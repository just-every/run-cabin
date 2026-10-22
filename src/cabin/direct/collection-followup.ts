import { need,newId,type Context } from '../model'
import type { CollectionPlan,CollectionJob } from './collection-types'
export async function followup(c:Context,p:CollectionPlan,j:CollectionJob,detail:string,notify=true){
 if(j.detail!==detail)p.history.push({at:c.now,detail:j.label+': '+detail})
 j.detail=detail;j.deadline??=new Date(Date.parse(c.now)+24*3600000).toISOString()
 if(!notify)return
 const member=c.data.members.find(m=>m.id===p.assigneeId&&m.active&&m.role==='manager'),owner=await c.db.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{id:string;email:string}>()
 const responsible=member??owner;need(responsible,'Restore the installation owner before following up payments',409)
 p.assigneeId=responsible.id
 const note='Reservation '+p.bookingId+' · Payments /app/direct. '+j.label+': '+detail+' Follow up by '+j.deadline+'. No automatic retry is authorized.'
 let task=c.data.tasks.find(t=>t.id===j.followupTaskId)
 if(!task){
  const id=newId();j.followupTaskId=id
  task={id,revision:newId(),propertyId:p.propertyId,turnoverId:null,title:'Reservation payment needs review',note,blocking:false,assigneeId:responsible.id,status:'open',photos:[],raisedBy:c.actor.id,raisedByName:'Cabin payments',raisedAt:c.now,closedBy:null,closedAt:null,closeNote:'',closePhotos:[],notified:null}
  c.data.tasks.push(task)
 }else {task.note=note;task.assigneeId=responsible.id;task.propertyId=p.propertyId;task.status='open';task.closedBy=null;task.closedAt=null;task.revision=newId()}
 const overdue=Date.parse(j.deadline)<=Date.parse(c.now),field=overdue?'overdueNoticeId':'followupNoticeId'
 if(j[field])return
 const id=newId();j[field]=id
 c.data.notices.push({id,revision:newId(),propertyId:p.propertyId,memberId:responsible.id,email:responsible.email,kind:'payment',recordId:p.id,subject:overdue?'Overdue reservation payment follow-up':'Reservation payment needs review',text:note,status:'pending',detail:null,createdAt:c.now,sentAt:null,...(overdue?{priority:'urgent' as const}:{})})
}
export function closeFollowup(c:Context,j:CollectionJob){
 for(const id of [j.followupNoticeId,j.overdueNoticeId]){const n=c.data.notices.find(n=>n.id===id);if(n?.status==='pending'){n.status='suppressed';n.detail='Payment follow-up resolved before delivery';n.revision=newId()}}
 const task=c.data.tasks.find(t=>t.id===j.followupTaskId)
 if(task?.status==='open'){task.status='closed';task.closedBy=c.actor.id;task.closedAt=c.now;task.closeNote='Payment follow-up resolved';task.revision=newId()}
}
