import { type Booking, type Context, type HomeSettings, type Turnover, manager, need, newId, text } from '../model'
import { homeSettings } from '../homes'
import { held, overlaps } from '../inventory'
import { instant } from '../clock'
import { day } from '../direct/rules'
import { stays } from '../direct/store'
import { lifecycleCommand } from '../reservations/commands'
import { managementFor } from '../properties/terms'
import { requireAction, requireProperty } from '../permissions/policy'
import { planAssignment } from '../dispatch/planner'
import { applyPreparation, preparationCandidate, preparationPlan, type ArrivalPreparationPlan } from './arrival-preparation'
import type { Recovery } from './types'

export interface AlternativeProposal {
 propertyId: string; start: string; end: string; arrivalTime: string; cleanerId: string; reason: string
 preparation: ArrivalPreparationPlan; baseline: string; blockedReason?: string
}
export interface AlternativeOrigin {
 booking: Booking; turnover: Turnover; settings: HomeSettings; propertyId: string; appliedAt: string
}
type AlternativeRecovery = Recovery & { alternativeOrigin?: AlternativeOrigin; proposal?: Recovery['proposal'] & { alternative?: AlternativeProposal } }

const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
function booking(c: Context, row: Recovery) {
 const b = c.data.bookings.find(b => b.id === row.bookingId)
 need(b?.status === 'confirmed' && !b.guestErasedAt && !b.restorePaused && (b.kind ?? 'stay') === 'stay', 'Review the current confirmed stay before offering an alternative.', 409)
 return b
}
const targetBooking = (b: Booking, proposal: AlternativeProposal): Booking => ({ ...b, propertyId: proposal.propertyId, start: proposal.start, end: proposal.end, arrivalTime: proposal.arrivalTime })

async function sourceBlock(c: Context, b: Booking) {
 if (b.source !== 'request' || b.channel !== 'direct' || b.connectionId || b.lifecycle?.method === 'channel' || b.lifecycle?.sourceOrigin || b.lifecycle?.sourceReview || b.lifecycle?.sourceConflict) return 'This stay has external source authority. Reconcile and obtain source acceptance with the operator before proposing a native correction; Cabin has not changed its channel reservation.'
 if ((await stays(c.db)).some(s => s.bookingId === b.id)) return 'This direct checkout retains its signed agreement, payment and owner scope. Reconcile the checkout and obtain guest acceptance before preparing a supported reservation correction; no payment or refund has been made.'
 return undefined
}

/** Includes both homes, recipient, inventory, source revisions, terms, scopes and capacity. */
export function alternativeBaseline(c: Context, row: Recovery, proposal: AlternativeProposal) {
 const b = booking(c, row), homes = new Set([row.propertyId, b.propertyId, proposal.propertyId])
 const { baseline: _baseline, ...target } = proposal
 return canonical({ target, booking: b, turnover: c.data.turnovers.find(t => t.id === row.turnoverId),
  properties: c.data.properties.filter(p => homes.has(p.id)), settings: [...homes].sort().map(id => homeSettings(c, id)),
  policies: c.data.recoveryPolicies.filter(p => homes.has(p.propertyId)), terms: c.data.managementTerms.filter(p => homes.has(p.propertyId)),
  destinationTerms: managementFor(c.data, proposal.propertyId, proposal.start),
  cleaner: c.data.members.find(m => m.id === proposal.cleanerId), profile: c.data.cleanerProfiles.find(p => p.id === proposal.cleanerId),
  inventory: c.data.bookings.filter(n => homes.has(n.propertyId)),
  turnovers: c.data.turnovers.filter(t => homes.has(t.propertyId) || t.cleanerId === proposal.cleanerId),
  connections: c.data.connections.filter(n => homes.has(n.propertyId)), feeds: c.data.feeds.filter(n => homes.has(n.propertyId)),
  imports: c.data.calendarDrafts.filter(n => homes.has(n.propertyId) && n.status === 'draft'),
  codes: c.data.codes.filter(n => n.bookingId === b.id), collections: c.data.collectionPlans.filter(n => n.bookingId === b.id),
  agreements: c.data.rentalAgreements.filter(n => n.bookingId === b.id), templates: c.data.rentalTemplates.filter(n => homes.has(n.propertyId)),
  readinessPlans: c.data.readinessPlans.filter(n => homes.has(n.propertyId)), readiness: c.data.readinessRecords.filter(n => homes.has(n.propertyId)),
  tasks: c.data.tasks.filter(n => homes.has(n.propertyId) && n.status === 'open'),
  messages: c.data.messages.filter(n => n.bookingId === b.id && ['sending', 'pending'].includes(n.status)), scheduled: c.data.scheduled.filter(n => n.bookingId === b.id && n.status === 'sending') })
}

