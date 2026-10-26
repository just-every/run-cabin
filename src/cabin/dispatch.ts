import { isArrivalPreparation, synchronizeArrivalPreparations } from './recovery/arrival-preparation'
import { hasAction,permitsProperty } from './permissions/policy'
import { occupancy as isStay } from './blocks'
import { accessBlocked } from './agreements/records'
import { type Booking, type Context, type HomeSettings, type Turnover, newId, need } from './model'
import { homeSettings } from './homes'
import { issue, move, revoke } from './codes'
import { localDay } from './clock'
import { assignmentNotice, taskNotice } from './notices'
import { checkoutTime, cleaningAccess, staleCompletion } from './turnover-window'
import { instant } from './clock'
import { wall } from './clock'
import { synchronizeDispatch, reconcileAccepted, offerEligible } from './dispatch/offers'
// Run inside every commit (storage.commit), after the command changed the data:
// each confirmed stay, from any channel or a direct booking, gets exactly one
// turnover between its check-out and the next check-in, its guest door code for
// the stay, and, once a cleaner is assigned, the cleaner's own code for the
// window and an email. A moved stay moves its turnover, codes and email; a
// cancelled one cancels them. Stays that checked out before today start nothing.
const nights = (b: Booking) => ({ first: b.start.slice(0, 10), checkout: b.end.slice(0, 10) })
export const liveTurnover = (c: { data: { turnovers: Turnover[] } }, bookingId: string) => c.data.turnovers.find(t => !isArrivalPreparation(t) && t.bookingId === bookingId && t.status !== 'draft' && t.status !== 'cancelled')
const activeCleaner = (c: Context, id: string | null, propertyId?:string) => id ? c.data.members.find(m => m.id === id && m.active && m.role === 'cleaner'&&(!m.scope||m.scope.actions.includes('*')||m.scope.actions.includes('operations:read'))&&(!propertyId||!m.scope||m.scope.propertyIds.includes('*')||m.scope.propertyIds.includes(propertyId))) ?? null : null

function windowOf(c: Context, s: HomeSettings, b: Booking) {
 const checkout = nights(b).checkout
 const next = c.data.bookings.filter(n => n.propertyId === b.propertyId && n.id !== b.id && n.status === 'confirmed' && isStay(n) && nights(n).first >= checkout).sort((x, y) => x.start.localeCompare(y.start))[0]
 const start = checkoutTime(s, b), end = `${next ? nights(next).first : checkout}T${next?.arrivalTime ?? s.checkInTime}`
 return { windowStart: s.dispatch ? wall(instant(start, s.timeZone) + s.dispatch.startOffsetMinutes * 60000, s.timeZone) : start, windowEnd: s.dispatch ? wall(instant(end, s.timeZone) - s.dispatch.finishBeforeMinutes * 60000, s.timeZone) : end, nextBookingId: next?.id ?? null }
}

function cancel(c: Context, t: Turnover, reason: string) {
 Object.assign(t, { status: 'cancelled', cancelReason: reason, revision: newId() }); t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'cancelled', cleanerId: t.cleanerId }]
}

/** The cleaner's code follows the assignment: a new cleaner gets fresh digits, a moved window moves them. */
function cleanerCode(c: Context, s: HomeSettings, t: Turnover) {
 if(t.cleanerId&&!activeCleaner(c,t.cleanerId,t.propertyId)){t.cleanerId=null;if(t.status==='approved')t.status='unassigned';t.revision=newId()}
 const current = c.data.codes.filter(r => r.turnoverId === t.id && r.status === 'issued')
 for (const r of current) if (t.status !== 'approved' || r.memberId !== t.cleanerId) revoke(r, t.status === 'completed' ? 'Turnover complete' : 'Reassigned')
 if (t.status !== 'approved' || !t.cleanerId) return null
 const access = cleaningAccess(s, t)
 if (instant(access.validUntil, s.timeZone) <= instant(access.validFrom, s.timeZone)) { for (const r of current) revoke(r, 'No cleaning access before the next arrival'); return null }
 const mine = current.find(r => r.memberId === t.cleanerId && r.status === 'issued')
 if (mine) { if (move(c, s, mine, access.validFrom, access.validUntil) && t.notified) t.notified = { ...t.notified, code: '' }; return mine }
 return issue(c, s, { bookingId: t.bookingId, turnoverId: t.id, holder: 'cleaner', memberId: t.cleanerId, ...access })
}

