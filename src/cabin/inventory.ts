import { type Context, type Booking, type Channel, type Request, need, text, newId, manager, property } from './model'
import { emailOf, phoneOf } from './inbox/threads'
// One unit/night inventory per home: every confirmed booking or block holds its
// nights [first night, checkout). Commits are serialised by cb_meta's version
// guard, so two requests for the same night cannot both be accepted.
export const CHANNELS: Channel[] = ['airbnb', 'vrbo', 'booking.com', 'direct']
const NAMES: Record<string, string> = { airbnb: 'Airbnb', vrbo: 'Vrbo', 'booking.com': 'Booking.com', direct: 'Direct', ical: 'External calendar' }
export const channelName = (c: string) => NAMES[c] ?? c
export function channel(value: unknown, allowDirect = true): Channel {
 const v = text(value, 'channel').toLowerCase().replace(/^booking$/, 'booking.com')
 need((CHANNELS as string[]).includes(v) && (allowDirect || v !== 'direct'), allowDirect ? 'Choose Airbnb, Vrbo, Booking.com or Direct' : 'Choose Airbnb, Vrbo or Booking.com')
 return v as Channel
}
export const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
/** Nights as calendar dates: a timed checkout still frees that day's night. */
export const nights = (b: { start: string; end: string }) => ({ first: b.start.slice(0, 10), checkout: b.end.slice(0, 10) })
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }) { const x = nights(a), y = nights(b); return x.first < y.checkout && y.first < x.checkout }
export const held = (c: { data: { bookings: Booking[] } }, propertyId: string) => c.data.bookings.filter(b => b.propertyId === propertyId && b.status === 'confirmed')
const short = (day: string) => new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const span = (b: { start: string; end: string }) => { const n = nights(b); return `${short(n.first)} → ${short(n.checkout)}` }
export const describe = (b: Booking) => `${channelName(b.channel)} ${(b.kind ?? 'stay') === 'block' ? 'block' : 'stay'} ${span(b)}`
function day(value: unknown, label: string) {
 const v = text(value, label, 10); need(/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v, `Enter the ${label} as YYYY-MM-DD`); return v
}
function arrival(value: unknown) {
 if (value === undefined || value === null || value === '') return null
 const v = text(value, 'arrival time', 5); need(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Enter the arrival time as HH:MM'); return v
}
const optional = (value: unknown, label: string, max: number) => value === undefined || value === null || String(value).trim() === '' ? '' : text(value, label, max)
/** The guest's email and phone on a stay: their thread in the inbox and where scheduled messages go. */
function contact(p: Record<string, unknown>) {
 const email = optional(p.guestEmail, 'guest email', 254), phone = optional(p.guestPhone, 'guest phone', 40)
 need(!email || emailOf(email), 'Enter the guest’s email like name@example.com'); need(!phone || phoneOf(phone), 'Enter a US phone number with its area code, or a number starting with +')
 return { ...(email ? { guestEmail: emailOf(email)! } : {}), ...(phone ? { guestPhone: phoneOf(phone)! } : {}) }
}
export async function reservationCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'reservation.request') {
  manager(c.actor); const prop = property(c, p.propertyId), kind = p.kind === 'block' ? 'block' : 'stay', ch = kind === 'block' ? 'direct' : channel(p.channel)
  const start = day(p.start, 'arrival date'), end = day(p.end, 'checkout date')
  need(start < end, 'Checkout must follow arrival'); need(Date.parse(end) - Date.parse(start) <= 365 * 86_400_000, 'Hold at most 365 nights at a time')
  const guestName = kind === 'stay' ? text(p.guestName, 'guest name', 120) : '', note = optional(p.note, 'note', 300)
  const hit = held(c, prop.id).find(b => overlaps(b, { start, end }))
  const row: Request = { id: newId(), revision: newId(), propertyId: prop.id, channel: ch, kind, start, end, guestName, arrivalTime: kind === 'stay' ? arrival(p.arrivalTime) : null, note, status: hit ? 'declined' : 'accepted', reason: hit ? `Overlaps ${describe(hit)}` : null, overlaps: hit?.id ?? null, bookingId: null, requestedBy: c.actor.id, requestedAt: c.now }
  if (!hit) {
   const booking: Booking = { id: newId(), revision: newId(), uid: `cabin-${row.id}`, start, end, summary: kind === 'block' ? note || 'Blocked' : guestName, cancelled: false, kind, propertyId: prop.id, channel: ch, status: 'confirmed', approvedAt: c.now, source: 'request', ...(kind === 'stay' ? { guestName, ...contact(p) } : {}), ...(row.arrivalTime ? { arrivalTime: row.arrivalTime } : {}) }
   c.data.bookings.push(booking); row.bookingId = booking.id
  }
  c.data.requests.push(row); c.entityId = row.id; return row
 }
 if (name === 'reservation.cancel') {
  manager(c.actor); const b = c.data.bookings.find(r => r.id === text(p.id, 'booking ID')); need(b, 'Booking not found', 404); property(c, b.propertyId)
  need(!await c.db.prepare("SELECT 1 FROM cb_direct_stays WHERE json_extract(data,'$.bookingId')=?").bind(b.id).first(), 'This is a Stripe checkout. Review its payment and deposit in Direct bookings before changing inventory.', 409)
  need(b.source === 'request', 'Cancel a channel stay on the channel; its next sync reopens the nights.', 409); need(b.status === 'confirmed', 'This hold is already cancelled', 409)
  Object.assign(b, { status: 'cancelled', cancelled: true, revision: newId(), approvedAt: c.now }); c.entityId = b.id; return b
 }
 if (name === 'booking.details') {
  manager(c.actor); const b = c.data.bookings.find(r => r.id === text(p.id, 'booking ID')); need(b && b.status === 'confirmed', 'Booking not found', 404); property(c, b.propertyId)
  need((b.kind ?? 'stay') === 'stay', 'Blocks have no guest');need(!b.guestErasedAt,'This guest identity was erased; contact details cannot be restored on this stay',409)
  const guestName = optional(p.guestName, 'guest name', 120), time = arrival(p.arrivalTime)
  if (guestName) b.guestName = guestName; else delete b.guestName
  if (time) b.arrivalTime = time; else delete b.arrivalTime
  if ('guestEmail' in p || 'guestPhone' in p) { const k = contact(p); delete b.guestEmail; delete b.guestPhone; Object.assign(b, k) }
  if ('channelRef' in p) { const ref = optional(p.channelRef, 'reservation number', 64); need(!ref || /^[\w-]+$/.test(ref), 'Use the reservation number as the channel shows it'); if (ref) b.channelRef = ref; else delete b.channelRef }
  c.entityId = b.id; return b
 }
 if (name === 'reservation.move') {
  // New dates for a stay Cabin holds itself; its turnover, door code and scheduled messages follow it.
  manager(c.actor); const b = c.data.bookings.find(r => r.id === text(p.id, 'booking ID')); need(b && b.status === 'confirmed', 'Booking not found', 404); property(c, b.propertyId)
  need(b.source === 'request', 'Change a channel stay on the channel; its next sync moves it here.', 409)
  need(!await c.db.prepare("SELECT 1 FROM cb_direct_stays WHERE json_extract(data,'$.bookingId')=?").bind(b.id).first(), 'This is a Stripe checkout. Its dates are part of the signed agreement.', 409)
  const start = day(p.start, 'arrival date'), end = day(p.end, 'checkout date'); need(start < end, 'Checkout must follow arrival')
  const hit = held(c, b.propertyId).find(o => o.id !== b.id && overlaps(o, { start, end })); need(!hit, `Those nights overlap ${hit ? describe(hit) : ''}`, 409)
  Object.assign(b, { start, end, revision: newId(), approvedAt: c.now }); c.entityId = b.id; return b
 }
 return undefined
}
