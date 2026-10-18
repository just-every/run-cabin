import { assertContactsAllowed } from '../../privacy/contacts'
import { providerCredentials, configuredCredentials } from '../../connections/credentials'
import { sharingAllowed } from '../../connections/guard'
import type { Bindings } from '../../../auth.server'
import { managedInstall } from '../../channels'
import { load } from '../../storage'
import { stayFor, phoneOf } from '../threads'
// Texts through Twilio's Messages API. US texting from an app needs the owner's
// A2P 10DLC registration first, so this stays off until the owner adds
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM after registering. It
// is tested against responses in Twilio's documented shape (tests/fixtures/twilio).
export const SMS_LINE = 'Texts are not connected. You need your own Twilio texting account, an approved number and the connection steps below. Until then Cabin emails guests who have an email on their stay.'
export const SMS_MANAGED = 'Texts are not available on RER Managed hosting yet because it cannot connect to Twilio. Use guest email for now.'
export async function sendSms(env: Bindings, to: string, body: string, propertyId?:string|null) {
 await assertContactsAllowed(env.DB,[to])
 const credentials=await providerCredentials(env,'twilio','message:send',propertyId)
 const sid = credentials.TWILIO_ACCOUNT_SID, response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
  method: 'POST', redirect:'manual', headers: { authorization: `Basic ${btoa(`${sid}:${credentials.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
  body: new URLSearchParams({ To: to, From: credentials.TWILIO_FROM, Body: body.slice(0, 1600) }), signal: AbortSignal.timeout(20_000),
 })
 let value: any = null; try { value = await response.json() } catch { /* the status explains it */ }
 if (!response.ok) throw Error(`Twilio refused the text (HTTP ${response.status}). Check its message history.`)
 if (typeof value?.sid !== 'string') throw Error('Twilio did not return a message id')
 return { providerId: value.sid as string, status: String(value.status ?? 'queued') }
}
/** Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the full URL followed by each POST field name and value, sorted by name. */
export async function twilioSigned(env: Bindings, url: string, fields: URLSearchParams, signature: string | null) {
 if(!signature)return false
 let credentials:Record<string,string>|null
 try { const booking=stayFor(await load(env.DB),{phone:phoneOf(fields.get('From'))});credentials=await providerCredentials(env,'twilio','message:receive',booking?.propertyId) } catch {return false}
 if(!credentials)return false
 const data = url + [...fields.keys()].filter((k, i, all) => all.indexOf(k) === i).sort().map(k => fields.getAll(k).map(v => k + v).join('')).join('')
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(credentials.TWILIO_AUTH_TOKEN), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
 const expected = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))))
 if (expected.length !== signature.length) return false
 let d = 0; for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
 return d === 0
}