export function dispatch(c: Context) {
 synchronizeArrivalPreparations(c)
 const now = Date.parse(c.now)
 const paused = (t: Turnover) => c.data.bookings.some(b=>b.id===t.bookingId&&b.restorePaused)
 for (const b of c.data.bookings) {
  if(b.restorePaused)continue
  if (!isStay(b) || b.guestErasedAt || !c.data.properties.some(p => p.id === b.propertyId)) continue
  const s = homeSettings(c, b.propertyId), t = liveTurnover(c, b.id), codes = c.data.codes.filter(r => r.bookingId === b.id && r.status === 'issued')
  if (b.status !== 'confirmed') {
   if (t && t.status !== 'completed') cancel(c, t, 'The stay was cancelled')
   for (const r of codes) revoke(r, 'The stay was cancelled')
   continue
  }
  const current = nights(b).checkout >= localDay(now, s.timeZone)
  if (!current && !t) continue
  const stay = { validFrom: `${nights(b).first}T${b.arrivalTime ?? s.checkInTime}`, validUntil: checkoutTime(s, b) }, guest = codes.find(r => r.holder === 'guest')
  if(b.kind==='block'||accessBlocked(c.data,b.id)){if(guest)revoke(guest,'Current rental agreement must be signed')}
  else if (guest) move(c, s, guest, stay.validFrom, stay.validUntil); else if (current) issue(c, s, { bookingId: b.id, turnoverId: null, holder: 'guest', memberId: null, ...stay })
  const w = windowOf(c, s, b)
  if (!t) {
   const cleaner = s.dispatch ? null : activeCleaner(c, s.cleanerId,b.propertyId)
   const row: Turnover = { id: newId(), revision: newId(), bookingId: b.id, bookingRevision: b.revision, propertyId: b.propertyId, cleanerId: cleaner?.id ?? null, checklist: [...s.checklist], photosRequired: s.photosRequired, dueDate: w.windowEnd.slice(0, 10), ...w, source: 'auto', status: cleaner ? 'approved' : 'unassigned', preparedBy: c.actor.id, preparedAt: c.now, notified: null, history: [{ at: c.now, by: c.actor.id, action: 'created', cleanerId: cleaner?.id ?? null }] }
   c.data.turnovers.push(row)
  } else {
   // A finished cleaning is evidence for this preceding stay only. A new next
   // arrival shortens the displayed gap, and a cleaning finished after it stays
   // done, shown as late; changed or premature evidence reopens, with its reason.
   const oldSettings = homeSettings(c.before, b.propertyId)
   if (t.status !== 'completed' && (t.bookingRevision !== b.revision || t.windowStart !== w.windowStart || oldSettings.timeZone !== s.timeZone)) delete t.checkedOut
   const stale = t.status === 'completed' ? staleCompletion(t, b, s, w.windowStart, oldSettings.timeZone) : null
   if (stale) {
    // Marking ready and reopening never land in one commit: the cleaner is refused with the reason instead.
    need(c.before.turnovers.find(x => x.id === t.id)?.status === 'completed', `Not marked ready: ${stale}. Reload the job.`, 409)
    const cleaner = activeCleaner(c, t.cleanerId,b.propertyId) ?? activeCleaner(c, s.cleanerId,b.propertyId)
    Object.assign(t, { status: cleaner ? 'approved' : 'unassigned', cleanerId: cleaner?.id ?? null, revision: newId(), checklist: [...s.checklist], photosRequired: s.photosRequired })
    delete t.completion; delete t.checkedOut
    t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: `reopened: ${stale}`, cleanerId: t.cleanerId }]
    if (t.notified) t.notified = { ...t.notified, code: '' }
   }
   // A first window (a turnover approved by hand) keeps its revision; a moved one takes a new one.
   if (t.windowStart !== w.windowStart || t.windowEnd !== w.windowEnd || t.nextBookingId !== w.nextBookingId) Object.assign(t, w, { dueDate: w.windowEnd.slice(0, 10) }, t.windowStart ? { revision: newId() } : {})
   if (t.status !== 'completed' && t.checkedOut && Date.parse(t.checkedOut.at) < instant(w.windowStart, s.timeZone)) delete t.checkedOut
   t.bookingRevision = b.revision
   if (t.status === 'unassigned' && !s.dispatch) { const cleaner = activeCleaner(c, s.cleanerId,b.propertyId); if (cleaner) { Object.assign(t, { status: 'approved', cleanerId: cleaner.id, revision: newId() }); t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'assigned', cleanerId: cleaner.id }] } }
  }
 }
 // Bring all windows and work revisions current before evaluating any route.
 for (const t of c.data.turnovers) if(!paused(t)) synchronizeDispatch(c, t)
 for (const t of c.data.turnovers) if(!paused(t)) reconcileAccepted(c, t)
 for (const t of c.data.turnovers) if(!paused(t)) offerEligible(c, t)
 for (const t of c.data.turnovers) {
  if (paused(t) || t.status === 'draft' || !t.windowStart) continue
  const s = homeSettings(c, t.propertyId)
  if (t.status === 'cancelled') { for (const r of c.data.codes) if (r.turnoverId === t.id) revoke(r, t.cancelReason ?? 'Turnover cancelled'); if (t.notified) assignmentNotice(c, s, t, null); continue }
  const code = cleanerCode(c, s, t)
  if (t.status !== 'completed') assignmentNotice(c, s, t, code)
 }
 for (const task of c.data.tasks) taskNotice(c, task)
}
