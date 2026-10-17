import { type Context, type Turnover, need, text, newId, preparer, manager, approve, exact } from './model'
import { photoList, storePhotos } from './photos'
import { checklist, homeSettings } from './homes'
import { liveTurnover } from './dispatch'
import { checkoutInstant, checkoutTime } from './turnover-window'
import { when } from './clock'
// Cabin dispatches each stay's turnover itself (dispatch.ts). People and agents
// can still prepare one by hand for review; approving it replaces the stay's
// dispatched turnover unless that one is already done. A manager reassigns; the
// assigned cleaner completes every checklist item with the home's photos.
const history = (c: Context, t: Turnover, action: string) => { t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action, cleanerId: t.cleanerId }] }
const afterCheckout = (c: Context, row: Turnover) => {
 const b = c.data.bookings.find(b => b.id === row.bookingId)
 need(b?.status === 'confirmed' && b.revision === row.bookingRevision, 'Booking changed. Ask the manager to review this turnover.', 409)
 const s = homeSettings(c, row.propertyId)
 need(Date.parse(c.now) >= checkoutInstant(s, b), `Guests have not checked out yet. Record departure and mark ready after ${when(checkoutTime(s, b))} (${s.timeZone}).`, 409)
}
export async function turnoverCommand(c:Context,name:string,p:Record<string,unknown>){
 if(name==='turnover.prepare'){
  preparer(c.actor);const booking=c.data.bookings.find(b=>b.id===text(p.bookingId,'booking ID'));need(booking&&booking.status==='confirmed','Choose an approved confirmed booking',409)
  const cleaner=c.data.members.find(m=>m.id===text(p.cleanerId,'cleaner ID'));need(cleaner?.active&&cleaner.role==='cleaner','Choose an active cleaner')
  const row:Turnover={id:newId(),revision:newId(),bookingId:booking.id,bookingRevision:booking.revision,propertyId:booking.propertyId,cleanerId:cleaner.id,checklist:checklist(p.checklist),photosRequired:homeSettings(c,booking.propertyId).photosRequired,dueDate:booking.end.slice(0,10),source:'manual',status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
  c.data.turnovers.push(row);c.entityId=row.id;return row
 }
 if(name==='turnover.approve'){
  manager(c.actor);const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row,'Turnover not found',404)
  const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking?.status==='confirmed'&&booking.revision===row.bookingRevision,'Booking changed. Prepare a new turnover.',409)
  need(c.data.members.some(m=>m.id===row.cleanerId&&m.active&&m.role==='cleaner'),'Cleaner access changed',409)
  const live=liveTurnover(c,row.bookingId);need(live?.status!=='completed','This stay’s turnover is already done',409)
  approve(c,'turnover',row,p.revision);history(c,row,'approved')
  if(live){Object.assign(live,{status:'cancelled',cancelReason:'Replaced by an approved turnover',revision:newId()});history(c,live,'replaced')}
  c.entityId=row.id;return row
 }
 if(name==='turnover.assign'){
  manager(c.actor);const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row,'Turnover not found',404);exact(row,p.revision)
  need(row.status==='unassigned'||row.status==='approved','Only an open turnover can be assigned',409)
  const cleaner=c.data.members.find(m=>m.id===text(p.cleanerId,'cleaner ID'));need(cleaner?.active&&cleaner.role==='cleaner','Choose an active cleaner')
  need(cleaner.id!==row.cleanerId,`${cleaner.name} already has this turnover`,409)
  Object.assign(row,{cleanerId:cleaner.id,status:'approved',revision:newId()});history(c,row,'assigned');c.entityId=row.id;return row
 }
 if(name==='turnover.checkout'){
  // The actual check-out, as the cleaner finds it on arrival or a manager records it.
  const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row&&(c.actor.role!=='cleaner'||row.cleanerId===c.actor.memberId),'Turnover not found',404)
  if(c.actor.role!=='cleaner')manager(c.actor);need(row.status==='approved'||row.status==='unassigned','Only an open turnover records a check-out',409);need(!row.checkedOut,'Check-out is already recorded',409)
  afterCheckout(c,row)
  row.checkedOut={at:c.now,by:c.actor.id,source:c.actor.role==='cleaner'?'cleaner':'staff'};history(c,row,'checked out');c.entityId=row.id;return row
 }
 if(name==='turnover.complete'){
  need(c.actor.role==='cleaner','Only the assigned cleaner can complete a turnover',403)
  const row=c.data.turnovers.find(t=>t.id===text(p.id,'turnover ID'));need(row&&row.cleanerId===c.actor.memberId,'Turnover not found',404);exact(row,p.revision)
  need(row.status==='approved','Only an approved turnover can be completed once',409)
  afterCheckout(c,row)
  const checks=checklist(p.checks);need(checks.length===row.checklist.length&&row.checklist.every(item=>checks.includes(item)),'Complete every item from the approved checklist')
  const photos=photoList(p,row.photosRequired??1),caption=text(p.caption,'photo caption',300),stored=await storePhotos(c,row.id,photos,caption)
  row.checkedOut??={at:c.now,by:c.actor.id,source:'cleaner'}
  row.status='completed';row.completion={checks:[...row.checklist],photoId:stored[0].id,caption,mimeType:stored[0].mimeType,sha256:stored[0].sha256,photos:stored,completedBy:c.actor.id,completedAt:c.now};history(c,row,'completed');c.entityId=row.id;return row
 }
 return undefined
}