function validateTarget(c: Context, row: Recovery, p: AlternativeProposal) {
 const b = booking(c, row), next = targetBooking(b, p), s = homeSettings(c, p.propertyId)
 requireAction(c.actor, 'reservation.amend'); requireProperty(c.actor, row.propertyId); requireProperty(c.actor, b.propertyId); requireProperty(c.actor, p.propertyId)
 need(c.data.properties.some(home => home.id === p.propertyId), 'Alternative home not found', 404)
 need(!held(c, p.propertyId).some(n => n.id !== b.id && overlaps(n, next)), 'Alternative nights are no longer available. Prepare and review another exact stay.', 409)
 need(instant(`${p.start}T${p.arrivalTime}`, s.timeZone) > Date.parse(c.now), 'Choose an alternative arrival still ahead.', 409)
 const cleaner = c.data.members.find(m => m.id === p.cleanerId && m.active && m.role === 'cleaner')
 need(cleaner, 'Choose an active cleaner for the alternative stay.', 409)
 for (const id of new Set([row.propertyId, b.propertyId, p.propertyId])) {
  need(c.data.recoveryPolicies.find(policy => policy.propertyId === id)?.cleanerIds.includes(p.cleanerId), 'The cleaner must be allowed by both homes’ current recovery policies.', 403)
  need(!cleaner.scope || ((cleaner.scope.propertyIds.includes('*') || cleaner.scope.propertyIds.includes(id)) && (cleaner.scope.actions.includes('*') || cleaner.scope.actions.includes('operations:read'))), 'The cleaner needs an operations grant for both homes.', 403)
 }
 const actual = preparationPlan(c, next)
 need(canonical(actual) === canonical(p.preparation), 'The alternative preparation window or preceding stay changed. Prepare and review again.', 409)
 const candidate = preparationCandidate(c, next, p.preparation), start = instant(candidate.windowStart!, s.timeZone), end = instant(candidate.windowEnd!, s.timeZone)
 need(Date.parse(c.now) < end, 'The preparation window has ended. Review a different alternative.', 409)
 if (s.dispatch) { const plan = planAssignment(c, p.cleanerId, candidate); need(plan.ok, plan.reason, 409) }
 else need(!c.data.turnovers.some(t => t.id !== candidate.id && t.cleanerId === p.cleanerId && t.status === 'approved' && t.windowStart && t.windowEnd && instant(t.windowStart, homeSettings(c, t.propertyId).timeZone) < end && instant(t.windowEnd, homeSettings(c, t.propertyId).timeZone) > start), 'The cleaner has another assignment in the alternative window.', 409)
 return { b, next, settings: s }
}

