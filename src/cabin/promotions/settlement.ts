import { type Context,need,newId,sha } from '../model'
import { post,contextJournals } from '../ledger/store'
import { debit as dr,credit as cr,type Leg } from '../ledger/types'
import type { Payout } from '../finance/types'
import { splitCents } from '../finance/allocation-calculation'
import { lifecycle } from '../reservations/history'
import { stays,saveStay } from '../direct/store'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { eligible,applyTarget } from './eligibility'
import { releaseHold } from './inventory'
import type { PromotionBooking,PromotionOffer } from './types'
import { offers,promotionRows } from './store'

async function journal(c:Context,o:PromotionOffer,suffix:string,lines:Leg[],ownerKey?:string){
 return post(c,{sourceKey:`promotion:${o.id}:${suffix}`,propertyId:o.propertyId,bookingId:o.bookingId,effectiveDate:c.now.slice(0,10),sourceType:'promotion-'+suffix,sourceId:o.id,sourceRevision:o.id,lines,ownerKey})
}
async function paymentLedger(c:Context,o:PromotionOffer,direct:boolean){
 await journal(c,o,'payment',[dr('processorFunds',o.amountCents),cr(direct?'allocationClearing':'receivable',o.amountCents)])
 if(!direct)await journal(c,o,'earned',[dr('advances',o.amountCents),cr('allocationClearing',o.amountCents)])
 for(const [i,p] of o.parts.entries())await journal(c,o,'owner-'+i,[dr('allocationClearing',p.grossCents),...(p.taxCents?[cr('taxes',p.taxCents)]:[]),...(p.managementFeeCents?[cr('managerRevenue',p.managementFeeCents)]:[]),...(p.reserveCents?[cr('ownerReserves',p.reserveCents)]:[]),...(p.expenseCents?[cr('vendorPayable',p.expenseCents)]:[]),...(p.payableCents?[cr('ownerLiability',p.payableCents)]:[])],await sha(p.ownerEmail.toLowerCase()))
}
export async function unappliedPayment(c:Context,o:PromotionOffer){await journal(c,o,'unapplied',[dr('processorFunds',o.amountCents),cr('guestCredits',o.amountCents)])}
/** Reservation finance reverses a reduced contractual charge. A separately earned and paid supplement must not reverse the original stay's receivable as well. */
export async function contractRefundBridge(c:Context,o:PromotionOffer){
 if(!o.refund?.amountCents||!o.appliedAt)return
 const d=(await stays(c.db)).find(s=>s.bookingId===o.bookingId);if(d?.paymentId)return
 await journal(c,o,'cancel-charge',[dr('receivable',o.refund.amountCents),cr('advances',o.refund.amountCents)])
}
async function directDates(c:Context,b:PromotionBooking){
 const d=(await stays(c.db)).find(s=>s.bookingId===b.id);if(!d)return
 const s=homeSettings(c,b.propertyId);d.start=b.start;d.end=b.end
 d.arrivalAt=new Date(instant(`${b.start}T${b.arrivalTime??s.checkInTime}`,s.timeZone)).toISOString()
 d.departureAt=new Date(instant(`${b.end}T${b.departureTime??s.checkOutTime}`,s.timeZone)).toISOString()
 d.depositDueAt=new Date(Date.parse(d.arrivalAt)-48*3600000).toISOString();saveStay(c,d)
}
/** The immutable original payment quote stays intact; the existing reservation price includes this separately receipted supplement. */
export async function applyPromotion(c:Context,o:PromotionOffer){
 const {b,direct}=await eligible(c,o),l=lifecycle(b);need(l.price,'Original reservation price is unavailable',409)
 if(b.source==='feed'){
  l.sourceReview=true;l.sourceOrigin??={propertyId:b.propertyId,channel:b.channel,uid:b.uid,connectionId:b.connectionId,snapshot:{start:b.start,end:b.end,summary:b.summary}}
 }
 releaseHold(c,o);applyTarget(b,o)
 const amount=o.baseCents-o.discountCents;l.price.rentCents+=o.kind==='gap'?amount:0;l.price.feesCents+=o.kind==='gap'?0:amount;l.price.taxCents+=o.taxCents;l.price.totalCents+=o.amountCents
 b.revision=newId();b.approvedAt=c.now;(b.promotionIds??=[]).push(o.id)
 await directDates(c,b);await paymentLedger(c,o,!!direct?.paymentId)
 if(o.kind==='extra')c.data.tasks.push({id:newId(),revision:newId(),propertyId:o.propertyId,turnoverId:null,title:o.title,note:`Paid guest extra · offer ${o.id} · quantity ${o.quantity}. ${o.terms}`,blocking:false,assigneeId:homeSettings(c,o.propertyId).maintenanceId,status:'open',photos:[],raisedBy:c.actor.id,raisedByName:'Guest offer acceptance',raisedAt:c.now,closedBy:null,closedAt:null,closeNote:'',closePhotos:[],notified:null})
 o.status='applied';o.appliedAt=c.now;o.appliedBookingRevision=b.revision
 receipt(c,o,'Paid supplemental offer',`${o.terms}\nPayment received: USD ${(o.amountCents/100).toFixed(2)}. Reference ${o.paymentId}. Your original stay has been updated.`)
}
export async function restoreOriginal(c:Context,o:PromotionOffer){
 const b=c.data.bookings.find(b=>b.id===o.bookingId) as PromotionBooking|undefined
 need(b&&b.status==='confirmed'&&b.promotionIds?.at(-1)===o.id,'Cancel the later accepted stay offers first, then settle this one.',409)
 need(b.start===o.target.start&&b.end===o.target.end&&b.arrivalTime===o.target.arrivalTime&&b.departureTime===o.target.departureTime,'The current stay differs from the signed offer. Review its linked reservation before settlement.',409)
 need(b.lifecycle?.price,'Original price unavailable',409)
 Object.assign(b,o.original);if(!o.original.arrivalTime)delete b.arrivalTime;if(!o.original.departureTime)delete b.departureTime
 const price=b.lifecycle.price,amount=o.baseCents-o.discountCents
 price.rentCents-=o.kind==='gap'?amount:0;price.feesCents-=o.kind==='gap'?0:amount;price.taxCents-=o.taxCents;price.totalCents-=o.amountCents
 b.promotionIds=b.promotionIds?.filter(id=>id!==o.id);b.revision=newId();b.approvedAt=c.now;await directDates(c,b)
 o.revertedAt=c.now
 for(const task of c.data.tasks.filter(t=>t.note.includes('offer '+o.id)&&t.status==='open')){task.status='closed';task.closeNote='Guest cancelled the paid extra';task.closedAt=c.now;task.closedBy=c.actor.id;task.revision=newId()}
}
export async function refundLedger(c:Context,o:PromotionOffer){
 const r=o.refund!;if(!r.amountCents)return
 // Keep each original owner scope, and allocate the partial refund by largest remainder over actual credited accounts.
 const rows=(await contextJournals(c)).filter(j=>j.sourceId===o.id&&j.sourceType.startsWith('promotion-owner-'))
 if(!rows.length){await journal(c,o,'refund-unapplied',[dr('guestCredits',r.amountCents),cr('processorFunds',r.amountCents)]);receipt(c,o,'Supplement refund',`Refund confirmed: USD ${(r.amountCents/100).toFixed(2)}. ${r.reason}. Reference ${r.providerId}.`);return}
 const credits=rows.flatMap(j=>j.lines.filter(l=>l.creditCents>0).map(l=>{const product=BigInt(l.creditCents)*BigInt(r.amountCents),denominator=BigInt(o.amountCents);return {j,l,value:Number(product/denominator),remainder:Number(product%denominator)}}))
 const remainder=r.amountCents-credits.reduce((n,p)=>n+p.value,0);[...credits].sort((a,b)=>b.remainder-a.remainder).slice(0,remainder).forEach(p=>p.value++)
 for(const [i,j] of rows.entries()){
  const parts=credits.filter(p=>p.j.id===j.id&&p.value),total=parts.reduce((n,p)=>n+p.value,0);if(!total)continue
  await journal(c,o,'refund-owner-'+i,[...parts.map(p=>dr(p.l.account,p.value)),cr('processorFunds',total)],j.ownerKey)
 }
 need(credits.reduce((n,p)=>n+p.value,0)===r.amountCents,'Original allocation cannot reconcile this refund',409)
 receipt(c,o,'Supplement refund',`Refund confirmed: USD ${(r.amountCents/100).toFixed(2)}. Retained under the accepted policy: USD ${(r.retainedCents/100).toFixed(2)}. ${r.reason}. Reference ${r.providerId}.`)
}
export function receipt(c:Context,o:PromotionOffer,subject:string,text:string){
 if(!o.email)return
 c.data.messages.push({id:newId(),revision:newId(),propertyId:o.propertyId,bookingId:o.bookingId,email:o.email,phone:null,ref:null,channel:'email',direction:'out',source:'host',status:'pending',subject,text,detail:null,replyTo:null,headerId:null,sentBy:c.actor.id,approvalId:null,scheduledId:null,providerId:null,grounds:['Processor-verified promotion '+o.id],createdAt:c.now,sentAt:null})
}
/** Added to the original reservation balance; refunded supplements cease to be receipts by their confirmed refund amount. */
export async function promotionPaidCents(db:D1Database,bookingId:string){
 const rows=(await db.prepare("SELECT data FROM cb_records WHERE kind='promotionOffers' AND json_extract(data,'$.bookingId')=?").bind(bookingId).all<{data:string}>()).results.map(r=>JSON.parse(r.data) as PromotionOffer)
 return rows.reduce((n,o)=>n+(o.paymentId?o.amountCents:0)-(o.refund?.status==='succeeded'?o.refund.amountCents:0),0)
}
export async function promotionPayments(db:D1Database){return (await promotionRows<PromotionOffer>(db,'promotionOffers')).filter(o=>o.paymentId).map(o=>({paymentId:o.paymentId,bookingId:o.bookingId,promotion:true as const}))}
/** Actual payout evidence moves processor funds into cash, and actual fees follow the already frozen supplement owners. */
export async function promotionPayout(c:Context,p:Payout){
 const o=p.paymentId&&(await offers(c)).find(o=>o.paymentId===p.paymentId&&o.bookingId===p.bookingId);if(!o)return false
 const leg=(account:Leg['account'],n:number,debit:boolean)=>n===0?[]:[n>0===debit?dr(account,Math.abs(n)):cr(account,Math.abs(n))]
 await post(c,{sourceKey:'payout:'+p.id,propertyId:o.propertyId,bookingId:o.bookingId,effectiveDate:c.now.slice(0,10),sourceType:'payout',sourceId:p.id,sourceRevision:p.revision,lines:[...leg('cash',p.netCents,true),...leg('channelFees',p.feeCents,true),...leg('processorFunds',p.grossCents,false)]})
 const fees=splitCents(p.feeCents,o.parts.map(part=>part.shareBps))
 for(const [i,part] of o.parts.entries())if(fees[i])await post(c,{sourceKey:`promotion:${o.id}:payout-fee:${p.id}:${i}`,propertyId:o.propertyId,bookingId:o.bookingId,effectiveDate:c.now.slice(0,10),sourceType:'promotion-processor-fee',sourceId:p.id,sourceRevision:p.revision,ownerKey:await sha(part.ownerEmail.toLowerCase()),lines:[...leg('ownerLiability',fees[i],true),...leg('channelFees',fees[i],false)]})
 return true
}
