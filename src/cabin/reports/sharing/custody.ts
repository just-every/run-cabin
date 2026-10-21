import { owner, query, type Context } from '../../model'
import { scrub, type ErasureScope } from '../../privacy/scope'
import { rows, saveFollowup } from './store'
import type { SavedReport, ReportSchedule, ReportRun, ReportFollowup } from './types'

/** Remove derived sharing state in the caller's existing guarded erasure transaction.
 * No artifact survives with an accessible download or a queued provider effect. */
export async function eraseReportSharing(c:Context,s:ErasureScope){
 owner(c.actor)
 const [saved,schedules,runs,followups]=await Promise.all([
  rows<SavedReport>(c.db,'cb_saved_reports'),rows<ReportSchedule>(c.db,'cb_report_schedules'),
  rows<ReportRun>(c.db,'cb_report_runs'),rows<ReportFollowup>(c.db,'cb_report_followups'),
 ])
 const member=s.entity==='member'?c.before.members.find(m=>m.id===s.id):null
 const operator=member?await c.db.prepare('SELECT id FROM oa_operators WHERE email=? COLLATE NOCASE').bind(member.email).first<{id:string}>():null
 const identities=new Set([s.id,...(operator?[operator.id]:[])]),addresses=new Set(s.values.filter(v=>v.includes('@')).map(v=>v.trim().toLowerCase()))
 const personalText=(value:unknown):boolean=>{
  if(typeof value==='string')return s.values.some(v=>v.length>=3&&value.toLowerCase().includes(v.toLowerCase()))
  if(Array.isArray(value))return value.some(personalText)
  return !!value&&typeof value==='object'&&Object.values(value).some(personalText)
 }
 const person=(value:any)=>!!value&&(identities.has(value.id)||identities.has(value.memberId)||typeof value.email==='string'&&addresses.has(value.email.trim().toLowerCase()))
 const affected=(value:any):boolean=>{
  if(s.entity==='member')return person(value.creator)||person(value.recipient)||person(value.recipient?.actor)||person(value.scope?.creator)||person(value.scope?.recipient)||person(value.scope?.recipient?.actor)||identities.has(value.consentedBy)||personalText(value)
  const propertyIds=[...(value.propertyIds??[]),...(value.recipientPropertyIds??[]),...(value.scope?.propertyIds??[]),value.filters?.property]
  return propertyIds.some(id=>s.properties.has(id))||personalText(value)
 }
 const definitionIds=new Set(saved.filter(affected).map(r=>r.id)),scheduleIds=new Set(schedules.filter(r=>affected(r)||definitionIds.has(r.savedReportId)).map(r=>r.id))
 for(const r of runs)if(affected(r))scheduleIds.add(r.scheduleId)
 const runIds=new Set(runs.filter(r=>scheduleIds.has(r.scheduleId)||affected(r)).map(r=>r.id))
 for(const f of followups){
  if(runIds.has(f.runId)||scheduleIds.has(f.scheduleId)){c.queries.push(query('DELETE FROM cb_report_followups WHERE id=?',f.id));continue}
  if(s.entity==='member'&&(identities.has(f.assignedTo)||identities.has(f.resolvedBy??'')||addresses.has(f.assignedEmail.toLowerCase())||personalText(f))){
   const clean=scrub(f,s.values) as ReportFollowup
   if(identities.has(f.assignedTo)||addresses.has(f.assignedEmail.toLowerCase())){clean.assignedTo=c.actor.id;clean.assignedEmail=c.actor.email;clean.assignedName='Installation owner'}
   if(identities.has(f.resolvedBy??''))clean.resolvedBy='erased-member'
   saveFollowup(c,clean)
  }else if(personalText(f))saveFollowup(c,scrub(f,s.values))
 }
 if(runIds.size){
  // The ordinary immutable-artifact trigger is restored before the atomic erasure batch
  // commits. This narrowly scoped exception cannot expose a mutable-artifact window.
  c.queries.push(query('DROP TRIGGER cb_report_artifact_no_delete'))
  for(const id of runIds)c.queries.push(query('DELETE FROM cb_report_artifacts WHERE run_id=?',id))
  c.queries.push(query("CREATE TRIGGER cb_report_artifact_no_delete BEFORE DELETE ON cb_report_artifacts BEGIN SELECT RAISE(ABORT,'Report artifacts are permanent'); END"))
  for(const id of runIds)c.queries.push(query('DELETE FROM cb_report_runs WHERE id=?',id))
 }
 for(const id of scheduleIds)c.queries.push(query('DELETE FROM cb_report_schedules WHERE id=?',id))
 for(const id of definitionIds)c.queries.push(query('DELETE FROM cb_saved_reports WHERE id=?',id))
 return {savedReports:definitionIds.size,schedules:scheduleIds.size,runs:runIds.size}
}