export async function prepareAlternative(c: Context, row: Recovery, input: Record<string, unknown>): Promise<AlternativeProposal | undefined> {
 if (!['alternativePropertyId', 'alternativeStart', 'alternativeEnd', 'alternativeArrivalTime'].some(key => input[key] !== undefined && input[key] !== '')) return undefined
 const b = booking(c, row), propertyId = text(input.alternativePropertyId || b.propertyId, 'alternative home'), start = day(input.alternativeStart || b.start.slice(0, 10)), end = day(input.alternativeEnd || b.end.slice(0, 10))
 need(start < end && Date.parse(end) - Date.parse(start) <= 365 * 86400000, 'Choose 1 to 365 alternative nights.')
 need(propertyId !== b.propertyId || start !== b.start.slice(0, 10) || end !== b.end.slice(0, 10), 'Choose a different home or different dates for the alternative.')
 need(!input.futureDiscount || input.futureDiscount === 'off' || input.futureDiscount === false, 'Review an alternative stay separately from any future-rate offer.', 409)
 const arrivalTime = text(input.alternativeArrivalTime || b.arrivalTime || homeSettings(c, propertyId).checkInTime, 'alternative check-in time', 5)
 need(/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime), 'Enter alternative arrival as HH:MM.')
 const p: AlternativeProposal = { propertyId, start, end, arrivalTime, cleanerId: text(input.cleanerId, 'alternative cleaner'), reason: text(input.why || row.reason, 'alternative reason', 2000), preparation: { windowStart: '', windowEnd: '' }, baseline: '' }
 p.preparation = preparationPlan(c, targetBooking(b, p)); p.blockedReason = await sourceBlock(c, b)
 validateTarget(c, row, p); p.baseline = alternativeBaseline(c, row, p)
 return p
}

/** Only a reviewed native reservation amendment may move inventory. External cases stay open. */
export async function applyAlternative(c: Context, row: AlternativeRecovery) {
 const p = row.proposal?.alternative
 need(p && row.status === 'proposed', 'Review an exact alternative stay first.', 409)
 manager(c.actor); need(!c.actor.isAgent, 'A manager must approve the alternative stay.', 403)
 need(row.proposal?.cleanerId === p.cleanerId, 'Review the same cleaner for the exact alternative.', 409)
 const { b, settings } = validateTarget(c, row, p)
 need(!row.proposal?.futureRate && !row.proposal?.arrivalTime, 'Review the exact alternative separately from a future rate or arrival-only settlement.', 409)
 need(p.baseline === alternativeBaseline(c, row, p), 'Alternative inventory, source, terms, recipient, cleaner or window changed. Prepare and review again.', 409)
 const blocked = await sourceBlock(c, b)
 if (blocked || p.blockedReason) {
  row.status = 'escalated'; row.revision = newId(); row.history.push({ at: c.now, by: c.actor.id, action: 'Alternative requires source reconciliation', why: blocked || p.blockedReason! }); c.entityId = row.id
  return null
 }
 const old = c.data.turnovers.find(t => t.id === row.turnoverId)
 need(old && old.status !== 'cancelled', 'Original recovery turnover changed. Review the case.', 409)
 const origin: AlternativeOrigin = { propertyId: row.propertyId, booking: structuredClone(b), turnover: structuredClone(old), settings: structuredClone(homeSettings(c, b.propertyId)), appliedAt: c.now }
 const amended = await lifecycleCommand(c, 'reservation.amend', { id: b.id, revision: b.revision, propertyId: p.propertyId, start: p.start, end: p.end, arrivalTime: p.arrivalTime, guestName: b.guestName || b.summary, guestEmail: b.guestEmail, guestPhone: b.guestPhone, reason: p.reason })
 need(amended === b, 'The native reservation amendment was not accepted.', 409)
 row.alternativeOrigin ??= origin
 const t = applyPreparation(c, b, p.preparation); row.turnoverId = t.id
 // row.propertyId remains the source financial scope. Existing postings never transfer owners.
 delete row.guestAcceptedAt; delete row.guestAcceptedRevision
 row.history.push({ at: c.now, by: c.actor.id, action: 'Exact alternative reservation approved', why: `${origin.booking.propertyId} ${origin.booking.start}–${origin.booking.end} → ${b.propertyId} ${b.start}–${b.end}. Guest acceptance of these exact terms is still required.` })
 return { b, t, settings }
}
