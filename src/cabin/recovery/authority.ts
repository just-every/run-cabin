import { type Context, need, newId, owner, text, exact } from '../model'
import type { Recovery, RecoveryAction, RecoveryAuthority, RecoveryProvider, Proposal } from './types'

export const RECOVERY_ACTIONS: RecoveryAction[] = ['cleaner:assign', 'credit:post', 'access:write', 'guest:send', 'owner:notify']
export const RECOVERY_PROVIDERS: RecoveryProvider[] = ['cabin', 'mail', 'seam']
const list = <T extends string>(value: unknown, allowed: T[], label: string): T[] => {
 const values = (Array.isArray(value) ? value : [value]).filter(Boolean)
 need(values.length > 0 && values.every(v => allowed.includes(v as T)), `Choose permitted recovery ${label}`)
 return [...new Set(values)] as T[]
}
export function authorityReason(c: Pick<Context, 'data' | 'now'>, row: Recovery, proposal: Proposal, action?: RecoveryAction, provider?: RecoveryProvider) {
 const policy = c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId), grant = policy?.authority
 if (!grant || grant.state !== 'active') return 'The owner must grant active recovery execution authority for this home.'
 if (Date.parse(c.now) < Date.parse(grant.startsAt) || Date.parse(c.now) >= Date.parse(grant.endsAt)) return 'Recovery execution is outside its granted time window.'
 if (row.execution && (row.execution.authorityId !== grant.id || row.execution.authorityRevision !== grant.revision)) return 'Recovery authority changed; a person must review this case before new effects.'
 if (action && !grant.actions.includes(action)) return `Recovery has no ${action} action grant.`
 if (provider && !grant.providers.includes(provider)) return `Recovery has no ${provider} provider grant.`
 if (!policy?.cleanerIds.includes(proposal.cleanerId)) return 'The replacement cleaner is no longer permitted.'
 return null
}
/** This grant belongs to the native deterministic recovery agent. Existing bearer keys remain draft-only. */
export function automaticAuthorityReason(c: Context, row: Recovery) {
 const p = row.proposal!, { settings } = { settings: c.data.homeSettings.find(s => s.propertyId === row.propertyId) }
 for (const action of RECOVERY_ACTIONS) { const reason = authorityReason(c, row, p, action, 'cabin'); if (reason) return reason }
 const mail = authorityReason(c, row, p, 'guest:send', 'mail'); if (mail) return mail
 if (settings?.lockDeviceId) return authorityReason(c, row, p, 'access:write', 'seam')
 return null
}
export function requireRecoveryAuthority(c: Context, row: Recovery) {
 const reason = automaticAuthorityReason(c, row); need(!reason, reason ?? '', 403)
 const p = row.proposal!
 const authority = c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId)!.authority!
 const policy = c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId)!
 const b = c.data.bookings.find(b => b.id === row.bookingId)!, property = c.data.properties.find(p => p.id === row.propertyId)!
 row.execution = { principal: 'cabin:stay-recovery', authorityId: authority.id, authorityRevision: authority.revision, grant: structuredClone(authority), limits: { creditLimitCents: policy.creditLimitCents, cleaningLimitCents: policy.cleaningLimitCents, cleanerIds: [...policy.cleanerIds] }, proposalRevision: row.revision, at: c.now, bookingRevision: b.revision, recipient: b.guestEmail ?? null, propertyRevision: property.revision, settingsRevision: c.data.homeSettings.find(s => s.propertyId === row.propertyId)?.revision ?? null, cleanerId: p.cleanerId, effects: [] }
}
export function authorityCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (!name.startsWith('recovery.authority.')) return undefined
 owner(c.actor)
 const policy = c.data.recoveryPolicies.find(r => r.propertyId === text(p.propertyId, 'home'))
 need(policy, 'Save this home’s recovery limits and cleaners first', 409); exact(policy, p.revision)
 if (name === 'recovery.authority.save') {
  const startsAt = text(p.startsAt, 'authority start'), endsAt = text(p.endsAt, 'authority end')
  need(Number.isFinite(Date.parse(startsAt)) && Number.isFinite(Date.parse(endsAt)) && Date.parse(startsAt) < Date.parse(endsAt), 'Choose a valid recovery execution window')
  need(/(?:Z|[+-]\d\d:\d\d)$/.test(startsAt) && /(?:Z|[+-]\d\d:\d\d)$/.test(endsAt), 'Include the time zone on both execution times')
  const authority: RecoveryAuthority = { id: newId(), revision: newId(), state: 'active', actions: list(p.actions, RECOVERY_ACTIONS, 'actions'), providers: list(p.providers, RECOVERY_PROVIDERS, 'providers'), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), grantedBy: c.actor.id, grantedAt: c.now }
  policy.authority = authority
 } else {
  need(policy.authority, 'There is no execution grant to change', 409)
  need(['recovery.authority.pause', 'recovery.authority.resume', 'recovery.authority.revoke'].includes(name), 'Unknown recovery authority action', 404)
  need(policy.authority.state !== 'revoked', 'A revoked grant cannot be resumed. Review and issue a new grant.', 409)
  policy.authority.state = name.endsWith('.pause') ? 'paused' : name.endsWith('.revoke') ? 'revoked' : 'active'
  // Pause/resume preserves the exact grant. Revocation permanently invalidates its pending effects.
  if (policy.authority.state === 'revoked') policy.authority.revision = newId()
 }
 policy.revision = newId(); c.entityId = policy.propertyId
 for (const row of c.data.recoveries.filter(r => r.propertyId === policy.propertyId && r.execution)) {
  row.history.push({ at: c.now, by: c.actor.email, action: 'Execution authority changed', why: `${policy.authority!.state}; pending or uncertain provider effects require review` }); row.revision = newId()
 }
 return policy
}
