import { type Booking, type Context, type HomeSettings, type Turnover, newId } from './model'
import { homeSettings } from './homes'
import { issue, move, revoke } from './codes'
import { localDay } from './clock'
import { assignmentNotice, taskNotice } from './notices'
// Run inside every commit (storage.commit), after the command changed the data:
// each confirmed stay, from any channel or a direct booking, gets exactly one
// turnover between its check-out and the next check-in, its guest door code for
// the stay, and, once a cleaner is assigned, the cleaner's own code for the
// window and an email. A moved stay moves its turnover, codes and email; a
// cancelled one cancels them. Stays that checked out before today start nothing.
const nights = (b: Booking) => ({ first: b.start.slice(0, 10), checkout: b.end.slice(0, 10) })
const isStay = (b: Booking) => (b.kind ?? 'stay') === 'stay'
export const liveTurnover = (c: { data: { turnovers: Turnover[] } }, bookingId: string) => c.data.turnovers.find(t => t.bookingId === bookingId && t.status !== 'draft' && t.status !== 'cancelled')
const activeCleaner = (c: Context, id: string | null) => id ? c.data.members.find(m => m.id === id && m.active && m.role === 'cleaner') ?? null : null

function windowOf(c: Context, s: HomeSettings, b: Booking) {
 const checkout = nights(b).checkout
 const next = c.data.bookings.filter(n => n.propertyId === b.propertyId && n.id !== b.id && n.status === 'confirmed' && isStay(n) && nights(n).first >= checkout).sort((x, y) => x.start.localeCompare(y.start))[0]
 return { windowStart: `${checkout}T${s.checkOutTime}`, windowEnd: `${next ? nights(next).first : checkout}T${s.checkInTime}`, nextBookingId: next?.id ?? null }
}

function cancel(c: Context, t: Turnover, reason: string) {
 Object.assign(t, { status: 'cancelled', cancelReason: reason, revision: newId() }); t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'cancelled', cleanerId: t.cleanerId }]
}

/** The cleaner's code follows the assignment: a new cleaner gets fresh digits, a moved window moves them. */
function cleanerCode(c: Context, s: HomeSettings, t: Turnover) {
 const current = c.data.codes.filter(r => r.turnoverId === t.id && r.status === 'issued')
 for (const r of current) if (t.status !== 'approved' || r.memberId !== t.cleanerId) revoke(r, t.status === 'completed' ? 'Turnover complete' : 'Reassigned')
 if (t.status !== 'approved' || !t.cleanerId) return null
 const mine = current.find(r => r.memberId === t.cleanerId)
 if (mine) { move(c, s, mine, t.windowStart!, t.windowEnd!); return mine }
 return issue(c, s, { bookingId: t.bookingId, turnoverId: t.id, holder: 'cleaner', memberId: t.cleanerId, validFrom: t.windowStart!, validUntil: t.windowEnd! })
}

export function dispatch(c: Context) {
 const now = Date.parse(c.now)
 for (const b of c.data.bookings) {
  if (!isStay(b) || !c.data.properties.some(p => p.id === b.propertyId)) continue
  const s = homeSettings(c, b.propertyId), t = liveTurnover(c, b.id), codes = c.data.codes.filter(r => r.bookingId === b.id && r.status === 'issued')
  if (b.status !== 'confirmed') {
   if (t && t.status !== 'completed') cancel(c, t, 'The stay was cancelled')
   for (const r of codes) revoke(r, 'The stay was cancelled')
   continue
  }
  const current = nights(b).checkout >= localDay(now, s.timeZone)
  if (!current && !t) continue
  const stay = { validFrom: `${nights(b).first}T${s.checkInTime}`, validUntil: `${nights(b).checkout}T${s.checkOutTime}` }, guest = codes.find(r => r.holder === 'guest')
  if (guest) move(c, s, guest, stay.validFrom, stay.validUntil); else if (current) issue(c, s, { bookingId: b.id, turnoverId: null, holder: 'guest', memberId: null, ...stay })
  const w = windowOf(c, s, b)
  if (!t) {
   const cleaner = activeCleaner(c, s.cleanerId)
   const row: Turnover = { id: newId(), revision: newId(), bookingId: b.id, bookingRevision: b.revision, propertyId: b.propertyId, cleanerId: cleaner?.id ?? null, checklist: [...s.checklist], photosRequired: s.photosRequired, dueDate: w.windowEnd.slice(0, 10), ...w, source: 'auto', status: cleaner ? 'approved' : 'unassigned', preparedBy: c.actor.id, preparedAt: c.now, notified: null, history: [{ at: c.now, by: c.actor.id, action: 'created', cleanerId: cleaner?.id ?? null }] }
   c.data.turnovers.push(row)
  } else if (t.status !== 'completed') {
   // A first window (a turnover approved by hand) keeps its revision; a moved one takes a new one.
   if (t.windowStart !== w.windowStart || t.windowEnd !== w.windowEnd || t.nextBookingId !== w.nextBookingId) Object.assign(t, w, { dueDate: w.windowEnd.slice(0, 10) }, t.windowStart ? { revision: newId() } : {})
   t.bookingRevision = b.revision
   if (t.status === 'unassigned') { const cleaner = activeCleaner(c, s.cleanerId); if (cleaner) { Object.assign(t, { status: 'approved', cleanerId: cleaner.id, revision: newId() }); t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'assigned', cleanerId: cleaner.id }] } }
  }
 }
 for (const t of c.data.turnovers) {
  if (t.status === 'draft' || !t.windowStart) continue
  const s = homeSettings(c, t.propertyId)
  if (t.status === 'cancelled') { for (const r of c.data.codes) if (r.turnoverId === t.id) revoke(r, t.cancelReason ?? 'Turnover cancelled'); if (t.notified) assignmentNotice(c, s, t, null); continue }
  const code = cleanerCode(c, s, t)
  if (t.status !== 'completed') assignmentNotice(c, s, t, code)
 }
 for (const task of c.data.tasks) taskNotice(c, task)
}
