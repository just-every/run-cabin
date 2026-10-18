import { type Context, type Booking, type Turnover, need, newId, text } from '../model'
import { homeSettings } from '../homes'
import { liveTurnover } from '../dispatch'
import type { Recovery, Trigger } from './types'

export const triggers: Trigger[] = ['cleaner_cancelled', 'not_ready', 'late_checkout', 'guest_problem']
export function note(c: Context, row: Recovery, action: string, why: string) {
 row.history.push({ at: c.now, by: c.actor.email || c.actor.id, action, why }); row.revision = newId(); c.entityId = row.id
}
export function openCase(c: Context, b: Booking, t: Turnover, trigger: Trigger, reason: string) {
 const existing = c.data.recoveries.find(r => r.bookingId === b.id && !r.issue && !['closed', 'undone'].includes(r.status))
 if (existing) { note(c, existing, 'Problem reported', reason); return existing }
 const row: Recovery = { id: newId(), revision: newId(), bookingId: b.id, turnoverId: t.id, propertyId: b.propertyId, trigger, reason, status: 'open', createdAt: c.now, createdBy: c.actor.id, history: [] }
 c.data.recoveries.push(row); note(c, row, 'Case opened', reason); return row
}
export function context(c: Context, row: Recovery) {
 const b = c.data.bookings.find(b => b.id === row.bookingId), t = c.data.turnovers.find(t => t.id === row.turnoverId)
 need(b?.status === 'confirmed' && t && t.status !== 'cancelled', 'Stay or turnover changed. Escalate this case and review the stay.', 409)
 return { b, t, settings: homeSettings(c, row.propertyId), policy: c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId) }
}
/** Approval binds recipients, spend authority, the stay, turnover, home and current code. */
export function baseline(c: Context, row: Recovery, cleanerId: string) {
 const { b, t, settings, policy } = context(c, row)
 const cleaner = c.data.members.find(m => m.id === cleanerId)
 return JSON.stringify({ b, t, settings, policy, cleaner, assignments: c.data.turnovers.filter(job => job.cleanerId === cleanerId && job.status === 'approved'), balances: c.data.statements.filter(s => s.source === 'recovery' && s.lines.some(l => l.bookingId === b.id)), property: c.data.properties.find(p => p.id === row.propertyId), codes: c.data.codes.filter(r => r.bookingId === b.id && r.holder === 'guest' && r.status === 'issued').map(r => [r.id, r.revision]) })
}
export function openReported(c: Context, p: Record<string, unknown>) {
 const trigger = text(p.trigger, 'reason type') as Trigger; need(triggers.includes(trigger), 'Choose a recovery reason')
 const t = p.turnoverId ? c.data.turnovers.find(t => t.id === p.turnoverId) : c.data.turnovers.find(t => t.nextBookingId === p.bookingId && t.status !== 'cancelled') ?? liveTurnover(c, text(p.bookingId, 'stay'))
 need(t && (c.actor.role !== 'cleaner' || t.cleanerId === c.actor.memberId), 'Turnover not found', 404)
 const b = c.data.bookings.find(b => b.id === (p.bookingId || t.nextBookingId || t.bookingId))
 need(b?.status === 'confirmed' && b.propertyId === t.propertyId, 'Choose a confirmed stay', 409)
 return openCase(c, b, t, trigger, text(p.reason, 'what went wrong', 2000))
}
