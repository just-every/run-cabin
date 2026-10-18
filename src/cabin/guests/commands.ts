import { manager, owner, need, text, exact, newId, property, type Context } from '../model'
import type { GuestData, GuestProfile } from './types'
import { guestRoot, guestBookings } from './resolve'
import { issueOffer } from './offers'
import { syncGuests } from './sync'
const yes=(value:unknown)=>value===true||value==='yes'||value==='on'
function profile(c:Context,input:Record<string,unknown>) {
 const p=(c.data as typeof c.data&GuestData).guests.find(g=>g.id===text(input.id,'guest ID')&&!g.erasedAt);need(p,'Guest not found',404);exact(p,input.revision);c.entityId=p.id;return p
}
function source(input:Record<string,unknown>){return text(input.source,'source of this fact or consent',400)}
export async function guestCommand(c:Context,name:string,input:Record<string,unknown>) {
 if(!name.startsWith('guest.'))return undefined
 manager(c.actor);syncGuests(c)
 const data=c.data as typeof c.data&GuestData
 if(name==='guest.sync')return {profiles:data.guests.length}
 if(name==='guest.policy'){
  const home=property(c,input.propertyId),old=data.guestPolicies.find(p=>p.propertyId===home.id);if(old)exact(old,input.revision)
  const next={id:old?.id??newId(),revision:newId(),propertyId:home.id,allowPreferences:yes(input.allowPreferences),allowRepeatOffers:yes(input.allowRepeatOffers)}
  if(old)Object.assign(old,next);else data.guestPolicies.push(next);c.entityId=next.id;return {id:next.id}
 }
 if(name==='guest.offer.revoke'){
  const offer=data.guestOffers.find(o=>o.id===text(input.id,'offer ID'));need(offer,'Offer not found',404);exact(offer,input.revision);need(offer.status==='issued','Only an unused offer can be revoked',409);offer.status='revoked';offer.revision=newId();c.entityId=offer.id;return {id:offer.id}
 }
 if(name==='guest.merge.undo'){
  const merge=data.guestMerges.find(m=>m.id===text(input.id,'merge ID'));need(merge&&merge.status==='active','Active merge not found',404);exact(merge,input.revision)
  const from=data.guests.find(g=>g.id===merge.fromId),into=data.guests.find(g=>g.id===merge.intoId);need(from&&!from.erasedAt&&into&&!into.erasedAt&&from.mergedInto===into.id,'This merge changed or its identity was erased',409)
  need(input.confirm==='yes','Confirm that you reviewed which reservation histories will separate')
  delete from.mergedInto;from.revision=newId();merge.status='undone';merge.revision=newId();merge.undoneAt=c.now;merge.undoneBy=c.actor.id;c.entityId=merge.id;return {id:merge.id}
 }
 const p=profile(c,input)
 if(name==='guest.message.link'){
  const booking=guestBookings(data,p.id).find(b=>b.id===text(input.bookingId,'reservation ID'));need(booking,'Choose a reservation belonging to this guest',404)
  const message=data.messages.find(m=>m.id===text(input.messageId,'message ID'));need(message&&!message.bookingId,'Choose an unmatched message',409);exact(message,input.messageRevision);need(input.confirm==='yes','Confirm that this message belongs to this guest and reservation')
  message.bookingId=booking.id;message.propertyId=booking.propertyId;message.revision=newId();c.entityId=message.id;return {id:message.id}
 }
 if(name==='guest.offer.issue')return issueOffer(c,input,'')
 if(name==='guest.identity.verify'){
  const identity=p.identities.find(i=>i.id===text(input.identityId,'identity ID'));need(identity&&['email','phone'].includes(identity.kind),'Choose an email or phone identity',404)
  need(input.confirm==='yes','Confirm you checked this contact belongs to the guest');identity.verified={by:c.actor.id,at:c.now,source:source(input)};p.revision=newId();return {id:p.id}
 }
 if(name==='guest.fact'){
  const kind=text(input.kind,'fact kind');need(['preference','service','note'].includes(kind),'Choose preference, service or private note');if(kind==='note')owner(c.actor)
  const propertyId=property(c,input.propertyId).id
  p.facts.push({id:newId(),kind:kind as 'preference'|'service'|'note',value:text(input.value,'guest fact',2000),propertyIds:[propertyId],source:source(input),at:c.now,by:c.actor.id});p.revision=newId();return {id:p.id}
 }
 if(name==='guest.consent'){
  const purpose=text(input.purpose,'consent purpose');need(purpose==='preferences'||purpose==='offers','Choose preferences or returning offers')
  need(input.allowed==='yes'||input.allowed==='no','Record explicit opt-in or opt-out')
  p.consents.push({id:newId(),purpose,allowed:input.allowed==='yes',propertyId:property(c,input.propertyId).id,source:source(input),at:c.now,by:c.actor.id});p.revision=newId();return {id:p.id}
 }
 if(name==='guest.merge'){
  const into=data.guests.find(g=>g.id===text(input.intoId,'destination guest ID')&&!g.erasedAt);need(into,'Destination guest not found',404);exact(into,input.intoRevision)
  need(!p.mergedInto&&!into.mergedInto&&p.id!==into.id,'Choose two separate guest roots',409)
  need(guestRoot(data,p.id)?.id!==guestRoot(data,into.id)?.id,'These origins already belong to the same guest',409)
  need(input.confirm==='yes','Review both complete histories and confirm they are the same person')
  const merge={id:newId(),revision:newId(),fromId:p.id,intoId:into.id,reason:text(input.reason,'reviewed evidence for this merge',1000),reviewedBy:c.actor.id,at:c.now,status:'active' as const}
  p.mergedInto=into.id;p.revision=newId();into.revision=newId();data.guestMerges.push(merge);return {id:merge.id}
 }
 need(false,'Unknown guest command',404)
}
