import { type Context,need } from '../model'
import { contextJournals,post } from '../ledger/store'
import { debit as dr,credit as cr,type Leg } from '../ledger/types'
import { taxData } from '../taxes/store'
import { sourceCommand } from '../taxes/sources'
import type { TaxData,TaxLine } from '../taxes/types'
import type { DirectStay } from './types'
import type { Refund } from './refund-types'
export async function directJournal(c:Context,s:DirectStay,key:string,sourceType:string,lines:Leg[]){
 const original=(await contextJournals(c)).find(j=>j.sourceKey==='direct-payment:'+s.paymentId)
 return post(c,{sourceKey:key,propertyId:s.propertyId,bookingId:s.bookingId,...(original?{ownerKey:original.ownerKey,legalEntity:original.legalEntity}:{}),effectiveDate:c.now.slice(0,10),sourceType,sourceId:key,sourceRevision:key,lines})
}
/** Processor funds are an asset, not a bank receipt. The payout later transfers them into trust cash. */
export async function paymentLedger(c:Context,s:DirectStay){
 if(!s.paymentId||!c.data.ledgerSettings.some(l=>l.propertyId===s.propertyId))return
 const journals=await contextJournals(c),key='direct-payment:'+s.paymentId;if(journals.some(j=>j.sourceKey===key))return
 const tax=s.quote.taxes.reduce((n,t)=>n+t.amountCents,0),taxSource=(await taxData(c.db)).sources.some(r=>r.bookingId===s.bookingId&&r.reference==='stripe:'+s.paymentId)
 const paidOut=c.data.payouts.filter(p=>p.bookingId===s.bookingId&&p.source==='stripe').some(p=>journals.some(j=>j.sourceKey==='payout:'+p.id))
 // Legacy payouts already credited the owner with the tax-inclusive gross. Reclassify only that tax.
 const lines=paidOut?(tax?[dr('ownerLiability',tax),cr(taxSource?'receivable':'taxes',tax)]:[]):[dr('processorFunds',s.quote.totalCents),cr('ownerLiability',s.quote.totalCents-tax),...(tax?[cr(taxSource?'receivable':'taxes',tax)]:[])]
 if(lines.length)await directJournal(c,s,key,'direct-payment',lines)
}
export async function depositLedger(c:Context,s:DirectStay){
 if(!c.data.ledgerSettings.some(l=>l.propertyId===s.propertyId)||!s.deposit)return
 const d=s.deposit
 if(['requires_capture','succeeded','canceled'].includes(d.status))await directJournal(c,s,'direct-hold:'+d.id,'direct-hold',[dr('damageAuthorization',d.amountCents),cr('damageHolds',d.amountCents)])
 if(['succeeded','canceled'].includes(d.status))await directJournal(c,s,'direct-hold-close:'+d.id,'direct-hold-release',[dr('damageHolds',d.amountCents),cr('damageAuthorization',d.amountCents)])
 if(d.status==='succeeded'&&d.capturedCents)await directJournal(c,s,'direct-damage:'+d.id,'direct-damage',[dr('processorFunds',d.capturedCents),cr('ownerLiability',d.capturedCents)])
}
export async function refundLedger(c:Context,s:DirectStay,r:Refund){
 await paymentLedger(c,s);await depositLedger(c,s)
 const tax=r.amounts.taxes.reduce((n,t)=>n+t.amountCents,0),base=r.amounts.totalCents-tax
 await directJournal(c,s,'direct-refund:'+r.id,'direct-refund',[...(base?[dr('ownerLiability',base)]:[]),...(tax?[dr('taxes',tax)]:[]),cr('processorFunds',r.amounts.totalCents)])
 await refundTaxLines(c,s,r,await taxData(c.db))
}
/** When a monthly source exists, retain exact original levy links, without posting its liability twice. */
export async function refundTaxLines(c:Context,s:DirectStay,r:Refund,data:TaxData){
 const source=data.sources.find(x=>x.bookingId===s.bookingId&&x.reference==='stripe:'+s.paymentId);if(!source)return
 for(const tax of r.amounts.taxes){
  const originals=data.lines.filter(l=>l.sourceId===source.id&&!l.originalLineId&&l.level===tax.jurisdiction)
  let remaining=tax.amountCents,baseRemaining=r.amounts.rentCents+r.amounts.feesCents
  if(!remaining&&!baseRemaining)continue
  need(originals.length,'The original tax source is missing this refunded levy. Review its source before settlement.',409)
  const available=originals.map(l=>({line:l,tax:l.taxCents+data.lines.filter(a=>a.originalLineId===l.id).reduce((n,a)=>n+a.taxCents,0),base:l.baseCents+data.lines.filter(a=>a.originalLineId===l.id).reduce((n,a)=>n+a.baseCents,0)}))
  for(const {line,tax:taxLeft,base:baseLeft} of available){
   const reference=`stripe-refund:${r.providerId}:${line.id}`
   const old=data.lines.find(l=>l.sourceReference===reference);if(old){remaining+=old.taxCents;baseRemaining+=old.baseCents;continue}
   const taxAmount=Math.min(remaining,taxLeft),base=Math.min(baseRemaining,baseLeft);if(!taxAmount&&!base)continue
   const result=await sourceCommand(c,data,'tax.adjust',{lineId:line.id,taxCents:taxAmount,channelCents:0,baseCents:base,exemptCents:0,reference,effectiveDate:c.now.slice(0,10),reason:r.reason+'; '+r.evidence,confirm:'yes'}) as TaxLine
   data.lines.push(result);remaining-=taxAmount;baseRemaining-=base
   if(taxAmount)await directJournal(c,s,'direct-tax-refund-bridge:'+result.id,'direct-tax-allocation',[dr('receivable',taxAmount),cr('taxes',taxAmount)])
  }
  need(remaining===0&&baseRemaining===0,'Tax adjustments already exhaust the original receipt. Reconcile the earlier adjustment before settlement.',409)
 }
}
