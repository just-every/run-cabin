import { providerCredentials } from '../../connections/credentials'
import type { Bindings } from '../../../auth.server'
import { managedInstall } from '../../channels'
// Booking.com guest messages through its Connectivity Messaging API, for a
// connectivity partner's machine account (BOOKING_MESSAGING_USER and
// BOOKING_MESSAGING_PASSWORD). Airbnb and Vrbo publish no messaging API outside
// their partner programs. None of the three is connected yet: they come with
// the owner's channel partner accounts. Tested against responses in Booking.com's
// documented shape (tests/fixtures/booking).
export const CHANNEL_LINE = 'Airbnb, Vrbo and Booking.com messages connect later, with the owner’s channel partner accounts. Until then those guests’ messages stay in each channel’s own app; a guest with an email on their stay is emailed from here.'
const BASE = 'https://supply-xml.booking.com/messaging'
async function call(env: Bindings, method: string, path: string, body?: unknown, propertyId?:string|null,action='message:receive') {
 const credentials=await providerCredentials(env,'booking',action,propertyId)
 const response = await fetch(BASE + path, { method, redirect:'manual', headers: { authorization: `Basic ${btoa(`${credentials.BOOKING_MESSAGING_USER}:${credentials.BOOKING_MESSAGING_PASSWORD}`)}`, accept: 'application/json', 'accept-version': '1.2', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) })
 let value: any = null; try { value = await response.json() } catch { /* the status explains it */ }
 const error = value?.errors?.[0]
 if (!response.ok || error) throw Error(`Booking.com refused the request (HTTP ${response.status}). Check its message history.`)
 return value?.data ?? {}
}
const segment = (v: string) => { if (!/^[\w-]{1,64}$/.test(v)) throw Error('Invalid Booking.com id'); return v }
/** Sends into the reservation's conversation: look it up by reservation number, then post. */
export async function sendBooking(env: Bindings, hotelId: string, reservationId: string, text: string,propertyId?:string|null) {
 const found = await call(env, 'GET', `/properties/${segment(hotelId)}/conversations/type/reservation?conversation_reference=${encodeURIComponent(reservationId)}`,undefined,propertyId,'message:send')
 const conversation = found?.conversation?.conversation_id
 if (typeof conversation !== 'string') throw Error('Booking.com has no conversation for this reservation')
 const sent = await call(env, 'POST', `/properties/${segment(hotelId)}/conversations/${segment(conversation)}`, { message: { content: text.slice(0, 5000) } },propertyId,'message:send')
 if (typeof sent?.message_id !== 'string') throw Error('Booking.com did not return a message id')
 return { providerId: sent.message_id as string }
}
/** New guest messages from the machine account's queue, then confirmed so the queue moves on. */
export async function latestBooking(env: Bindings) {
 const data = await call(env, 'GET', '/messages/latest'), list: any[] = Array.isArray(data?.messages) ? data.messages : []
 const guest = list.filter(m => m?.sender?.metadata?.participant_type === 'guest' && typeof m.content === 'string' && m.conversation?.conversation_type === 'reservation')
  .map(m => ({ id: String(m.message_id), text: String(m.content).slice(0, 8000), reservationId: String(m.conversation.conversation_reference ?? ''), name: String(m.sender.metadata.name ?? ''), at: String(m.timestamp ?? '') }))
 if (list.length) await call(env, 'PUT', `/messages?number_of_messages=${list.length}`)
 return guest
}
