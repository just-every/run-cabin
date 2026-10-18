import { type Booking, type Context, type Scheduled, newId } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { inboxSettings, RULES } from './settings'
import { statement } from './render'
// Run inside every commit, after dispatch (storage.commit): each confirmed stay
// gets its check-in instructions, checkout reminder and review request, due at
// instants worked out from the stay's dates and the home's check-in and
// check-out times in its own time zone. A moved stay moves the messages not yet
// sent, and a stay that moves after its message went out gets the new details
// at the new time; a cancelled stay, or a message turned off, cancels them. Each message
// has a deadline (check-in, check-out, a week after check-out) after which it
// is no longer worth sending; a stay booked inside a message's window gets it
// at once. Check-in instructions state the guest's door code and the hours it
// works: if that code or its hours change after they went out (a new check-out
// time, say), the corrected instructions go out again, marked Updated, until
// check-out. A message goes out again only when what it says changed. Sending is deliver.ts, on every command and on the five-minute Cron.
const HOUR = 3_600_000
const isStay = (b: Booking) => (b.kind ?? 'stay') === 'stay'
export function times(c: Pick<Context, 'data'>, b: Booking) {
 const s = homeSettings(c, b.propertyId)
 return { checkin: instant(`${b.start.slice(0, 10)}T${s.checkInTime}`, s.timeZone), checkout: instant(`${b.end.slice(0, 10)}T${s.checkOutTime}`, s.timeZone) }
}
/** The guest door code a check-in message states, as sent: which code and the hours it works. */
const codeWindow = (c: Pick<Context, 'data'>, b: Booking) => { const r = c.data.codes.find(r => r.bookingId === b.id && r.holder === 'guest' && r.status === 'issued'); return r ? `${r.id}|${r.validFrom}|${r.validUntil}` : '' }
const settled = (row: Scheduled) => row.status !== 'scheduled' && row.status !== 'cancelled' && row.status !== 'sending'
function cancel(row: Scheduled, reason: string) { if (row.status === 'scheduled') Object.assign(row, { status: 'cancelled', reason, revision: newId() }) }
export function scheduleMessages(c: Context) {
 const settings = inboxSettings(c), now = Date.parse(c.now)
 for (const b of c.data.bookings) {
  if(b.restorePaused)continue
  if (!isStay(b) || b.guestErasedAt || !c.data.properties.some(p => p.id === b.propertyId)) continue
  const rows = c.data.scheduled.filter(r => r.bookingId === b.id)
  if (b.status !== 'confirmed') { for (const r of rows) cancel(r, 'The stay was cancelled'); continue }
  const t = times(c, b)
  for (const rule of RULES) {
   const set = settings.schedule[rule], row = rows.find(r => r.rule === rule)
   if (!set.enabled) { if (row) cancel(row, 'Turned off in inbox settings'); continue }
   const due = rule === 'review' ? t.checkout + set.hours * HOUR : (rule === 'checkin' ? t.checkin : t.checkout) - set.hours * HOUR
   // Corrected check-in instructions stay worth sending until check-out: the code they state works until then.
   const deadline = rule === 'checkin' ? (row?.updated ? t.checkout : t.checkin) : rule === 'checkout' ? t.checkout : t.checkout + 7 * 24 * HOUR
   const dueAt = new Date(due).toISOString(), until = new Date(deadline).toISOString(), anchor = new Date(rule === 'checkin' ? t.checkin : t.checkout).toISOString()
   const code = rule === 'checkin' ? codeWindow(c, b) : undefined
   if (!row) { if (now < deadline) c.data.scheduled.push({ id: newId(), revision: newId(), propertyId: b.propertyId, bookingId: b.id, rule, dueAt, deadline: until, anchor, code, status: 'scheduled', reason: null, messageId: null, createdAt: c.now, sentAt: null }); continue }
   const delivered = row.status === 'sent' || row.status === 'suppressed'
   // A message already out whose words would not change (a review request after a new check-out time, say) is not sent again.
   const same = delivered && row.content !== undefined && row.content === statement(c.data, b, set)
   if (same && ((row.anchor && row.anchor !== anchor) || (code !== undefined && row.code !== undefined && row.code !== code))) { Object.assign(row, { anchor, code, revision: newId() }); continue }
   if (settled(row) && row.anchor && row.anchor !== anchor && now < deadline) { Object.assign(row, { dueAt, deadline: until, anchor, code, status: 'scheduled', reason: 'The stay moved: the new details go out', updated: true, messageId: null, createdAt: c.now, sentAt: null, revision: newId() }); continue }
   if (delivered && code && row.code !== undefined && row.code !== code && now < t.checkout) { Object.assign(row, { dueAt, deadline: new Date(t.checkout).toISOString(), anchor, code, status: 'scheduled', reason: 'The door code or its hours changed: the corrected details go out', updated: true, messageId: null, createdAt: c.now, sentAt: null, revision: newId() }); continue }
   if (code !== undefined && row.code !== code && (row.code === undefined || (!delivered && row.status !== 'sending'))) row.code = code
   const reopen = row.status === 'cancelled' && now < deadline
   if ((row.status === 'scheduled' || reopen) && (row.dueAt !== dueAt || row.deadline !== until || reopen)) Object.assign(row, { dueAt, deadline: until, anchor, status: 'scheduled', reason: reopen ? null : row.reason, updated: reopen ? undefined : row.updated, revision: newId() })
  }
 }
}
/** When a message was due, as far as its stay knew: a stay booked after the due time made it due when it was booked. */
export const dueFrom = (r: Scheduled) => r.dueAt > r.createdAt ? r.dueAt : r.createdAt
/** Minutes late a sent message was, measured from when it fell due. */
export const lateMinutes = (r: Scheduled) => r.sentAt ? Math.max(0, Math.round((Date.parse(r.sentAt) - Date.parse(dueFrom(r))) / 60_000)) : null
