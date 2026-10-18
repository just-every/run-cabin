import { homeReadiness } from '../readiness'
import { offerCommand } from '../dispatch/offers'
import { planAssignment } from '../dispatch/planner'
import { homeSettings } from '../homes'
import { type Context, need, text, integer, newId, manager, owner, exact } from '../model'
import { context, openReported, baseline, note } from './cases'
import { withinLimits } from './limits'
import { applyRecovery, undoRecovery } from './actions'
import { prepareSettlement } from './settlement'
import { creditText, guestMessage } from './messages'
import { authorityCommand, automaticAuthorityReason } from './authority'
import { captureRecoveryEffects, unresolvedRecoveryEffects } from './effects'
import { recoveryEffectCommand } from './reconcile'

function amount(p: Record<string, unknown>, cents: string, dollars: string) {
 if (p[cents] !== undefined) return integer(p[cents], cents, 0, 100_000_000)
 const value = String(p[dollars] ?? '0'); need(/^\d+(?:\.\d{1,2})?$/.test(value), 'Enter USD with at most two decimal places')
 return integer(Math.round(Number(value) * 100), dollars, 0, 100_000_000)
}
export async function recoveryCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (!name.startsWith('recovery.')) return undefined
 need(!c.actor.isAgent, 'Bearer keys can prepare drafts only. Recovery execution uses its separately granted native authority.', 403)
 const authority = authorityCommand(c, name, p); if (authority !== undefined) return authority
 if (name === 'recovery.effect.resolve' || name === 'recovery.execution.review') return recoveryEffectCommand(c, name, p)
 if (name === 'recovery.open') { if (c.actor.role !== 'cleaner') manager(c.actor); return openReported(c, p) }
 if (name === 'recovery.settings') {
  owner(c.actor); const propertyId = text(p.propertyId, 'home'); need(c.data.properties.some(h => h.id === propertyId), 'Home not found', 404)
  const old = c.data.recoveryPolicies.find(r => r.propertyId === propertyId); if (old) exact(old, p.revision)
  const ids = Array.isArray(p.cleanerIds) ? p.cleanerIds.filter(Boolean) : p.cleanerIds ? [p.cleanerIds] : []
  need(ids.length > 0 && ids.length <= 50 && ids.every(id => c.data.members.some(m => m.id === id && m.active && m.role === 'cleaner')), 'Choose the home’s active backup cleaners')
  const row = { id: `recovery-policy:${propertyId}`, propertyId, revision: newId(), cleanerIds: [...new Set(ids)] as string[], auto: p.auto === true || p.auto === 'on', creditLimitCents: amount(p, 'creditLimitCents', 'creditLimitDollars'), cleaningLimitCents: amount(p, 'cleaningLimitCents', 'cleaningLimitDollars'), savedBy: c.actor.id, futureDiscountBps: p.futureDiscountAllowed === true || p.futureDiscountAllowed === 'on' ? 1000 : 0 }
  if (old) { if(old.authority)old.authority.revision=newId(); Object.assign(old, row) } else c.data.recoveryPolicies.push(row)
  c.entityId = propertyId; return row
 }
 if (name === 'recovery.plan') {
  manager(c.actor); const row = c.data.recoveries.find(r => r.id === p.id); need(row, 'Recovery case not found', 404); exact(row, p.revision)
  const { t, policy } = context(c, row)
  const cleaner = policy?.cleanerIds.map(id => c.data.members.find(m => m.id === id)).find(m => m?.active && m.role === 'cleaner' && m.id !== t.cleanerId && (!homeSettings(c,t.propertyId).dispatch || planAssignment(c,m.id,t).ok) && !c.data.turnovers.some(job => job.id !== t.id && job.cleanerId === m.id && job.status === 'approved' && job.windowStart! < t.windowEnd! && job.windowEnd! > t.windowStart!))
  if (!cleaner) { row.status = 'escalated'; note(c, row, 'Owner needed', 'No active backup cleaner is free in this turnover window. Reschedule with the cleaner and review the stay.'); return row }
  return recoveryCommand(c, 'recovery.propose', { ...p, cleanerId: cleaner.id, creditCents: Math.min(7500, policy!.creditLimitCents), extraCleaningCents: 0, why: 'Active backup from the home’s list with no overlapping assigned turnover. Credit follows the owner’s saved limit.' })
 }
 const row = c.data.recoveries.find(r => r.id === text(p.id, 'case')); need(row, 'Recovery case not found', 404); exact(row, p.revision)
 const { b, t, policy } = context(c, row)
 if (name === 'recovery.accept') {
  if(t.dispatch && row.proposal?.cleanerId===c.actor.memberId) {
   const offer=t.dispatch.offers.find(o=>o.memberId===c.actor.memberId&&o.status==='pending'&&o.generation===t.dispatch?.generation)
   if(offer)offerCommand(c,'turnover.accept',{id:t.id,revision:t.revision,offerId:offer.id})
  }
  need(c.actor.role === 'cleaner' && t.cleanerId === c.actor.memberId, 'Only the assigned cleaner can accept this recovery', 403)
  need(row.status === 'active' && !row.acceptedAt, 'This job is not awaiting acceptance', 409)
  row.appliedBaseline=JSON.stringify({booking:b.revision,recipient:b.guestEmail,cleanerId:t.cleanerId}); row.acceptedAt = c.now; note(c, row, 'Replacement cleaner accepted', 'The assigned cleaner accepted the recovery turnover'); return row
 }
 manager(c.actor)
 if (name === 'recovery.propose') {
  need(['open', 'proposed', 'escalated'].includes(row.status) && !row.statementId, 'This action has already been applied', 409)
  const cleanerId = text(p.cleanerId ?? p.newCleanerId, 'replacement cleaner')
  need(policy?.cleanerIds.includes(cleanerId), 'Choose a cleaner from this home’s recovery list')
  need(cleanerId !== t.cleanerId, 'Choose a replacement cleaner')
  const creditCents = amount(p, 'creditCents', 'creditDollars'), extraCleaningCents = amount(p, 'extraCleaningCents', 'extraCleaningDollars')
  const settlement = await prepareSettlement(c, row, p)
  row.proposal = { ...settlement, cleanerId, creditCents, extraCleaningCents, why: text(p.why || row.reason, 'why this action', 2000), baseline: baseline(c, row, cleanerId), guestText: creditText(c, row, creditCents) + (settlement.arrivalTime ? `\n\nYour earlier check-in no longer fits. We propose check-in at ${settlement.arrivalTime} (${homeSettings(c, row.propertyId).timeZone}). Please confirm on your stay page; until then your host must follow up.` : '') + (settlement.futureRate ? `\n\nWe offer 10% off the rent on one future stay at this home, subject to availability and the home’s stay rules. The private offer on your stay page expires ${settlement.futureRate.expiresAt}. Cleaning, extras and taxes are separate. You can accept the revised arrangements or ask your host for help on your stay page.` : '') }
  row.status = 'proposed'; note(c, row, 'Action proposed', row.proposal.why)
  if (policy?.auto && withinLimits(c, row, row.proposal)) {
   const reason = automaticAuthorityReason(c, row)
   if (!reason) await applyRecovery(c, row, true)
   else note(c, row, 'Human approval required', reason)
  }
  return row
 }
 if (name === 'recovery.approve') return applyRecovery(c, row)
 if (name === 'recovery.reject') { need(row.status === 'proposed', 'Only a proposal can be rejected', 409); row.status = 'open'; note(c, row, 'Action rejected', 'The proposed action was not approved; nothing was applied'); delete row.proposal; return row }
 if (name === 'recovery.undo') { owner(c.actor); return undoRecovery(c, row, text(p.reason, 'why undo this action', 2000)) }
 if (name === 'recovery.access') {
  need(row.status === 'active', 'Apply the action first', 409)
  const code = c.data.codes.find(r => r.id === row.codeId)
  need(code?.status === 'issued' && code.lock.state === 'manual', 'This code does not need manual keypad confirmation', 409)
  row.manualAckAt = c.now; note(c, row, 'Keypad confirmed by person', `The host confirmed setting code ending ${code.code.slice(-2)} for ${code.validFrom} to ${code.validUntil}`); return row
 }
 if (name === 'recovery.close') {
  need(row.status === 'active', 'This case is not awaiting readiness confirmation', 409)
  need(!unresolvedRecoveryEffects(row).length, 'Reconcile blocked or uncertain recovery effects before confirming readiness', 409)
  need(row.acceptedAt && t.status === 'completed' && t.completion && (t.completion.photos?.length ?? 1) >= (t.photosRequired ?? 1), 'The replacement cleaner must accept and mark ready with all required photos', 409)
  need(!c.data.tasks.some(task => task.propertyId === row.propertyId && task.blocking && task.status === 'open'), 'Resolve the home’s blocking maintenance tasks first', 409)
  const code = c.data.codes.find(r => r.id === row.codeId)
  need(code?.status === 'issued' && (code.lock.state === 'set' || row.manualAckAt), 'Confirm the replacement code on the lock or keypad first', 409)
  need(row.statementId && c.data.statements.some(s => s.id === row.statementId && s.status === 'approved'), 'The owner balance has not posted', 409)
  need(!(row.proposal?.arrivalTime || row.proposal?.futureRate) || row.guestAcceptedAt, 'The guest must accept the revised arrangements on their stay page before closing', 409)
  const creditMessage = c.data.messages.find(m => m.id === row.creditMessageId)
  need(creditMessage && ['sent', 'suppressed'].includes(creditMessage.status), 'Deliver the approved credit offer before closing; check the guest Inbox for failures', 409)
  need(b.guestEmail, 'Add the guest’s email before sending readiness confirmation', 409)
  const home = c.data.properties.find(p => p.id === row.propertyId)!
  const readiness = homeReadiness(c.data,home,b.start.slice(0,10),Date.parse(c.now))
  need(readiness.arrival?.id === b.id && readiness.state === 'ready', `Verify the arrival in Readiness first: ${readiness.reasons.join('; ')}`,409)
  row.confirmationMessageId = guestMessage(c, row, `${home.name} is ready`, `Hi ${b.guestName || 'there'},\n\nYour cleaner has marked ${home.name} ready with photos, and your host has confirmed access. Your stay page shows the current door code. We look forward to welcoming you.`).id
  row.status = 'ready'; note(c, row, 'Readiness confirmed', 'Cleaner acceptance, photo completion, door access and owner balance verified. Waiting for guest email acceptance.'); return row
 }
 need(false, 'Unknown recovery action', 404)
}

