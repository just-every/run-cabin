import { type Context,newId,need } from '../model'
import { offers,savePromotion } from './store'
import type { PromotionOffer } from './types'
import { contractRefundBridge } from './settlement'

export function releaseHold(c:Context,o:PromotionOffer){
 const b=c.data.bookings.find(b=>b.id===o.holdId)
 if(b?.status==='confirmed')Object.assign(b,{status:'cancelled',cancelled:true,revision:newId()})
}
export function holdNights(c:Context,o:PromotionOffer){
 if(o.kind!=='gap'||o.holdId)return
 o.holdId=newId()
 c.data.bookings.push({id:o.holdId,revision:newId(),uid:'promotion:'+o.id,propertyId:o.propertyId,
  start:o.original.end,end:o.target.end,summary:'Private extension offer hold',kind:'block',channel:'direct',
  source:'request',status:'confirmed',cancelled:false,approvedAt:c.now})
}
export function refundDue(c:Context,o:PromotionOffer,reason:string){
 const retainedCents=Date.parse(c.now)<=Date.parse(o.refundDeadlineAt)?0:Math.round(o.amountCents*o.refundRetainedBps/10000)
 o.refund={amountCents:o.amountCents-retainedCents,retainedCents,reason,status:'due'};o.status='refund_due'
 releaseHold(c,o)
}
/** No provider call occurs inside a domain transaction. Open processor sessions keep their hold until their terminal outcome is read. */
export async function synchronizePromotions(c:Context,name=''){
 if(!name.startsWith('promotion.'))for(const b of c.data.bookings){const old=c.before.bookings.find(v=>v.id===b.id);if(!old||b.status!=='confirmed')continue;const active=(await offers(c)).filter(o=>o.bookingId===b.id&&o.status==='applied');if(!active.length)continue;const facts=(row:typeof b)=>JSON.stringify({propertyId:row.propertyId,start:row.start,end:row.end,guestName:row.guestName,guestEmail:row.guestEmail,arrivalTime:row.arrivalTime,departureTime:row.departureTime,price:row.lifecycle?.price});need(facts(b)===facts(old),'Cancel and settle the accepted stay offers before changing this reservation’s guest, dates, home or price.',409)}
 for(const o of await offers(c)){
  if(o.restorePaused)continue
  const b=c.data.bookings.find(b=>b.id===o.bookingId)
  if(b?.guestErasedAt&&(o.email||o.tokenSealed)){
   o.email='';o.tokenHash='';o.tokenSealed='';delete o.checkoutUrl;o.title='Retained supplemental payment';o.terms='Retained financial terms';o.error=undefined
   if(o.signature)o.signature={...o.signature,name:'Erased guest',terms:'Retained financial consent'}
   savePromotion(c,'promotionOffers',o)
  }
  const unavailable=!b||b.status!=='confirmed'||!!b.guestErasedAt||!!b.restorePaused
  if(['draft','sent'].includes(o.status)&&(unavailable||Date.parse(o.expiresAt)<=Date.parse(c.now)||b!.revision!==o.bookingRevision)){
   o.status=Date.parse(o.expiresAt)<=Date.parse(c.now)?'expired':'cancelled';releaseHold(c,o);savePromotion(c,'promotionOffers',o)
   const message=c.data.messages.find(m=>m.id===o.messageId);if(message&&['pending','draft'].includes(message.status)){message.status='discarded';message.revision=newId()}
  }else if(o.status==='checkout'&&(unavailable||b!.revision!==o.bookingRevision)&&!o.cancelReason){
   o.cancelReason='Original stay changed or ended; reconcile and close its processor checkout';savePromotion(c,'promotionOffers',o)
  }else if(o.status==='applied'&&b?.status==='cancelled'){refundDue(c,o,'Original reservation ended');await contractRefundBridge(c,o);savePromotion(c,'promotionOffers',o)}
 }
 // The supplement's accepted cancellation policy replaces the source policy for its own amount only.
 for(const b of c.data.bookings){
  const l=b.lifecycle;if(b.status!=='cancelled'||!l?.price||!l.outcome)continue
  const supplements=(await offers(c)).filter(o=>o.bookingId===b.id&&o.appliedAt&&!o.revertedAt&&o.refund)
  if(!supplements.length)continue
  const original=l.price.totalCents-supplements.reduce((n,o)=>n+o.amountCents,0)
  const bps=l.outcome==='no_show'?l.policy.noShowBps:l.policy.freeUntil&&Date.parse(c.now)<Date.parse(l.policy.freeUntil)?0:l.policy.retainedBps
  // Freeze the original cancellation decision; later passes must not move its deadline.
  const justEnded=c.before.bookings.find(old=>old.id===b.id)?.status==='confirmed'
  if(justEnded)l.settledChargeCents=Math.round(original*bps/10000)+supplements.reduce((n,o)=>n+o.refund!.retainedCents,0)
 }
}
