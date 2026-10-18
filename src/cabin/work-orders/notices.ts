import { type Context, type Task, newId } from '../model'
export async function inspectionNotice(c:Context,task:Task){
 const work=task.work!;if(!work.requiresInspection||!work.inspectorId)return
 const inspector=work.inspectorId==='installation-owner'?await c.db.prepare("SELECT id,email,display_name AS name FROM oa_operators WHERE role='owner' AND status='active' LIMIT 1").first<{id:string;email:string;name:string}>():c.data.members.find(m=>m.id===work.inspectorId&&m.active)
 if(!inspector)return
 c.data.notices.push({id:newId(),revision:newId(),propertyId:task.propertyId,memberId:inspector.id,email:inspector.email,kind:'task',recordId:task.id,subject:`Inspection required: ${task.title}`,text:`${inspector.name},\n\nCompleted work on ${work.asset} needs your inspection before this work order closes. Review the checklist, completion photos and invoice in Cabin.\n\n${work.completed!.note}`,status:'pending',detail:null,createdAt:c.now,sentAt:null})
}
