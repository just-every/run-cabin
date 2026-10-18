import { need,newId,query,type Actor,type Context } from '../model'
import { homes,stays } from '../direct/store'
import { policyFor,riskReasons } from './policy'
import type { VerificationCase,VerificationData,VerificationPolicy } from './types'
export const cases=(data:VerificationData)=>data.verifications??[]
export const verificationOf=(data:VerificationData,bookingId:string)=>cases(data).find(v=>v.bookingId===bookingId)
export const resolved=(v:VerificationCase)=>v.status==='not_required'||v.status==='verified'||v.status==='approved'
export const verificationAccessBlocked=(data:VerificationData,bookingId:string)=>{const v=verificationOf(data,bookingId);return !!v&&v.policy.blockAccess&&!resolved(v)}
export async function loadVerifications(db:D1Database):Promise<VerificationCase[]> {return (await db.prepare('SELECT data FROM cb_verifications ORDER BY rowid').all<{data:string}>()).results.map(r=>JSON.parse(r.data))}
export function saveVerification(c:Context,v:VerificationCase){v.revision=newId();const data=c.data as typeof c.data&VerificationData;data.verifications??=[];const index=data.verifications.findIndex(r=>r.id===v.id);if(index<0)data.verifications.push(v);else data.verifications[index]=v;c.queries.push(query('INSERT INTO cb_verifications(id,booking_id,property_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',v.id,v.bookingId,v.propertyId,JSON.stringify(v)));c.audit=[...(c.audit??[]),{kind:'verification',id:v.id,propertyId:v.propertyId,bookingId:v.bookingId,revision:v.revision,result:v.status}];c.entityId=v.id}
export function createVerification(c:Context,bookingId:string,propertyId:string,policy:VerificationPolicy,reasons:string[],end:string){
 const v:VerificationCase={id:newId(),revision:newId(),propertyId,bookingId,policy:structuredClone(policy),reasons,status:reasons.length?'pending':'not_required',token:reasons.length?newId()+newId():null,createdAt:c.now,retainUntil:new Date(Date.parse(end.slice(0,10)+'T23:59:59Z')+policy.retentionDays*86400000).toISOString(),history:[{at:c.now,by:c.actor.id,action:reasons.length?'Verification required by saved policy':'Verification not required by saved policy'}]};if(!reasons.length){v.policy.blockAccess=false;v.policy.requireBeforeConfirmation=false}saveVerification(c,v)
 if(!reasons.length)return v
 c.data.notices.push({id:newId(),revision:newId(),propertyId,memberId:policy.reviewerId,email:policy.reviewerEmail,kind:'inbox',recordId:v.id,subject:'Guest identity review assigned',text:'A reservation requires identity verification. Open Direct bookings in Cabin to review the assigned case. No identity documents are included in this email.',status:'pending',detail:null,createdAt:c.now,sentAt:null})
 const b=c.data.bookings.find(b=>b.id===bookingId)
 if(b?.guestEmail&&policy.origin)c.data.messages.push({id:newId(),revision:newId(),propertyId,bookingId,email:b.guestEmail,phone:null,ref:null,channel:'email',direction:'out',source:'scheduled',status:'pending',subject:'Complete your identity check',text:`Your host requires an identity check for this reservation. Use Stripe Identity or request manual review here:\n\n${policy.origin}/book/verification/${v.token}\n\nDo not email identity documents. Your saved access policy remains in force until the check is resolved.`,detail:null,replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:null,grounds:['saved identity policy'],createdAt:c.now,sentAt:null})
 return v
}
/** Parent calls before dispatch, after loading verifications into Context.data. Existing stays retain their saved policy. */
export async function synchronizeVerification(c:Context,changedHome?:import('../direct/types').DirectHome){
 const configured=await homes(c.db),direct=await stays(c.db),owner=await c.db.prepare("SELECT id,email FROM oa_operators WHERE status='active' AND role='owner' LIMIT 1").first<{id:string;email:string}>()
 if(changedHome){const index=configured.findIndex(h=>h.propertyId===changedHome.propertyId);if(index<0)configured.push(changedHome);else configured[index]=changedHome}
 if(!owner)return
 for(const b of c.data.bookings){if(b.guestErasedAt||b.status!=='confirmed'||(b.kind??'stay')!=='stay'||b.end.slice(0,10)<c.now.slice(0,10)||verificationOf(c.data,b.id))continue;const home=configured.find(h=>h.propertyId===b.propertyId);if(!home)continue;const d=direct.find(d=>d.bookingId===b.id),policy=policyFor(home,owner,home.verificationPolicy?.origin??'');const reasons=riskReasons(policy,{start:b.start,createdAt:b.approvedAt},d?.quote.totalCents,d?.quote.guests,Date.parse(c.now));const v=createVerification(c,b.id,b.propertyId,policy,reasons,b.end);if(d?.identity){v.provider={...d.identity,mode:d.paymentMode??'test'};v.status=d.identity.status==='verified'?'verified':'requires_input';saveVerification(c,v)}}
}
export function mayReview(actor:Actor,v:VerificationCase){return !actor.isAgent&&(actor.role==='owner'||actor.role==='manager'&&actor.memberId===v.policy.reviewerId)}
/** Never expose guest capabilities, provider references or evidence to unrelated staff. */
export function verificationState(data:VerificationData,actor:Actor){if(actor.isAgent||!['owner','manager'].includes(actor.role))return [];return cases(data).filter(v=>v.status!=='erased'||actor.role==='owner'&&!!v.provider).map(v=>mayReview(actor,v)?{...v,token:null}:{id:v.id,bookingId:v.bookingId,propertyId:v.propertyId,status:v.status,policy:{blockAccess:v.policy.blockAccess}})}
export function currentCase(c:Context,id:string,revision:unknown){const v=cases(c.data).find(v=>v.id===id);need(v,'Verification case not found',404);need(v.revision===revision,'Verification changed. Reload before deciding.',409);return v}
