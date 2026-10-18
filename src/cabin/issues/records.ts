import { type Context,type Booking,type GuestMessage,newId,need,text } from '../model'
import type { Recovery } from '../recovery/types'
import type { IssueCategory } from './types'
import { note } from '../recovery/cases'
import { guestMessage } from '../recovery/messages'
import { homeSettings } from '../homes'

export const EMERGENCY = 'If anyone is in immediate danger, leave the affected area if you can do so safely and call 911. Do not use affected equipment. Contact the named host now. Cabin cannot assess physical safety.'
export function classifyIssue(reason:string,hint?:unknown):IssueCategory {
 if(/\b(fire|smoke|gas (?:smell|leak)|smell (?:of )?gas|carbon monoxide|unconscious|electrocution|sparks|emergency|serious injury|flooding)\b/i.test(reason)||hint==='emergency')return 'emergency'
 if(hint==='access'||/\b(lock(?:ed)?|keypad|door code|cannot (?:get|check) in|can't (?:get|check) in|access fail)\b/i.test(reason))return 'access'
 if(hint==='maintenance'||/\b(leak\w*|broken|not working|appliance|washer|plumbing)\b/i.test(reason))return 'maintenance'
 if(hint==='cleaning'||/\b(dirty|unclean|cleaning|linen|mess)\b/i.test(reason))return 'cleaning'
 return 'other'
}
export const issuePolicy=(c:Pick<Context,'data'>,propertyId:string)=>c.data.recoveryPolicies.find(p=>p.propertyId===propertyId)?.issuePolicy
export function issueBaseline(c:Context,r:Recovery){
 const b=c.data.bookings.find(b=>b.id===r.bookingId),policy=issuePolicy(c,r.propertyId)
 return JSON.stringify({booking:b?.revision,status:b?.status,recipient:b?.guestEmail,policy,settings:homeSettings(c,r.propertyId).revision,tasks:c.data.tasks.filter(t=>t.propertyId===r.propertyId&&t.status==='open').map(t=>[t.id,t.revision]),vendors:c.data.members.filter(m=>policy?.vendorIds.includes(m.id)||m.id===policy?.inspectorId||m.id===policy?.responsibleId)})
}
export function issueNotice(c:Context,r:Recovery,subject:string,body:string){
 const i=r.issue!;c.data.notices.push({id:newId(),revision:newId(),propertyId:r.propertyId,memberId:i.assignedId,email:i.assignedEmail,kind:'issue',...(i.category==='emergency'?{priority:'urgent' as const}:{}),recordId:r.id,subject,text:`${i.assignedName}: ${body}\nCase ${r.id}. Open Stay recovery to review the reservation, sources and work.`,status:'pending',detail:null,createdAt:c.now,sentAt:null})
}
export function openGuestIssue(c:Context,b:Booking,reason:string,source:'portal'|'inbox'|'staff',ownerEmail:string,hint?:unknown,messageId?:string){
 need(b.status==='confirmed'&&!b.guestErasedAt,'Choose an active reservation',409)
 const duplicate=messageId&&c.data.recoveries.find(r=>r.issue?.messageId===messageId);if(duplicate)return duplicate
 const category=classifyIssue(reason,hint),policy=issuePolicy(c,b.propertyId)
 const t=c.data.turnovers.find(t=>t.nextBookingId===b.id&&t.status!=='cancelled')??c.data.turnovers.find(t=>t.bookingId===b.id&&t.status!=='cancelled')
 const r:Recovery={id:newId(),revision:newId(),propertyId:b.propertyId,bookingId:b.id,turnoverId:t?.id??'',trigger:'guest_problem',reason:text(reason,'issue report',8000),status:category==='emergency'||!policy?'escalated':'open',createdAt:c.now,createdBy:c.actor.id,history:[],issue:{category,source,messageId,assignedId:policy?.responsibleId??'installation-owner',assignedName:policy?.responsibleName??'Installation owner',assignedEmail:policy?.responsibleEmail??ownerEmail,policyRevision:policy?.revision??'',declines:[]}}
 need(r.issue!.assignedEmail,'A named responsible host must be configured',409)
 if(category==='emergency')r.issue!.emergencyInstructions=EMERGENCY
 c.data.recoveries.push(r);note(c,r,'Issue classified',`${category}; source ${source}; reservation revision ${b.revision}; ${policy?'approved policy '+policy.revision:'no approved troubleshooting policy; human review required'}`)
 const instruction=category!=='emergency'&&policy?.instructions.find(i=>i.category===category)
 if(instruction)r.issue!.troubleshooting={instructionId:instruction.id,title:instruction.title,answer:instruction.answer,baseline:issueBaseline(c,r),sources:[`policy ${policy!.revision}`,`reservation ${b.id} revision ${b.revision}`,`operations ${homeSettings(c,b.propertyId).revision}`]}
 issueNotice(c,r,category==='emergency'?'Emergency guest report — immediate human response':'Guest issue assigned',`${category==='emergency'?EMERGENCY+'\n':''}${reason}`)
 return r
}
export function incomingIssue(c:Context,b:Booking|null,m:GuestMessage,ownerEmail:string){
 if(!b||b.status!=='confirmed'||b.guestErasedAt)return null
 const category=classifyIssue(m.text)
 if(category==='other'&&!/\b(problem|issue|help)\b/i.test(m.text))return null
 return openGuestIssue(c,b,m.text,'inbox',ownerEmail,category,m.id)
}
/** Inspectable field evidence is necessary; a sent reply never proves the fix. */
export function synchronizeIssues(c:Context){
 for(const r of c.data.recoveries){const i=r.issue;if(!i||r.restorePaused)continue
  const task=c.data.tasks.find(t=>t.id===i.taskId),work=task?.work
  if(work?.declined&&!i.declines.some(d=>d.at===work.declined!.at&&d.reason===work.declined!.note)){
   i.declines.push({vendorId:c.before.tasks.find(t=>t.id===task!.id)?.assigneeId??null,at:work.declined.at,reason:work.declined.note});r.status='escalated';note(c,r,'Vendor declined',work.declined.note);issueNotice(c,r,'Guest issue needs another vendor','The vendor declined. Review and approve another assignment; the issue remains open.')
  }
  if(i.workRevision&&task?.revision!==i.workRevision){
   delete i.workRevision;delete i.inspectedAt;delete i.guestConfirmedAt;delete i.guestConfirmation;delete i.recurrenceConfirmedAt;delete i.recurrenceEvidence;delete i.recurrenceDueAt;delete i.recurrenceRequestedAt;delete i.confirmationMessageId;delete r.closedAt;r.status='active';note(c,r,'Fix changed','Field work changed; new inspection and guest confirmation are required.')
  }
 }
}
export function requestGuestCheck(c:Context,r:Recovery,origin:string,recurrence=false){
 const i=r.issue!,b=c.data.bookings.find(b=>b.id===r.bookingId)!,code=c.data.codes.find(code=>code.bookingId===b.id&&code.holder==='guest'&&code.status==='issued'&&code.link)
 if(!code||!b.guestEmail)return false
 const task=c.data.tasks.find(t=>t.id===i.taskId)!
 const link=new URL('/stay/'+code.link,origin).href
 const m=guestMessage(c,r,recurrence?'Has the problem returned?':'Please check the reported fix',`${recurrence?'Your host is checking whether the reported problem has returned.':'The assigned vendor completed the work and the named inspector accepted its evidence.'}\n\nReported issue: ${r.reason}\nWork: ${task.title}\n${recurrence?'Confirm whether it has stayed resolved':'Please check the result and confirm, or tell your host it still needs attention'} on your private stay page: ${link}\n\nThis is a service check, not an assurance of physical safety.`)
 m.grounds=[r.id,task.id,task.revision,'named inspection '+task.work!.inspected!.at]
 if(recurrence)i.recurrenceRequestedAt=c.now;else i.confirmationMessageId=m.id
 note(c,r,recurrence?'Recurrence check requested':'Guest confirmation requested','The inspected fix awaits the guest’s own response.');return true
}
