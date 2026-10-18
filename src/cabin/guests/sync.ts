import { newId, type Context } from '../model'
import type { GuestData, GuestProfile } from './types'
import { guestRoot } from './resolve'
/** Each stay starts with its own origin even when another stay has identical contact details. */
export function syncGuests(c:Context) {
 const data=c.data as typeof c.data & GuestData
 for(const booking of data.bookings){
  if((booking.kind??'stay')!=='stay'||booking.guestErasedAt)continue
  let profile=data.guests.find(g=>g.bookingId===booking.id)
  if(!profile){profile={id:newId(),revision:newId(),bookingId:booking.id,createdAt:c.now,identities:[],facts:[],consents:[]};data.guests.push(profile)}
  const source=booking.source==='migration'?'Imported reservation':booking.channel==='direct'?'Direct reservation':`${booking.channel} reservation`
  const facts:[GuestProfile['identities'][number]['kind'],string|undefined][]=[['name',booking.guestName],['email',booking.guestEmail],['phone',booking.guestPhone],['channel',`${booking.channel}:${booking.channelRef??booking.uid}`]]
  for(const [kind,value]of facts)if(value&&!profile.identities.some(i=>i.kind===kind&&i.value===value)){profile.identities.push({id:newId(),kind,value,bookingId:booking.id,source,at:c.now});profile.revision=newId()}
 }
 // Confirmation of an offer follows the exact previously reviewed guest identity.
 for(const offer of data.guestOffers.filter(o=>o.status==='redeemed'&&o.redeemedBookingId)){
  const profile=data.guests.find(g=>g.bookingId===offer.redeemedBookingId),root=guestRoot(data,offer.guestId)
  if(profile&&root&&profile.id!==root.id&&!profile.mergedInto&&!data.guestMerges.some(m=>m.fromId===profile.id&&m.reviewedBy===`offer:${offer.id}`)){profile.mergedInto=root.id;profile.revision=newId();data.guestMerges.push({id:newId(),revision:newId(),fromId:profile.id,intoId:root.id,reason:'Guest accepted their private returning-guest offer with the verified contact and saved name.',reviewedBy:`offer:${offer.id}`,at:c.now,status:'active'})}
 }
}
