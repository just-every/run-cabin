import { requestCleaner, withdrawOffers } from '../dispatch/offers'
import { type Context, need, newId } from '../model'
import { issue, revoke } from '../codes'
import { context, baseline, note } from './cases'
import { guestMessage } from './messages'
import { withinLimits } from './limits'
import { applySettlement } from './settlement'
import { postRecoveryBalance } from './finance'
import type { Recovery } from './types'

export async function applyRecovery(c: Context, row: Recovery, automatic = false) {
 const p = row.proposal!; need(row.status === 'proposed' && p, 'Review a proposed action first', 409)
 const { b, t, settings, policy } = context(c, row)
 need(p.baseline === baseline(c, row, p.cleanerId), 'Stay, recipient, cleaner or limits changed. Propose and review again.', 409)
 const within = withinLimits(c, row, p)
 need(!automatic || (policy?.auto && within), 'Owner approval is needed above the saved limits', 403)
 need(within || c.actor.role === 'owner', 'Only the owner can approve spending above the saved limits', 403)
 need(policy?.cleanerIds.includes(p.cleanerId), 'Choose a cleaner from this home’s recovery list')
 need(c.data.members.some(m => m.id === p.cleanerId && m.active && m.role === 'cleaner'), 'Cleaner is no longer active', 409)
 need(!c.data.turnovers.some(job => job.id !== t.id && job.cleanerId === p.cleanerId && job.status === 'approved' && job.windowStart! < t.windowEnd! && job.windowEnd! > t.windowStart!), 'This cleaner has another turnover in this window. Review another backup.', 409)
 const old = c.data.codes.find(r => r.bookingId === b.id && r.holder === 'guest' && r.status === 'issued')
 need(old, 'This stay has no active code to replace. Review access first.', 409)
 row.previous = { turnover: structuredClone(t), code: structuredClone(old), arrivalTime: b.arrivalTime }
 const approval = { id: newId(), kind: 'recovery', recordId: row.id, revision: row.revision, actorId: c.actor.id, actorName: c.actor.email, at: c.now }
 c.data.approvals.push(approval); row.approvalId = approval.id
 await applySettlement(c, row)
 if (settings.dispatch) requestCleaner(c, t, p.cleanerId)
 else Object.assign(t, { cleanerId: p.cleanerId, status: 'approved', revision: newId() }); delete t.completion
 t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'recovery reassignment', cleanerId: p.cleanerId }]
 // Issue before revoking: the replacement is guaranteed different from the old code.
 const code = issue(c, settings, { bookingId: b.id, turnoverId: null, holder: 'guest', memberId: null, validFrom: `${b.start.slice(0,10)}T${b.arrivalTime ?? settings.checkInTime}`, validUntil: old.validUntil })
 // Retain the guest's secret stay URL; its current code changes on the same page.
 code.link = old.link; old.link = null; revoke(old, 'Replaced by approved stay recovery'); row.codeId = code.id
 row.creditMessageId = guestMessage(c, row, 'An update about your stay', p.guestText).id
 row.statementId = postRecoveryBalance(c, row, p.creditCents, p.extraCleaningCents, p.why)
 row.balanceCents = -p.creditCents - p.extraCleaningCents; row.status = 'active'
 note(c, row, automatic ? 'Applied within owner limits' : 'Action approved and applied', p.why)
 row.appliedBaseline = JSON.stringify({ booking: b.revision, recipient: b.guestEmail, cleanerId: t.cleanerId })
 return row
}
export function undoRecovery(c: Context, row: Recovery, why: string) {
 need(row.previous && row.proposal && ['active', 'ready', 'closed', 'escalated'].includes(row.status), 'No applied action to undo', 409)
 const { b, t, settings } = context(c, row)
 need(row.appliedBaseline === JSON.stringify({ booking: b.revision, recipient: b.guestEmail, cleanerId: t.cleanerId }), 'Stay or assignee changed. Review it before compensating this action.', 409)
 if (t.status !== 'completed') {
  if (settings.dispatch) { withdrawOffers(c,t,'Recovery undone; previous cleaner must accept again'); if (row.previous.turnover.cleanerId) requestCleaner(c,t,row.previous.turnover.cleanerId); else { t.cleanerId=null; t.status='unassigned'; if(t.dispatch){delete t.dispatch.acceptedBy;delete t.dispatch.acceptedAt;t.dispatch.generation=newId()} } }
  else Object.assign(t, { cleanerId: row.previous.turnover.cleanerId, status: row.previous.turnover.status, revision: newId() }); t.history = [...t.history ?? [], { at: c.now, by: c.actor.id, action: 'recovery assignment undone', cleanerId: t.cleanerId }] }
 if (row.offerId) { const offer = c.data.guestOffers.find(o => o.id === row.offerId); need(!offer || offer.status !== 'redeemed', 'This future-stay offer has been used. Review the paid return before undoing.', 409); if (offer) { offer.status = 'revoked'; offer.revision = newId() } }
 b.arrivalTime = row.previous.arrivalTime; b.revision = newId()
 const current = c.data.codes.find(r => r.id === row.codeId)!;
 const code = issue(c, settings, { bookingId: b.id, turnoverId: null, holder: 'guest', memberId: null, validFrom: row.previous.code.validFrom, validUntil: row.previous.code.validUntil })
 code.link = current.link; current.link = null; revoke(current, 'Recovery undone; new replacement code issued')
 row.undoStatementId = postRecoveryBalance(c, row, row.proposal.creditCents, row.proposal.extraCleaningCents, why, true)
 const oldMessage = c.data.messages.find(m => m.id === row.creditMessageId)
 if (oldMessage?.status === 'pending') Object.assign(oldMessage, { status: 'discarded', revision: newId() })
 guestMessage(c, row, 'Correction to your stay update', `Your host has reversed the earlier recovery credit and cleaning adjustment. Please contact your host about the revised arrangements. Your stay page now shows your replacement door code.`)
 row.status = 'undone'; row.balanceCents = 0; note(c, row, 'Action compensated', why)
 return row
}
