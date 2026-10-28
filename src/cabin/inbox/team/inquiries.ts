import type { Context, Data } from '../../model'
import { newId } from '../../model'
import { threads } from '../threads'
import { ensureCase, notifyMember } from './cases'
import { activeManager, teamSettings } from './settings'
import type { Inquiry } from '../../reservations/inquiries'
const stage=(q:Inquiry,now:number,minutes:number)=>now>=Date.parse(q.deadline)?'elapsed':now>=Date.parse(q.deadline)-minutes*60000?'approaching':'pending'
export function inquiryDeadlinesDue(data:Data,now:number){const team=teamSettings(data);return data.inquiries.some(q=>q.status==='inquiry'&&!q.restorePaused&&stage(q,now,team.urgentMinutes)!==q.deadlineStage)}
/** A local clock never confirms provider expiry. Each deadline stage reopens accountable native follow-up once. */
export function syncInquiryDeadlines(c:Context){
 const team=teamSettings(c.data),now=Date.parse(c.now)
 for(const q of c.data.inquiries){
  if(q.status!=='inquiry'||q.restorePaused)continue
  const next=stage(q,now,team.urgentMinutes)
  if(next==='pending'||next===q.deadlineStage)continue
  const t=threads(c.data).find(t=>t.id===q.threadId),to=activeManager(c.data,team.escalationMemberId)
  if(!t||!to)continue
  if(to.scope&&!to.scope.propertyIds.includes('*')&&!to.scope.propertyIds.includes(q.propertyId))continue
  if(to.scope&&!to.scope.actions.includes('*')&&!to.scope.actions.includes('inbox:read'))continue
  const row=ensureCase(c,t)
  Object.assign(row,{status:'open',urgency:'urgent',assigneeId:to.id,route:'Source inquiry deadline',acceptedAt:null,acceptedByName:null,waitingSince:c.now,dueAt:new Date(now+team.repeatMinutes*60000).toISOString()})
  row.escalations.push({at:c.now,toId:to.id,toName:to.name})
  notifyMember(c,row,t,to.id,`Inquiry deadline ${next}: ${q.guestName}`,`Source inquiry ${q.sourceId} for ${q.start} to ${q.end}, ${q.guests} guests, USD ${(q.quoteCents/100).toFixed(2)}. Source deadline ${q.deadline}. ${next==='elapsed'?'The deadline has elapsed locally.':'The deadline is approaching.'} Channel outcome remains unresolved. Open the source thread and reconcile there; Cabin has sent no channel decision.`)
  q.deadlineStage=next;q.revision=newId()
 }
}
