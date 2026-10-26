import { type Booking, type Context, type HomeSettings, type Turnover, need, newId } from '../model'
import { homeSettings } from '../homes'
import { instant, wall } from '../clock'
import { checkoutTime } from '../turnover-window'

export interface ArrivalPreparationPlan { turnoverId?: string; windowStart: string; windowEnd: string }
export type ArrivalPreparation = Turnover & { purpose: 'arrival' }
export const isArrivalPreparation = (t: Turnover): t is ArrivalPreparation => 'purpose' in t && t.purpose === 'arrival'

/** The last occupied interval controls vacancy even when its opaque source did not create a turnover. */
function arrivalWindow(c: Context, b: Booking) {
 const settings = homeSettings(c, b.propertyId)
 const previous = c.data.bookings.filter(n => n.id !== b.id && n.propertyId === b.propertyId && n.status === 'confirmed' && n.end.slice(0, 10) <= b.start.slice(0, 10)).sort((a, z) => z.end.localeCompare(a.end))[0]
 const start = previous ? checkoutTime(settings, previous) : `${b.start.slice(0, 10)}T${settings.checkOutTime}`
 const windowStart = wall(instant(start, settings.timeZone) + (settings.dispatch?.startOffsetMinutes ?? 0) * 60000, settings.timeZone)
 const arrival = `${b.start.slice(0, 10)}T${b.arrivalTime ?? settings.checkInTime}`
 const windowEnd = wall(instant(arrival, settings.timeZone) - (settings.dispatch?.finishBeforeMinutes ?? 0) * 60000, settings.timeZone)
 return { previous, windowStart, windowEnd }
}

export function preparationPlan(c: Context, b: Booking): ArrivalPreparationPlan {
 const { previous, windowStart, windowEnd } = arrivalWindow(c, b)
 const settings = homeSettings(c, b.propertyId)
 need(instant(windowStart, settings.timeZone) < instant(windowEnd, settings.timeZone), 'There is no cleaning window before the alternative arrival. Review different dates or a later arrival.', 409)
 const preceding = previous && c.data.turnovers.find(t => !isArrivalPreparation(t) && t.bookingId === previous.id && t.bookingRevision === previous.revision && t.propertyId === b.propertyId && !['draft', 'cancelled'].includes(t.status))
 const arrival = c.data.turnovers.find(t => isArrivalPreparation(t) && t.bookingId === b.id && t.propertyId === b.propertyId && !['draft', 'cancelled'].includes(t.status))
 return { ...(preceding || arrival ? { turnoverId: (preceding || arrival)!.id } : {}), windowStart, windowEnd }
}

/** A preview is a real job shape for dispatch capacity checking, never completion evidence. */
export function preparationCandidate(c: Context, b: Booking, plan: ArrivalPreparationPlan): Turnover {
 const old = plan.turnoverId && c.data.turnovers.find(t => t.id === plan.turnoverId)
 if (old) return { ...old, windowStart: plan.windowStart, windowEnd: plan.windowEnd, nextBookingId: b.id, dueDate: plan.windowEnd.slice(0, 10) }
 const settings = homeSettings(c, b.propertyId)
 return { id: `arrival:${b.id}`, revision: b.revision, purpose: 'arrival', propertyId: b.propertyId, bookingId: b.id, bookingRevision: b.revision, cleanerId: null, checklist: [...settings.checklist], photosRequired: settings.photosRequired, dueDate: plan.windowEnd.slice(0, 10), windowStart: plan.windowStart, windowEnd: plan.windowEnd, nextBookingId: b.id, status: 'unassigned', source: 'auto', preparedBy: c.actor.id, preparedAt: c.now, notified: null } as ArrivalPreparation
}

export function applyPreparation(c: Context, b: Booking, plan: ArrivalPreparationPlan): Turnover {
 const existing = plan.turnoverId && c.data.turnovers.find(t => t.id === plan.turnoverId)
 if (existing) {
  need(existing.propertyId === b.propertyId && existing.status !== 'cancelled', 'The alternative cleaning changed. Review a new proposal.', 409)
  Object.assign(existing, { windowStart: plan.windowStart, windowEnd: plan.windowEnd, nextBookingId: b.id, dueDate: plan.windowEnd.slice(0, 10), revision: newId() })
  if (isArrivalPreparation(existing)) existing.bookingRevision = b.revision
  return existing
 }
 const row = preparationCandidate(c, b, plan)
 row.id = newId(); row.revision = newId()
 row.history = [{ at: c.now, by: c.actor.id, action: 'arrival preparation created for approved alternative', cleanerId: null }]
 c.data.turnovers.push(row)
 return row
}

/** Arrival jobs participate in ordinary cleaner acceptance, checklist, photos and access. */
export function validArrivalCompletion(t: Turnover, b: Booking, settings: HomeSettings) {
 if (!isArrivalPreparation(t) || b.status !== 'confirmed' || b.propertyId !== t.propertyId || t.bookingRevision !== b.revision || t.nextBookingId !== b.id || t.status !== 'completed' || !t.completion || !t.windowStart || !t.windowEnd) return false
 const done = Date.parse(t.completion.completedAt)
 return Number.isFinite(done) && done >= instant(t.windowStart, settings.timeZone) && done <= instant(t.windowEnd, settings.timeZone)
  && t.checklist.every(item => t.completion!.checks.includes(item)) && (t.completion.photos?.length ?? (t.completion.photoId ? 1 : 0)) >= (t.photosRequired ?? 1)
  && (!t.dispatch || t.dispatch.acceptedBy === t.cleanerId)
}

/** Run before ordinary dispatch so moved bookings cannot retain old arrival evidence or codes. */
export function synchronizeArrivalPreparations(c: Context) {
 for (const t of c.data.turnovers.filter(isArrivalPreparation)) {
  if (t.status === 'cancelled' || t.status === 'draft') continue
  const b = c.data.bookings.find(b => b.id === t.bookingId)
  if (b?.restorePaused) continue
  const s = homeSettings(c, t.propertyId)
  const w = b && b.propertyId === t.propertyId && b.status === 'confirmed' ? arrivalWindow(c, b) : null
  if (!b || !w || instant(w.windowStart, s.timeZone) >= instant(w.windowEnd, s.timeZone)) {
   t.status = 'cancelled'; t.cancelReason = 'Alternative stay or arrival preparation window changed'; t.revision = newId(); continue
  }
  const oldSettings = homeSettings(c.before, t.propertyId)
  const changed = t.bookingRevision !== b.revision || t.windowStart !== w.windowStart || t.windowEnd !== w.windowEnd || oldSettings.timeZone !== s.timeZone || JSON.stringify(t.checklist) !== JSON.stringify(s.checklist) || t.photosRequired !== s.photosRequired
  if (!changed) continue
  Object.assign(t, { bookingRevision: b.revision, windowStart: w.windowStart, windowEnd: w.windowEnd, dueDate: w.windowEnd.slice(0, 10), nextBookingId: b.id, checklist: [...s.checklist], photosRequired: s.photosRequired, revision: newId() })
  if (t.status === 'completed') t.status = t.cleanerId ? 'approved' : 'unassigned'
  delete t.completion; delete t.checkedOut
  t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'arrival preparation changed; fresh completion required', cleanerId: t.cleanerId }]
 }
}
