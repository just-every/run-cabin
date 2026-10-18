import { assertContactsAllowed } from '../../privacy/contacts'
import { sharingAllowed } from '../../connections/guard'
import type { Bindings } from '../../../auth.server'
import { managedInstall } from '../../channels'
// Texts through Twilio's Messages API. US texting from an app needs the owner's
// A2P 10DLC registration first, so this stays off until the owner adds
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM after registering. It
// is tested against responses in Twilio's documented shape (tests/fixtures/twilio).
export const SMS_LINE = 'Texts are not connected. You need your own Twilio texting account, an approved number and the connection steps below. Until then Cabin emails guests who have an email on their stay.'
export const SMS_MANAGED = 'Texts are not available on RER Managed hosting yet because it cannot connect to Twilio. Use guest email for now.'
export const smsAccount = (env: Bindings) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) && !managedInstall(env)
export async function sendSms(env: Bindings, to: string, body: string) {
 await sharingAllowed(env.DB, 'twilio')
 await assertContactsAllowed(env.DB,[to])
 const sid = env.TWILIO_ACCOUNT_SID!, response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
  method: 'POST', headers: { authorization: `Basic ${btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
  body: new URLSearchParams({ To: to, From: env.TWILIO_FROM!, Body: body.slice(0, 1600) }), signal: AbortSignal.timeout(20_000),
 })
 let value: any = null; try { value = await response.json() } catch { /* the status explains it */ }
 if (!response.ok) throw Error(`Twilio refused the text${value?.code ? ` (${value.code})` : ''}: ${String(value?.message ?? response.status).slice(0, 200)}`)
 if (typeof value?.sid !== 'string') throw Error('Twilio did not return a message id')
 return { providerId: value.sid as string, status: String(value.status ?? 'queued') }
}
/** Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the full URL followed by each POST field name and value, sorted by name. */
export async function twilioSigned(env: Bindings, url: string, fields: URLSearchParams, signature: string | null) {
 if (!signature || !env.TWILIO_AUTH_TOKEN) return false
 const data = url + [...fields.keys()].filter((k, i, all) => all.indexOf(k) === i).sort().map(k => fields.getAll(k).map(v => k + v).join('')).join('')
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TWILIO_AUTH_TOKEN), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
 const expected = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))))
 if (expected.length !== signature.length) return false
 let d = 0; for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
 return d === 0
}
