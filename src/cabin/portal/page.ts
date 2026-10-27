import { agreementOf, currentDocument } from '../agreements/records'
import { verificationOf, resolved } from '../verification/records'
import { portalBalance } from './balance'
import { guideFilesHtml } from './files'
import { instant, when } from '../clock'
import { h, money } from '../ui/shared'
import type { AccessCode, Booking, Data, HomeSettings } from '../model'

/** Door code, arrival instructions and guidebook: shown only while the stay is confirmed, access is released and check-out has not passed. */
export const accessLive = (code: AccessCode, booking: Booking, blocked: boolean, now = Date.now()) => !blocked && booking.status === 'confirmed' && code.status === 'issued' && (code.lock.state === 'manual' || code.lock.state === 'set') && now < instant(code.validUntil, code.timeZone)

const row = (label: string, state: string, detail: string) => `<li><strong>${h(label)}</strong> <span class="chip ${state === 'done' ? 'chip-good' : ''}">${h(state === 'done' ? 'Done' : 'To do')}</span> <span class="muted">${detail}</span></li>`

/** The guest's own checklist before arrival: signature, identity and payment, each from its saved record. */
export async function portalTasks(env: { DB: D1Database }, data: Data, booking: Booking,path:string) {
 if (booking.status !== 'confirmed') return ''
 const rows: string[] = [], agreement = agreementOf(data, booking.id), verification = verificationOf(data, booking.id)
 if (agreement?.required) {
  const signed = !!currentDocument(agreement)?.signature
  rows.push(row('Sign the rental agreement', signed ? 'done' : 'todo', signed ? 'Signed.' : agreement.token ? `<a href="/book/stay/agreement/${h(agreement.token)}">Review and sign</a>` : 'Your host will send it.'))
 }
 if (verification && verification.status !== 'not_required') rows.push(row('Complete the identity check', resolved(verification) ? 'done' : 'todo', resolved(verification) ? 'Verified.' : verification.token ? `<a href="${h(path)}/verification">Start or request manual review</a>` : 'Your host will contact you.'))
 if (booking.lifecycle?.price || data.payouts.some(p=>p.bookingId===booking.id&&p.match==='matched') || await env.DB.prepare("SELECT 1 FROM cb_direct_stays WHERE json_extract(data,'$.bookingId')=?").bind(booking.id).first()) {
  const { balanceCents, paidCents,channelPaidCents } = await portalBalance(env,data,booking)
  if (balanceCents !== null) rows.push(row('Pay your balance', balanceCents <= 0 ? 'done' : 'todo', balanceCents <= 0 ? `Paid ${money(paidCents)}.` : `${money(balanceCents)} still due. Use the secure link in your booking email.`))
  else if(channelPaidCents>0)rows.push(row('Confirm your channel payment','todo',`Your channel records ${money(channelPaidCents)} in reservation payments. Ask your host to confirm the total and any remaining balance.`))
 }
 return rows.length ? `<section class="panel" id="tasks"><h2>Before you arrive</h2><ul class="tasks">${rows.join('')}</ul></section>` : ''
}

/** Arrival instructions, house rules and the guidebook, with the guide version the guest is reading. */
export function portalGuide(data: Data, settings: HomeSettings, propertyId: string,path:string) {
 const guide = settings.guide, rules = data.propertyProfiles.find(p => p.propertyId === propertyId)?.houseRules
 if (!guide && !rules) return ''
 const block = (title: string, body: string) => body ? `<h3>${h(title)}</h3><p class="prewrap">${h(body)}</p>` : ''
 return `<section class="panel" id="guide"><h2>Arrival and your stay</h2>${guide ? `<p class="muted">Guide version ${guide.version} · updated ${h(guide.updatedAt.slice(0, 10))}</p>` : ''}${block('Arrival instructions', guide?.arrival ?? '')}${block('House rules', rules ?? '')}${block('Guidebook', guide?.guidebook ?? '')}${guideFilesHtml(guide,path)}</section>`
}

export const reservationFacts = (booking: Booking, settings: HomeSettings) => `<dt>Guest</dt><dd>${h(booking.guestName ?? 'Guest')}</dd><dt>Reservation</dt><dd>${h(booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled')} · ${h(when(`${booking.start.slice(0,10)}T${booking.arrivalTime??settings.checkInTime}`))} to ${h(when(`${booking.end.slice(0,10)}T${booking.departureTime??settings.checkOutTime}`))}</dd>`
