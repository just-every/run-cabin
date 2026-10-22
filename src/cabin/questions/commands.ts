import { type Context, need, newId, text, guard } from '../model'
import { hasAction, permitsProperty } from '../permissions/policy'
import { memberActor } from '../permissions/authority'
import { answerQuestion } from './read'
import { createMaintenanceTask } from '../maintenance'

export async function questionCommand(c:Context,name:string,input:Record<string,unknown>){
 if(name!=='question.investigate')return undefined
 need(!c.actor.isAgent&&hasAction(c.actor,'question.investigate')&&hasAction(c.actor,'task.raise'),'Investigation approval is outside your grant',403)
 need(input.consent===true||input.consent==='on'||input.consent==='true','Explicitly approve this investigation and named person')
 const answer=await answerQuestion(c.db,{actor:c.actor},input)
 need(answer.digest===input.digest&&answer.version===c.before.version,'The answer or records changed. Ask again before approving.',409)
 const propertyId=text(input.propertyId,'investigation property'),assigneeId=text(input.assigneeId,'responsible person')
 need(answer.proposal?.propertyIds.includes(propertyId)&&permitsProperty(c.actor,propertyId),'Investigation property is outside this answer',403)
 const member=c.data.members.find(m=>m.id===assigneeId&&m.active&&m.role==='manager');need(member,'Choose an active team member with access to this evidence')
 const op=await c.db.prepare("SELECT id FROM oa_operators WHERE email=? COLLATE NOCASE AND status='active' AND role='member'").bind(member.email).first<{id:string}>(),recipient=op?await memberActor(c.db,op.id):null
 const required=answer.kind==='net'?['reports:read','finance:read']:answer.kind==='conversations'?['reports:read','inbox:read','reservations:read']:['reports:read','reservations:read',...(answer.kind==='arrivals'?['operations:read']:[])]
 need(recipient&&permitsProperty(recipient,propertyId)&&required.every(action=>hasAction(recipient,action)),'The assigned person cannot read this evidence',403)
 // Approval is one internal investigation, never a booking, posting or guest send.
 const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(input.digest)+':'+propertyId))
 const id='question-'+Array.from(new Uint8Array(key),v=>v.toString(16).padStart(2,'0')).join('')
 need(!c.data.tasks.some(t=>t.id===id),'This exact investigation was already approved',409)
 c.queries.push(guard("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active')",recipient.id,recipient.operatorVersion))
 const note=`Approved ${answer.kind} investigation. Saved Cabin revision ${answer.version}; cutoff ${answer.cutoff}. ${answer.reports.map((r:any)=>r.label+': '+r.href).join(' ')}. Reopen the current scoped report before acting. No booking, financial or guest action approved.`
 const task=await createMaintenanceTask(c,propertyId,null,{title:answer.proposal.title,note,blocking:false},c.actor.email,assigneeId)
 task.id=id;task.revision=newId();task.work!.checklist=['Review cited source records','Record investigation findings'];c.entityId=id
 c.data.approvals.push({id:newId(),kind:'portfolio-investigation',recordId:id,revision:answer.digest,actorId:c.actor.id,at:c.now})
 // Standard task custody, assignment, audit and erasure apply; store no raw prompt
 // or conversation copy. The approved source window and digest remain attributable.
 return task
}
