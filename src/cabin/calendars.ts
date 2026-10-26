import { type Context, type Booking, type CalendarDraft, type CalendarEvent, type CalendarChange, type Channel, type Clash, need, text, newId, preparer, manager, property, approve, sha } from './model'
import { sharesCapacity } from './capacity'
import { parseCalendar } from './calendar-file'
import { channel as channelOf } from './inventory'
export async function calendarBaseline(c: Context, propertyId: string) { return sha(JSON.stringify({capacity:c.data.propertyProfiles.map(p=>[p.propertyId,p.inventoryUnits]),bookings:c.data.bookings.filter(b => sharesCapacity(c.data,b.propertyId,propertyId)).sort((a,b) => a.id.localeCompare(b.id))})) }
function clashes(bookings: { id: string; propertyId: string; start: string; end: string }[], data: Context['data']): Clash[] {
 const found: Clash[] = []
 for (let i=0;i<bookings.length;i++) for (let j=i+1;j<bookings.length;j++) {
  const a=bookings[i],b=bookings[j]
  if (sharesCapacity(data,a.propertyId,b.propertyId) && Date.parse(a.start)<Date.parse(b.end) && Date.parse(b.start)<Date.parse(a.end)) found.push({a:a.id,b:b.id,start:a.start>b.start?a.start:b.start,end:a.end<b.end?a.end:b.end})
 }
 return found
}
/** A channel's bookings against its calendar: Cabin's own holds are never removed by a feed. */
export const channelBookings = (c: Context, propertyId: string, channel: Channel, connectionId?: string) => c.data.bookings.filter(b=>{
 const origin=b.lifecycle?.sourceOrigin
 return origin?origin.propertyId===propertyId&&origin.channel===channel&&(!connectionId||origin.connectionId===connectionId):b.propertyId===propertyId&&b.channel===channel&&(!connectionId||b.connectionId===connectionId)&&b.source!=='request'&&b.source!=='migration'
}).map(b=>b.lifecycle?.sourceOrigin?{...b,...b.lifecycle.sourceOrigin.snapshot,status:'confirmed' as const}:b)

export function reconcile(old: Booking[], events: CalendarEvent[]) {
 const changes: CalendarChange[]=[]
 for(const e of events) {
  const prior=old.find(b=>b.uid===e.uid)
  if(e.cancelled) { if(prior?.status==='confirmed')changes.push({kind:'cancel',uid:e.uid,before:prior,after:e});continue }
  if(!prior) changes.push({kind:'add',uid:e.uid,after:e})
  else if(prior.status==='cancelled'||['start','end','summary'].some(k=>e[k as keyof CalendarEvent]!==prior[k as keyof Booking])) changes.push({kind:'change',uid:e.uid,before:prior,after:e})
 }
 for(const b of old) if(b.status==='confirmed'&&!events.some(e=>e.uid===b.uid))changes.push({kind:'remove',uid:b.uid,before:b})
 return changes
}
/** Apply reconciled changes; a feed stay on the dates of a hold Cabin granted for that channel adopts the hold. */
export function applyChanges(c: Context, propertyId: string, channel: Channel, changes: CalendarChange[], connectionId?: string) {
 for(const change of changes) {
  let prior=c.data.bookings.find(b=>(b.propertyId===propertyId&&b.channel===channel&&b.uid===change.uid&&(!connectionId||b.connectionId===connectionId))||(b.lifecycle?.sourceOrigin?.propertyId===propertyId&&b.lifecycle.sourceOrigin.channel===channel&&b.lifecycle.sourceOrigin.uid===change.uid&&(!connectionId||b.lifecycle.sourceOrigin.connectionId===connectionId)))
  if(prior?.lifecycle?.sourceReview){const e=change.after;prior.lifecycle.sourceConflict={start:e?.start??prior.start,end:e?.end??prior.end,summary:e?.summary??prior.summary,cancelled:change.kind==='cancel'||change.kind==='remove',at:c.now};prior.revision=newId();if(e&&prior.lifecycle.sourceOrigin)prior.lifecycle.sourceOrigin.snapshot={start:e.start,end:e.end,summary:e.summary};continue}
  if(change.kind==='cancel'||change.kind==='remove') { need(prior,'Booking no longer exists',409);Object.assign(prior,{status:'cancelled',cancelled:true,revision:newId(),approvedAt:c.now});continue }
  const e=change.after!
  if(!connectionId) prior??=c.data.bookings.find(b=>b.propertyId===propertyId&&b.channel===channel&&(b.source==='request'||b.source==='migration')&&b.status==='confirmed'&&b.start===e.start.slice(0,10)&&b.end===e.end.slice(0,10))
  const row:Booking={...(prior??{}),...e,id:prior?.id??newId(),revision:newId(),propertyId,channel,status:'confirmed',approvedAt:c.now,source:'feed',...(connectionId?{connectionId}: {})}
  if(!e.guestName&&prior?.guestName)row.guestName=prior.guestName
  if(prior?.arrivalTime)row.arrivalTime=prior.arrivalTime
  if(prior)Object.assign(prior,row);else c.data.bookings.push(row)
 }
}
export async function calendarCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'calendar.prepare') {
  preparer(c.actor); const prop = property(c,p.propertyId), channel = channelOf(p.channel,false)
  const old = channelBookings(c,prop.id,channel)
  const events=parseCalendar(p.calendar,old), changes=reconcile(old,events)
  const resulting=[...c.data.bookings.filter(b=>sharesCapacity(c.data,b.propertyId,prop.id)&&(b.propertyId!==prop.id||b.channel!==channel)&&b.status==='confirmed'&&b.kind!=='block'),...events.filter(e=>!e.cancelled&&e.kind!=='block').map(e=>({...e,propertyId:prop.id,id:`${channel}:${e.uid}`}))]
  const row: CalendarDraft={id:newId(),revision:newId(),propertyId:prop.id,channel,importedAt:c.now,events,changes,clashes:clashes(resulting,c.data),baseline:await calendarBaseline(c,prop.id),status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
  c.data.calendarDrafts.push(row);c.entityId=row.id;return row
 }
 if(name==='calendar.approve') {
  manager(c.actor);const draft=c.data.calendarDrafts.find(d=>d.id===text(p.id,'draft ID'));need(draft,'Calendar draft not found',404)
  property(c,draft.propertyId);need(await calendarBaseline(c,draft.propertyId)===draft.baseline,'Bookings changed. Prepare and review the calendar again.',409)
  approve(c,'calendar',draft,p.revision)
  applyChanges(c,draft.propertyId,draft.channel,draft.changes)
  const feedId=`${draft.propertyId}:${draft.channel}`, feed={id:feedId,propertyId:draft.propertyId,channel:draft.channel,importedAt:draft.importedAt,approvedAt:c.now,draftId:draft.id}
  const old=c.data.feeds.find(f=>f.id===feedId);if(old)Object.assign(old,feed);else c.data.feeds.push(feed)
  c.entityId=draft.id;return {id:draft.id,revision:draft.revision,approval:draft.approval,clashes:draft.clashes}
 }
 return undefined
}
