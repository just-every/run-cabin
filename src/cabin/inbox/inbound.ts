import type { Bindings } from '../../auth.server'
// @ts-expect-error Base's inbound MIME parser ships without type declarations.
import { parseMime } from '../../modules/mail/src/inbound/mime.mjs'
// @ts-expect-error Base's inbound header parser ships without type declarations.
import { parseHeaders, address } from '../../modules/mail/src/inbound/headers.mjs'
import { type Actor, type GuestMessage, type MessageChannel, newId } from '../model'
import { load, mutate } from '../storage'
import { inboxSettings } from './settings'
import { emailOf, stayFor } from './threads'
import { startDraft, finishDrafts } from './drafts'
import { deliverGuestMessages } from './deliver'
import { escalateReplies } from './reply-policy'
import { deliverNotices } from '../notify'
import { aiKey } from './ai'
import { bookingAccount, latestBooking } from './adapters/booking'
// Guest messages arriving: email routed to the inbox address (the Worker's
// email handler, through Cloudflare Email Routing on the owner's domain), texts
// from Twilio's webhook and Booking.com's message queue. Each lands in its
// guest's thread, tied to their current or next stay, with a drafted reply
// waiting beside it. Mail to any other address is refused unread.
export const INBOX_SYSTEM: Actor = { id: 'cabin:inbox', email: '', role: 'system', isAgent: false, operatorVersion: 0 }
export const MAX_EMAIL_BYTES = 2_000_000
const LIMITS = { maxRawBytes: MAX_EMAIL_BYTES, maxBodyBytes: 1_000_000, maxAttachments: 20, maxAttachmentBytes: MAX_EMAIL_BYTES, maxTotalAttachmentBytes: MAX_EMAIL_BYTES }
const stripHtml = (html: string) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
/** The guest's new words: the quoted history a mail app adds under a reply is left out. */
export function freshText(text: string) {
 const t = text.replace(/\r\n/g, '\n'), quoted = t.search(/\n(On [^\n]*(\n[^\n]*)?wrote:\s*\n|-{2,} ?Original Message|_{8,}\nFrom: )/i)
 const kept = (quoted > 0 ? t.slice(0, quoted) : t).split('\n').filter(l => !l.startsWith('>')).join('\n').trim()
 return (kept || t.trim()).slice(0, 8000)
}
export interface Incoming { channel: MessageChannel; email?: string | null; phone?: string | null; ref?: string | null; subject: string; text: string; headerId?: string | null; providerId?: string | null }
export async function receiveGuest(env: Bindings, m: Incoming) {
 const ai = !!(await aiKey(env, inboxSettings(await load(env.DB))))
 const row = await mutate(env.DB, INBOX_SYSTEM, 'message.received', c => {
  const seen = c.data.messages.find(r => r.direction === 'in' && ((m.providerId && r.providerId === m.providerId) || (m.headerId && r.headerId === m.headerId)))
  if (seen) return seen
  const b = m.ref ? c.data.bookings.find(r => r.channel === m.channel && r.channelRef === m.ref) ?? null : stayFor(c.data, { email: m.email, phone: m.phone })
  const row: GuestMessage = { id: newId(), revision: newId(), propertyId: b?.propertyId ?? null, bookingId: b?.id ?? null, email: m.email ?? b?.guestEmail ?? null, phone: m.phone ?? null, ref: b ? null : m.ref ?? null, channel: m.channel, direction: 'in', source: 'guest', status: 'received', subject: m.subject.slice(0, 300), text: m.text, detail: null, replyTo: null, headerId: m.headerId ?? null, sentBy: null, approvalId: null, scheduledId: null, providerId: m.providerId ?? null, grounds: [], createdAt: c.now, sentAt: null }
  c.data.messages.push(row); startDraft(c, env.AUTH_ORIGIN, row, ai); c.entityId = row.id; return row
 })
 await finishDrafts(env)
 await escalateReplies(env)
 await deliverNotices(env)
 await deliverGuestMessages(env)
 return row
}
/** The address a reply reaches: Reply-To when the message names one, else From. */
function replyAddress(raw: Uint8Array, from: string | null) {
 const end = new TextDecoder('latin1').decode(raw.subarray(0, 64_000)).search(/\r?\n\r?\n/)
 try { const headers = parseHeaders(new TextDecoder('latin1').decode(raw.subarray(0, end > 0 ? end : 0))); const to = headers.get('reply-to'); if (to) return emailOf(address(to)) } catch { /* fall back to From */ }
 return emailOf(from)
}
export async function receiveEmail(env: Bindings, recipients: string[], raw: Uint8Array): Promise<{ refused: string } | { message: GuestMessage }> {
 const inbox = inboxSettings(await load(env.DB))
 if (!inbox.address || !recipients.some(r => emailOf((/<([^<>]+)>/.exec(r)?.[1] ?? r)) === inbox.address)) return { refused: 'Unknown address' }
 let parsed: { from: string | null; subject: string; text: string | null; html: string | null; messageId: string | null }
 try { parsed = parseMime(raw, LIMITS, undefined) } catch { return { refused: 'Cabin could not read this message' } }
 const email = replyAddress(raw, parsed.from)
 if (!email) return { refused: 'No sender address' }
 const body = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : '')
 return { message: await receiveGuest(env, { channel: 'email', email, subject: parsed.subject ?? '', text: freshText(body || '(no text)'), headerId: parsed.messageId }) }
}
/** Cloudflare Email Routing delivers the inbox address here. */
export async function emailHandler(message: ForwardableEmailMessage, env: Bindings) {
 if (message.rawSize > MAX_EMAIL_BYTES) { message.setReject('Message too large for Cabin (2 MB)'); return }
 const outcome = await receiveEmail(env, [message.to], new Uint8Array(await new Response(message.raw).arrayBuffer()))
 if ('refused' in outcome) message.setReject(outcome.refused)
}
/** Booking.com's queue, on the Cron, once its machine account is connected. */
export async function pollChannels(env: Bindings) {
 if (!bookingAccount(env)) return
 for (const m of await latestBooking(env)) await receiveGuest(env, { channel: 'booking.com', ref: m.reservationId, subject: 'Booking.com message', text: m.text, providerId: `booking:${m.id}` })
}
