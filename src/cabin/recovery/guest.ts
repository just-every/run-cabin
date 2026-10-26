import { recoveryUnresolved } from './monitor'
import { type Context, type Data, type Booking, type AccessCode, need, exact, newId } from '../model'
import { instant } from '../clock'
import { note } from './cases'
import { h } from '../ui/shared'

export function guestSettlement(c: Context, booking: Booking, code: AccessCode, form: URLSearchParams, managerEmail: string) {
 const row = c.data.recoveries.find(r => r.id === form.get('caseId') && r.bookingId === booking.id && r.approvalId && ['active', 'ready', 'escalated'].includes(r.status))
 need(row && (row.proposal?.arrivalTime || row.proposal?.alternative || row.offerId), 'These arrangements are no longer awaiting a response', 409)
 exact(row, form.get('revision'))
 need(instant(code.validUntil, code.timeZone) > Date.parse(c.now), 'Contact your host about this completed stay', 409)
 need(row.appliedBaseline === JSON.stringify({ booking: booking.revision, recipient: booking.guestEmail, cleanerId: c.data.turnovers.find(t => t.id === row.turnoverId)?.cleanerId }), 'Your stay changed. Ask your host to review these arrangements.', 409)
 need(!row.guestAcceptedAt, 'Your response has already been recorded', 409)
 if (form.get('response') === 'accept') {
  row.status = 'active'; row.guestAcceptedAt = c.now; row.guestAcceptedRevision = row.revision
  note(c, row, 'Guest accepted revised arrangements', 'The guest confirmed through their private stay page. This does not mark the home ready or redeem a future booking.')
 } else {
  need(form.get('response') === 'help', 'Choose a response')
  row.status = 'escalated'; note(c, row, 'Guest needs a person', 'The guest could not accept the revised arrival and asked the host to contact them.')
 }
 c.data.notices.push({ id: newId(), revision: newId(), propertyId: row.propertyId, memberId: c.actor.id, email: managerEmail, kind: 'inbox', recordId: row.id, subject: `Recovery response from ${booking.guestName || 'your guest'}`, text: row.guestAcceptedAt ? 'The guest accepted the revised arrangements. Verify cleaning, photos and access before closing the recovery.' : 'The guest needs your help and has not accepted the revised arrangements. Contact them before arrival.', status: 'pending', detail: null, createdAt: c.now, sentAt: null })
}
/** A delivery receipt is not the guest's confirmation that the recovery worked. */
export function guestRecoveryConfirmation(c: Context, booking: Booking, code: AccessCode, form: URLSearchParams) {
 const row=c.data.recoveries.find(r=>r.id===form.get('caseId')&&r.bookingId===booking.id&&!r.issue)
 need(row?.status==='ready'&&row.approvalId,'This recovery is not awaiting a guest check',409);exact(row,form.get('revision'))
 need(code.id===row.codeId&&code.status==='issued','The current access changed. Contact your host.',409)
 need(!row.guestConfirmedAt,'Your confirmation has already been recorded',409)
 const reasons=recoveryUnresolved(c.data,row);need(!reasons.length,'Your host must resolve the outstanding stay problem before confirming recovery',409)
 if(form.get('response')==='confirmed'){
  row.guestConfirmedAt=c.now;note(c,row,'Guest confirmed recovery','The verified guest confirmed the home and replacement access through their private stay page. A person must still perform the follow-up check.')
 }else{
  need(form.get('response')==='problem','Choose your current experience')
  row.status='escalated';delete row.recurrence;note(c,row,'Guest reports continuing problem','The verified guest reports that the recovery has not resolved their problem. A person must follow up; this case cannot close.')
 }
}
export function guestRecovery(data: Data, bookingId: string) {
 const row=[...data.recoveries].reverse().find(r=>r.bookingId===bookingId&&r.approvalId&&!r.issue&&r.status!=='undone')
 if(!row)return ''
 const offer=data.guestOffers.find(o=>o.id===row.offerId),activeOffer=offer?.status==='issued'&&Date.parse(offer.expiresAt)>Date.now()
 const arrangements=row.proposal?.arrivalTime||row.proposal?.alternative||row.offerId
 const proposed=arrangements?`<section class="panel"><h2>Your revised arrangements</h2><p class="recovery-text">${h(row.proposal?.guestText)}</p>${row.guestAcceptedAt?'<p class="notice">You accepted these arrangements. Your host still verifies the home is ready.</p>':`${row.status==='escalated'?'<p class="notice">Your host has been asked to contact you. These arrangements are unresolved.</p>':''}<form method="post"><input type="hidden" name="action" value="settlement"><input type="hidden" name="caseId" value="${h(row.id)}"><input type="hidden" name="revision" value="${h(row.revision)}"><button name="response" value="accept">Accept revised arrangements</button><button name="response" value="help">I need to speak with my host</button></form>`}${row.guestAcceptedAt&&activeOffer&&row.offerUrl?`<p><a class="button" href="${h(row.offerUrl)}">Book a future stay with 10% off rent</a></p><p>One use before ${h(offer!.expiresAt.slice(0,10))}. Stay rules and availability apply. Cleaning, extras and taxes are separate.</p>`:offer?.status==='redeemed'?'<p>Your future-stay offer has been used.</p>':''}</section>`:''
 const confirmation=row.status==='ready'?`<section class="panel"><h2>Check your recovery</h2>${row.guestConfirmedAt?'<p>Your confirmation is recorded. Your host is checking that the problem stays resolved.</p>':`<p>Your host has verified cleaning, photos and replacement access. Please confirm what you found.</p><form method="post"><input type="hidden" name="action" value="recovery-confirm"><input type="hidden" name="caseId" value="${h(row.id)}"><input type="hidden" name="revision" value="${h(row.revision)}"><button name="response" value="confirmed">The home and access are working</button><button name="response" value="problem">The problem is still happening</button></form>`}</section>`:''
 return proposed+confirmation
}
