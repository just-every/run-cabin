import { guard, need, newId, sha, text, type Context } from '../../model'
import { hasAction, permitsProperty } from '../../permissions/authority'
import { reportFilters, readReport } from '../read'
import { reportManager, selectedProperties, recipientFor, ownerProperties } from './scope'
import { row, saveDefinition, saveSchedule, saveFollowup } from './store'
import { runInstant } from './period'
import type { SavedReport, ReportSchedule, ReportFollowup } from './types'
const canManage=(c:Context,creatorId:string)=>need(c.actor.role==='owner'||c.actor.id===creatorId,'Only the report creator or installation owner can manage it',403)
export async function reportSharingCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!['report.save','report.schedule','report.pause','report.followup.resolve'].includes(name))return undefined
 reportManager(c.actor);need(hasAction(c.actor,name),'This report action is outside your grant',403)
 if(name==='report.save'){
  const old=p.id?await row<SavedReport>(c.db,'cb_saved_reports',text(p.id,'report')):null
  if(p.id)need(old,'Saved report not found',404)
  if(old){canManage(c,old.creator.id);need(old.propertyIds.every(id=>permitsProperty(c.actor,id)),'Saved report is outside your current scope',403);need(p.revision===old.revision,'Saved report changed. Review it again.',409);c.queries.push(guard('EXISTS(SELECT 1 FROM cb_saved_reports WHERE id=? AND revision=?)',old.id,old.revision))}
  const input=p.filters&&typeof p.filters==='object'?p.filters as Record<string,unknown>:p,params=new URLSearchParams()
  for(const key of ['from','until','property','channel','owner','basis','dates'])if(typeof input[key]==='string')params.set(key,input[key] as string)
  const filters=reportFilters(params),propertyIds=selectedProperties(c.data,c.actor,filters)
  // Validate exactly the same filters and owner references as the live public report.
  await readReport(c.db,c.actor,params)
  const r:SavedReport={id:old?.id??newId(),revision:newId(),name:text(p.name,'report name',120),filters,propertyIds,creator:{...c.actor},createdAt:c.now}
  saveDefinition(c,r);c.entityId=r.id;return r
 }
 if(name==='report.schedule'){
  const saved=await row<SavedReport>(c.db,'cb_saved_reports',text(p.savedReportId,'saved report'));need(saved,'Saved report not found',404);canManage(c,saved.creator.id)
  need(p.savedReportRevision===saved.revision,'Saved report changed. Review its exact filters.',409)
  const propertyIds=selectedProperties(c.data,c.actor,saved.filters);need(JSON.stringify(propertyIds)===JSON.stringify(saved.propertyIds),'Selected homes changed. Save and review the report again.',409)
  need(p.consent===true||p.consent==='true'||p.consent==='on','Explicitly approve this schedule, period, recipient and format')
  const period=p.period??'saved-window',cadence=p.cadence??'once',format=p.format
  need(['saved-window','previous-month','previous-week'].includes(String(period)),'Choose a reporting period');need(['once','weekly','monthly'].includes(String(cadence)),'Choose a cadence');need(format==='csv'||format==='json','Choose CSV or JSON')
  const recipient=await recipientFor(c.db,c.actor,p,propertyIds,c.data)
  const r:ReportSchedule & {recipientPropertyIds?:string[]}={id:newId(),revision:newId(),name:saved.name,savedReportId:saved.id,savedReportRevision:saved.revision,filters:{...saved.filters},propertyIds,creator:{...c.actor},recipient,period:period as ReportSchedule['period'],cadence:cadence as ReportSchedule['cadence'],format,nextRunAt:runInstant(p.nextRunAt),enabled:true,consentedAt:c.now,consentedBy:c.actor.id,createdAt:c.now}
  if(recipient.kind==='owner'){need(!saved.filters.owner||saved.filters.owner===await sha(recipient.email),'Saved owner filter belongs to another recipient',403);r.recipientPropertyIds=await ownerProperties(c.data,recipient.email,propertyIds)}
  c.queries.push(guard('EXISTS(SELECT 1 FROM cb_saved_reports WHERE id=? AND revision=?)',saved.id,saved.revision));saveSchedule(c,r);c.entityId=r.id;return r
 }
 if(name==='report.pause'){
  const r=await row<ReportSchedule>(c.db,'cb_report_schedules',text(p.id,'schedule'));need(r,'Schedule not found',404);canManage(c,r.creator.id);need(r.propertyIds.every(id=>permitsProperty(c.actor,id)),'Schedule is outside your current property scope',403);need(p.revision===r.revision,'Schedule changed. Reload before pausing.',409)
  c.queries.push(guard('EXISTS(SELECT 1 FROM cb_report_schedules WHERE id=? AND revision=?)',r.id,r.revision));r.enabled=false;r.pausedAt=c.now;r.revision=newId();saveSchedule(c,r);c.entityId=r.id;return r
 }
 const r=await row<ReportFollowup>(c.db,'cb_report_followups',text(p.id,'follow-up'));need(r,'Follow-up not found',404)
 const schedule=await row<ReportSchedule>(c.db,'cb_report_schedules',r.scheduleId);need(schedule&&schedule.propertyIds.every(id=>permitsProperty(c.actor,id)),'Follow-up is outside your current property scope',403)
 need(c.actor.role==='owner'||c.actor.id===r.assignedTo||c.actor.memberId===r.assignedTo,'Only the assigned person or installation owner can resolve this follow-up',403)
 need(p.revision===r.revision&&!r.resolvedAt,'Follow-up changed. Reload before resolving.',409)
 c.queries.push(guard("EXISTS(SELECT 1 FROM cb_report_followups WHERE id=? AND json_extract(data,'$.revision')=?)",r.id,r.revision));Object.assign(r,{revision:newId(),resolvedAt:c.now,resolvedBy:c.actor.id,resolution:text(p.resolution,'resolution and delivery check',1000)});saveFollowup(c,r);c.entityId=r.id;return r
}
