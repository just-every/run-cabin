import { type Actor, type Data, need } from '../model'
import { assertLive, load } from '../storage'
import { hasAction, permitsProperty } from './policy'
const targetKeys=new Set(['id','bookingId','propertyId','statementId','taskId','turnoverId','draftId','quoteId','messageId','reservationId','agreementId','verificationId'])
/** Resolve every supplied resource against server records, never just the claimed home. */
export async function commandScope(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>){
 await assertLive(db,actor)
 if(!actor.scope||(name.startsWith('report.')||name.startsWith('question.')))return
 need(hasAction(actor,name),'This action is outside your team grant',403)
 if(actor.scope.propertyIds.includes('*')&&actor.scope.actions.includes('*'))return
 const data=await load(db),properties=new Set<string>(),unresolved:string[]=[]
 const byId=new Map<string,any>()
 for(const rows of Object.values(data))if(Array.isArray(rows))for(const r of rows)if(r&&typeof r==='object'&&'id'in r)byId.set(r.id,r)
 for(const p of data.properties)byId.set(p.id,{propertyId:p.id})
 const resolve=async(id:string)=>{
  let row=byId.get(id)
  if(!row){const stored=await db.prepare('SELECT data FROM cb_records WHERE id=?').bind(id).first<{data:string}>();if(stored)row=JSON.parse(stored.data)}
  if(!row){const stored=await db.prepare('SELECT property_id AS propertyId FROM cb_direct_stays WHERE id=? UNION ALL SELECT property_id FROM cb_owner_expenses WHERE id=? UNION ALL SELECT property_id FROM cb_owner_stay_requests WHERE id=? LIMIT 1').bind(id,id,id).first<any>();if(stored)row=stored}
  if(row?.propertyId)properties.add(row.propertyId)
  else if(row?.bookingId&&byId.get(row.bookingId)?.propertyId)properties.add(byId.get(row.bookingId).propertyId)
  else unresolved.push(id)
 }
 for(const [key,value] of Object.entries(input)){
  if(targetKeys.has(key)&&typeof value==='string'&&value)await resolve(value)
  if(key==='propertyIds'&&Array.isArray(value))for(const id of value)if(typeof id==='string')await resolve(id)
 }
 // A thread key is a contact-wide identifier. Its entire cohort must be in scope.
 if(typeof input.threadId==='string'){
  const {threadId,messageKey}=await import('../inbox/threads')
  const messages=data.messages.filter(m=>threadId(messageKey(data,m))===input.threadId)
  need(messages.length,'Thread not found',404)
  for(const m of messages){need(m.propertyId,'Unscoped conversation requires the installation owner',403);properties.add(m.propertyId)}
 }

 need(unresolved.length===0&&properties.size>0,'Choose a record within your property grant',403)
 for(const id of properties)need(permitsProperty(actor,id),'Record not found',404)
}
/** A captured grant is part of a queued operation, not authority conferred on the scheduler. */
export async function queuedAuthority(db:D1Database,actor:Actor|undefined,action:string,propertyId:string|null){
 if(!actor)return true
 try{await assertLive(db,actor);return hasAction(actor,action)&&!!propertyId&&permitsProperty(actor,propertyId)}catch{return false}
}
