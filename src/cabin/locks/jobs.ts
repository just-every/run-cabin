import type { AccessCode, Data } from '../model'
import { newId, sha } from '../model'
import { instant } from '../clock'
import { mutate, SYSTEM } from '../storage'
import { verificationAccessBlocked } from '../verification/records'
import { revoke } from '../codes'
import type { LockJob, Observation } from './types'

const device=(data:Data,code:AccessCode)=>data.homeSettings.find(s=>s.propertyId===code.propertyId)?.lockDeviceId??null
export const fingerprint=(data:Data,code:AccessCode)=>sha(JSON.stringify([code.revision,code.status,code.code,code.validFrom,code.validUntil,code.timeZone,device(data,code)]))
export const due=(code:AccessCode)=>(!code.lock.job?.claim||Date.parse(code.lock.job.claim.until)<=Date.now())&&(code.lock.state==='pending'||code.status==='revoked'&&!!code.lock.providerId&&code.lock.state!=='removed'||!!code.lock.job&&code.lock.job.stage!=='complete')
/** Expiry is an explicit provider removal, including an unfinished programming attempt. */
export async function expire(db:D1Database,data:Data){
 const expired=(d:Data,code:AccessCode,now:number)=>code.status==='issued'&&!!device(d,code)&&!d.bookings.find(b=>b.id===code.bookingId)?.restorePaused&&now>=instant(code.validUntil,code.timeZone)
 if(!data.codes.some(code=>expired(data,code,Date.now())))return false
 await mutate(db,SYSTEM,'lock.expire',c=>{
  const ids=[]
  for(const code of c.data.codes)if(expired(c.data,code,Date.parse(c.now))){revoke(code,'The assigned access window ended');ids.push(code.id)}
  return ids
 })
 return true
}
function provedNotApplied(data:Data,job:LockJob){
 const ticket=job.recovery;if(!ticket)return false
 const attempt=data.recoveries.find(r=>r.id===ticket.caseId)?.execution?.effects.find(e=>e.id===ticket.effectId)?.attempts.find(a=>a.id===ticket.attemptId)
 return attempt?.state==='not_applied'&&!!attempt.resolvedAt
}
export async function claim(db:D1Database,id:string){
 return mutate(db,SYSTEM,'lock.claim',async c=>{
  const code=c.data.codes.find(r=>r.id===id);if(!code||!due(code))return null
  if(code.status==='issued'&&code.holder==='guest'&&verificationAccessBlocked(c.data,code.bookingId))revoke(code,'Guest identity verification unresolved')
  let job=code.lock.job
  if(job?.claim&&job.claim.until>c.now)return null
  if(job&&provedNotApplied(c.data,job))job=undefined
  const source=await fingerprint(c.data,code)
  if(!job||job.stage==='complete'||job.stage==='prepared'&&job.fingerprint!==source){
   if(code.status==='revoked'&&!code.lock.providerId){code.lock={...code.lock,state:'removed',error:null,at:c.now};return null}
   const deviceId=code.status==='revoked'?code.lock.job?.deviceId??device(c.data,code):device(c.data,code)
   if(!deviceId&&!code.lock.providerId){code.lock={...code.lock,state:'manual',error:null,at:c.now};return null}
   // A provider id belongs to the original device. Moving locks needs a person.
   if(code.status==='issued'&&code.lock.job?.providerId&&code.lock.job.deviceId!==deviceId){code.lock={...code.lock,state:'failed',error:'The connected lock changed. Reconcile the original device before changing access.',at:c.now};return null}
   job={id:newId(),fingerprint:source,revision:code.revision,operation:code.status==='revoked'?'delete':code.lock.providerId?'update':'create',deviceId,name:`Cabin ${code.holder} access ${code.id}`,code:code.code,starts_at:new Date(instant(code.validFrom,code.timeZone)).toISOString(),ends_at:new Date(instant(code.validUntil,code.timeZone)).toISOString(),stage:'prepared',claim:null,providerId:code.lock.providerId}
  }
  job.claim={token:newId(),until:new Date(Date.parse(c.now)+60_000).toISOString()};code.lock.job=job;c.entityId=code.id
  return {code:structuredClone(code),job:structuredClone(job)}
 })
}
/** Both token and source are checked again immediately before permitting the write. */
export async function start(db:D1Database,id:string,job:LockJob){
 return mutate(db,SYSTEM,'lock.requested',async c=>{
  const code=c.data.codes.find(r=>r.id===id),current=code?.lock.job
  if(!code||current?.id!==job.id||current.claim?.token!==job.claim?.token||current.stage!=='prepared'||current.claim!.until<=c.now||await fingerprint(c.data,code)!==job.fingerprint)return false
  if(code.status==='issued'&&code.holder==='guest'&&verificationAccessBlocked(c.data,code.bookingId))return false
  current.stage='started';current.startedAt=c.now;current.deviceId=job.deviceId;current.recovery=job.recovery;job.stage='started';job.startedAt=c.now;c.entityId=id;return true
 })
}
export async function receipt(db:D1Database,id:string,job:LockJob,value:any){
 return mutate(db,SYSTEM,'lock.accepted',c=>{
  const code=c.data.codes.find(r=>r.id===id),current=code?.lock.job
  if(!code||current?.id!==job.id||current.claim?.token!==job.claim?.token)return false
  const providerId=value?.access_code?.access_code_id,actionId=value?.action_attempt?.action_attempt_id
  if(typeof providerId==='string'){current.providerId=providerId;code.lock.providerId=providerId}
  if(typeof actionId==='string')current.actionAttemptId=actionId
  current.acceptedAt=c.now;current.stage='observing';Object.assign(job,structuredClone(current));c.entityId=id;return true
 })
}
export async function settle(db:D1Database,id:string,job:LockJob,result:Observation){
 return mutate(db,SYSTEM,'lock.result',async c=>{
  const code=c.data.codes.find(r=>r.id===id),current=code?.lock.job
  if(!code||current?.id!==job.id||current.claim?.token!==job.claim?.token)return null
  current.providerId=result.providerId;current.claim=null
  if(result.acknowledged)current.acceptedAt??=c.now
  if(result.complete)current.stage='complete'
  code.lock.providerId=result.providerId
  // A stale response may retain the provider reference for revocation, never grant access.
  const unchanged=await fingerprint(c.data,code)===job.fingerprint
  // Cancellation can remove an identified resource while its programming is pending.
  // An update never creates a different resource; another window edit still waits.
  if(!unchanged&&job.operation==='create'&&result.providerId&&result.acknowledged)current.stage='complete'
  if(!unchanged&&code.status==='revoked'&&job.operation==='update'&&job.providerId)current.stage='complete'
  code.lock.state=unchanged?result.state:current.stage==='complete'?'pending':'failed'
  code.lock.error=unchanged?result.error:current.stage==='complete'?null:'An earlier lock change is unresolved. Reconcile it before applying the current access window.'
  code.lock.at=c.now;c.entityId=id;return structuredClone(code)
 })
}
