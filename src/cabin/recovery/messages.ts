import { type Context, type GuestMessage, newId } from '../model'
import type { Recovery } from './types'

export const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
export function creditText(c: Context, row: Recovery, credit: number) {
 const b = c.data.bookings.find(b => b.id === row.bookingId)!, home = c.data.properties.find(p => p.id === row.propertyId)!
 return `Hi ${b.guestName || 'there'},\n\nWe are arranging a replacement cleaning for ${home.name}. ${credit ? `We are offering you a ${dollars(credit)} stay credit.` : 'We will confirm when the home is ready.'}\n\nYour host will confirm readiness after the cleaner has finished and provided photos.`
}
/** The approved case owns this exact email. No LLM chooses its recipient or money. */
export function guestMessage(c: Context, row: Recovery, subject: string, text: string) {
 const b = c.data.bookings.find(b => b.id === row.bookingId)!
 const m: GuestMessage = { id: newId(), revision: newId(), propertyId: row.propertyId, bookingId: b.id, email: b.guestEmail ?? null, phone: null, ref: null, channel: 'email', direction: 'out', source: 'host', status: 'pending', subject, text, detail: null, replyTo: null, headerId: null, sentBy: c.actor.id, approvalId: row.approvalId ?? null, scheduledId: null, providerId: null, grounds: ['approved recovery case', row.id], createdAt: c.now, sentAt: null }
 c.data.messages.push(m); return m
}
