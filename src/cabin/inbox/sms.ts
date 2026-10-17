import type { Bindings } from '../../auth.server'
import { smsAccount, twilioSigned } from './adapters/twilio'
import { phoneOf } from './threads'
import { receiveGuest } from './inbound'
// Twilio's incoming-text webhook (POST /inbound/sms), on once the owner's Twilio
// number is connected. Only requests Twilio signed with this install's auth token
// are read; the text joins the guest whose stay has that phone number.
const reply = (status = 200) => new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { status, headers: { 'content-type': 'text/xml', 'cache-control': 'no-store' } })
export async function smsResponse(request: Request, env: Bindings) {
 if (request.method !== 'POST' || !smsAccount(env)) return new Response('Not found', { status: 404 })
 if (Number(request.headers.get('content-length') ?? 0) > 64_000) return new Response('Too large', { status: 413 })
 const body = (await request.text()).slice(0, 64_000), fields = new URLSearchParams(body), url = new URL(request.url)
 if (!await twilioSigned(env, new URL(url.pathname + url.search, env.AUTH_ORIGIN).href, fields, request.headers.get('x-twilio-signature'))) return new Response('Forbidden', { status: 403 })
 const phone = phoneOf(fields.get('From')), sid = fields.get('MessageSid'), text = (fields.get('Body') ?? '').trim()
 if (!phone || !sid || !text) return reply()
 await receiveGuest(env, { channel: 'sms', phone, subject: 'Text message', text: text.slice(0, 8000), providerId: `twilio:${sid}` })
 return reply()
}
