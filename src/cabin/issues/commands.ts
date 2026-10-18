import {type Context,type Booking,type AccessCode,manager,owner,property,need,text,integer,newId,exact} from '../model'
import {note} from '../recovery/cases'
import {guestMessage} from '../recovery/messages'
import {createMaintenanceTask} from '../maintenance'
import {workOrderCommand} from '../work-orders/commands'
import {issuePolicy,issueBaseline,issueNotice,openGuestIssue} from './records'
import type {IssueCategory,IssuePolicy} from './types'
const categories:IssueCategory[]=['access','maintenance','cleaning','other']
const unsafe=/\b(safe|harmless|no danger|turn (?:it |the \w+ )?on|reset.{0,15}breaker|touch.{0,15}wir|climb)\b/i
function active(c:Context,id:unknown,label:string,managerOnly=false){
 const value=text(id,label)
 if(value==='installation-owner')return value
 need(c.data.members.some(m=>m.id===value&&m.active&&(!managerOnly||m.role==='manager')),`Choose an active ${label}`)
 return value
}
export async function issueCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!name.startsWith('issue.'))return undefined
 manager(c.actor);need(!c.actor.isAgent,'A human must approve issue work',403)
 if(name==='issue.settings'){
  owner(c.actor);const home=property(c,p.propertyId),old=c.data.recoveryPolicies.find(r=>r.propertyId===home.id)
  if(old?.issuePolicy)need(p.revision===old.issuePolicy.revision,'Issue policy changed. Reload before saving.',409)
  const responsibleId=active(c,p.responsibleId,'responsible manager',true),responsible=c.data.members.find(m=>m.id===responsibleId)
  const inspectorId=active(c,p.inspectorId,'inspector')
  const vendorIds=(Array.isArray(p.vendorIds)?p.vendorIds:String(p.vendorIds??'').split(',')).filter(Boolean).map(id=>active(c,id,'vendor'))
  need(vendorIds.length>0&&vendorIds.length<=50&&!vendorIds.includes('installation-owner'),'Choose one or more approved field staff')
  const title=String(p.instructionTitle??'').trim(),answer=String(p.instructionAnswer??'').trim(),category=String(p.instructionCategory??'other') as IssueCategory
  need(!!title===!!answer&&categories.includes(category),'Choose an instruction category and provide both title and instruction')
  need(!unsafe.test(answer),'Troubleshooting may not assure safety or instruct hazardous physical actions. Escalate those matters to a person.')
  const policy:IssuePolicy={revision:newId(),responsibleId,responsibleName:responsible?.name??'Installation owner',responsibleEmail:responsible?.email??c.actor.email,vendorIds:[...new Set(vendorIds)],inspectorId,spendLimitCents:integer(Number(p.spendLimitCents),'Dispatch spend limit (cents)',0,100_000_000),recurrenceMinutes:integer(Number(p.recurrenceMinutes),'Recurrence check delay (minutes)',1,10080),instructions:title?[{id:newId(),category,title:text(title,'instruction title',120),answer:text(answer,'approved troubleshooting',2000)}]:[],approvedBy:c.actor.id,approvedAt:c.now}
  if(old)old.issuePolicy=policy
  else c.data.recoveryPolicies.push({id:'recovery-policy:'+home.id,propertyId:home.id,revision:newId(),cleanerIds:[],auto:false,creditLimitCents:0,cleaningLimitCents:0,savedBy:c.actor.id,issuePolicy:policy})
  c.entityId=home.id;return policy
 }
 if(name==='issue.open'){
  const b=c.data.bookings.find(b=>b.id===p.bookingId);need(b,'Reservation not found',404)
  return openGuestIssue(c,b,text(p.reason,'issue report',2000),'staff',c.actor.email,p.category)
 }
 const r=c.data.recoveries.find(r=>r.id===p.id&&r.issue);need(r,'Guest issue not found',404);exact(r,p.revision)
 const i=r.issue!,b=c.data.bookings.find(b=>b.id===r.bookingId);need(b?.status==='confirmed'&&!b.guestErasedAt&&!r.restorePaused,'The stay needs review before further service actions',409)
 const policy=issuePolicy(c,r.propertyId)
 if(name==='issue.accept'){
  need(i.assignedId==='installation-owner'?c.actor.role==='owner':c.actor.memberId===i.assignedId,'Only the named responsible host can accept this issue',403)
  i.humanAcceptedAt=c.now;note(c,r,'Named host accepted responsibility','The host will follow the guest issue to completion.');return r
 }
 need(i.category!=='emergency','An emergency remains with the named human. Do not dispatch or close it as an automated service fix.',409)
 need(r.status!=='closed','This issue is closed. A new report opens a new case.',409)
 if(name==='issue.followup'){
  need(i.guestConfirmedAt&&i.recurrenceDueAt&&!i.recurrenceRequestedAt&&Date.parse(i.recurrenceDueAt)<=Date.parse(c.now),'The separate guest follow-up is not due yet',409)
  note(c,r,'Due follow-up requested','The host requested the scheduled recurrence check.');return r
 }
 if(name==='issue.troubleshoot'){
  const t=i.troubleshooting;need(t&&t.baseline===issueBaseline(c,r),'Approved instructions or current stay facts changed. Prepare a current plan.',409)
  need(!t.sentMessageId,'These instructions were already sent',409)
  const m=guestMessage(c,r,t.title,t.answer+'\n\nIf the issue persists, contact your host through your private stay page. This instruction does not confirm the issue is fixed.');m.grounds=t.sources;t.sentMessageId=m.id;note(c,r,'Approved troubleshooting sent',t.sources.join('; '));return r
 }
 if(name==='issue.propose'){
  need(policy,'Configure this home’s issue policy first',409)
  const vendorId=active(c,p.vendorId,'vendor');need(policy.vendorIds.includes(vendorId),'Choose a vendor approved for this home',403)
  const estimateCents=integer(Number(p.estimateCents),'Estimated work cents',0,100_000_000)
  const task=c.data.tasks.find(t=>t.id===i.taskId);need(!task?.work?.accepted||task.status==='closed','Accepted work must be completed or escalated before a new dispatch',409)
  const instruction=policy.instructions.find(x=>x.category===i.category)
  if(instruction)i.troubleshooting={instructionId:instruction.id,title:instruction.title,answer:instruction.answer,baseline:issueBaseline(c,r),sources:[`policy ${policy.revision}`,`reservation ${b.id} revision ${b.revision}`]}
  i.dispatch={vendorId,inspectorId:policy.inspectorId,estimateCents,baseline:issueBaseline(c,r)};i.policyRevision=policy.revision;r.status='proposed';note(c,r,'Dispatch proposed',`Vendor ${vendorId}; estimate ${estimateCents} cents; named inspector ${policy.inspectorId}; policy ${policy.revision}`);return r
 }
 if(name==='issue.dispatch'){
  const plan=i.dispatch;need(policy&&plan&&!plan.approvedAt&&r.status==='proposed','Prepare a fresh dispatch proposal',409)
  need(plan.baseline===issueBaseline(c,r),'Stay, authority, policy or open work changed. Prepare the dispatch again.',409)
  need(plan.estimateCents<=policy.spendLimitCents,'This estimate exceeds the owner’s issue limit. The owner must change the saved limit before dispatch.',409)
  need(plan.vendorId!==plan.inspectorId,'Choose an independent inspector before dispatch',409)
  let task=c.data.tasks.find(t=>t.id===i.taskId)
  if(task?.status==='closed'){i.previousTaskIds=[...i.previousTaskIds??[],task.id];task=undefined;delete i.workRevision;delete i.inspectedAt;delete i.confirmationMessageId;delete i.guestConfirmedAt;delete i.guestConfirmation;delete i.recurrenceDueAt;delete i.recurrenceRequestedAt;delete i.recurrenceConfirmedAt;delete i.recurrenceEvidence}
  if(!task)task=await createMaintenanceTask(c,r.propertyId,r.turnoverId||null,{title:`${i.category}: ${r.reason.slice(0,95)}`,note:'Guest issue '+r.id,blocking:true,photos:[]},'Guest service issue',plan.vendorId)
  task.work!.spendLimitCents=policy.spendLimitCents
  await workOrderCommand(c,'work.configure',{id:task.id,revision:task.revision,asset:i.category,assigneeId:plan.vendorId,requiresInspection:true,inspectorId:plan.inspectorId,checklist:['Resolve the reported issue','Check the result with the host'],dueDate:c.now.slice(0,10),priority:'urgent'})
  plan.approvedBy=c.actor.id;plan.approvedAt=c.now;i.taskId=task.id;r.status='active'
  c.data.approvals.push({id:newId(),kind:'issue.dispatch',recordId:r.id,revision:r.revision,actorId:c.actor.id,at:c.now})
  note(c,r,'Exact dispatch approved',`Work ${task.id}; estimate ${plan.estimateCents} cents; invoices still require their own exact approval.`);return r
 }
 need(false,'Unknown issue action',404)
}
export function guestIssueResponse(c:Context,b:Booking,code:AccessCode,p:URLSearchParams){
 const r=c.data.recoveries.find(r=>r.id===p.get('caseId')&&r.bookingId===b.id&&r.issue);need(r,'Issue not found',404);exact(r,p.get('revision'))
 const i=r.issue!,task=c.data.tasks.find(t=>t.id===i.taskId)
 need(code.status==='issued'&&b.status==='confirmed'&&!b.guestErasedAt&&r.status!=='closed'&&i.category!=='emergency','This issue is not awaiting a guest service response',409)
 need(task?.status==='closed'&&task.work?.accepted&&task.work?.inspected&&task.revision===i.workRevision,'The fix still needs inspected field evidence',409)
 const response=p.get('response'),evidence=text(p.get('evidence'),'what you observed',1000)
 if(response==='unresolved'){
  r.status='escalated';delete i.guestConfirmedAt;delete i.recurrenceConfirmedAt;delete i.recurrenceDueAt
  note(c,r,'Guest reports unresolved or recurring issue',evidence);issueNotice(c,r,'Guest says the issue persists',evidence);return r
 }
 if(response==='fixed'){
  need(!i.guestConfirmedAt,'The first confirmation is already recorded',409)
  const policy=issuePolicy(c,r.propertyId);need(policy,'The responsible host must review the service policy',409)
  i.guestConfirmedAt=c.now;i.guestConfirmation=evidence;i.recurrenceDueAt=new Date(Date.parse(c.now)+policy.recurrenceMinutes*60000).toISOString();r.status='active'
  note(c,r,'Guest confirmed the inspected fix',evidence);return r
 }
 need(response==='still_fixed'&&i.guestConfirmedAt&&i.recurrenceDueAt&&Date.parse(c.now)>=Date.parse(i.recurrenceDueAt),'The separate recurrence check is not due yet',409)
 need(i.recurrenceRequestedAt,'Wait for the follow-up check to be requested',409)
 i.recurrenceConfirmedAt=c.now;i.recurrenceEvidence=evidence;r.status='closed';r.closedAt=c.now;note(c,r,'Issue closed after recurrence check',evidence);return r
}