/** A sent confirmation is part of closure; a failed or unavailable email leaves the case open. */
export async function finishRecoveries(c: Context) {
 await captureRecoveryEffects(c)
 for (const row of c.data.recoveries) {
  if(row.restorePaused)continue
  if(row.status==='active'){
   const t=c.data.turnovers.find(t=>t.id===row.turnoverId),b=c.data.bookings.find(b=>b.id===row.bookingId)
   if(t?.dispatch&&b){
    if(t.dispatch.acceptedBy===row.proposal?.cleanerId&&!row.acceptedAt){row.acceptedAt=t.dispatch.acceptedAt;row.appliedBaseline=JSON.stringify({booking:b.revision,recipient:b.guestEmail,cleanerId:t.cleanerId});note(c,row,'Replacement cleaner accepted','Accepted current offer after capacity and drive checks')}
    if(t.dispatch.acceptedBy!==row.proposal?.cleanerId)delete row.acceptedAt
   }
  }
  if (row.status !== 'ready') continue
  if (unresolvedRecoveryEffects(row).length) continue
  const m = c.data.messages.find(m => m.id === row.confirmationMessageId)
  if (m?.status !== 'sent' && m?.status !== 'suppressed') continue
  const t = c.data.turnovers.find(t => t.id === row.turnoverId), code = c.data.codes.find(code => code.id === row.codeId)
  if (((row.proposal?.arrivalTime || row.proposal?.futureRate) && !row.guestAcceptedAt) || t?.status !== 'completed' || !t.completion || !row.acceptedAt || (t.completion.photos?.length ?? 1) < (t.photosRequired ?? 1) || code?.status !== 'issued' || !(code.lock.state === 'set' || row.manualAckAt) || c.data.tasks.some(task => task.propertyId === row.propertyId && task.blocking && task.status === 'open') || !c.data.statements.some(s => s.id === row.statementId && s.status === 'approved')) continue
  const b=c.data.bookings.find(b=>b.id===row.bookingId),home=c.data.properties.find(p=>p.id===row.propertyId)
  if (!b || !home || homeReadiness(c.data,home,b.start.slice(0,10),Date.parse(c.now)).state !== 'ready') continue
  row.status = 'closed'; row.closedAt = c.now; note(c, row, 'Case closed', m.status === 'sent' ? 'Guest readiness email accepted; final owner adjustment is frozen' : 'Local readiness email suppressed; all deterministic steps completed')
 }
}
