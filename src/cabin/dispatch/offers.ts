import { type Context, type Turnover, need, newId, exact, manager, text } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { planAssignment, driveMinutes } from './planner'
import { dispatchNotice, offerNotice, escalate, resolveEscalation } from './messages'

export const dispatchHistory = (c: Context, t: Turnover, action: string, cleanerId = t.cleanerId) => { t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action, cleanerId }] }
export function withdrawOffers(c: Context, t: Turnover, reason: string) {
 for (const offer of t.dispatch?.offers ?? []) if (offer.status === 'pending' || offer.status === 'accepted') {
  offer.status = 'withdrawn'; offer.respondedAt = c.now; offer.reason = reason
  dispatchNotice(c, t, offer.memberId, 'Turnover offer withdrawn', reason)
 }
}
export function synchronizeDispatch(c: Context, t: Turnover) {
 const s = homeSettings(c, t.propertyId), config = s.dispatch
 if (!config || t.status === 'draft' || !t.windowStart) return
 if (t.status === 'completed') { resolveEscalation(c, t); return }
 if (t.status === 'cancelled') { withdrawOffers(c, t, t.cancelReason ?? 'Turnover cancelled'); resolveEscalation(c, t); return }
 const baseline = JSON.stringify([t.bookingRevision, t.windowStart, t.windowEnd, s.timeZone, s.address, t.checklist, t.photosRequired, config.templateName, config.instructions, config.durationMinutes, config.rateCents, config.approvedCleanerIds, config.responseMinutes, config.reminderMinutes, config.escalationMinutes, config.offerCount])
 if (t.dispatch?.baseline === baseline) return
 const old = t.dispatch
 withdrawOffers(c, t, 'The booking, window or approved work changed. Review the replacement offer before accepting.')
 if (old?.acceptedBy) dispatchHistory(c, t, 'acceptance invalidated because the approved work changed', old.acceptedBy)
 t.dispatch = { generation: newId(), baseline, templateName: config.templateName, instructions: config.instructions, durationMinutes: config.durationMinutes, rateCents: config.rateCents, offers: old?.offers ?? [], reasons: [] }
 Object.assign(t, { cleanerId: null, status: 'unassigned', revision: newId() })
}
function addOffer(c: Context, t: Turnover, memberId: string) {
 const s = homeSettings(c, t.propertyId), d = t.dispatch!, config = s.dispatch!
 const deadline = Math.min(Date.parse(c.now) + config.responseMinutes * 60000, instant(t.windowEnd!, s.timeZone) - (d.durationMinutes + config.escalationMinutes) * 60000)
 if (deadline <= Date.parse(c.now)) return false
 const offer = { id: newId(), generation: d.generation, memberId, offeredAt: c.now, expiresAt: new Date(deadline).toISOString(), status: 'pending' as const }
 d.offers.push(offer); dispatchHistory(c, t, `offered; response due ${offer.expiresAt}`, memberId); offerNotice(c, t, offer)
 return true
}
export function offerEligible(c: Context, t: Turnover) {
 const d = t.dispatch, config = homeSettings(c, t.propertyId).dispatch
 if (!d || !config || t.status !== 'unassigned') return
 const now = Date.parse(c.now)
 for (const offer of d.offers) if (offer.generation === d.generation && offer.status === 'pending') {
  if (Date.parse(offer.expiresAt) <= now) { offer.status = 'expired'; offer.respondedAt = c.now; offer.reason = 'No response before the deadline'; dispatchHistory(c, t, 'offer expired without acceptance', offer.memberId); dispatchNotice(c, t, offer.memberId, 'Turnover offer expired', 'The response deadline passed. You are not assigned this job.') }
  else if (!offer.reminderAt && now >= Date.parse(offer.expiresAt) - config.reminderMinutes * 60000) { offer.reminderAt = c.now; offerNotice(c, t, offer, true) }
 }
 const pending = d.offers.filter(o => o.generation === d.generation && o.status === 'pending')
 const tried = new Set([...d.offers.filter(o => o.generation === d.generation).map(o => o.memberId), ...d.excludedCleanerIds ?? []])
 const reasons: string[] = []
 const eligible = config.approvedCleanerIds.filter(id => !tried.has(id)).map(id => ({ id, plan: planAssignment(c, id, t) }))
 for (const item of eligible) if (!item.plan.ok) reasons.push(`${c.data.members.find(m => m.id === item.id)?.name ?? 'Cleaner'}: ${item.plan.reason}`)
 // "Nearby" means the manager's saved one-way home-base drive time, never an invented distance.
 const preferred = homeSettings(c, t.propertyId).cleanerId
 eligible.filter(e => e.plan.ok).sort((a, b) => config.offerCount === 1 && a.id === preferred ? -1 : config.offerCount === 1 && b.id === preferred ? 1 : (driveMinutes(c, a.id, t.propertyId) ?? Infinity) - (driveMinutes(c, b.id, t.propertyId) ?? Infinity)).slice(0, config.offerCount - pending.length).forEach(e => {
  if (!addOffer(c, t, e.id)) reasons.push('There is not enough time left to accept and complete the work before arrival')
 })
 const active = d.offers.filter(o => o.generation === d.generation && o.status === 'pending')
 d.reasons = reasons
 if (!active.length) {
  if (!reasons.length) d.reasons.push('All approved cleaners declined, expired or became unavailable; no eligible backup remains')
  escalate(c, t, d.reasons)
 } else if (now >= instant(t.windowEnd!, homeSettings(c, t.propertyId).timeZone) - (d.durationMinutes + config.escalationMinutes) * 60000) escalate(c, t, ['No cleaner has accepted before the pre-arrival deadline', ...reasons])
}
export function reconcileAccepted(c: Context, t: Turnover) {
 const d = t.dispatch
 if (!d?.acceptedBy || t.status !== 'approved') return
 const plan = planAssignment(c, d.acceptedBy, t, false)
 if (!plan.ok) {
  const reason = `Assignment requires replacement: ${plan.reason}`
  withdrawOffers(c, t, reason); dispatchHistory(c, t, reason)
  delete d.acceptedAt; delete d.acceptedBy; delete d.scheduledStart; delete d.scheduledEnd
  Object.assign(t, { cleanerId: null, status: 'unassigned', revision: newId() }); d.reasons = [reason]; escalate(c, t, d.reasons); return
 }
 d.scheduledStart = plan.start; d.scheduledEnd = plan.end
 const s = homeSettings(c, t.propertyId), config = s.dispatch!, end = instant(t.windowEnd!, s.timeZone), now = Date.parse(c.now)
 if (!d.completionReminderAt && now >= end - (d.durationMinutes + config.escalationMinutes) * 60000) { d.completionReminderAt = c.now; dispatchNotice(c, t, d.acceptedBy, 'Turnover completion reminder', `This accepted job must be ready before ${t.windowEnd} (${s.timeZone}). Contact your manager if it is at risk.`) }
 if (now >= end - config.escalationMinutes * 60000) escalate(c, t, ['Accepted turnover is still incomplete at the pre-arrival escalation deadline'])
}
export function offerCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (!['turnover.accept', 'turnover.decline', 'turnover.offers'].includes(name)) return undefined
 const t = c.data.turnovers.find(t => t.id === text(p.id, 'turnover ID')); need(t, 'Turnover not found', 404)
 if (name === 'turnover.offers') {
  manager(c.actor); exact(t, p.revision); need(t.dispatch && t.status === 'unassigned', 'Only an unassigned configured job can reopen offers', 409)
  withdrawOffers(c, t, 'Manager reopened this job for new offers'); t.dispatch.generation = newId(); t.dispatch.excludedCleanerIds = []; t.revision = newId(); dispatchHistory(c, t, 'manager reopened offers'); c.entityId = t.id; return t
 }
 need(c.actor.role === 'cleaner' && c.actor.memberId, 'Only the offered cleaner can respond', 403)
 const d = t.dispatch, offer = d?.offers.find(o => o.id === p.offerId && o.memberId === c.actor.memberId)
 need(d && offer, 'Turnover offer not found', 404); exact(t, p.revision)
 if (name === 'turnover.decline' && offer.status === 'accepted' && d.acceptedBy === c.actor.memberId && t.cleanerId === c.actor.memberId && t.status === 'approved') {
  offer.status = 'declined'; offer.respondedAt = c.now; offer.reason = text(p.reason, 'reason for cancelling the accepted job', 500)
  dispatchHistory(c, t, `accepted cleaner cancelled: ${offer.reason}`, offer.memberId)
  d.generation = newId(); d.excludedCleanerIds = [offer.memberId]; delete d.acceptedBy; delete d.acceptedAt; delete d.scheduledStart; delete d.scheduledEnd; delete d.completionReminderAt
  Object.assign(t, { cleanerId: null, status: 'unassigned', revision: newId() }); escalate(c, t, [`Accepted cleaner cancelled: ${offer.reason}. Seeking eligible backups.`]); c.entityId = t.id; return t
 }
 need(offer.generation === d.generation && offer.status === 'pending' && t.status === 'unassigned' && !t.cleanerId, 'This offer is no longer available; another cleaner may have accepted', 409)
 need(Date.parse(c.now) < Date.parse(offer.expiresAt), 'This offer expired. Reload to see your current jobs.', 409)
 need(c.data.bookings.some(b => b.id === t.bookingId && b.status === 'confirmed' && b.revision === t.bookingRevision), 'The booking changed. Review a new offer.', 409)
 if (name === 'turnover.decline') { offer.status = 'declined'; offer.reason = text(p.reason, 'reason for declining', 500); dispatchHistory(c, t, `declined: ${offer.reason}`, offer.memberId); escalate(c, t, [`Cleaner declined: ${offer.reason}. Seeking eligible backups.`]) }
 else {
  const plan = planAssignment(c, offer.memberId, t); need(plan.ok, `Cannot accept: ${plan.reason}`, 409)
  offer.status = 'accepted'; d.acceptedBy = offer.memberId; d.acceptedAt = c.now; d.scheduledStart = plan.start; d.scheduledEnd = plan.end; d.reasons = []
  Object.assign(t, { status: 'approved', cleanerId: offer.memberId })
  for (const other of d.offers) if (other.status === 'pending') { other.status = 'withdrawn'; other.respondedAt = c.now; other.reason = 'Another eligible cleaner accepted first'; dispatchNotice(c, t, other.memberId, 'Turnover offer filled', 'Another eligible cleaner accepted first. You are not assigned this job.') }
  dispatchHistory(c, t, 'accepted', offer.memberId); resolveEscalation(c, t)
 }
 offer.respondedAt = c.now; t.revision = newId(); c.entityId = t.id; return t
}
export function requestCleaner(c: Context, t: Turnover, memberId: string) {
 const plan = planAssignment(c, memberId, t); need(plan.ok, `Cannot offer this assignment: ${plan.reason}`, 409)
 withdrawOffers(c, t, 'Manager selected a replacement cleaner'); const d = t.dispatch!
 delete d.acceptedBy; delete d.acceptedAt; delete d.scheduledStart; delete d.scheduledEnd
 d.generation = newId(); d.reasons = []; t.cleanerId = null; t.status = 'unassigned'; t.revision = newId()
 need(addOffer(c, t, memberId), 'Not enough time remains before arrival to offer this job', 409)
 dispatchHistory(c, t, 'manager requested acceptance', memberId)
}
