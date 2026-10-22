import { instant } from '../clock'
import { homeSettings } from '../homes'
import { charge } from '../reservations/finance'
import { collectionPlans,saveCollection } from './collection-store'
import type { Booking,Context } from '../model'
export const collectionBasis=(b:Booking)=>({start:b.start,end:b.end,email:(b.guestEmail??'').trim().toLowerCase(),totalCents:charge(b),propertyId:b.propertyId,policy:JSON.stringify(b.lifecycle?.policy??null),arrivalTime:b.arrivalTime??''})
export function collectionDue(c:Pick<Context,'data'>,b:Booking,days:number|null,created:string){
 if(days===null)return created
 const settings=homeSettings(c,b.propertyId),date=new Date(Date.parse(b.start.slice(0,10)+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)
 return new Date(instant(date+'T'+(b.arrivalTime??settings.checkInTime),settings.timeZone)).toISOString()
}
/** Reservation edits and schedule changes commit together, before any scheduler can claim new work. */
export async function syncCollections(c:Context){
 for(const p of c.data.collectionPlans){
  const b=c.data.bookings.find(b=>b.id===p.bookingId),basis=b?collectionBasis(b):null
  if(!b||b.cancelled||b.status!=='confirmed'||b.guestErasedAt||b.restorePaused){
   if(p.status==='cancelled'&&!b?.guestErasedAt)continue
   p.status='cancelled';delete p.paymentMethod;delete p.setup
   for(const j of p.jobs)if(['scheduled','failed'].includes(j.status)){j.status='suppressed';j.detail='Reservation ended, erased or restored; future collection stopped.'}
   if(b?.guestErasedAt){delete p.consent;delete p.customerId;p.basis.email='';p.history=[];for(const j of p.jobs)delete j.detail}
   p.history.push({at:c.now,detail:'Future collection suppressed; uncertain provider effects still require reconciliation.'});saveCollection(c,p)
  }else if(JSON.stringify(basis)!==JSON.stringify(p.basis)){
   p.status='consent_required';p.basis=basis!;p.propertyId=b.propertyId;p.policy=b.lifecycle?.policy.name??p.policy;delete p.consent;delete p.setup;delete p.paymentMethod;if(!p.jobs.some(j=>['uncertain','pending'].includes(j.status)))delete p.customerId
   for(const j of p.jobs)if(['scheduled','failed'].includes(j.status)){
    j.dueAt=collectionDue(c,b,j.leadDays,p.createdAt);j.detail='Stay changed; guest must approve the revised schedule before collection.'
   }
   p.history.push({at:c.now,detail:'Reservation changed; due times recalculated in the home time zone. Exact guest re-consent required.'});saveCollection(c,p)
  }
 }
}
