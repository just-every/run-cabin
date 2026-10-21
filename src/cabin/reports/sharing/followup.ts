import { need, newId, type Context } from '../../model'
import { currentActor } from './scope'
import { saveFollowup } from './store'
import type { ReportRun, ReportFollowup } from './types'
export async function assignFollowup(c:Context,r:ReportRun){
 let creatorActive=false
 try{await currentActor(c.db,r.creator);creatorActive=true}catch{/* Changed grants require installation-owner review. */}
 const member=creatorActive&&r.creator.memberId?c.data.members.find(m=>m.id===r.creator.memberId&&m.active&&m.role==='manager'):null
 const owner=await c.db.prepare("SELECT id,email,display_name AS name FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{id:string;email:string;name:string}>()
 need(owner,'The installation owner must be restored before assigning report failures',409)
 const assignedTo=member?.id??owner.id,assignedEmail=member?.email??owner.email,assignedName=member?.name??owner.name
 need(assignedTo,'A responsible report operator is required',409)
 const f:ReportFollowup={id:newId(),revision:newId(),runId:r.id,scheduleId:r.scheduleId,reason:r.detail,assignedTo,assignedEmail,assignedName,createdAt:c.now}
 saveFollowup(c,f);return f
}
