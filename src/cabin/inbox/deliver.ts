import { secureAccount } from '../connections/credentials'
import { messageAccessBlocked } from '../agreements/access'
import { accessBlocked } from '../agreements/records'
import { automaticStillAllowed } from './reply-policy'
import { record } from '../audit/write'
import type { Bindings } from '../../auth.server'
import { operatorMail } from '../connections/mail'
import { type Booking, type Data, type GuestMessage, type InboxSettings, type MessageChannel, newId } from '../model'
import { load, mutate } from '../storage'
import { lifecycleContent, lifecycleRecipient, lifecycleEscalation, lifecycleOptout, quietUntil } from './lifecycle-policy'
import { lifecycleHome } from './lifecycle-settings'
import { preferenceLink } from './preferences'
import { inboxSettings } from './settings'
import { INBOX_SYSTEM } from './inbound'
import { sendSms, SMS_LINE, SMS_MANAGED } from './adapters/twilio'
import { sendBooking, CHANNEL_LINE } from './adapters/booking'
import { managedInstall } from '../channels'
// Sends what is due, after every command and on the five-minute Cron: each
// scheduled message whose time has come (claimed first, so two runs never send
// it twice) and every reply a person approved or wrote. Each is recorded in its
// guest's thread as sent, suppressed (development mail), unavailable (no way to
// reach this guest yet, said plainly) or failed with the provider's reason.
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
type Route = { channel: MessageChannel; email: string | null; phone: string | null } | { unavailable: string }
/** How a stay's guest can be reached now: email first, then a text, then the channel's own messages. */
export async function route(env: Bindings, inbox: InboxSettings, b: Booking): Promise<Route> {
 if (b.guestEmail) return { channel: 'email', email: b.guestEmail, phone: null }
 if (b.guestPhone) return (!managedInstall(env)&&await secureAccount(env,'twilio')) ? { channel: 'sms', email: null, phone: b.guestPhone } : { unavailable: managedInstall(env) ? SMS_MANAGED : `This guest has only a phone number. ${SMS_LINE}` }
 if (b.channel === 'booking.com' && b.channelRef && inbox.channelIds[b.propertyId] && !managedInstall(env)&&await secureAccount(env,'booking')) return { channel: 'booking.com', email: null, phone: null }
 return { unavailable: b.channel === 'direct' ? 'No email or phone on this stay: add the guest’s email to the stay and Cabin sends it.' : `No email on this stay. ${CHANNEL_LINE}` }
}
function claimDue(env: Bindings, id: string) {
 return mutate(env.DB, INBOX_SYSTEM, 'message.scheduled.claim', async c => {
  const row = c.data.scheduled.find(r => r.id === id), b = row && c.data.bookings.find(r => r.id === row.bookingId)
  if (!row || !b || row.status !== 'scheduled' || Date.parse(row.dueAt) > Date.now()) return null
  if(row.rule==='checkin'&&accessBlocked(c.data,b.id)){row.reason='Waiting for the current rental signature or identity check';return null}
  if (b.status !== 'confirmed' || lifecycleOptout(c.data, b) || !lifecycleHome(c.data,b.propertyId).schedule[row.rule].enabled) { Object.assign(row, {status:'cancelled',reason:'Stay, guest preference or schedule no longer permits this send',revision:newId()}); return null }
  const quiet = quietUntil(c.data, b, Date.now())
  if (quiet > Date.now()) { row.nextEligibleAt = new Date(quiet).toISOString(); row.reason = 'Waiting for the home’s quiet hours to end'; return null }
  delete row.nextEligibleAt
  if (Date.now() >= Date.parse(row.deadline)) { Object.assign(row, { status: 'skipped', reason: `Late by ${Math.max(0,Math.floor((Date.now()-Date.parse(row.dueAt))/60000))} minutes; its stay window passed before submission`, revision: newId() }); lifecycleEscalation(c,b,row.id,row.reason!,env.OWNER_EMAIL); return null }
  row.sourceRevision=b.revision
  const inbox = inboxSettings(c), content = await lifecycleContent(c,b,row.rule,env.AUTH_ORIGIN), r = await route(env,inbox,await lifecycleRecipient(c.db,b))
  if (!content.eligible) { Object.assign(row,{status:'skipped',reason:'The required task is already resolved or follow-up consent is absent',revision:newId()}); return null }
  if (!('unavailable' in r) && !lifecycleHome(c.data,b.propertyId).channels.includes(r.channel)) { Object.assign(row,{status:'unavailable',reason:'The guest’s available channel is disabled by this home’s messaging policy',revision:newId()}); lifecycleEscalation(c,b,row.id,row.reason!,env.OWNER_EMAIL); return null }
  const preference = await preferenceLink(env,b.id)
  const m: GuestMessage = { id: newId(), revision: newId(), propertyId: b.propertyId, bookingId: b.id, email: 'unavailable' in r ? b.guestEmail ?? null : r.email, phone: 'unavailable' in r ? b.guestPhone ?? null : r.phone, ref: null, channel: 'unavailable' in r ? 'email' : r.channel, direction: 'out', source: 'scheduled', status: 'sending', subject: (row.updated ? 'Updated: ' : '') + content.subject, text: (row.updated ? 'These details changed. This message replaces the earlier one.\n\n' : '') + content.text + `\n\nLifecycle message preferences: ${preference}`, detail: null, replyTo: null, headerId: null, sentBy: null, approvalId: null, scheduledId: row.id, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
  c.data.messages.push(m); c.entityId = row.id; const canonical = await lifecycleContent(c,b,row.rule,null); row.content = canonical.subject + '\n' + canonical.text; row.sourceRevision = b.revision; row.attemptedAt = c.now
  if ('unavailable' in r) { Object.assign(m, { status: 'unavailable', detail: r.unavailable }); Object.assign(row, { status: 'unavailable', reason: r.unavailable, messageId: m.id, revision: newId() }); lifecycleEscalation(c,b,row.id,r.unavailable,env.OWNER_EMAIL); return null }
  Object.assign(row, { status: 'sending', messageId: m.id, revision: newId() }); return { ...m }
 }, () => false).catch(() => null)
}
const claimReply = (env: Bindings, id: string) => mutate(env.DB, INBOX_SYSTEM, 'message.claim', c => { const m = c.data.messages.find(r => r.id === id); if (!m || m.status !== 'pending') return null; if(messageAccessBlocked(c.data,m))return null; if (m.control?.automatic && !automaticStillAllowed(c.data, env.AUTH_ORIGIN, m)) { m.status = 'draft'; m.control.automatic = false; m.control.needsHost = true; m.detail = 'Automatic authority or sources changed before sending. Review this reply.'; m.revision = newId(); return null } Object.assign(m, { status: 'sending', revision: newId() }); return { ...m } }, () => false).catch(() => null)
export async function transmit(env: Bindings, data: Data, m: GuestMessage): Promise<{ status: GuestMessage['status']; detail: string | null; providerId: string | null }> {
 const inbox = inboxSettings(data), b = m.bookingId ? data.bookings.find(r => r.id === m.bookingId) : null
 try {
  if (m.source==='scheduled' && b && lifecycleOptout(data,b)) return {status:'discarded',detail:'Guest opted out of automatic lifecycle messages',providerId:null}
  if (m.scheduledId) {
   const row=data.scheduled.find(r=>r.id===m.scheduledId)
   if (!row || !b || b.status!=='confirmed' || lifecycleOptout(data,b) || !lifecycleHome(data,b.propertyId).schedule[row.rule].enabled) return {status:'discarded',detail:'Cancelled by the current stay, schedule or guest preference',providerId:null}
   if (!lifecycleHome(data,b.propertyId).channels.includes(m.channel)) return {status:'unavailable',detail:'This channel is disabled by the home’s messaging policy',providerId:null}
   const recipient=await route(env,inbox,await lifecycleRecipient(env.DB,b)); if('unavailable' in recipient || recipient.channel!==m.channel || recipient.email!==m.email || recipient.phone!==m.phone) return {status:'unavailable',detail:'The guest recipient changed before submission. Review the current contact.',providerId:null}
   const content=await lifecycleContent({db:env.DB,data},b,row.rule,env.AUTH_ORIGIN)
   const canonical=await lifecycleContent({db:env.DB,data},b,row.rule,null)
   if (!content.eligible || row.content!==canonical.subject+'\n'+canonical.text) return {status:'unavailable',detail:'Guest facts or release conditions changed after this message was prepared. Review the current stay before sending.',providerId:null}
  }
  if(messageAccessBlocked(data,m))return {status:'unavailable',detail:'Required agreement and identity tasks must be resolved before guest access instructions can be sent.',providerId:null}
  if (m.channel === 'sms') { if (managedInstall(env)||!await secureAccount(env,'twilio') || !m.phone) return { status: 'unavailable', detail: managedInstall(env) ? SMS_MANAGED : SMS_LINE, providerId: null }; const r = await sendSms(env, m.phone, m.text,m.propertyId); return { status: 'sent', detail: null, providerId: r.providerId } }
  if (m.channel !== 'email') {
   const hotel = b ? inbox.channelIds[b.propertyId] : undefined
   if (m.channel !== 'booking.com' || managedInstall(env)||!await secureAccount(env,'booking') || !hotel || !b?.channelRef) return { status: 'unavailable', detail: CHANNEL_LINE, providerId: null }
   const r = await sendBooking(env, hotel, b.channelRef, m.text,m.propertyId); return { status: 'sent', detail: null, providerId: r.providerId }
  }
  const sender = operatorMail(env,m.propertyId)
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
 await mutate(env.DB, INBOX_SYSTEM, 'message.restart.reconcile', c => {
  for (const r of c.data.scheduled.filter(r=>r.status==='sending'&&r.attemptedAt&&Date.parse(r.attemptedAt)<Date.now()-5*60_000)) {
   const m=c.data.messages.find(m=>m.id===r.messageId), b=c.data.bookings.find(b=>b.id===r.bookingId)
   r.status='failed';r.reason='Submission outcome is uncertain after interruption. Check the provider before any resend.';r.revision=newId()
   if(m){m.status='failed';m.detail=r.reason;m.revision=newId()}
   if(b)lifecycleEscalation(c,b,r.id,r.reason,env.OWNER_EMAIL)
  }
 },()=>false)
 const data = await load(env.DB), now = Date.now()
 const claimed: GuestMessage[] = []
 for (const r of data.scheduled.filter(r => r.status === 'scheduled' && Date.parse(r.dueAt) <= now && (!r.nextEligibleAt || Date.parse(r.nextEligibleAt)<=now)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))) { const m = await claimDue(env, r.id); if (m) claimed.push(m) }
 for (const m of data.messages.filter(m => m.status === 'pending')) { const c = await claimReply(env, m.id); if (c) claimed.push(c) }
 if (!claimed.length) return []
 const results = []
 for (const m of claimed) {
  const outcome = await transmit(env, await load(env.DB), m)
  await record(env.DB,INBOX_SYSTEM,'message.provider.result',{kind:'messages',id:m.id,propertyId:m.propertyId,bookingId:m.bookingId,revision:m.revision,result:outcome.status==='failed'?'failed-or-uncertain':outcome.status})
  results.push(await mutate(env.DB, INBOX_SYSTEM, `message.${outcome.status}`, c => {
   const row = c.data.messages.find(r => r.id === m.id); if (!row) return null
   Object.assign(row, outcome, { sentAt: c.now, revision: newId() }); c.entityId = row.id
   const s = row.scheduledId ? c.data.scheduled.find(r => r.id === row.scheduledId) : null
   if (s) Object.assign(s, { status: outcome.status === 'discarded' ? 'cancelled' : outcome.status, reason: outcome.detail, sentAt: c.now, revision: newId() })
   if(s && ['failed','unavailable'].includes(outcome.status)){ const b=c.data.bookings.find(b=>b.id===row.bookingId); if(b)lifecycleEscalation(c,b,s.id,outcome.detail??'Delivery failed',env.OWNER_EMAIL) }
   return row
  }))
 }
 return results
}
