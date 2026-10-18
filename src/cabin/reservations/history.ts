import { stays } from '../direct/store'
import { type Booking, type Context, newId, need } from '../model'
import type { ReservationLifecycle, ReservationVersion } from './types'
export const originalPolicy = () => ({known:false,name:'Cancellation terms need source review',freeUntil:null,retainedBps:0,noShowBps:0})
export function lifecycle(b:Booking):ReservationLifecycle {
 return b.lifecycle ??= {method:b.channel==='direct'?'manual':'channel',sourceId:b.channelRef??b.uid,policy:originalPolicy(),history:[],events:[]}
}
function version(b:Booking):Omit<ReservationVersion,'at'|'by'|'reason'> {
 const l=lifecycle(b)
 return {revision:b.revision,propertyId:b.propertyId,start:b.start,end:b.end,guestName:b.guestName??b.summary,guestEmail:b.guestEmail,guestPhone:b.guestPhone,arrivalTime:b.arrivalTime,departureTime:b.departureTime,status:l.outcome??b.status,channel:b.channel,sourceId:l.sourceId,price:l.price,policy:l.policy,managementTerms:b.managementTerms}
}
/** Record actual semantic changes once, including imported amendments and cancellations. */
export async function recordReservations(c:Context,name:string) {
 const direct=await stays(c.db)
 for(const b of c.data.bookings){
  if((b.kind??'stay')!=='stay')continue
  const old=c.before.bookings.find(o=>o.id===b.id), l=lifecycle(b),d=direct.find(s=>s.bookingId===b.id)
  if(d&&!l.price){l.method='direct';l.sourceId=d.id;l.policy=d.quote.cancellationPolicy??originalPolicy();l.price={rentCents:d.quote.rentCents,feesCents:d.quote.cleaningCents+d.quote.extraGuestCents,taxCents:d.quote.taxes.reduce((n,t)=>n+t.amountCents,0),totalCents:d.quote.totalCents}}
  const current=version(b), prior=old?version(structuredClone(old)):null
  const comparable=(v:typeof current)=>JSON.stringify({...v,revision:undefined})
  if(prior&&comparable(prior)===comparable(current)){if(!old?.lifecycle)delete b.lifecycle;continue}
  need(!old||!c.before.messages.some(m=>m.bookingId===b.id&&m.status==='sending'),'A guest delivery is in flight. Reconcile its result before amending this reservation.',409)
  if(old)for(const m of c.data.messages){if(m.bookingId!==b.id||m.direction!=='out'||!c.before.messages.some(previous=>previous.id===m.id)||!['pending','draft'].includes(m.status))continue;m.status=b.status!=='confirmed'||m.source==='scheduled'?'discarded':'draft';m.detail='Reservation terms changed. Review this message before sending.';m.revision=newId();if(m.control){m.control.automatic=false;m.control.needsHost=true}}
  if(old&&old.revision===b.revision)b.revision=newId()
  if(!old&&l.history.some(v=>v.revision===b.revision))continue
  if(old&&!l.history.length)l.history.push({...prior!,at:old.approvedAt,by:'original-record',reason:'Original retained reservation'})
  l.history.push({...version(b),at:c.now,by:c.actor.id,reason:l.cancellationReason??name})
 }
}
