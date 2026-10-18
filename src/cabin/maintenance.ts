import { initialWork } from './work-orders/records'
import { workOrderCommand } from './work-orders/commands'
import { type Context, type Task, need, text, newId, manager, property, exact } from './model'
import { photoList, storePhotos } from './photos'
import { homeSettings } from './homes'
// Broken things become tasks with photos: a cleaner reports one from their
// turnover, or a manager adds one by hand. It goes to the home's maintenance
// person (or whoever the manager picks), who is emailed (dispatch.ts); an open
// blocking task keeps the home from being ready for its next arrival.
const optional = (value: unknown, label: string, max: number) => value === undefined || value === null || String(value).trim() === '' ? '' : text(value, label, max)
const flag = (value: unknown) => value === true || value === 'on' || value === 'true' || value === '1'
const actorName = (c: Context) => c.actor.memberId ? c.data.members.find(m => m.id === c.actor.memberId)?.name ?? c.actor.email : c.actor.role === 'owner' ? 'The owner' : c.actor.email
function assignee(c: Context, value: unknown) {
 if (value === undefined || value === null || value === '') return null
 const m = c.data.members.find(r => r.id === text(value, 'member ID')); need(m?.active, 'Choose an active person'); return m.id
}
export async function taskCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'task.raise') {
  let propertyId: string, turnoverId: string | null = null
  if (c.actor.role === 'cleaner' && p.sourceTaskId) {
   const source=c.data.tasks.find(t=>t.id===p.sourceTaskId&&(t.assigneeId===c.actor.memberId||t.work?.inspectorId===c.actor.memberId));need(source,'Work order not found',404);propertyId=source.propertyId;turnoverId=source.turnoverId
  } else if (c.actor.role === 'cleaner') {
   const t = c.data.turnovers.find(r => r.id === text(p.turnoverId, 'turnover ID')); need(t && t.cleanerId === c.actor.memberId && (t.status === 'approved' || t.status === 'completed'), 'Turnover not found', 404)
   if (p.turnoverRevision !== undefined) exact(t, p.turnoverRevision)
   if (p.bookingRevision !== undefined) need(p.bookingRevision === t.bookingRevision, 'Booking changed. Review the current job before uploading.', 409)
   propertyId = t.propertyId; turnoverId = t.id
  } else {
   manager(c.actor)
   if (p.turnoverId) { const t = c.data.turnovers.find(r => r.id === text(p.turnoverId, 'turnover ID')); need(t, 'Turnover not found', 404); propertyId = t.propertyId; turnoverId = t.id }
   else propertyId = property(c, p.propertyId).id
  }
  return createMaintenanceTask(c,propertyId,turnoverId,p,actorName(c),c.actor.role==='cleaner'?null:assignee(c,p.assigneeId))
 }
 if (name === 'task.assign') {
  manager(c.actor); const row = c.data.tasks.find(t => t.id === text(p.id, 'task ID')); need(row, 'Task not found', 404); exact(row, p.revision)
  need(!row.work?.accepted,'Accepted work cannot be reassigned. Open a new corrective order.',409);
  need(row.status === 'open', 'This task is closed', 409); row.assigneeId = assignee(c, p.assigneeId); need(row.assigneeId, 'Choose who fixes it')
  row.blocking = flag(p.blocking)
  row.revision = newId(); c.entityId = row.id; return row
 }
 if (name === 'task.close') {
  return workOrderCommand(c,'work.complete',p)
 }
 return undefined
}

/** Caller supplies the authorized property/stay; all report content remains untrusted. */
export async function createMaintenanceTask(c:Context,propertyId:string,turnoverId:string|null,p:Record<string,unknown>,reporter:string,assigned:string|null=null){
 const title=text(p.title,'what is wrong',120),id=newId()
 const row:Task={id,revision:newId(),propertyId,turnoverId,title,note:optional(p.note,'note',1000),blocking:flag(p.blocking),assigneeId:assigned,status:'open',photos:await storePhotos(c,id,photoList(p,0,6),title),raisedBy:c.actor.id,raisedByName:reporter,raisedAt:c.now,closedBy:null,closedAt:null,closeNote:'',closePhotos:[],notified:null}
 row.work=initialWork(c.data,row)
 row.assigneeId??=homeSettings(c,propertyId).maintenanceId
 if(row.assigneeId&&!c.data.members.some(m=>m.id===row.assigneeId&&m.active))row.assigneeId=null
 c.data.tasks.push(row);c.entityId=id;return row
}
