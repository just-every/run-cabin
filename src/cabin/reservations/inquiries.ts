import { type Context, type GuestMessage, need, newId, owner, sha, text, integer } from '../model'
import { rows } from '../channel-agent/store'
import { PROFILE, type Profile } from '../channel-agent/types'
import type { ReadAction } from '../channel-agent/read-types'
import { sharingAllowed } from '../connections/guard'
import { teamSettings, activeManager } from '../inbox/team/settings'
import { messageKey, threadId } from '../inbox/threads'

/** A source inquiry never takes inventory or establishes a channel decision. */
export interface Inquiry {
 id:string; revision:string; propertyId:string; channel:Profile['channel']; profileId:string; generation:string;
 sourceId:string; sourceThreadId:string; threadRef:string; sourceUrl:string; observedAt:string; fingerprint:string;
 guestName:string; start:string; end:string; guests:number; quoteCents:number; currency:'USD'; sourceText:string; deadline:string;
 status:'needs_review'|'inquiry'|'erased'; messageId:string|null; threadId:string|null;
 reviewedBy:string|null; reviewedAt:string|null; deadlineStage:'pending'|'approaching'|'elapsed'; restorePaused?:boolean;
}
function timestamp(value:unknown,label:string){
 const s=text(value,label,30),n=Date.parse(s)
 need(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(n)&&new Date(n).toISOString()===s.replace(/Z$/,s.includes('.')?'Z':'.000Z'),`${label} must be an exact UTC timestamp`)
 return s
}
function date(value:string){need(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,'Inquiry dates must be real calendar dates');return value}
/** Existing authorized reservation reads may observe inquiries; identity is reviewed natively before a thread is created. */
export async function captureInquiry(c:Context,p:Profile,a:ReadAction,r:Record<string,string>,observedAt:string){
 const sourceId=text(r.reservationId,'source inquiry ID',500),sourceThreadId=text(r.threadId,'source thread ID',500)
 const start=date(r.start),end=date(r.end);need(start<end&&Date.parse(end)-Date.parse(start)<=365*86400000,'Inquiry must request 1 to 365 nights')
 need(r.currency==='USD','Inquiry quote currency must be explicit USD')
 need(/^\d+(?:\.\d{1,2})?$/.test(r.quote),'Inquiry quote must be a nonnegative USD amount')
 const quoteCents=integer(Math.round(Number(r.quote)*100),'Inquiry quote cents'),guests=integer(Number(r.guests),'Inquiry guest count',1,1000)
 const deadline=timestamp(r.deadline,'Source deadline'),guestName=text(r.guestName,'source guest name',500),sourceText=text(r.message,'source inquiry message',8000)
 const id='inquiry:'+await sha(JSON.stringify([p.channel,p.id,sourceId]))
 const threadRef='inquiry-thread:'+await sha(JSON.stringify([p.channel,p.id,sourceThreadId]))
 const fingerprint=await sha(JSON.stringify({sourceId,sourceThreadId,start,end,guests,quoteCents,deadline,guestName,sourceText}))
 const old=c.data.inquiries.find(q=>q.id===id)
 need(!old||!old.restorePaused&&old.status!=='erased','Inquiry was erased or restored inactive; source replay is refused',409)
 need(!old||old.fingerprint===fingerprint,'Source inquiry identity or terms changed; owner reconciliation required',409)
 need(!old||Date.parse(observedAt)>=Date.parse(old.observedAt),'Inquiry observation is stale',409)
 if(old){if(old.status==='needs_review'&&old.generation!==p.generation){old.generation=p.generation;old.observedAt=observedAt;old.revision=newId()}return old.id}
 // A thread with conflicting guest identity is ambiguous; never resolve by name or silently merge it.
 need(!c.data.inquiries.some(q=>q.threadRef===threadRef&&q.status!=='erased'&&q.guestName!==guestName),'Source thread identity is ambiguous; owner reconciliation required',409)
 const q:Inquiry={id,revision:newId(),propertyId:p.propertyId,channel:p.channel,profileId:p.id,generation:p.generation,sourceId,sourceThreadId,threadRef,sourceUrl:a.readUrl,observedAt,fingerprint,guestName,start,end,guests,quoteCents,currency:'USD',sourceText,deadline,status:'needs_review',messageId:null,threadId:null,reviewedBy:null,reviewedAt:null,deadlineStage:'pending'}
 c.data.inquiries.push(q);c.entityId=q.id;return q.id
}
export function eraseInquiry(c:Context,q:Inquiry){
 q.status='erased';q.guestName='Erased guest';q.sourceText='';q.sourceId='';q.sourceThreadId='';q.revision=newId()
 for(const m of c.data.messages.filter(m=>m.id===q.messageId||m.ref===q.threadRef)){m.text='Erased inquiry';m.subject='Erased inquiry';m.status='discarded';m.revision=newId()}
 const row=c.data.threadCases.find(r=>r.id===q.threadId)
 if(row){row.guest='Erased guest';row.status='answered';row.waitingSince=null;row.dueAt=null;row.claim=null;row.notes=[];row.handovers=[];row.revision=newId()}
 for(const n of c.data.notices.filter(n=>n.recordId===q.threadId)){n.text='';n.subject='Erased inquiry';n.status='suppressed';n.revision=newId()}
}
export async function inquiryCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!name.startsWith('inquiry.'))return undefined
 owner(c.actor);need(!c.actor.isAgent,'A native owner must review source identity',403)
 const q=c.data.inquiries.find(q=>q.id===text(p.id,'inquiry'));need(q,'Inquiry not found',404)
 need(q.revision===p.revision,'Inquiry changed. Review the current source record.',409);c.entityId=q.id
 if(name==='inquiry.erase'){need(p.confirm==='yes','Confirm inquiry erasure');need(!c.data.notices.some(n=>n.recordId===q.threadId&&n.status==='sending'),'Inquiry notice is in flight; reconcile it before erasing',409);eraseInquiry(c,q);return q}
 need(name==='inquiry.review','Unknown inquiry command',404)
 need(q.status==='needs_review'&&!q.restorePaused,'This source inquiry is no longer awaiting review',409)
 need(p.confirm==='yes'&&p.sourceThreadId===q.sourceThreadId,'Confirm the exact source thread identity; name-only matches are refused',409)
 await sharingAllowed(c.db,'calendars','calendar:read',q.propertyId)
 const profile=(await rows<Profile>(c.db,PROFILE)).find(row=>row.id===q.profileId)
 need(profile?.status==='connected'&&profile.generation===q.generation&&profile.propertyId===q.propertyId,'Channel authority changed; reconnect and obtain a fresh source read',409)
 const team=teamSettings(c.data),to=activeManager(c.data,team.escalationMemberId)
 need(team.since&&to&&(!to.scope||to.scope.propertyIds.includes('*')||to.scope.propertyIds.includes(q.propertyId))&&(!to.scope||to.scope.actions.includes('*')||to.scope.actions.includes('inbox:read')),'Configure an accountable inbox escalation manager for this home in Settings first',409)
 const m:GuestMessage={id:newId(),revision:newId(),propertyId:q.propertyId,bookingId:null,email:null,phone:null,ref:q.threadRef,channel:q.channel,direction:'in',source:'guest',status:'received',subject:'Source inquiry',text:q.sourceText,detail:'Source thread reviewed by the installation owner. No channel action sent.',replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:'channel-read:'+q.id,grounds:[],createdAt:c.now,sentAt:q.observedAt}
 c.data.messages.push(m);q.messageId=m.id;q.threadId=threadId(messageKey(c.data,m));q.reviewedBy=c.actor.id;q.reviewedAt=c.now;q.status='inquiry';q.revision=newId()
 return q
}
