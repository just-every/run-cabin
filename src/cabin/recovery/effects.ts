import { type Context, type Data, newId, sha, need } from '../model'
import { load, mutate, SYSTEM } from '../storage'
import { authorityReason } from './authority'
import type { Recovery, RecoveryEffect } from './types'

type Kind = RecoveryEffect['kind']
type Source = { revision: string; payload: unknown; email?: string; text?: string; subject?: string }
/** Status and claim revisions are deliberately excluded: the approved recipient, words and access window are fixed. */
function source(data: Data, kind: Kind, id: string): Source | null {
 if (kind === 'lock') {
  const code = data.codes.find(c => c.id === id)
  return code ? { revision: code.revision, payload: [code.id, code.propertyId, code.bookingId, code.turnoverId, code.memberId, code.status, code.code, code.validFrom, code.validUntil, code.timeZone, data.homeSettings.find(s => s.propertyId === code.propertyId)?.lockDeviceId] } : null
 }
 const message = data.messages.find(m => m.id === id)
 if (message) return { revision: message.revision, payload: [message.email, message.subject, message.text, message.bookingId], email: message.email ?? '', text: message.text, subject: message.subject }
 const notice = data.notices.find(n => n.id === id)
 if (notice) return { revision: notice.revision, payload: [notice.email, notice.subject, notice.text, notice.memberId], email: notice.email, text: notice.text, subject: notice.subject }
 const delivery = data.deliveries.find(d => d.id === id), statement = delivery && data.statements.find(s => s.id === delivery.statementId)
 return delivery && statement ? { revision: delivery.revision, payload: [delivery.email, statement.id, statement.revision, statement.netCents, statement.lines], email: delivery.email } : null
}
export async function captureRecoveryEffects(c: Context) {
 for (const row of c.data.recoveries.filter(r => r.execution)) {
  const execution = row.execution!
  if (['undone', 'closed'].includes(row.status)) continue
  const candidates: { kind: Kind; id: string; action: RecoveryEffect['action'] }[] = [
   ...c.data.messages.filter(m => m.grounds?.includes(row.id) && m.createdAt >= execution.at).map(m => ({ kind: 'mail' as const, id: m.id, action: 'guest:send' as const })),
   ...c.data.deliveries.filter(d => c.data.statements.some(s => s.id === d.statementId && s.recoveryId === row.id)).map(d => ({ kind: 'mail' as const, id: d.id, action: 'owner:notify' as const })),
   ...c.data.notices.filter(n => n.recordId === row.turnoverId && n.createdAt >= execution.at).map(n => ({ kind: 'mail' as const, id: n.id, action: 'cleaner:assign' as const })),
   ...c.data.codes.filter(code => code.lock.state === 'pending' && (code.id === row.codeId || code.id === row.previous?.code.id || code.turnoverId === row.turnoverId && (code.createdAt >= execution.at || !execution.capturedAt && c.before.codes.find(b => b.id === code.id)?.revision !== code.revision))).map(code => ({ kind: 'lock' as const, id: code.id, action: 'access:write' as const })),
  ]
  for (const candidate of candidates) {
   if (execution.effects.some(e => e.kind === candidate.kind && e.sourceId === candidate.id)) continue
   const original = source(c.data, candidate.kind, candidate.id); if (!original) continue
   execution.effects.push({ id: newId(), kind: candidate.kind, sourceId: candidate.id, sourceRevision: original.revision, sourceHash: await sha(JSON.stringify(original.payload)), action: candidate.action, provider: candidate.kind === 'mail' ? 'mail' : 'seam', state: 'queued', attempts: [], detail: 'Approved effect queued; no provider request has started.' })
  }
  execution.capturedAt ??= c.now
 }
}
function find(data: Data, kind: Kind, id: string) {
 for (const row of data.recoveries) { const effect = row.execution?.effects.find(e => e.kind === kind && e.sourceId === id); if (effect) return { row, effect } }
 return null
}
function currentReason(c: Context, row: Recovery) {
 const b = c.data.bookings.find(b => b.id === row.bookingId), p = c.data.properties.find(p => p.id === row.propertyId), t = c.data.turnovers.find(t => t.id === row.turnoverId), execution = row.execution!
 if (!b || b.status !== 'confirmed' || b.revision !== execution.bookingRevision || (b.guestEmail ?? null) !== execution.recipient || p?.revision !== execution.propertyRevision || (c.data.homeSettings.find(s => s.propertyId === row.propertyId)?.revision ?? null) !== execution.settingsRevision || t?.cleanerId !== execution.cleanerId) return 'Stay, recipient, property terms or cleaner changed after approval. A person must review the unresolved case.'
 return null
}
export interface RecoveryEffectTicket { caseId: string; effectId: string; attemptId: string }
/** Call immediately before the actual provider write, after all other provider checks. No second write follows an uncertain first one. */
export async function beginRecoveryEffect(db: D1Database, kind: Kind, id: string, mail?: { to: readonly string[]; subject: string; text: string }): Promise<RecoveryEffectTicket | null> {
 if (!find(await load(db), kind, id)) return null
 const result = await mutate(db, SYSTEM, 'recovery.effect.start', async c => {
  const found = find(c.data, kind, id); if (!found) return { ticket: null }
  const { row, effect } = found, original = source(c.data, kind, id)
  let reason = authorityReason(c, row, row.proposal!, effect.action, effect.provider) ?? currentReason(c, row)
  if (!original || await sha(JSON.stringify(original.payload)) !== effect.sourceHash) reason = 'The approved provider effect changed. A person must review it before sending.'
  if (mail && original && (mail.to.length !== 1 || mail.to[0].toLowerCase() !== original.email?.toLowerCase() || original.subject !== undefined && original.subject !== mail.subject || original.text !== undefined && (c.data.messages.some(m => m.id === id) ? original.text !== mail.text : !mail.text.startsWith(original.text + '\n')))) reason = 'Provider recipient or exact approved message does not match this effect.'
  if (['started', 'uncertain', 'acknowledged'].includes(effect.state)) reason = effect.state === 'acknowledged' ? 'This effect already has a provider acknowledgement; it cannot be sent twice.' : 'A provider outcome is unresolved. Reconcile its request history before any resend.'
  if (reason) {
   if (effect.state === 'started') { effect.state = 'uncertain'; const last = effect.attempts.at(-1); if (last?.state === 'started') last.state = 'uncertain' }
   else if (!['acknowledged', 'uncertain'].includes(effect.state)) effect.state = 'blocked'
   effect.detail = reason; c.entityId = row.id
   return { reason, ticket: null }
  }
  const attemptId = newId(); effect.attempts.push({ id: attemptId, at: c.now, state: 'started' }); effect.state = 'started'; effect.detail = 'Provider request started; acknowledgement pending. Do not resend after interruption.'; c.entityId = row.id
  return { ticket: { caseId: row.id, effectId: effect.id, attemptId } }
 })
 need(!result.reason, result.reason ?? '', 409); return result.ticket
}
/** A timeout, crash or ambiguous response never becomes success or a retryable failure. Revocation does not discard the old acknowledgement. */
export async function finishRecoveryEffect(db: D1Database, ticket: RecoveryEffectTicket | null, outcome: { state: 'acknowledged' | 'uncertain' | 'not_applied'; reference?: string }) {
 if (!ticket) return
 await mutate(db, SYSTEM, 'recovery.effect.result', c => {
  const row = c.data.recoveries.find(r => r.id === ticket.caseId), effect = row?.execution?.effects.find(e => e.id === ticket.effectId), attempt = effect?.attempts.find(a => a.id === ticket.attemptId)
  if (!row || !effect || !attempt || !['started', 'uncertain'].includes(attempt.state)) return
  attempt.state = outcome.state; effect.state = outcome.state; effect.providerId = outcome.reference
  if (outcome.reference) attempt.reference = outcome.reference.slice(0, 300)
  effect.detail = outcome.state === 'acknowledged' ? 'The provider acknowledged this request. Physical work and readiness still require a person.' : outcome.state === 'not_applied' ? 'No provider request occurred: development mail was suppressed.' : 'Provider acceptance is uncertain. A person must reconcile provider evidence; no automatic resend.'
  c.entityId = row.id
 })
}
export function unresolvedRecoveryEffects(row: Recovery) { return row.execution?.effects.filter(e => ['started', 'uncertain', 'blocked'].includes(e.state)) ?? [] }

export { source as recoveryEffectSource }
