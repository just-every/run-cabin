import { type Booking, type Context, type Scheduled, newId } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { inboxSettings, RULES } from './settings'
// Run inside every commit, after dispatch (storage.commit): each confirmed stay
// gets its check-in instructions, checkout reminder and review request, due at
// instants worked out from the stay's dates and the home's check-in and
// check-out times in its own time zone. A moved stay moves the messages not yet
// sent, and a stay that moves after its message went out gets the new details
// at the new time; a cancelled stay, or a message turned off, cancels them. Each message
// has a deadline (check-in, check-out, a week after check-out) after which it
// is no longer worth sending; a stay booked inside a message's window gets it
// at once. Sending is deliver.ts, on every command and on the five-minute Cron.
const HOUR = 3_600_000
const isStay = (b: Booking) => (b.kind ?? 'stay') === 'stay'
export function times(c: Pick<Context, 'data'>, b: Booking) {
 const s = homeSettings(c, b.propertyId)
 return { checkin: instant(`${b.start.slice(0, 10)}T${s.checkInTime}`, s.timeZone), checkout: instant(`${b.end.slice(0, 10)}T${s.checkOutTime}`, s.timeZone) }
}
function cancel(row: Scheduled, reason: string) { if (row.status === 'scheduled') Object.assign(row, { status: 'cancelled', reason, revision: newId() }) }
export function scheduleMessages(c: Context) {
 const settings = inboxSettings(c), now = Date.parse(c.now)
 for (const b of c.data.bookings) {
  if (!isStay(b) || !c.data.properties.some(p => p.id === b.propertyId)) continue
  const rows = c.data.scheduled.filter(r => r.bookingId === b.id)
  if (b.status !== 'confirmed') { for (const r of rows) cancel(r, 'The stay was cancelled'); continue }
  const t = times(c, b)
  for (const rule of RULES) {
   const set = settings.schedule[rule], row = rows.find(r => r.rule === rule)
   if (!set.enabled) { if (row) cancel(row, 'Turned off in inbox settings'); continue }
   const due = rule === 'review' ? t.checkout + set.hours * HOUR : (rule === 'checkin' ? t.checkin : t.checkout) - set.hours * HOUR
   const deadline = rule === 'checkin' ? t.checkin : rule === 'checkout' ? t.checkout : t.checkout + 7 * 24 * HOUR
   const dueAt = new Date(due).toISOString(), until = new Date(deadline).toISOString(), anchor = new Date(rule === 'checkin' ? t.checkin : t.checkout).toISOString()
   if (!row) { if (now < deadline) c.data.scheduled.push({ id: newId(), revision: newId(), propertyId: b.propertyId, bookingId: b.id, rule, dueAt, deadline: until, anchor, status: 'scheduled', reason: null, messageId: null, createdAt: c.now, sentAt: null }); continue }
   if (row.status !== 'scheduled' && row.status !== 'cancelled' && row.status !== 'sending' && row.anchor && row.anchor !== anchor && now < deadline) { Object.assign(row, { dueAt, deadline: until, anchor, status: 'scheduled', reason: 'The stay moved: the new details go out', messageId: null, createdAt: c.now, sentAt: null, revision: newId() }); continue }
   const reopen = row.status === 'cancelled' && now < deadline
   if ((row.status === 'scheduled' || reopen) && (row.dueAt !== dueAt || row.deadline !== until || reopen)) Object.assign(row, { dueAt, deadline: until, anchor, status: 'scheduled', reason: null, revision: newId() })
  }
 }
}
/** When a message was due, as far as its stay knew: a stay booked after the due time made it due when it was booked. */
export const dueFrom = (r: Scheduled) => r.dueAt > r.createdAt ? r.dueAt : r.createdAt
/** Minutes late a sent message was, measured from when it fell due. */
export const lateMinutes = (r: Scheduled) => r.sentAt ? Math.max(0, Math.round((Date.parse(r.sentAt) - Date.parse(dueFrom(r))) / 60_000)) : null
