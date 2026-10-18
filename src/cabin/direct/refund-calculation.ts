import { need,sha,type Booking,type Context } from '../model'
import type { DirectStay } from './types'
import type { Refund,RefundAmounts } from './refund-types'
export const unsettled=(s:DirectStay)=>(s.refunds??[]).some(r=>['requested','uncertain','pending'].includes(r.status))
export const refunded=(s:DirectStay)=>(s.refunds??[]).filter(r=>r.status==='succeeded'&&r.kind!=='deposit').reduce((n,r)=>n+r.amounts.totalCents,0)
export function remaining(s:DirectStay):RefundAmounts{
 const a:RefundAmounts={rentCents:s.quote.rentCents,feesCents:s.quote.cleaningCents+s.quote.extraGuestCents,depositCents:s.deposit?.capturedCents??0,taxes:s.quote.taxes.map(t=>({jurisdiction:t.jurisdiction,label:t.label,amountCents:t.amountCents})),totalCents:0}
 for(const r of s.refunds??[])if(r.status==='succeeded'){
  a.rentCents-=r.amounts.rentCents;a.feesCents-=r.amounts.feesCents;a.depositCents-=r.amounts.depositCents
  for(const t of a.taxes)t.amountCents-=r.amounts.taxes.find(x=>x.jurisdiction===t.jurisdiction)?.amountCents??0
 }
 a.totalCents=a.rentCents+a.feesCents+a.taxes.reduce((n,t)=>n+t.amountCents,0);return a
}
export async function refundBasis(c:Context,s:DirectStay,b:Booking){
 return sha(JSON.stringify({booking:b,quote:s.quote,email:s.email,propertyId:s.propertyId,payment:s.paymentId,deposit:s.deposit,refunds:(s.refunds??[]).filter(r=>r.status!=='draft'&&r.status!=='cancelled'),ledger:c.data.ledgerSettings.find(l=>l.propertyId===s.propertyId)}))
}
export function calculateRefund(s:DirectStay,b:Booking,kind:Refund['kind'],amount?:number):{amounts:RefundAmounts;terms:string}{
 const left=remaining(s),a:RefundAmounts={rentCents:0,feesCents:0,depositCents:0,taxes:left.taxes.map(t=>({...t,amountCents:0})),totalCents:0}
 let terms='Original signed quote; taxes refunded proportionally to the returned taxable rent and fees.'
 if(kind==='deposit'){
  need(s.deposit?.status==='succeeded'&&left.depositCents>0,'No captured refundable damage money is available. An authorization is released, not refunded.',409)
  need(amount&&amount<=left.depositCents,'Choose an amount within the remaining captured damage payment');a.depositCents=amount;terms='Refund of captured damage money, separate from rent and lodging tax.'
 }else if(kind==='full'){a.rentCents=left.rentCents;a.feesCents=left.feesCents;a.taxes=left.taxes.map(t=>({...t}))}
 else if(kind==='rent'){
  need(amount&&amount<=left.rentCents,'Choose a rent refund within the remaining paid rent');a.rentCents=amount
 }else{
  const l=b.lifecycle;need(l?.price&&l.policy.known!==false,'Save and review the reservation’s changed price or cancellation terms first',409)
  const target=l.settledChargeCents??l.price.totalCents,refund=Math.max(0,left.totalCents-target)
  need(refund>0,'The saved terms do not leave a refundable overpayment. Any additional balance remains due.',409)
  if(l.outcome){
   // The saved policy states the total cancellation charge. Return tax first; the retained charge is assigned to rent/fees.
   const tax=Math.min(refund,left.taxes.reduce((n,t)=>n+t.amountCents,0));let restTax=tax
   a.taxes=left.taxes.map((t,i)=>{const value=i===left.taxes.length-1?restTax:Math.floor(tax*t.amountCents/Math.max(1,left.taxes.reduce((n,x)=>n+x.amountCents,0)));restTax-=value;return {...t,amountCents:value}})
   const base=refund-tax;a.rentCents=Math.min(left.rentCents,base);a.feesCents=base-a.rentCents
   terms=`${l.policy.name}; saved ${l.outcome} charge USD ${(target/100).toFixed(2)}. ${l.cancellationReason??''}`
  }else{
   a.rentCents=Math.max(0,left.rentCents-l.price.rentCents);a.feesCents=Math.max(0,left.feesCents-l.price.feesCents)
   const tax=Math.max(0,left.taxes.reduce((n,t)=>n+t.amountCents,0)-l.price.taxCents);let rest=tax
   a.taxes=left.taxes.map((t,i)=>{const value=i===left.taxes.length-1?rest:Math.floor(tax*t.amountCents/Math.max(1,left.taxes.reduce((n,x)=>n+x.amountCents,0)));rest-=value;return {...t,amountCents:value}})
   need(a.rentCents+a.feesCents+tax===refund,'This amendment moves money between charge categories. Save a price with separately refundable rent, fees and tax before settlement.',409)
   terms=`Saved amendment ${b.revision}; retained reservation price USD ${(target/100).toFixed(2)}.`
  }
 }
 if(kind==='rent'){
  const originalBase=s.quote.rentCents+s.quote.cleaningCents+s.quote.extraGuestCents,returnedBase=originalBase-left.rentCents-left.feesCents+a.rentCents
  a.taxes=left.taxes.map((t,i)=>({...t,amountCents:Math.max(0,Math.min(t.amountCents,Math.round(s.quote.taxes[i].amountCents*returnedBase/originalBase)-(s.quote.taxes[i].amountCents-t.amountCents)))}))
 }
 a.totalCents=a.rentCents+a.feesCents+a.depositCents+a.taxes.reduce((n,t)=>n+t.amountCents,0)
 need(a.totalCents>0&&[a.rentCents,a.feesCents,a.depositCents,...a.taxes.map(t=>t.amountCents)].every(n=>Number.isSafeInteger(n)&&n>=0),'No refundable payment remains',409)
 return {amounts:a,terms}
}
