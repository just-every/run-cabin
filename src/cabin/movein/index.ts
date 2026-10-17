import { providerCommand, providerJobs } from './provider-import'
import { planD1Import, createD1ImportJob, applyD1ImportBatches, undoD1Import, resumeD1Import, readD1ImportJob, readD1ImportOriginals, readD1ImportUndoReport, canonicalJson } from '../../modules/import-kit/src/d1/index.ts'
import type { D1ImportContext, D1Database as KitDatabase, ImportMapping, ImportPlan } from '../../modules/import-kit/src/d1/index.ts'
import { namespace, propertySource } from './csv'
import { destination,mappingVersion,propertyTargets,nativeConflicts } from './targets'
import { type Actor, need, owner, text, newId, guard, query } from '../model'
import { assertLive, authority } from '../storage'
export function importContext(db:D1Database,actor:Actor,reviewId?:string):D1ImportContext {
 owner(actor)
 return {destination,namespace,mappingVersion,storage:{database:db as unknown as KitDatabase,targets:propertyTargets},batchSize:10,maxBatches:1,reversalPolicy:'preserve-conflicts',originalErasurePolicy:'withdraw-affected-artifacts',authorization:{principalId:actor.id,predicate(action){
  const a=authority(actor)
  if(['apply','undo','rollback'].includes(action)){need(reviewId,'Approved import review required',403);return {sql:`(${a.sql}) AND EXISTS(SELECT 1 FROM cb_import_reviews r JOIN cb_approvals a ON a.record_id=r.id AND a.kind='import' AND a.revision=r.fingerprint WHERE r.id=? AND r.actor_id=? AND r.job_id IS NOT NULL)`,params:[...a.params,reviewId,actor.id]}}
  return a
 }}}
}
const mapping:ImportMapping={version:mappingVersion,map(record){return {effects:[{targetKind:'property',targetId:record.sourceId,value:{...(record.payload as Record<string,string|number>),version:1,inUse:false}}]}}}
const values=(plan:ImportPlan)=>plan.entries.flatMap(e=>e.effects.map(e=>e.value as Record<string,any>))
const properties=(plan:ImportPlan)=>values(plan).map(v=>({id:v.id,name:v.name,ownerName:v.owner_name,ownerEmail:v.owner_email,commissionBps:v.commission_bps,revision:v.version}))
interface Review {id:string;fingerprint:string;plan:string;actor_id:string;job_id:string|null}
async function atomic(db:D1Database,actor:Actor,queries:ReturnType<typeof query>[]){const a=authority(actor);await db.batch([guard(a.sql,...a.params),...queries,query('UPDATE cb_meta SET version=version+1 WHERE id=1'),guard(a.sql,...a.params),query('DELETE FROM cb_guard')].map(q=>db.prepare(q.sql).bind(...q.params)))}
export async function importCommand(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>):Promise<unknown>{
 owner(actor);await assertLive(db,actor)
 if(name.startsWith('import.provider.'))return providerCommand(db,actor,name,input)
 try {
  if(name==='import.preview'){
   const plan=await planD1Import(propertySource(input.csv),mapping,importContext(db,actor)),id=newId(),conflicts=await nativeConflicts(db,values(plan))
   await atomic(db,actor,[query('INSERT INTO cb_import_reviews(id,fingerprint,plan,actor_id,created_at) VALUES(?,?,?,?,?)',id,plan.fingerprint,canonicalJson(plan),actor.id,new Date().toISOString())])
   return {id,fingerprint:plan.fingerprint,counts:plan.counts,diagnostics:plan.diagnostics,properties:properties(plan),conflicts,status:'review'}
  }
  const id=text(input.id??input.jobId,'import ID'),review=await db.prepare('SELECT * FROM cb_import_reviews WHERE (id=? OR job_id=?) AND actor_id=?').bind(id,id,actor.id).first<Review>()
  need(review,'Import review not found',404);const context=importContext(db,actor,review.id)
  if(name==='import.approve'){
   need(text(input.fingerprint,'fingerprint')===review.fingerprint,'The reviewed import fingerprint changed',409)
   if(review.job_id)return {id:review.id,job:await readD1ImportJob(review.job_id,context)}
   const plan=JSON.parse(review.plan) as ImportPlan
   need(plan.fingerprint===review.fingerprint&&plan.principalId===actor.id,'The immutable import plan changed',409)
   const conflicts=await nativeConflicts(db,values(plan));need(conflicts.length===0,'Properties now conflict with this plan. Preview a corrected CSV.',409)
   const job=await createD1ImportJob(plan,{...context,reviewedFingerprint:review.fingerprint,operationKey:review.id})
   const at=new Date().toISOString()
   await atomic(db,actor,[guard('EXISTS(SELECT 1 FROM cb_import_reviews WHERE id=? AND fingerprint=? AND plan=? AND job_id IS NULL)',review.id,review.fingerprint,review.plan),query('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?)',newId(),'import',review.id,review.fingerprint,actor.id,at),query('UPDATE cb_import_reviews SET job_id=? WHERE id=?',job.id,review.id),query('INSERT INTO cb_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)',newId(),actor.id,actor.role,name,review.id,at)])
   return {id:review.id,job:await applyD1ImportBatches(job.id,context)}
  }
  need(review.job_id,'Approve this exact import plan first',409)
  if(name==='import.undo')return {id:review.id,job:await undoD1Import(review.job_id,context),report:await readD1ImportUndoReport(review.job_id,context)}
  if(name==='import.resume')return {id:review.id,job:await resumeD1Import(review.job_id,context)}
  if(name==='import.journal'){
   const job=await readD1ImportJob(review.job_id,context),originals=await readD1ImportOriginals(review.job_id,context)
   const batches=(await db.prepare('SELECT action,position,end_position AS endPosition,fence FROM ik_batches WHERE job_id=? ORDER BY rowid').bind(review.job_id).all()).results
   await assertLive(db,actor);return {id:review.id,job,originals,batches}
  }
  need(false,'Unknown import command',404)
 }catch(error){const message=String((error as Error)?.message??error)
  if(/IMPORT_JOB_NOT_FOUND/.test(message))need(false,'Import job not found or retired by erasure',404)
  if(/NATIVE_EDIT_CONFLICT|TARGET_REVISION_CONFLICT|SOURCE_ID_CONTENT_CONFLICT|IMPORT_ALREADY_REVERSING|IMPORT_ATOMIC_GUARD|IMPORT_FINAL_GUARD|JOB_BINDING_MISMATCH|OPERATION_KEY_CONFLICT|UNIQUE constraint|IMPORT_NOT_COMPLETED|IMPORT_NOT_COMPLETE|UNDO_REQUIRES|REVERSAL_MODE_CONFLICT/.test(message))need(false,'Import conflicts with current records or access. Native edits and dependent operations are preserved.',409)
  if(/IMPORT_D1_REQUEST_LIMIT|IMPORT_D1_TRANSPORT_LIMIT/.test(message))need(false,'This import needs another request. Resume the approved job.',409)
  throw error
 }
}
export async function importJobs(db:D1Database,actor:Actor){
 if(actor.role!=='owner')return []
 const reviews=(await db.prepare('SELECT r.*,j.state,j.checkpoint,j.total,j.error FROM cb_import_reviews r LEFT JOIN ik_jobs j ON j.id=r.job_id WHERE r.actor_id=? ORDER BY r.rowid DESC LIMIT 30').bind(actor.id).all<any>()).results
 return [...await providerJobs(db,actor),...reviews.map(r=>({id:r.id,jobId:r.job_id,fingerprint:r.fingerprint,status:r.state??(r.job_id?'retired':'review'),state:r.state??'review',checkpoint:r.checkpoint,total:r.total,error:r.error,createdAt:r.created_at,...(!r.job_id?{properties:properties(JSON.parse(r.plan))}:{})}))]
}
