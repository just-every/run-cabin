import type { Context } from '../model'
import type { Recovery, Proposal } from './types'

/** Limits are per stay, including prior cases and their exact reversals. */
export function withinLimits(c: Context, row: Recovery, proposal: Proposal) {
 const policy = c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId)
 if (!policy) return false
 const statements = c.data.statements.filter(s => s.source === 'recovery' && s.lines.some(l => l.bookingId === row.bookingId))
 const credit = -statements.reduce((sum, s) => sum + (s.lines[0]?.amountCents ?? 0), 0)
 const cleaning = -statements.reduce((sum, s) => sum + (s.lines[1]?.amountCents ?? 0), 0)
 return (!proposal.futureRate || (policy.futureDiscountBps ?? 0) >= 1000) && credit + proposal.creditCents <= policy.creditLimitCents && cleaning + proposal.extraCleaningCents <= policy.cleaningLimitCents
}
