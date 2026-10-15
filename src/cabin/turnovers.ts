import { type Context, type Turnover, need, text, newId, preparer, manager, approve, exact, query, sha } from './model'
import { photoBytes } from './photos'
function checklist(value:unknown){need(Array.isArray(value)&&value.length>0&&value.length<=50,'Use a checklist of 1 to 50 items');const items=value.map(v=>text(v,'checklist item',250));need(new Set(items).size===items.length,'Checklist items must be unique');return items}
export async function turnoverCommand(c:Context,name:string,p:Record<string,unknown>){
 if(name==='turnover.prepare'){
  preparer(c.actor);const booking=c.data.bookings.find(b=>b.id===text(p.bookingId,'booking ID'));need(booking&&booking.status==='confirmed','Choose an approved confirmed booking',409)
  const cleaner=c.data.members.find(m=>m.id===text(p.cleanerId,'cleaner ID'));need(cleaner?.active&&cleaner.role==='cleaner','Choose an active cleaner')
  const row:Turnover={id:newId(),revision:newId(),bookingId:booking.id,bookingRevision:booking.revision,propertyId:booking.propertyId,cleanerId:cleaner.id,checklist:checklist(p.checklist),dueDate:booking.end.slice(0,10),status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
  c.data.turnovers.push(row);c.entityId=row.id;return row
 }
 if(name==='turnover.approve'){
  manager(c.actor);const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row,'Turnover not found',404)
  const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking?.status==='confirmed'&&booking.revision===row.bookingRevision,'Booking changed. Prepare a new turnover.',409)
  need(c.data.members.some(m=>m.id===row.cleanerId&&m.active&&m.role==='cleaner'),'Cleaner access changed',409)
  need(!c.data.turnovers.some(t=>t.id!==row.id&&t.bookingId===row.bookingId&&t.status!=='draft'),'This booking already has an approved turnover',409)
  approve(c,'turnover',row,p.revision);c.entityId=row.id;return row
 }
 if(name==='turnover.complete'){
  need(c.actor.role==='cleaner','Only the assigned cleaner can complete a turnover',403)
  const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row&&row.cleanerId===c.actor.memberId,'Turnover not found',404);exact(row,p.revision)
  need(row.status==='approved','Only an approved turnover can be completed once',409)
  const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking?.status==='confirmed'&&booking.revision===row.bookingRevision,'Booking changed. Ask the manager to review this turnover.',409)
  const checks=checklist(p.checks);need(checks.length===row.checklist.length&&row.checklist.every(item=>checks.includes(item)),'Complete every item from the approved checklist')
  const photo=photoBytes(p.photo,p.mimeType),photoId=newId(),caption=text(p.caption,'photo caption',300),digest=await sha(photo.bytes)
  c.queries.push(query('INSERT INTO cb_photos(id,turnover_id,mime_type,bytes,sha256,caption,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?)',photoId,row.id,photo.mimeType,photo.bytes,digest,caption,c.actor.id,c.now))
  row.status='completed';row.completion={checks:[...row.checklist],photoId,caption,mimeType:photo.mimeType,sha256:digest,completedBy:c.actor.id,completedAt:c.now};c.entityId=row.id;return row
 }
 return undefined
}
