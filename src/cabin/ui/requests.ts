import { h, form, hidden, select, panel, empty, propertyName } from './shared'
import { channelName, nights, span } from '../inventory'
import { stayLabel, time12 } from './calendar-grid'
// Requests check every held night first: a request that overlaps is declined
// and says which stay or block it hit; one that fits closes on every channel.
const input = (name: string, label: string, type: string, attrs = '') => `<label>${h(label)}<input name="${h(name)}" type="${h(type)}" ${attrs}></label>`
export function requestForms(s: any) {
  const homes = s.properties.map((p: any) => [p.id, p.name])
  const stay = form('reservation.request', 'calendar', hidden('kind', 'stay') + select('propertyId', 'Home', homes) + select('channel', 'Requested on', [['direct', 'Direct (phone, email or your site)'], ['airbnb', 'Airbnb'], ['vrbo', 'Vrbo'], ['booking.com', 'Booking.com']]) + input('guestName', 'Guest name', 'text', 'required maxlength="120" autocomplete="off"') + `<div class="pair">${input('start', 'Arrival', 'date', 'required')}${input('end', 'Checkout', 'date', 'required')}</div>` + input('arrivalTime', 'Arrival time (optional)', 'time'), 'Check and hold these nights')
  const block = form('reservation.request', 'calendar', hidden('kind', 'block') + select('propertyId', 'Home', homes) + `<div class="pair">${input('start', 'First night', 'date', 'required')}${input('end', 'Open again on', 'date', 'required')}</div>` + input('note', 'Reason (owner stay, maintenance…)', 'text', 'maxlength="300"'), 'Block these nights')
  return panel('Take a request', `<p class="muted">Cabin declines a request that overlaps any held night and says why; an accepted one closes on every channel at their next sync. Answering requests inside Airbnb, Vrbo and Booking.com needs their partner APIs, which come later.</p>${stay}`) + panel('Block nights', block)
}
export function decisions(s: any) {
  const rows = [...s.requests].sort((a: any, b: any) => b.requestedAt.localeCompare(a.requestedAt)).slice(0, 12).map((r: any) => {
    const held = r.bookingId && s.bookings.find((b: any) => b.id === r.bookingId && b.status === 'confirmed' && b.source === 'request')
    const what = r.kind === 'block' ? `Block ${span(r)}` : `${channelName(r.channel)} request ${span(r)} · ${h(r.guestName)}`
    return `<article class="record decision ${r.status}"><p class="chip ${r.status === 'declined' ? 'chip-bad' : 'chip-good'}"><span class="dot"></span>${h(r.status === 'declined' ? 'Declined' : r.kind === 'block' ? 'Blocked' : 'Accepted')}</p><p><strong>${what}</strong> · ${h(propertyName(s, r.propertyId))}</p>${r.reason ? `<p class="reason">${h(r.reason)}</p>` : ''}${held ? form('reservation.cancel', 'calendar', hidden('id', held.id), r.kind === 'block' ? 'Remove block' : 'Cancel hold', 'class="quiet"') : ''}</article>`
  }).join('')
  return panel('Recent requests', rows || empty('Requests and blocks you take appear here with Cabin’s decision.'))
}
export function arrivals(s: any, today: string, until: string) {
  const rows = s.bookings.filter((b: any) => b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay' && nights(b).first >= today && nights(b).first < until).sort((a: any, b: any) => a.start.localeCompare(b.start)).map((b: any) => {
    const day = new Date(nights(b).first + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    const edit = form('booking.details', 'calendar', hidden('id', b.id) + `<div class="pair"><label>Guest name<input name="guestName" type="text" maxlength="120" value="${h(b.guestName ?? '')}"></label><label>Arrival time<input name="arrivalTime" type="time" value="${h(b.arrivalTime ?? '')}"></label></div>`, 'Save guest and time')
    return `<article class="record arrival"><p><strong>${h(day)}</strong> · ${h(propertyName(s, b.propertyId))} · <span class="ch ch-${b.channel === 'booking.com' ? 'booking' : h(b.channel)}">${h(channelName(b.channel))}</span></p><p>${h(stayLabel(b))}${b.arrivalTime ? ` · arriving ${h(time12(b.arrivalTime))}` : ''} · ${h(span(b))}</p><details><summary>Guest and arrival time</summary>${edit}</details></article>`
  }).join('')
  return panel('Arrivals in the next two weeks', rows || empty('No arrivals in the next two weeks.'))
}
