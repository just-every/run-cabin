import { type Context, need, text, newId } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { homes } from '../direct/store'
import { guestRoot, guestGroup, consent, consentBaseline } from '../guests/resolve'
import { issueOffer } from '../guests/offers'
import type { Recovery, Proposal } from './types'

async function futureFacts(c: Context, row: Recovery) {
 const home = (await homes(c.db)).find(h => h.propertyId === row.propertyId && h.enabled)
 const origin = c.data.guests.find(g => g.bookingId === row.bookingId), root = origin && guestRoot(c.data, origin.id)
 const booking = c.data.bookings.find(b => b.id === row.bookingId)!
 need(home && root && booking.guestEmail && booking.guestName, 'Publish the booking page and review this guest’s contact first', 409)
 const group = guestGroup(c.data, root.id)
 need(group.some(g => g.identities.some(i => i.kind === 'email' && i.value === booking.guestEmail!.toLowerCase() && i.verified)), 'Verify the guest’s email with its source under Guests first', 409)
 need(c.data.guestPolicies.some(p => p.propertyId === row.propertyId && p.allowRepeatOffers) && consent(c.data, root.id, row.propertyId, 'offers'), 'Record the guest’s explicit offer consent and the home’s returning-offer permission first', 409)
 need((c.data.recoveryPolicies.find(p => p.propertyId === row.propertyId)?.futureDiscountBps ?? 0) >= 1000, 'The owner must allow the 10% future-stay rate in recovery settings first', 403)
 return { guestId: root.id, baseline: JSON.stringify({ home, group, consent: consentBaseline(c.data, root.id, row.propertyId) }) }
}
export async function prepareSettlement(c: Context, row: Recovery, input: Record<string, unknown>): Promise<Pick<Proposal, 'arrivalTime' | 'futureRate'>> {
 const result: Pick<Proposal, 'arrivalTime' | 'futureRate'> = {}, booking = c.data.bookings.find(b => b.id === row.bookingId)!, settings = homeSettings(c, row.propertyId)
 if (input.arrivalTime) {
  const time = text(input.arrivalTime, 'revised check-in', 5)
  need(/^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time > (booking.arrivalTime ?? settings.checkInTime), 'Choose a later check-in than the current promise')
  need(time <= settings.checkInTime, 'A delay beyond the home’s normal check-in needs a separate human arrangement', 409)
  need(instant(`${booking.start.slice(0,10)}T${time}`, settings.timeZone) > Date.parse(c.now), 'The revised arrival must still be ahead', 409)
  result.arrivalTime = time
 }
 if (input.futureDiscount === true || input.futureDiscount === 'on') {
  const facts = await futureFacts(c, row), raw = text(input.offerExpiresAt, 'offer expiry', 30), expiry = new Date(raw.length === 10 ? raw + 'T23:59:59Z' : raw)
  need(Number.isFinite(expiry.getTime()) && expiry.getTime() > Date.parse(c.now) && expiry.getTime() <= Date.parse(c.now) + 90*86400000, 'Choose an offer expiry within 90 days')
  result.futureRate = { ...facts, expiresAt: expiry.toISOString() }
 }
 return result
}
export async function applySettlement(c: Context, row: Recovery) {
 const p = row.proposal!, b = c.data.bookings.find(b => b.id === row.bookingId)!
 if (p.futureRate) need((await futureFacts(c, row)).baseline === p.futureRate.baseline, 'The guest’s contact, consent or home terms changed. Review a new proposal.', 409)
 if (p.arrivalTime) { b.arrivalTime = p.arrivalTime; b.revision = newId() }
 if (p.futureRate) {
  const offer = await issueOffer(c, { id: p.futureRate.guestId, propertyId: row.propertyId, bookingId: b.id, confirm: 'yes', expiresAt: p.futureRate.expiresAt }, '', row.id)
  row.offerId = offer.id; row.offerUrl = offer.url
 }
}
