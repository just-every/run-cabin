import { instant } from '../clock'
import { homeSettings } from '../homes'
import { charge } from '../reservations/finance'
import { saveCollection } from './collection-store'
import { need,type Booking,type Context } from '../model'
export const collectionBasis=(b:Booking)=>({start:b.start,end:b.end,email:(b.guestEmail??'').trim().toLowerCase(),totalCents:charge(b),propertyId:b.propertyId,policy:JSON.stringify(b.lifecycle?.policy??null),arrivalTime:b.arrivalTime??''})
export function collectionDue(c:Pick<Context,'data'>,b:Booking,days:number|null,created:string){
 if(days===null)return created
 const settings=homeSettings(c,b.propertyId),date=new Date(Date.parse(b.start.slice(0,10)+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)
 return new Date(instant(date+'T'+(b.arrivalTime??settings.checkInTime),settings.timeZone)).toISOString()
}
/** Reservation edits and schedule changes commit together, before any scheduler can claim new work. */
export async function syncCollections(c:Context,name:string){
 for(const p of c.data.collectionPlans){
  const b=c.data.bookings.find(b=>b.id===p.bookingId),basis=b?collectionBasis(b):null
  if(!b||b.cancelled||b.status!=='confirmed'||b.guestErasedAt||b.restorePaused){
   if(p.status==='cancelled'&&!b?.guestErasedAt)continue
   p.status='cancelled';delete p.paymentMethod;delete p.setup
   for(const j of p.jobs)if(['scheduled','failed'].includes(j.status)){j.status='suppressed';j.detail='Reservation ended, erased or restored; future collection stopped.'}
   if(b?.guestErasedAt){delete p.consent;delete p.customerId;p.basis.email='';p.history=[];for(const j of p.jobs)delete j.detail}
   p.history.push({at:c.now,detail:'Future collection suppressed; uncertain provider effects still require reconciliation.'});saveCollection(c,p)
  }else if(JSON.stringify(basis)!==JSON.stringify(p.basis)){
   need(!p.jobs.some(j=>['uncertain','pending'].includes(j.status)),'Reconcile started collection effects before changing reservation terms',409)
   const next=basis!,old=p.basis,unpaid=p.jobs.filter(j=>['scheduled','failed'].includes(j.status))
   // An exception may never increase a charge, bring it forward, or silently change its policy, home or verification channel.
   const favorable=['reservation.amend','reservation.move','booking.details'].includes(name)&&!c.actor.isAgent&&next.email===old.email&&next.propertyId===old.propertyId&&next.policy===old.policy&&next.totalCents<=old.totalCents&&next.start>=old.start&&next.end>=old.end&&unpaid.every(j=>collectionDue(c,b,j.leadDays,p.createdAt)>=j.dueAt)
   if(favorable){
    let reduction=old.totalCents-next.totalCents
    for(const j of [...unpaid].reverse()){
     const less=Math.min(reduction,j.amountCents);j.amountCents-=less;reduction-=less
     if(!j.amountCents){j.status='suppressed';j.detail='Host reduced the amount to zero; prior attempts and follow-up retained.'}
    }
   }else{
    p.status='consent_required';delete p.consent;delete p.setup;delete p.paymentMethod
    if(!p.jobs.some(j=>['uncertain','pending'].includes(j.status)))delete p.customerId
   }
   p.basis=next;p.propertyId=b.propertyId;p.policy=b.lifecycle?.policy.name??p.policy
   for(const j of unpaid){
    j.dueAt=collectionDue(c,b,j.leadDays,p.createdAt)
    if(j.status==='scheduled')j.detail=favorable?'Host reduced or deferred this payment; the existing guest mandate remains valid.':'Stay changed; guest must approve the revised schedule before collection.'
   }
   p.history.push({at:c.now,detail:favorable?'Host changed terms only in the guest’s favour; amounts never increase and due times never advance. Existing consent retained.':'Reservation changed; due times recalculated in the home time zone. Exact verified guest re-consent required.'});saveCollection(c,p)
  }
 }
}
