import type { Booking, Context, Data, ScheduleRule } from '../model'
import { homeSettings } from '../homes'
import { homeReadiness } from '../readiness'
import { accessBlocked, agreementOf, currentDocument } from '../agreements/records'
import { verificationOf, resolved } from '../verification/records'
import { paymentBalance } from '../reservations/finance'
import { consent } from '../guests/resolve'
import { instant, wall, between } from '../clock'
import { lifecycleHome } from './lifecycle-settings'
import { facts, fill } from './render'
import { stays } from '../direct/store'
/** Quiet hours alter the eligible due instant; the original schedule stays visible. */
export function quietUntil(data: Pick<Data, 'inbox' | 'homeSettings'>, b: Booking, ms: number) {
 const p = lifecycleHome(data, b.propertyId)
 if (!p.quietFrom || !p.quietUntil) return ms
 const zone = homeSettings(data, b.propertyId).timeZone, local = wall(ms, zone), time = local.slice(11)
 const overnight = p.quietFrom > p.quietUntil
 const quiet = overnight ? time >= p.quietFrom || time < p.quietUntil : time >= p.quietFrom && time < p.quietUntil
 if (!quiet) return ms
 const day = overnight && time >= p.quietFrom ? new Date(Date.parse(local.slice(0, 10) + 'T12:00Z') + 86_400_000).toISOString().slice(0, 10) : local.slice(0, 10)
 return instant(`${day}T${p.quietUntil}`, zone)
}
export function lifecycleOptout(data: Pick<Data, 'inbox' | 'bookings'>, b: Booking) {
 const decisions=data.inbox.flatMap(i=>i.lifecycle?.optouts??[]).filter(o=>o.bookingId===b.id||data.bookings.some(old=>old.id===o.bookingId&&old.propertyId===b.propertyId&&old.guestEmail&&old.guestEmail===b.guestEmail)).sort((a,b)=>b.at.localeCompare(a.at)); return decisions[0]?.disabled??false
}
export function releaseReady(data: Data, b: Booking) {
 const home = data.properties.find(p => p.id === b.propertyId)
 return !accessBlocked(data, b.id) && !!home && homeReadiness(data, home, b.start.slice(0, 10)).state === 'ready'
}
/** All template placeholders use current facts. Access capabilities are absent until every release condition passes. */
export async function lifecycleContent(c: Pick<Context, 'db' | 'data'>, b: Booking, rule: ScheduleRule, origin: string | null) {
 const set = lifecycleHome(c.data, b.propertyId).schedule[rule], balance = await paymentBalance(c, b)
 const direct = (await stays(c.db)).find(s => s.bookingId === b.id)
 const f = { ...facts(c.data, origin, {...b,guestName:b.guestName??direct?.guestName}), action_link: 'Reply to your host to resolve the outstanding payment.' }
 const ready = releaseReady(c.data, b) && (balance.balanceCents === null || balance.balanceCents <= 0) && (!direct || !!direct.paymentId)
 if (!ready) { const code=c.data.codes.find(code=>code.bookingId===b.id&&code.holder==='guest'&&code.status==='issued'); f.code = 'Withheld until payment, verification and readiness checks pass'+(code?'. Expected access window: '+between(code.validFrom,code.validUntil):''); f.stay_link = 'Your host will release access after the required checks pass' }
 let eligible = true
 if (rule === 'payment') { eligible = direct ? !direct.paymentId && direct.phase === 'held' : (balance.balanceCents ?? 0) > 0; if (direct?.checkoutUrl) f.action_link = direct.checkoutUrl }
 if (rule === 'signature') { const a = agreementOf(c.data, b.id); eligible = !!a?.required && !currentDocument(a).signature; if (a?.token) f.action_link = `${a.origin}/book/stay/agreement/${a.token}` }
 if (rule === 'identity') { const v = verificationOf(c.data, b.id); eligible = !!v && !resolved(v) && v.status !== 'erased'; if (v?.token) f.action_link = `${v.policy.origin}/book/verification/${v.token}` }
 if (rule === 'repeat') { const guest = c.data.guests.find(g => g.bookingId === b.id); eligible = !!guest && consent(c.data, guest.id, b.propertyId, 'offers') && c.data.guestPolicies.some(p => p.propertyId === b.propertyId && p.allowRepeatOffers) }
 if (rule === 'confirmation' && direct?.confirmationMessageId) eligible = false // The paid booking workflow already sent its definitive confirmation.
 return { eligible, subject: fill(set.subject, f), text: fill(set.template, f), ready }
}
export function lifecycleEscalation(c: Context, booking: Booking, id: string, reason: string, ownerEmail='') {
 const policy = lifecycleHome(c.data, booking.propertyId), email = policy.managerEmail || c.actor.email || ownerEmail
 if (!email || c.data.notices.some(n => n.recordId === id && n.kind === 'inbox')) return
 c.data.notices.push({ id: crypto.randomUUID(), revision: crypto.randomUUID(), propertyId: booking.propertyId, memberId: 'owner', email, kind: 'inbox', recordId: id, subject: 'Scheduled guest message needs attention', text: `${reason}\nOpen the guest Inbox in Cabin to review this stay and delivery outcome.`, status: 'pending', detail: null, createdAt: c.now, sentAt: null })
}

export async function lifecycleRecipient(db:D1Database,b:Booking){const d=(await stays(db)).find(s=>s.bookingId===b.id);return d?{...b,guestEmail:b.guestEmail??d.email,guestName:b.guestName??d.guestName}:b}
