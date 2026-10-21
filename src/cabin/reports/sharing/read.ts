import { authorizedRentalInterests } from '../../permissions/interests'
import { need, sha, type Actor } from '../../model'
import { assertLive } from '../../storage'
import { reportDirectory } from './directory'
import { permitsProperty } from '../../permissions/authority'
import { reportManager, runtimeScope } from './scope'
import { rows, row } from './store'
import type { SavedReport, ReportSchedule, ReportRun, ReportFollowup } from './types'
export async function reportSharingState(db:D1Database,actor:Actor){
 reportManager(actor);await assertLive(db,actor)
 const [saved,schedules,runs,followups,data]=await Promise.all([rows<SavedReport>(db,'cb_saved_reports'),rows<ReportSchedule>(db,'cb_report_schedules'),rows<ReportRun>(db,'cb_report_runs'),rows<ReportFollowup>(db,'cb_report_followups'),reportDirectory(db,actor)])
 const visible=(r:{creator:Actor;propertyIds:string[]})=>(actor.role==='owner'||r.creator.id===actor.id)&&r.propertyIds.every(id=>permitsProperty(actor,id))
 const shown=schedules.filter(visible),ids=new Set(shown.map(r=>r.id)),shownRuns=runs.filter(r=>ids.has(r.scheduleId)),runIds=new Set(shownRuns.map(r=>r.id))
 const members=data.members.filter(m=>m.active&&m.role==='manager'&&(!m.scope||m.scope.actions.includes('*')||m.scope.actions.includes('reports:read')&&m.scope.actions.includes('finance:read'))&&(actor.role==='owner'||!actor.scope||actor.scope.propertyIds.some(id=>id==='*'||!m.scope||m.scope.propertyIds.includes('*')||m.scope.propertyIds.includes(id)))).map(m=>({id:m.id,name:m.name,email:m.email}))
 const addresses=[...new Set([...data.properties.map(p=>p.ownerEmail.trim().toLowerCase()),...data.members.filter(m=>m.active&&m.scope?.pmsRole==='rental_owner').map(m=>m.email)])],owners=[] as {email:string;name:string}[];if(actor.role==='owner')for(const email of addresses){const interests=await authorizedRentalInterests(db,email,data);if(interests.length)owners.push({email,name:interests[0].name})}
 await assertLive(db,actor)
 return {savedReports:saved.filter(visible),reportSchedules:shown,reportRuns:shownRuns,reportFollowups:followups.filter(f=>runIds.has(f.runId)),reportRecipients:{members,owners}}
}
async function artifact(db:D1Database,id:string){
 const r=await row<ReportRun>(db,'cb_report_runs',id);need(r?.artifact&&r.scope,'Report artifact not found',404)
 const s=await row<ReportSchedule>(db,'cb_report_schedules',r.scheduleId);need(s,'Report schedule not found',404)
 const file=await db.prepare('SELECT content,sha256,content_type AS contentType,filename FROM cb_report_artifacts WHERE run_id=?').bind(id).first<{content:string;sha256:string;contentType:string;filename:string}>()
 need(file&&await sha(file.content)===file.sha256&&file.sha256===r.artifact.sha256,'Frozen report integrity check failed',409)
 return {run:r,schedule:s,file}
}
export async function downloadReportArtifact(db:D1Database,actor:Actor,id:string){
 reportManager(actor);await assertLive(db,actor)
 const {run,schedule,file}=await artifact(db,id)
 need(actor.role==='owner'||run.creator.id===actor.id||run.recipient.kind==='member'&&run.recipient.actor.id===actor.id,'Report artifact not found',404)
 need(run.scope!.propertyIds.every(id=>permitsProperty(actor,id)),'Report artifact is outside your current scope',403)
 await runtimeScope(db,schedule);await assertLive(db,actor);return file
}
export async function downloadOwnerReportArtifact(db:D1Database,email:string,id:string,actor?:Actor){
 const {run,schedule,file}=await artifact(db,id)
 need(run.recipient.kind==='owner'&&run.recipient.email.toLowerCase()===email.trim().toLowerCase(),'Report artifact not found',404)
 need(!actor||run.scope!.propertyIds.every(id=>permitsProperty(actor,id)),'Report artifact not found',404);await runtimeScope(db,schedule);return file
}
export async function ownerReportArtifacts(db:D1Database,email:string){
 const selected=(await rows<ReportRun>(db,'cb_report_runs')).filter(r=>r.artifact&&r.recipient.kind==='owner'&&r.recipient.email===email.trim().toLowerCase()),result=[]
 for(const r of selected){const s=await row<ReportSchedule>(db,'cb_report_schedules',r.scheduleId);if(!s)continue;try{await runtimeScope(db,s);result.push({id:r.id,name:r.name,filters:r.filters,format:r.format,cutoff:r.cutoff,status:r.status})}catch{/* Changed grants do not expose retained artifacts. */}}
 return result
}
