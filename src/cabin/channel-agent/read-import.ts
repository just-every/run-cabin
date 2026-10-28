import { captureInquiry, guardInquirySource } from '../reservations/inquiries'
import type { Bindings } from '../../auth.server'
import { type Actor, type Booking, type Context, need, manager, newId, sha, text } from '../model'
import { assertContactsAllowed } from '../privacy/contacts'
import { sharingAllowed } from '../connections/guard'
import { mutate } from '../storage'
import { reservationCommand } from '../inventory'
import { applyChanges } from '../calendars'
import { lifecycle } from '../reservations/history'
import { financeImport } from '../finance/import'
import { cents, csvDate, sumCents } from '../finance/csv'
import { receiveGuestInContext } from '../inbox/inbound'
import { rows, save as saveRecord } from './store'
import { PROFILE, type Profile } from './types'
import { READ_SOURCE, READ_OBSERVATION, type ReadAction, type ReadPayload, type ReadSource } from './read-types'

function save<T extends {id:string}>(c:Context,kind:string,row:T){saveRecord(c,kind,row)}
const hosts={airbnb:'airbnb.com',vrbo:'vrbo.com','booking.com':'booking.com'}
const fields={
 'read-reservations':{required:['listingId','reservationId','guestName','start','end','status'],optional:['guestEmail','guestPhone','threadId','guests','currency','quote','deadline','message']},
 'read-messages':{required:['listingId','reservationId','messageId','text','sentAt','direction'],optional:[]},
 'read-payouts':{required:['listingId','transactionId','payoutId','reservationId','date','currency','gross','fee','net','type','status'],optional:['guestName']}
} as const
const scope=(p:Profile)=>[p.channel,p.id,p.generation,p.propertyId]
const sourceKey=(p:Profile,kind:string,id:string)=>sha(JSON.stringify([...scope(p),kind,id]))
const fingerprint=(r:Record<string,string>)=>sha(JSON.stringify(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))))
function iso(value:unknown,label:string){
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace(/Z$/,value.includes('.')?'Z':'.000Z'),`${label} must be an exact UTC ISO timestamp`)
 return value
}
function date(value:string,label:string){need(/^\d{4}-\d{2}-\d{2}$/.test(value),`${label} must use YYYY-MM-DD`);return csvDate(value,label)}
function payloadFor(action:ReadAction,value:unknown):ReadPayload{
 need(value&&typeof value==='object'&&!Array.isArray(value),'A source read is required')
 const p=value as Record<string,unknown>;need(Object.keys(p).every(k=>k==='records'||k==='observedAt'),'Unexpected source read fields')
 const observedAt=iso(p.observedAt,'Observation time')
 need(Date.parse(observedAt)>=Date.parse(action.createdAt)&&Date.parse(observedAt)<=Date.now()+60000,'Source observation predates this action or is in the future',409)
 need(Array.isArray(p.records)&&p.records.length<=500,'Read at most 500 visible source rows')
 const spec=fields[action.kind];need(spec,'Unknown read action')
 const allowed=new Set<string>([...spec.required,...spec.optional])
 const records=p.records.map((value:unknown)=>{
  need(value&&typeof value==='object'&&!Array.isArray(value),'Each source row must be a flat record')
  const row=value as Record<string,unknown>
  need(Object.keys(row).every(k=>allowed.has(k)&&typeof row[k]==='string'),'Unexpected or non-string source field')
  for(const k of spec.required){const max=k==='text'?8000:500;text(row[k],`source ${k}`,max);need((row[k] as string).length<=max,`Source ${k} is too long`)}
  for(const k of spec.optional)if(k in row){const max=k==='message'?8000:500;text(row[k],`source ${k}`,max);need((row[k] as string).length<=max,`Source ${k} is too long`)}
  return row as Record<string,string>
 })
 need(JSON.stringify(records).length<=2_000_000,'Source read is too large')
 return {observedAt,records}
}
async function current(c:Context,a:ReadAction,p:Profile){
 await sharingAllowed(c.db,'calendars','calendar:read',p.propertyId)
 const fresh=(await rows<Profile>(c.db,PROFILE)).find(r=>r.id===p.id)
 need(fresh&&fresh.generation===p.generation&&fresh.propertyId===p.propertyId&&fresh.channel===p.channel&&fresh.status==='connected','Channel profile changed or paused; owner review required',409)
 need(a.profileId===p.id&&a.propertyId===p.propertyId&&a.channel===p.channel&&a.profileGeneration===p.generation,'Read action no longer belongs to this profile generation',409)
 need(c.data.properties.some(r=>r.id===p.propertyId),'Home no longer exists',409)
}
function sourceBooking(c:Context,p:Profile,anchor:ReadSource|undefined):Booking|null{
 if(!anchor?.bookingId)return null
 const b=c.data.bookings.find(r=>r.id===anchor.bookingId)
 need(b&&b.propertyId===p.propertyId&&b.channel===p.channel&&!b.restorePaused,'Source reservation scope changed; owner review required',409)
 need(!b.guestErasedAt,'Guest identity was erased; source reads cannot restore it',409)
 need(!anchor.bookingRevision||anchor.bookingRevision===b.revision,'Reservation changed since its source observation; owner review required',409)
 return b
}
function freshSource(old:ReadSource|undefined,observedAt:string,hash:string){
 need(!old||Date.parse(observedAt)>=Date.parse(old.observedAt),'Source observation is stale; owner review required',409)
 need(!old||Date.parse(observedAt)!==Date.parse(old.observedAt)||old.fingerprint===hash,'Source changed within the same observation; owner review required',409)
}
function anchor(p:Profile,a:ReadAction,id:string,observedAt:string,hash:string):ReadSource{
 return {id,propertyId:p.propertyId,profileId:p.id,generation:p.generation,channel:p.channel,kind:a.kind,observedAt,fingerprint:hash}
}
async function observation(c:Context,p:Profile,a:ReadAction,payload:ReadPayload){
 const recordHashes=await Promise.all(payload.records.map(fingerprint))
 const id='channel-read-observation:'+await sha(JSON.stringify([...scope(p),a.id,payload.observedAt,recordHashes]))
 // Digests and scoped entity IDs retain provenance without retaining erased guest words or contacts.
 save(c,READ_OBSERVATION,{id,propertyId:p.propertyId,profileId:p.id,generation:p.generation,channel:p.channel,actionId:a.id,kind:a.kind,readUrl:a.readUrl,observedAt:payload.observedAt,recordCount:payload.records.length,recordHashes,evidenceClass:'host-page-readback'})
}
async function reservations(c:Context,p:Profile,a:ReadAction,payload:ReadPayload){
 const saved=await rows<ReadSource>(c.db,READ_SOURCE),seen=new Set<string>(),ids:string[]=[]
 for(const raw of payload.records){
  await guardInquirySource(c,p,raw.reservationId)
  try{await assertContactsAllowed(c.db,[raw.guestEmail,raw.guestPhone])}catch(error){throw Object.assign(error as Error,{discardChannelEvidence:true})}
  if(raw.status.toLowerCase()==='inquiry'){const id=await captureInquiry(c,p,a,raw,payload.observedAt);need(!seen.has(id),'Repeated source inquiry ID');seen.add(id);ids.push(id);continue}
  const r:Record<string,string>={...raw,status:raw.status.toLowerCase()};need(r.status==='confirmed'||r.status==='cancelled','Source reservation status must be confirmed or cancelled')
  date(r.start,'Arrival');date(r.end,'Checkout');need(r.start<r.end&&Date.parse(r.end)-Date.parse(r.start)<=365*86400000,'Source stay must hold 1 to 365 nights')
  const ref=await sourceKey(p,'reservation',r.reservationId),id='channel-read-source:'+ref,hash=await fingerprint(r),old=saved.find(s=>s.id===id)
  need(!seen.has(id),'Repeated source reservation ID');seen.add(id);freshSource(old,payload.observedAt,hash)
  let b=sourceBooking(c,p,old)
  if(old?.fingerprint===hash){save(c,READ_SOURCE,{...old,observedAt:payload.observedAt});if(b)ids.push(b.id);continue}
  need(!old||old.status!=='cancelled','Cancelled source reservation changed; owner review required',409)
  if(!b&&r.status==='confirmed'){
   const uid='channel-source-'+ref
   applyChanges(c,p.propertyId,p.channel,[{kind:'add',uid,after:{uid,start:r.start,end:r.end,summary:r.guestName,guestName:r.guestName,cancelled:false}}])
   b=c.data.bookings.find(b=>b.uid===uid&&b.propertyId===p.propertyId)!
   b.channelRef=r.reservationId;lifecycle(b).sourceId=r.reservationId
   await reservationCommand(c,'booking.details',{id:b.id,revision:b.revision,guestName:r.guestName,guestEmail:r.guestEmail,guestPhone:r.guestPhone})
  }else if(b){
   need(b.status==='confirmed'&&!b.cancelled,'Source reservation has locally ended; owner review required',409)
   if(b.start!==r.start||b.end!==r.end)need(r.status==='confirmed','Cancellation dates changed; owner review required',409)
   applyChanges(c,p.propertyId,p.channel,[{kind:r.status==='cancelled'?'cancel':'change',uid:b.uid,before:b,after:{uid:b.uid,start:r.start,end:r.end,summary:r.guestName,guestName:r.guestName,cancelled:r.status==='cancelled'}}])
   if(r.status==='confirmed')await reservationCommand(c,'booking.details',{id:b.id,revision:b.revision,guestName:r.guestName,arrivalTime:b.arrivalTime,guestEmail:r.guestEmail??b.guestEmail,guestPhone:r.guestPhone??b.guestPhone})
   b.revision=newId()
  }
  const row={...anchor(p,a,id,payload.observedAt,hash),status:r.status,...(b?{bookingId:b.id,bookingRevision:b.revision}:{})}
  save(c,READ_SOURCE,row);if(b)ids.push(b.id)
 }
 return ids
}
async function messages(c:Context,env:Bindings,p:Profile,a:ReadAction,payload:ReadPayload){
 const saved=await rows<ReadSource>(c.db,READ_SOURCE),seen=new Set<string>(),ids:string[]=[]
 for(const r of payload.records){
  iso(r.sentAt,'Message time');need(Date.parse(r.sentAt)<=Date.parse(payload.observedAt),'Message time follows its observation')
  const key=await sourceKey(p,'message',JSON.stringify([r.reservationId,r.messageId])),id='channel-read-source:'+key,hash=await fingerprint(r),old=saved.find(s=>s.id===id)
  need(!seen.has(id),'Repeated source message ID');seen.add(id);freshSource(old,payload.observedAt,hash)
  need(!old||old.fingerprint===hash,'Source message ID changed its content; owner review required',409)
  const direction=r.direction.toLowerCase();need(['guest','host','in','out','inbound','outbound'].includes(direction),'Message sender must explicitly be guest or host')
  if(['host','out','outbound'].includes(direction))continue
  const reservationId='channel-read-source:'+await sourceKey(p,'reservation',r.reservationId)
  const reservation=saved.find(s=>s.id===reservationId),b=sourceBooking(c,p,reservation)
  need(b,'Import this message’s source reservation first',409)
  if(old){need(c.data.messages.some(m=>m.id===old.messageId&&m.bookingId===b.id),'Imported message is missing or moved; owner review required',409);save(c,READ_SOURCE,{...old,observedAt:payload.observedAt});ids.push(old.messageId!);continue}
  const m=await receiveGuestInContext(c,env,{channel:p.channel,bookingId:b.id,propertyId:p.propertyId,ref:b.channelRef,subject:`${p.channel} message`,text:r.text,providerId:'channel-read:'+key,sentAt:r.sentAt},{ai:false,scoped:true})
  // Drafts from a read always remain host decisions, including later scheduler passes.
  for(const draft of c.data.messages.filter(d=>d.replyTo===m.id&&d.direction==='out'))if(draft.control){draft.control.automatic=false;draft.control.needsHost=true}
  save(c,READ_SOURCE,{...anchor(p,a,id,payload.observedAt,hash),bookingId:b.id,messageId:m.id});ids.push(m.id)
 }
 return ids
}
const cell=(s:string)=>'"'+s.replace(/"/g,'""')+'"'
async function payoutCsv(p:Profile,payload:ReadPayload){
 const headers=p.channel==='airbnb'?['Transaction ID','Payout ID','Confirmation code','Date','Currency','Gross earnings','Host service fee','Amount','Type','Guest name']:p.channel==='vrbo'?['Transaction ID','Payout ID','Reservation ID','Date','Currency','Gross booking amount','Commission','Net amount','Type','Guest name']:['Transaction ID','Payout ID','Reservation ID','Date','Currency','Gross amount','Fee amount','Net amount','Type','Guest name']
 const seen=new Set<string>(),records:string[][]=[]
 for(const r of payload.records){
  need(['paid','settled'].includes(r.status.toLowerCase()),'Only paid or settled source transactions can be imported')
  date(r.date,'Settlement date');need(r.currency==='USD','Source settlement currency must be explicit USD')
  const type=r.type.toLowerCase();need(['reservation','payment','charge','refund'].includes(type),'Unsupported source settlement type')
  const gross=cents(r.gross,'Gross'),fee=cents(r.fee,'Fee'),net=cents(r.net,'Net')
  need(sumCents([gross,-fee])===net,'Source settlement amounts do not reconcile')
  need(type==='refund'?gross<0&&net<=0:gross>0&&fee>=0&&net>=0,'Source settlement signs do not match its transaction type')
  const tx=await sourceKey(p,'transaction',r.transactionId);need(!seen.has(tx),'Repeated source transaction ID');seen.add(tx)
  const kind=p.channel==='airbnb'?(type==='refund'?'refund':'reservation'):p.channel==='vrbo'?(type==='refund'?'refund':'payment'):type
  records.push([r.transactionId,r.payoutId,r.reservationId,r.date,r.currency,r.gross,r.fee,r.net,kind,r.guestName??''])
 }
 return [headers,...records].map(row=>row.map(cell).join(',')).join('\n')
}
/** Called outside runner mutate, before successful completion. No provider/network writes. */
export async function importChannelRead(env:Bindings,actor:Actor,action:ReadAction,profile:Profile,value:unknown){
 manager(actor)
 need(action.kind in fields,'Unknown channel read kind')
 const url=new URL(action.readUrl),host=hosts[profile.channel]
 need(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&(url.hostname===host||url.hostname.endsWith('.'+host)),'Read URL must be on the authorized channel')
 const payload=payloadFor(action,value)
 need(profile.listingId&&payload.records.every(r=>r.listingId===profile.listingId),'The source records do not belong to this channel listing',409)
 if(action.kind==='read-payouts'){
  const csv=await payoutCsv(profile,payload)
  await mutate(env.DB,actor,'channelAgent.read.check',async c=>{await current(c,action,profile);const saved=await rows<ReadSource>(c.db,READ_SOURCE);for(const r of payload.records){const id='channel-read-source:'+await sourceKey(profile,'transaction',r.transactionId),old=saved.find(s=>s.id===id);freshSource(old,payload.observedAt,await fingerprint(r));need(!old||old.fingerprint===await fingerprint(r),'Source settlement changed; owner review required',409)}})
  const result=payload.records.length?await financeImport(env,actor,'payout.import',{source:profile.channel,propertyId:profile.propertyId,csv,evidenceReference:`channel-host-profile:${profile.id}:${profile.generation}`}):{imported:[],duplicates:[],matched:0}
  await mutate(env.DB,actor,'channelAgent.read.observed',async c=>{await current(c,action,profile);const saved=await rows<ReadSource>(c.db,READ_SOURCE);for(const r of payload.records){const id='channel-read-source:'+await sourceKey(profile,'transaction',r.transactionId),hash=await fingerprint(r),old=saved.find(s=>s.id===id);freshSource(old,payload.observedAt,hash);need(!old||old.fingerprint===hash,'Source settlement changed; owner review required',409);save(c,READ_SOURCE,anchor(profile,action,id,payload.observedAt,hash))}await observation(c,profile,action,payload)})
  return {kind:action.kind,count:payload.records.length,result,evidenceClass:'host-page-readback' as const}
 }
 return mutate(env.DB,actor,'channelAgent.read.import',async c=>{
  await current(c,action,profile)
  const ids=action.kind==='read-reservations'?await reservations(c,profile,action,payload):await messages(c,env,profile,action,payload)
  await observation(c,profile,action,payload)
  return {kind:action.kind,count:payload.records.length,ids,evidenceClass:'host-page-readback' as const}
 })
}
