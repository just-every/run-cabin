import { type Booking, type Context, integer, need } from '../model'
import { modelFor,percent,splitCents } from '../finance/allocation-calculation'
import { allocationTerms } from '../properties/terms'
import { contextJournals, journals, post } from '../ledger/store'
import { debit,credit } from '../ledger/types'
import type { ReservationPrice, CancellationPolicy } from './types'
export function price(input:Record<string,unknown>):ReservationPrice {
 const read=(k:string)=>{const dollars=input[k.replace('Cents','Dollars')];if(dollars===undefined)return integer(Number(input[k]??0),k,0,100_000_000);need(/^\d+(?:\.\d{1,2})?$/.test(String(dollars)),'Enter USD with at most two decimal places');return integer(Math.round(Number(dollars)*100),k,0,100_000_000)}
 const rentCents=read('rentCents'),feesCents=read('feesCents'),taxCents=read('taxCents'),totalCents=rentCents+feesCents+taxCents
 need(Number.isSafeInteger(totalCents)&&totalCents<=100_000_000,'Reservation total is too large')
 return {rentCents,feesCents,taxCents,totalCents}
}
export function policy(input:Record<string,unknown>):CancellationPolicy {
 const name=String(input.policyName??'').trim();need(name&&name.length<=300,'Describe the saved cancellation policy')
 const freeUntil=input.freeUntil?String(input.freeUntil):null
 need(!freeUntil||/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/.test(freeUntil)&&Number.isFinite(Date.parse(freeUntil)),'Use an exact UTC cancellation deadline')
 const percent=(key:string)=>{const value=input[key.replace('Bps','Percent')];if(value===undefined)return Number(input[key]??0);need(/^\d+(?:\.\d{1,2})?$/.test(String(value)),'Enter a percentage with at most two decimal places');return Math.round(Number(value)*100)}
 return {known:true,name,freeUntil,retainedBps:integer(percent('retainedBps'),'cancellation basis points',0,10000),noShowBps:integer(percent('noShowBps'),'no-show basis points',0,10000)}
}
export const charge=(b:Booking)=>b.lifecycle?.settledChargeCents??b.lifecycle?.price?.totalCents??0
export { paymentBalance } from './balances'
/** Contractual receivables are not receipts. Changes post only their delta; cash is never invented. */
export async function syncReservationFinance(c:Context){
 for(const b of c.data.bookings){
  const l=b.lifecycle;if(!l?.price)continue
  const terms=allocationTerms(c.data,b),model=modelFor(terms),gross=charge(b),tax=l.outcome?0:l.price.taxCents,base=model.commissionBase==='receipts'?gross-tax:l.outcome?gross:l.price.rentCents,commission=gross?percent(base,terms.commissionBps)+model.fixedFeeCents:0,net=gross-commission-tax,reserve=percent(Math.max(0,net),model.reserveBps),parts=splitCents(net-reserve,model.owners.map(o=>o.bps))
  l.allocation={agreementId:terms.id,grossCents:gross,commissionCents:commission,ownerCents:net-reserve,reserveCents:reserve,owners:model.owners.map((o,i)=>({name:o.name,amountCents:parts[i]}))}
  const old=c.before.bookings.find(o=>o.id===b.id),direct=await c.db.prepare("SELECT data FROM cb_direct_stays WHERE json_extract(data,'$.bookingId')=?").bind(b.id).first<{data:string}>(),d=direct?JSON.parse(direct.data):null,previous=old?.lifecycle?.price?charge(old):d?.paymentId?d.quote.totalCents:0,delta=gross-previous
  const transferred=old&&old.propertyId!==b.propertyId
  // Paid direct stays recognize provider funds and actual refunds in their own settlement journals.
  if(d?.paymentId)continue
  if((!delta&&!transferred)||!c.data.ledgerSettings.some(s=>s.propertyId===b.propertyId))continue
  const amount=transferred?gross:Math.abs(delta)
  if(transferred)for(const original of (await contextJournals(c)).filter(j=>j.bookingId===b.id&&j.propertyId===old.propertyId&&j.sourceType==='reservation-charge'&&!j.reversalOf)){
   if((await contextJournals(c)).some(j=>j.reversalOf===original.id))continue
   await post(c,{...original,sourceKey:`reservation-transfer:${original.id}:${b.revision}`,sourceType:'reservation-transfer',sourceRevision:b.revision,reversalOf:original.id,effectiveDate:c.now.slice(0,10),lines:original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents}))})
  }
  if(!amount)continue
  await post(c,{sourceKey:`reservation:${b.id}:${b.revision}`,propertyId:b.propertyId,bookingId:b.id,effectiveDate:c.now.slice(0,10),sourceType:'reservation-charge',sourceId:b.id,sourceRevision:b.revision,lines:delta>0||transferred?[debit('receivable',amount),credit('advances',amount)]:[debit('advances',amount),credit('receivable',amount)]})
 }
}
