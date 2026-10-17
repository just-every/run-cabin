import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { type Booking, type Data, type GuestMessage, type InboxSettings, type MessageChannel, newId } from '../model'
import { load, mutate } from '../storage'
import { facts, fill } from './render'
import { inboxSettings } from './settings'
import { INBOX_SYSTEM } from './inbound'
import { smsAccount, sendSms, SMS_LINE, SMS_MANAGED } from './adapters/twilio'
import { bookingAccount, sendBooking, CHANNEL_LINE } from './adapters/booking'
import { managedInstall } from '../channels'
// Sends what is due, after every command and on the five-minute Cron: each
// scheduled message whose time has come (claimed first, so two runs never send
// it twice) and every reply a person approved or wrote. Each is recorded in its
// guest's thread as sent, suppressed (development mail), unavailable (no way to
// reach this guest yet, said plainly) or failed with the provider's reason.
const PER_RUN = 20
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
type Route = { channel: MessageChannel; email: string | null; phone: string | null } | { unavailable: string }
/** How a stay's guest can be reached now: email first, then a text, then the channel's own messages. */
export function route(env: Bindings, inbox: InboxSettings, b: Booking): Route {
 if (b.guestEmail) return { channel: 'email', email: b.guestEmail, phone: null }
 if (b.guestPhone) return smsAccount(env) ? { channel: 'sms', email: null, phone: b.guestPhone } : { unavailable: managedInstall(env) ? SMS_MANAGED : `This guest has only a phone number. ${SMS_LINE}` }
 if (b.channel === 'booking.com' && b.channelRef && inbox.channelIds[b.propertyId] && bookingAccount(env)) return { channel: 'booking.com', email: null, phone: null }
 return { unavailable: b.channel === 'direct' ? 'No email or phone on this stay: add the guest’s email to the stay and Cabin sends it.' : `No email on this stay. ${CHANNEL_LINE}` }
}
function claimDue(env: Bindings, id: string) {
 return mutate(env.DB, INBOX_SYSTEM, 'message.scheduled.claim', c => {
  const row = c.data.scheduled.find(r => r.id === id), b = row && c.data.bookings.find(r => r.id === row.bookingId)
  if (!row || !b || row.status !== 'scheduled' || Date.parse(row.dueAt) > Date.now()) return null
  if (Date.now() >= Date.parse(row.deadline)) { Object.assign(row, { status: 'skipped', reason: 'Its moment passed before Cabin could send it', revision: newId() }); return null }
  const inbox = inboxSettings(c), set = inbox.schedule[row.rule], f = facts(c.data, env.AUTH_ORIGIN, b), r = route(env, inbox, b)
  const m: GuestMessage = { id: newId(), revision: newId(), propertyId: b.propertyId, bookingId: b.id, email: 'unavailable' in r ? b.guestEmail ?? null : r.email, phone: 'unavailable' in r ? b.guestPhone ?? null : r.phone, ref: null, channel: 'unavailable' in r ? 'email' : r.channel, direction: 'out', source: 'scheduled', status: 'sending', subject: (row.updated ? 'Updated: ' : '') + fill(set.subject, f), text: (row.updated ? 'These details changed. This message replaces the earlier one.\n\n' : '') + fill(set.template, f), detail: null, replyTo: null, headerId: null, sentBy: null, approvalId: null, scheduledId: row.id, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
  c.data.messages.push(m); c.entityId = row.id
  if ('unavailable' in r) { Object.assign(m, { status: 'unavailable', detail: r.unavailable }); Object.assign(row, { status: 'unavailable', reason: r.unavailable, messageId: m.id, revision: newId() }); return null }
  Object.assign(row, { status: 'sending', messageId: m.id, revision: newId() }); return { ...m }
 }, () => false).catch(() => null)
}
const claimReply = (env: Bindings, id: string) => mutate(env.DB, INBOX_SYSTEM, 'message.claim', c => { const m = c.data.messages.find(r => r.id === id); if (!m || m.status !== 'pending') return null; Object.assign(m, { status: 'sending', revision: newId() }); return { ...m } }, () => false).catch(() => null)
async function transmit(env: Bindings, data: Data, m: GuestMessage): Promise<{ status: GuestMessage['status']; detail: string | null; providerId: string | null }> {
 const inbox = inboxSettings(data), b = m.bookingId ? data.bookings.find(r => r.id === m.bookingId) : null
 try {
  if (m.channel === 'sms') { if (!smsAccount(env) || !m.phone) return { status: 'unavailable', detail: managedInstall(env) ? SMS_MANAGED : SMS_LINE, providerId: null }; const r = await sendSms(env, m.phone, m.text); return { status: 'sent', detail: null, providerId: r.providerId } }
  if (m.channel !== 'email') {
   const hotel = b ? inbox.channelIds[b.propertyId] : undefined
   if (m.channel !== 'booking.com' || !bookingAccount(env) || !hotel || !b?.channelRef) return { status: 'unavailable', detail: CHANNEL_LINE, providerId: null }
   const r = await sendBooking(env, hotel, b.channelRef, m.text); return { status: 'sent', detail: null, providerId: r.providerId }
  }
  const sender = operatorMail(env)
  if (!m.email) return { status: 'unavailable', detail: 'This guest has no email address yet.', providerId: null }
  if (!sender || !env.MAIL_FROM) return { status: 'unavailable', detail: 'No mail provider is set up for this install, so this message was not sent.', providerId: null }
  const asked = m.replyTo ? data.messages.find(r => r.id === m.replyTo)?.headerId : null
  const result = await sender.send({ deliveryId: m.id, from: env.MAIL_FROM, to: [m.email], subject: m.subject, text: m.text, html: `<div style="font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escape(m.text)}</div>`, ...(inbox.address ? { replyTo: inbox.address } : {}), headers: { ...(asked ? { 'In-Reply-To': asked, References: asked } : {}), ...(m.source === 'scheduled' ? { 'Auto-Submitted': 'auto-generated' } : {}) } })
  if (result?.status === 'accepted') return { status: 'sent', detail: null, providerId: result.providerMessageId ?? null }
  if (result?.status === 'development') return { status: 'suppressed', detail: 'Development mode sends no email; a hosted install sends it.', providerId: null }
  return { status: 'failed', detail: 'The mail provider did not accept this message.', providerId: null }
 } catch (error) { return { status: 'failed', detail: `${(error as Error)?.message || 'The provider refused this message.'}`.slice(0, 300), providerId: null } }
}
export async function deliverGuestMessages(env: Bindings) {
 const data = await load(env.DB), now = Date.now()
 const claimed: GuestMessage[] = []
 for (const r of data.scheduled.filter(r => r.status === 'scheduled' && Date.parse(r.dueAt) <= now).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, PER_RUN)) { const m = await claimDue(env, r.id); if (m) claimed.push(m) }
 for (const m of data.messages.filter(m => m.status === 'pending').slice(0, PER_RUN)) { const c = await claimReply(env, m.id); if (c) claimed.push(c) }
 if (!claimed.length) return []
 const fresh = await load(env.DB), results = []
 for (const m of claimed) {
  const outcome = await transmit(env, fresh, m)
  results.push(await mutate(env.DB, INBOX_SYSTEM, `message.${outcome.status}`, c => {
   const row = c.data.messages.find(r => r.id === m.id); if (!row) return null
   Object.assign(row, outcome, { sentAt: c.now, revision: newId() }); c.entityId = row.id
   const s = row.scheduledId ? c.data.scheduled.find(r => r.id === row.scheduledId) : null
   if (s) Object.assign(s, { status: outcome.status === 'sent' ? 'sent' : outcome.status, reason: outcome.detail, sentAt: c.now, revision: newId() })
   return row
  }))
 }
 return results
}
