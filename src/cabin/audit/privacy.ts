import { eraseProfiles } from '../guests/erase'
import { guestGroup } from '../guests/resolve'
import { type Context, type Query, need, text, query, newId, sha } from '../model'
import { commit } from '../storage'
import { stays, saveStay } from '../direct/store'
/** Operational identity erasure retains signed agreements and immutable accounting evidence as legal records. */
export async function eraseGuest(c:Context,p:Record<string,unknown>,fence:Query[]) {
 const booking=c.data.bookings.find(b=>b.id===text(p.id,'reservation'));need(booking,'Reservation not found',404)
 need(booking.revision===p.revision,'Reservation changed. Review it again before erasing',409)
 const email=booking.guestEmail?.toLowerCase(),phone=booking.guestPhone
 const group=booking.guestId?guestGroup(c.data,booking.guestId):[],profileIds=new Set(group.map(g=>g.id))
 const matched=c.data.bookings.filter(b=>b.id===booking.id||(group.length?!!b.guestId&&profileIds.has(b.guestId):email&&b.guestEmail?.toLowerCase()===email||phone&&b.guestPhone===phone)),ids=new Set(matched.map(b=>b.id))
 eraseProfiles(c,profileIds)
 const messages=c.data.messages.filter(m=>m.bookingId&&ids.has(m.bookingId)||email&&m.email?.toLowerCase()===email||phone&&m.phone===phone)
 need(!messages.some(m=>m.status==='sending'),'A guest message is being sent. Wait for its result before erasing.',409)
 const subjects=new Set<string>(ids),homeIds=new Set(matched.map(b=>b.propertyId))
 for(const b of matched){Object.assign(b,{guestName:'Erased guest',summary:'Reserved',revision:newId(),guestErasedAt:c.now});delete b.guestEmail;delete b.guestPhone}
 for(const m of messages){subjects.add(m.id);Object.assign(m,{email:null,phone:null,ref:null,subject:'Erased guest message',text:'',grounds:[],detail:null,headerId:null,revision:newId()});if(['pending','draft','drafting'].includes(m.status))m.status='discarded'}
 for(const r of c.data.requests.filter(r=>r.bookingId&&ids.has(r.bookingId))){r.guestName='Erased guest';r.note='';r.revision=newId();subjects.add(r.id)}
 for(const r of c.data.scheduled.filter(r=>ids.has(r.bookingId))){need(r.status!=='sending','A scheduled message is being sent. Wait for its result.',409);r.status='cancelled';r.reason='Guest identity erased';r.content=undefined;r.code=undefined;r.revision=newId();subjects.add(r.id)}
 for(const code of c.data.codes.filter(r=>ids.has(r.bookingId)&&r.holder==='guest')){code.status='revoked';code.link=null;code.reason='Guest identity erased';code.revision=newId();subjects.add(code.id)}
 for(const t of c.data.turnovers.filter(r=>ids.has(r.bookingId)||!!r.nextBookingId&&ids.has(r.nextBookingId))){subjects.add(t.id);if(t.completion)t.completion.caption='Guest identity erased'}
 for(const r of c.data.recoveries.filter(r=>ids.has(r.bookingId))){subjects.add(r.id);r.reason='Guest identity erased';r.history=r.history.map(h=>({...h,why:''}));if(r.proposal)Object.assign(r.proposal,{why:'Guest identity erased',guestText:'',baseline:''});delete r.previous;delete r.appliedBaseline;r.revision=newId()}
 for(const d of await stays(c.db))if(ids.has(d.bookingId)){subjects.add(d.id);subjects.add('guest:'+d.id);d.guestName='Erased guest';d.email='';delete d.checkoutUrl;delete d.bookingLinkSealed;saveStay(c,d);c.queries.push(query('UPDATE cb_direct_stays SET token_hash=? WHERE id=?',await sha(newId()),d.id))}
 // Retained vendor plans and their undo snapshots may contain the same contact.
 const plans=(await c.db.prepare('SELECT id,plan FROM cb_provider_moveins').all<{id:string;plan:string}>()).results
 for(const row of plans){const plan=JSON.parse(row.plan),guests=plan.guests??[],affected=guests.filter((g:any)=>email&&g.email?.toLowerCase()===email||phone&&g.phone===phone)
  if(!affected.length)continue
  for(const g of affected){g.name='Erased guest';g.email=undefined;g.phone=undefined;c.queries.push(query('UPDATE cb_movein_guests SET data=? WHERE movein_id=? AND source_id=?',JSON.stringify(g),row.id,g.externalId))}
  c.queries.push(query('UPDATE cb_provider_moveins SET plan=?,inventory=NULL WHERE id=?',JSON.stringify(plan),row.id))
 }
 // Redact this guest's snapshots without changing unrelated reservations.
 const erasedUids=new Set(matched.map(b=>b.propertyId+':'+b.uid))
 for(const draft of c.data.calendarDrafts.filter(r=>homeIds.has(r.propertyId))){draft.events=draft.events.map(e=>erasedUids.has(draft.propertyId+':'+e.uid)?{...e,summary:'Reserved',guestName:undefined}:e);draft.changes=draft.changes.map(e=>erasedUids.has(draft.propertyId+':'+e.uid)?{...e,before:e.before?{...e.before,summary:'Reserved',guestName:'Erased guest',guestEmail:undefined,guestPhone:undefined}:undefined,after:e.after?{...e.after,summary:'Reserved',guestName:undefined}:undefined}:e)}
 for(const id of subjects)c.queries.push(query('INSERT OR IGNORE INTO cb_audit_redactions(subject_id,anonymous_id,at,actor_id) VALUES(?,?,?,?)',id,'erased:'+newId(),c.now,c.actor.id))
 for(const b of matched)c.queries.push(query("INSERT OR IGNORE INTO cb_erasure_fences(entity,id_hash,at) VALUES('guest',?,?)",await sha(b.id),c.now))
 c.queries.push(...fence);c.entityId=booking.id;await commit(c,'privacy.guest.erase');return {erased:true,reservations:matched.length}
}
/** A later feed or background job may update a stay, but cannot restore erased guest identity or re-queue its messages. */
export function retainGuestErasure(c:Context){
 const erased=new Set(c.before.bookings.filter(b=>b.guestErasedAt).map(b=>b.id));for(const b of c.data.bookings)if(erased.has(b.id)||b.guestErasedAt){b.guestErasedAt??=c.now;b.guestName='Erased guest';b.summary='Reserved';delete b.guestEmail;delete b.guestPhone;for(const r of c.data.scheduled.filter(r=>r.bookingId===b.id)){if(r.status==='scheduled')r.status='cancelled';r.content=undefined;r.code=undefined}for(const code of c.data.codes.filter(r=>r.bookingId===b.id&&r.holder==='guest')){code.status='revoked';code.link=null}}
}
