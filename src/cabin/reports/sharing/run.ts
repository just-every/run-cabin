import type { Bindings } from '../../../auth.server'
import { guard, need, newId, query, sha } from '../../model'
import { authority, mutate, SYSTEM } from '../../storage'
import { operatorMail } from '../../connections/mail'
import { sharingAllowed } from '../../connections/guard'
import { h } from '../../ui/shared'
import { readReport } from '../read'
import { reportCsv } from '../export'
import { runtimeScope } from './scope'
import { assignFollowup } from './followup'
import { periodFilters, nextOccurrence } from './period'
import { rows, row, insertRun, saveRun, saveSchedule } from './store'
import type { ReportSchedule, ReportRun } from './types'
const active=(r:ReportRun)=>r.status==='generating'||r.status==='sending'
function transition(r:ReportRun,status:ReportRun['status'],detail:string,at=new Date().toISOString()){
 r.status=status;r.detail=detail;r.history.push({at,status,detail});if(!active(r))r.finishedAt=at
}
async function failed(env:Bindings,id:string,status:ReportRun['status'],detail:string){
 await mutate(env.DB,SYSTEM,'report.run.failed',async c=>{
  const r=await row<ReportRun>(c.db,'cb_report_runs',id);if(!r||!active(r))return
  transition(r,status,detail,c.now);saveRun(c,r);await assignFollowup(c,r)
  const s=await row<ReportSchedule>(c.db,'cb_report_schedules',r.scheduleId)
  // A failure pauses subsequent sharing until a person explicitly creates a reviewed schedule.
  if(s){s.enabled=false;s.revision=newId();saveSchedule(c,s)}
 })
}
async function claim(env:Bindings,s:ReportSchedule){
 return mutate(env.DB,SYSTEM,'report.run.claim',async c=>{
  const current=await row<ReportSchedule>(c.db,'cb_report_schedules',s.id)
  if(!current?.enabled||current.revision!==s.revision||current.nextRunAt!==s.nextRunAt)return null
  const r:ReportRun={id:newId(),scheduleId:s.id,name:s.name,dueAt:s.nextRunAt,startedAt:c.now,period:s.period,format:s.format,filters:periodFilters(s),scope:null,creator:s.creator,recipient:s.recipient,status:'generating',detail:'Generating the approved reporting period.',history:[{at:c.now,status:'generating',detail:'Run claimed once for this due time.'}]}
  c.queries.push(guard('EXISTS(SELECT 1 FROM cb_report_schedules WHERE id=? AND revision=? AND enabled=1 AND next_run_at=?)',s.id,s.revision,s.nextRunAt));insertRun(c,r)
  current.enabled=s.cadence!=='once';current.nextRunAt=nextOccurrence(s);current.revision=newId();current.lastRunId=r.id;saveSchedule(c,current);return r
 })
}
async function generateAndSend(env:Bindings,s:ReportSchedule,r:ReportRun){
 let scope
 try{scope=await runtimeScope(env.DB,s)}catch{await failed(env,r.id,'refused','Creator or recipient access changed or the approved owner scope is no longer certain. Review the schedule and access.');return}
 try{
  const params=new URLSearchParams({...r.filters});if(scope.ownerKey)params.set('owner',scope.ownerKey)
  const report=await readReport(env.DB,scope.ownerKey?SYSTEM:scope.creator,params,scope.ownerKey?s.recipient.email:undefined)
  need(report.properties.every(p=>scope.propertyIds.includes(p.id)),'Generated report exceeds the approved scope',403)
  if(scope.ownerKey)need(report.journals.every(j=>j.ownerKey===scope.ownerKey)&&report.performance.every(p=>p.id===scope.ownerKey),'Owner report contains another owner’s rows',403)
  const content=s.format==='json'?JSON.stringify(report,null,2):reportCsv(report),hash=await sha(content),contentType=s.format==='json'?'application/json':'text/csv; charset=utf-8',filename=`cabin-report-${r.id}.${s.format}`
  // Recheck authority at generation and retain the exact bytes before the network effect.
  await runtimeScope(env.DB,s)
  await mutate(env.DB,SYSTEM,'report.artifact.generated',async c=>{
   need(c.before.version===report.version,'Data changed after report generation',409)
   const current=await row<ReportRun>(c.db,'cb_report_runs',r.id);need(current?.status==='generating','Run already advanced',409)
   const a=authority(scope.creator);c.queries.push(guard(a.sql,...a.params))
   if(scope.recipient.kind==='member'){const b=authority(scope.recipient.actor);c.queries.push(guard(b.sql,...b.params))}
   Object.assign(current,{scope,filters:report.filters,cutoff:report.cutoff,dataVersion:report.version,artifact:{sha256:hash,filename,contentType}})
   transition(current,'sending','Frozen artifact stored; delivery is being attempted.',c.now)
   c.queries.push(query('INSERT INTO cb_report_artifacts(run_id,content,sha256,content_type,filename,created_at) VALUES(?,?,?,?,?,?)',r.id,content,hash,contentType,filename,c.now));saveRun(c,current)
  })
 }catch{await failed(env,r.id,'generation_failed','Report generation or its authority/cutoff check failed. Review the sources and access before scheduling again.');return}
 try{
  await runtimeScope(env.DB,s)
  const latestSchedule=await row<ReportSchedule>(env.DB,'cb_report_schedules',s.id);need(latestSchedule&&!latestSchedule.pausedAt,'Report schedule was paused before sending',403)
  // Multi-home mail must satisfy every selected provider scope, not an unscoped provider call.
  for(const id of scope.propertyIds)await sharingAllowed(env.DB,'mail','message:send',id)
  const sender=operatorMail(env,scope.propertyIds.length===1?scope.propertyIds[0]:undefined)
  need(sender&&env.MAIL_FROM,'Mail is unavailable',503)
  const path=s.recipient.kind==='owner'?`/owners/reports/${r.id}`:`/api/cabin/report-artifacts/${r.id}`,link=new URL(path,env.AUTH_ORIGIN).href
  const body=`${s.name}\nReporting period: ${r.filters.from} (inclusive) to ${r.filters.until} (exclusive).\nFormat: ${s.format.toUpperCase()}.\nYour frozen report is ready: ${link}\n\nSign in with this recipient email. Current access is checked again at download.`
  const result=await sender.send({deliveryId:r.id,headers:{'Auto-Submitted':'auto-generated'},from:env.MAIL_FROM,to:[s.recipient.email],subject:`Cabin report · ${s.name}`,text:body,html:`<div style="white-space:pre-wrap">${h(body)}</div>`})
  const status=result?.status==='accepted'?'sent':result?.status==='development'?'suppressed':'delivery_failed'
  await mutate(env.DB,SYSTEM,'report.delivery.result',async c=>{
   const current=await row<ReportRun>(c.db,'cb_report_runs',r.id);if(!current||current.status!=='sending')return
   transition(current,status,status==='sent'?'Mail provider accepted the report link.':status==='suppressed'?'Development mode suppressed external email.':'Provider acceptance was not confirmed; check before any further send.',c.now)
   if(result?.providerMessageId)current.providerReference=result.providerMessageId;saveRun(c,current)
   if(status==='delivery_failed'){await assignFollowup(c,current);const scheduled=await row<ReportSchedule>(c.db,'cb_report_schedules',s.id);if(scheduled){scheduled.enabled=false;scheduled.revision=newId();saveSchedule(c,scheduled)}}
  })
 }catch{await failed(env,r.id,'delivery_failed','Delivery failed or acceptance is uncertain. Check the provider and recipient access before scheduling another send.')}
}
/** One claim per due occurrence. Uncertain effects are assigned, never silently retried. */
export async function runReportSchedules(env:Bindings,now=Date.now()){
 for(const r of await rows<ReportRun>(env.DB,'cb_report_runs'))if(active(r)&&Date.parse(r.startedAt)<now-15*60_000)await failed(env,r.id,r.status==='sending'?'delivery_failed':'generation_failed','Interrupted report run. Check generation or provider acceptance before scheduling another send.')
 const due=(await rows<ReportSchedule>(env.DB,'cb_report_schedules')).filter(s=>s.enabled&&Date.parse(s.nextRunAt)<=now).sort((a,b)=>a.nextRunAt.localeCompare(b.nextRunAt))
 for(const s of due.slice(0,20)){
  // The transaction's due-time uniqueness and installation revision serialize concurrent Cron calls.
  let r:ReportRun|null=null
  try{r=await claim(env,s)}catch(error){if((error as {status?:number}).status!==409)throw error}
  if(r)await generateAndSend(env,s,r)
 }
}
