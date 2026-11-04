import { type Actor, type Context, type Data, need, owner, property, text, exact, newId, sha } from '../model'
import { assertLive } from '../storage'
import { permitsProperty } from '../permissions/policy'
import { guestGroup, consent } from './resolve'
import { completedStay } from './offers'
import type { GuestProfile, GuestSegment } from './types'

/** Marketing preparation remains installation-owner-only and has no outbound effect. */
function authority(actor:Actor,propertyId:string) {
 owner(actor);need(!actor.isAgent&&permitsProperty(actor,propertyId),'Marketing preparation is outside your property authority',403)
}
export function recordMarketingConsent(c:Context,profile:GuestProfile,input:Record<string,unknown>) {
 const home=property(c,input.propertyId);authority(c.actor,home.id)
 const booking=c.data.bookings.find(b=>b.id===profile.bookingId)
 need(booking&&booking.propertyId===home.id&&!booking.guestErasedAt,'Choose the identity origin belonging to this home',409)
 need(input.allowed==='yes'||input.allowed==='no','Record explicit marketing opt-in or opt-out')
 let identityId:string|undefined
 if(input.allowed==='yes'){
  const identity=profile.identities.find(i=>i.id===input.identityId&&i.kind==='email'&&i.verified&&i.value.toLowerCase()===booking.guestEmail?.trim().toLowerCase())
  need(identity,'Verify the current reservation email before recording marketing opt-in',409)
  need(input.confirm==='yes','Confirm the guest separately requested repeat-stay marketing')
  identityId=identity.id
 }
 profile.consents.push({id:newId(),purpose:'marketing',identityId,allowed:input.allowed==='yes',propertyId:home.id,source:text(input.source,'separate marketing consent evidence',400),at:c.now,by:c.actor.id})
 profile.revision=newId();return {id:profile.id}
}

function inventory(data:Data,propertyId:string,now:string) {
 const members:GuestSegment['members']=[]
 let excluded=0
 const roots=data.guests.filter(g=>!g.erasedAt&&!g.mergedInto)
 for(const root of roots){
  const group=guestGroup(data,root.id),origins=group.filter(g=>data.bookings.some(b=>b.id===g.bookingId&&b.propertyId===propertyId))
  if(!origins.length)continue
  const eligible=consent(data,root.id,propertyId,'marketing')?origins.flatMap(g=>{
   const booking=data.bookings.find(b=>b.id===g.bookingId)!
   const decision=[...g.consents].reverse().find(c=>c.purpose==='marketing'&&c.propertyId===propertyId)
   const contact=g.identities.find(i=>i.id===decision?.identityId&&i.kind==='email'&&i.verified&&i.value.toLowerCase()===booking.guestEmail?.trim().toLowerCase())
   return decision?.allowed&&!decision.inactive&&contact&&!booking.guestErasedAt&&!booking.restorePaused&&completedStay(data,booking.id,Date.parse(now)) ? [{guestId:root.id,profileIds:group.map(g=>g.id).sort(),identityId:contact.id,bookingId:booking.id}] : []
  }):[]
  if(eligible.length)members.push(eligible[0]);else excluded++
 }
 return {members,excluded}
}
async function baseline(data:Data,propertyId:string) {
 const roots=data.guests.filter(g=>guestGroup(data,g.id).some(origin=>data.bookings.some(b=>b.id===origin.bookingId&&b.propertyId===propertyId)))
 // Hash the reviewed facts, including every merged origin. Keep contacts out of the retained preview.
 return sha(JSON.stringify({home:data.properties.find(p=>p.id===propertyId),guests:roots,bookings:data.bookings.filter(b=>roots.some(g=>g.bookingId===b.id)),grants:data.members.map(m=>[m.id,m.revision,m.active,m.scope]),settings:data.homeSettings.filter(s=>s.propertyId===propertyId).map(s=>[s.revision,s.timeZone])}))
}
async function valid(db:D1Database,data:Data,segment:GuestSegment) {
 if(segment.status!=='prepared'||segment.baseline!==await baseline(data,segment.propertyId))return false
 if(!segment.authority)return false
 try{authority(segment.authority,segment.propertyId);await assertLive(db,segment.authority);return true}catch{return false}
}
export async function marketingCommand(c:Context,name:string,input:Record<string,unknown>) {
 if(name==='guest.marketing.prepare'){
  const home=property(c,input.propertyId);authority(c.actor,home.id)
  const selected=inventory(c.data,home.id,c.now)
  need(selected.members.length,'No eligible guests: require a completed stay, verified current email and separate marketing opt-in; merged opt-outs suppress inclusion',409)
  const segment:GuestSegment={id:newId(),revision:newId(),propertyId:home.id,label:text(input.label,'segment label',100),preparedAt:c.now,authority:structuredClone(c.actor),baseline:await baseline(c.data,home.id),status:'prepared',...selected}
  c.data.guestSegments.push(segment);c.entityId=segment.id
  return {id:segment.id,revision:segment.revision,count:segment.members.length,excluded:segment.excluded}
 }
 need(name==='guest.marketing.review','Unknown marketing command',404)
 const segment=c.data.guestSegments.find(s=>s.id===input.id);need(segment,'Segment not found',404);authority(c.actor,segment.propertyId);exact(segment,input.revision)
 need(await valid(c.db,c.data,segment),'This preparation is inactive or changed. Prepare a fresh local segment.',409)
 c.entityId=segment.id;return {id:segment.id,count:segment.members.length,status:'local-preview',externalEffects:0}
}
export async function marketingState(db:D1Database,data:Data,actor:Actor) {
 if(actor.role!=='owner'||actor.isAgent)return []
 return Promise.all(data.guestSegments.map(async segment=>{
  const active=await valid(db,data,segment)
  const members=active?segment.members.map(m=>{
   const origin=data.guests.find(g=>g.bookingId===m.bookingId),identity=origin?.identities.find(i=>i.id===m.identityId),booking=data.bookings.find(b=>b.id===m.bookingId)
   return {...m,name:booking?.guestName,email:identity?.value}
  }):[]
  return {id:segment.id,revision:segment.revision,propertyId:segment.propertyId,label:segment.label,preparedAt:segment.preparedAt,status:active?'prepared' as const:'inactive' as const,members,excluded:segment.excluded}
 }))
}
