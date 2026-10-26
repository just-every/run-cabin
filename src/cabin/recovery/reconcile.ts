import { type Context, need, owner, text, exact, newId, sha } from '../model'
import { automaticAuthorityReason } from './authority'
import { recoveryEffectSource } from './effects'
import { note } from './cases'

/** People record external evidence. This door cannot invent an automatic retry, transfer funds or attest physical readiness. */
export async function recoveryEffectCommand(c: Context, name: string, p: Record<string, unknown>) {
 owner(c.actor)
 const row = c.data.recoveries.find(r => r.id === text(p.id, 'recovery case'))
 need(row?.execution && row.proposal, 'Recovery execution not found', 404); exact(row, p.revision)
 if (name === 'recovery.execution.review') {
  need(p.confirm === 'yes', 'Review the exact case, pending recipients and provider actions before authorizing continuation')
  need(!row.execution.effects.some(e => ['started', 'uncertain'].includes(e.state)), 'Reconcile every started provider effect first; a new grant cannot erase uncertainty.', 409)
  const b = c.data.bookings.find(b => b.id === row.bookingId), property = c.data.properties.find(prop => prop.id === row.propertyId), t = c.data.turnovers.find(t => t.id === row.turnoverId)
  need(b?.status === 'confirmed' && b.revision === row.execution.bookingRevision && (b.guestEmail ?? null) === row.execution.recipient && property?.revision === row.execution.propertyRevision && (c.data.homeSettings.find(s => s.propertyId === row.propertyId)?.revision ?? null) === row.execution.settingsRevision && t?.cleanerId === row.execution.cleanerId, 'Booking, recipient, property terms or cleaner changed. Resolve this case with a person; continuation cannot reuse the old approval.', 409)
  for (const effect of row.execution.effects.filter(e => !['acknowledged'].includes(e.state))) {
   const original = recoveryEffectSource(c.data, effect.kind, effect.sourceId)
   need(original && await sha(JSON.stringify(original.payload)) === effect.sourceHash, 'A pending provider action changed. Review and resolve it instead of reusing the old approval.', 409)
  }
  const grant = c.data.recoveryPolicies.find(policy => policy.propertyId === row.propertyId)?.authority
  need(grant, 'Grant recovery execution authority for this home first', 409)
  row.execution.authorityId = grant.id; row.execution.authorityRevision = grant.revision
  const reason = automaticAuthorityReason(c, row); need(!reason, reason ?? '', 403)
  for (const effect of row.execution.effects.filter(e => e.state === 'blocked')) { effect.state = 'queued'; effect.detail = 'A person reviewed the unchanged action under the current execution grant.'; requeue(c, effect.kind, effect.sourceId) }
  c.data.approvals.push({ id: newId(), kind: 'recovery-continuation', recordId: row.id, revision: row.revision, actorId: c.actor.id, actorName: c.actor.email, at: c.now })
  note(c, row, 'Exact continuation approved', text(p.reason, 'reason for continuation', 1000)); return row
 }
 const effect = row.execution.effects.find(e => e.id === text(p.effectId, 'provider effect'))
 need(effect && ['started', 'uncertain'].includes(effect.state), 'Choose an unresolved started effect', 409)
 const attempt = effect.attempts.at(-1); need(attempt && ['started', 'uncertain'].includes(attempt.state), 'No unresolved provider attempt', 409)
 need(p.outcome === 'accepted' || p.outcome === 'not_applied', 'Choose the outcome established by provider evidence')
 const reference = text(p.reference, 'provider evidence reference', 300), reason = text(p.reason, 'what the provider evidence establishes', 1000)
 need(p.confirm === 'yes', 'Confirm you checked the provider request history; absence of a reply is not proof of failure')
 Object.assign(attempt, { state: p.outcome === 'accepted' ? 'acknowledged' : 'not_applied', reference, resolvedBy: c.actor.id, resolvedAt: c.now })
 effect.state = p.outcome === 'accepted' ? 'acknowledged' : 'not_applied'; effect.providerId = p.outcome === 'accepted' ? reference : undefined
 effect.detail = `${p.outcome === 'accepted' ? 'Provider acceptance' : 'No provider effect'} verified by ${c.actor.email}: ${reason}`
 if (p.outcome === 'accepted') {
  if (effect.kind === 'mail') {
   const message = c.data.messages.find(m => m.id === effect.sourceId)
   if(message?.send)Object.assign(message.send,{state:'accepted',providerId:reference,finishedAt:c.now})
   if (message) Object.assign(message, { status: 'sent', providerId: reference, sentAt: c.now, revision: newId(), detail: 'Provider acceptance established from reconciled evidence.' })
   const notice = c.data.notices.find(n => n.id === effect.sourceId), delivery = c.data.deliveries.find(d => d.id === effect.sourceId)
   if (notice) Object.assign(notice, { status: 'sent', sentAt: c.now, detail: 'Provider acceptance established from reconciled evidence.' })
   if (delivery) Object.assign(delivery, { status: 'sent', sentAt: c.now, detail: 'Provider acceptance established from reconciled evidence.' })
  } else {
   const code = c.data.codes.find(code => code.id === effect.sourceId)
   need(code, 'Access record no longer exists; reconcile it with the provider before continuing', 409)
   need(await sha(JSON.stringify(recoveryEffectSource(c.data, 'lock', code.id)!.payload)) === effect.sourceHash, 'Access changed since submission; reconcile the obsolete provider code separately before authorizing current access', 409)
   code.lock = { ...code.lock, state: 'pending', providerId: reference, error: null, at: c.now }
   if(code.lock.job){code.lock.job.providerId=reference;code.lock.job.acceptedAt=c.now;code.lock.job.stage='observing';code.lock.job.claim=null}
  }
 } else requeue(c, effect.kind, effect.sourceId)
 note(c, row, 'Provider effect reconciled', `${effect.kind} ${effect.sourceId}: ${effect.state}; ${reference}; ${reason}`)
 return row
}
function requeue(c: Context, kind: 'mail' | 'lock', id: string) {
 if (kind === 'lock') { const code = c.data.codes.find(code => code.id === id); if (code) code.lock = { ...code.lock, state: 'pending', error: null }; return }
 const message = c.data.messages.find(m => m.id === id)
 if(message?.send)Object.assign(message.send,{state:'rejected',finishedAt:c.now})
 if (message) Object.assign(message, { status: 'pending', detail: 'Provider proved the earlier request had no effect. A fresh current authority check is required.', revision: newId() })
 const notice = c.data.notices.find(n => n.id === id), delivery = c.data.deliveries.find(d => d.id === id)
 if (notice) {notice.status = 'pending';if(notice.send)notice.send.state='rejected'}
 if (delivery) delivery.status = 'pending'
}
