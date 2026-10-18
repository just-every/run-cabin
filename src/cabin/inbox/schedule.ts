import { type Booking, type Context, type Scheduled, newId } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { RULES } from './settings'
import { lifecycleHome } from './lifecycle-settings'
import { lifecycleContent, lifecycleOptout, quietUntil } from './lifecycle-policy'
import { stays } from '../direct/store'
import type { DirectStay } from '../direct/types'
const HOUR = 3_600_000
export function times(c: Pick<Context, 'data'>, b: Booking) {
 const s = homeSettings(c, b.propertyId)
 return { checkin: instant(`${b.start.slice(0, 10)}T${b.arrivalTime ?? s.checkInTime}`, s.timeZone), checkout: instant(`${b.end.slice(0, 10)}T${s.checkOutTime}`, s.timeZone) }
}
const codeWindow = (c: Pick<Context, 'data'>, b: Booking) => { const r = c.data.codes.find(r => r.bookingId === b.id && r.holder === 'guest' && r.status === 'issued'); return r ? `${r.id}|${r.validFrom}|${r.validUntil}` : '' }
function cancel(row: Scheduled, reason: string) { if (['scheduled', 'failed', 'unavailable'].includes(row.status)) Object.assign(row, { status: 'cancelled', reason, revision: newId() }) }
/** Stored due times and delivery records survive restart; only changed guest-facing facts authorize a correction. */
function schedule(c: Context, direct: DirectStay[] = []) {
 const now = Date.parse(c.now)
 for (const b of c.data.bookings) {
  if (b.restorePaused || b.guestErasedAt || !c.data.properties.some(p => p.id === b.propertyId)) continue
  const checkout = direct.find(s => s.bookingId === b.id), isStay = (b.kind ?? 'stay') === 'stay'
  if (!isStay && !checkout) continue
  const rows = c.data.scheduled.filter(r => r.bookingId === b.id), t = times(c, b)
  if (b.status !== 'confirmed' || lifecycleOptout(c.data, b)) { for (const r of rows) cancel(r, b.status !== 'confirmed' ? 'The stay was cancelled' : 'The guest opted out of lifecycle messages'); continue }
  for (const rule of RULES) {
   if (!isStay && !['payment', 'identity', 'signature'].includes(rule)) continue
   const set = lifecycleHome(c.data, b.propertyId).schedule[rule], row = rows.find(r => r.rule === rule)
   if (!set.enabled) { if (row) cancel(row, 'Turned off in inbox settings'); continue }
   const event = ['confirmation', 'payment', 'signature', 'identity'].includes(rule)
   const base = event ? Date.parse(b.approvedAt) : ['review', 'repeat', 'checkout'].includes(rule) ? t.checkout : t.checkin
   const rawDue = base + (['checkin', 'checkout'].includes(rule) ? -1 : 1) * set.hours * HOUR
   const timingRevision=JSON.stringify([new Date(base).toISOString(),set.hours,lifecycleHome(c.data,b.propertyId).quietFrom,lifecycleHome(c.data,b.propertyId).quietUntil,lifecycleHome(c.data,b.propertyId).channels]); const dueAt = new Date(quietUntil(c.data, b, rawDue)).toISOString(), anchor = new Date(base).toISOString()
   const deadline = ['review', 'repeat'].includes(rule) ? t.checkout + Math.max(90 * 24 * HOUR, set.hours * HOUR + 7 * 24 * HOUR) : t.checkout
   const until = new Date(deadline).toISOString(), code = rule === 'checkin' ? codeWindow(c, b) : undefined
   if (!row) { if(now>=deadline)continue; c.data.scheduled.push({ id: newId(), revision: newId(), propertyId: b.propertyId, bookingId: b.id, rule, timingRevision, dueAt, deadline: until, anchor, code, status: 'scheduled', reason: null, messageId: null, createdAt: c.now, sentAt: null }); continue }
   if (row.status === 'sending') continue
   if(row.status==='unavailable'&&(row.sourceRevision!==b.revision||row.timingRevision!==timingRevision))Object.assign(row,{status:'scheduled',reason:'Contact or delivery policy changed; checking the current route',messageId:null,revision:newId()})
   if (row.status === 'cancelled' && now < deadline) Object.assign(row, { status: 'scheduled', reason: null, revision: newId() })
   if (row.status === 'scheduled' && row.timingRevision !== timingRevision) {Object.assign(row, { timingRevision, dueAt, deadline: until, anchor, code });delete row.nextEligibleAt}
  }
 }
}
/** Synchronous preparation also serves import snapshots and the demo lane's existing caller. */
export function scheduleMessages(c: Context) { schedule(c) }
/** Every commit reconciles direct holds and delivered content before any provider effect. */
export async function synchronizeMessages(c: Context) {
 schedule(c, await stays(c.db))
 for(const row of c.data.scheduled.filter(r=>r.status==='sent'||r.status==='suppressed')){
  const b=c.data.bookings.find(b=>b.id===row.bookingId)
  if(!b||b.restorePaused||b.guestErasedAt||b.status!=='confirmed'||lifecycleOptout(c.data,b))continue
  const set=lifecycleHome(c.data,b.propertyId).schedule[row.rule];if(!set.enabled)continue
  const t=times(c,b),event=['confirmation','payment','signature','identity'].includes(row.rule)
  const base=event?Date.parse(b.approvedAt):['review','repeat','checkout'].includes(row.rule)?t.checkout:t.checkin
  const anchor=new Date(base).toISOString(),code=row.rule==='checkin'?codeWindow(c,b):undefined
  const content=await lifecycleContent(c,b,row.rule,null),same=row.content===content.subject+'\n'+content.text
  const corrected=content.eligible&&!same&&(row.anchor!==anchor||row.rule==='checkin')
  const deadline=['review','repeat'].includes(row.rule)?t.checkout+Math.max(90*24*HOUR,set.hours*HOUR+7*24*HOUR):t.checkout
  if(corrected&&Date.parse(c.now)<deadline){
   const due=base+(['checkin','checkout'].includes(row.rule)?-1:1)*set.hours*HOUR
   Object.assign(row,{status:'scheduled',dueAt:new Date(quietUntil(c.data,b,due)).toISOString(),deadline:new Date(deadline).toISOString(),anchor,code,reason:'Current reservation or released access details changed',updated:true,messageId:null,createdAt:c.now,sentAt:null,revision:newId()})
  }else if(same)Object.assign(row,{anchor,code})
 }
}
export const dueFrom = (r: Scheduled) => r.dueAt > r.createdAt ? r.dueAt : r.createdAt
export const lateMinutes = (r: Scheduled) => r.sentAt ? Math.max(0, Math.round((Date.parse(r.sentAt) - Date.parse(dueFrom(r))) / 60_000)) : null
