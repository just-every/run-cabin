import { inquiriesPanel } from '../reservations/inquiries-ui'
import type { Request } from '../model'
import { quotesPanel } from '../reservations/quotes-ui'
import { createReservation } from '../reservations/ui'
import { blockEditor } from './blocks'
import { h, form, hidden, select, panel, empty, heading, propertyName, manager } from './shared'
import { addDays, channelName, nights, span } from '../inventory'
import { ARRIVAL_DAYS, stayLabel, time12 } from './calendar-grid'
// Requests check every held night first: a request that overlaps is declined
// and says which stay or block it hit; one that fits closes on every channel.
const input = (name: string, label: string, type: string, attrs = '') => `<label>${h(label)}<input name="${h(name)}" type="${h(type)}" ${attrs}></label>`
export function requestForms(s: any) {
  const homes = s.properties.map((p: any) => [p.id, p.name])
  const stay = form('reservation.request', 'reservations', hidden('kind', 'stay') + select('propertyId', 'Home', homes) + select('channel', 'Requested on', [['direct', 'Direct (phone, email or your site)'], ['airbnb', 'Airbnb'], ['vrbo', 'Vrbo'], ['booking.com', 'Booking.com']]) + input('guestName', 'Guest name', 'text', 'required maxlength="120" autocomplete="off"') + `<div class="pair">${input('guestEmail', 'Guest email (optional)', 'email', 'maxlength="254" autocomplete="off"')}${input('guestPhone', 'Guest phone (optional)', 'tel', 'maxlength="40" autocomplete="off"')}</div>` + `<div class="pair">${input('start', 'Arrival', 'date', 'required')}${input('end', 'Checkout', 'date', 'required')}</div>` + input('arrivalTime', 'Arrival time (optional)', 'time'), 'Check and hold these nights')
  const block = form('reservation.request', 'reservations', hidden('kind', 'block') + select('purpose','Block purpose',[['maintenance','Maintenance'],['owner','Owner personal stay']])+select('propertyId', 'Home', homes) + `<div class="pair">${input('start', 'First night', 'date', 'required')}${input('end', 'Open again on', 'date', 'required')}</div>` + input('note', 'Reason (owner stay, maintenance…)', 'text', 'maxlength="300" required'), 'Block these nights')
  return `<section class="panel" id="request"><h2>Take a request</h2><p class="muted">Cabin declines a request that overlaps any held night and says why; an accepted one closes on every channel at their next sync. Answering requests inside Airbnb, Vrbo and Booking.com needs their partner APIs, which come later.</p>${stay}</section>` + panel('Block nights', block)
}
export function decisions(s: any, selected?: string | null) {
  const requests = [...s.requests].sort((a: Request, b: Request) => b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id))
  const rows = (selected ? requests.filter((r: Request) => r.id === selected) : requests.slice(0, 12)).map((r: Request) => {
    const held = r.bookingId && s.bookings.find((b: any) => b.id === r.bookingId && b.status === 'confirmed' && b.source === 'request')
    const what = r.kind === 'block' ? `Block ${span(r)}` : `${channelName(r.channel)} request ${span(r)} · ${h(r.guestName)}`
    return `<article class="record decision ${r.status}" id="request-${h(r.id)}"><p class="chip ${r.status === 'declined' ? 'chip-bad' : 'chip-good'}"><span class="dot"></span>${h(r.status === 'declined' ? 'Declined' : r.kind === 'block' ? 'Blocked' : 'Accepted')}</p><p><strong>${what}</strong> · ${h(propertyName(s, r.propertyId))}</p>${r.reason ? `<p class="reason">${h(r.reason)}</p>` : ''}${held && !held.blockUse ? form('reservation.cancel', 'reservations', hidden('id', held.id)+hidden('revision',held.revision), r.kind === 'block' ? 'Remove block' : 'Cancel hold', 'class="danger"') : ''}</article>`
  }).join('')
  return panel(selected ? 'Request record' : 'Recent requests', rows || empty(selected ? 'This request is not available.' : 'Requests and blocks you take appear here with Cabin’s decision.'))
}
export function arrivals(s: any, today: string, until: string) {
  const rows = s.bookings.filter((b: any) => b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay' && nights(b).first >= today && nights(b).first < until).sort((a: any, b: any) => a.start.localeCompare(b.start)).map((b: any) => {
    const day = new Date(nights(b).first + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    const edit = form('booking.details', 'reservations', hidden('id', b.id)+hidden('revision',b.revision) + `<div class="pair"><label>Guest name<input name="guestName" type="text" maxlength="120" value="${h(b.guestName ?? '')}"></label><label>Arrival time<input name="arrivalTime" type="time" value="${h(b.arrivalTime ?? '')}"></label></div><div class="pair"><label>Guest email<input name="guestEmail" type="email" maxlength="254" value="${h(b.guestEmail ?? '')}"></label><label>Guest phone<input name="guestPhone" type="tel" maxlength="40" value="${h(b.guestPhone ?? '')}"></label></div>`, 'Save guest details')
    return `<article class="record arrival" id="stay-${h(b.id)}"><p><strong>${h(day)}</strong> · ${h(propertyName(s, b.propertyId))} · <span class="ch ch-${b.channel === 'booking.com' ? 'booking' : h(b.channel)}">${h(channelName(b.channel))}</span></p><p>${h(stayLabel(b))}${b.arrivalTime ? ` · arriving ${h(time12(b.arrivalTime))}` : ''} · ${h(span(b))}</p><details><summary>Guest, contact and arrival time</summary>${edit}</details>${b.source === 'request' ? `<details><summary>Change dates</summary>${form('reservation.move', 'reservations', hidden('id', b.id)+hidden('revision',b.revision) + `<div class="pair">${input('start', 'Arrival', 'date', `required value="${h(nights(b).first)}"`)}${input('end', 'Checkout', 'date', `required value="${h(nights(b).checkout)}"`)}</div>`, 'Move this stay')}<p class="muted">Its turnover, door codes and scheduled messages move with it.</p></details>` : ''}</article>`
  }).join('')
  return panel('Arrivals in the next two weeks', rows || empty('No arrivals in the next two weeks.'))
}
/** Requests, blocks and the next two weeks' arrivals: the calendar's New reservation opens here. */
export function reservations(s: any, selected?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const lead = heading('Vacation rental operations', 'Reservations', 'Take a phone, email or channel request, block nights for an owner stay or maintenance, and keep each arrival’s guest details and arrival time.')
  if (!s.properties.length) return lead + panel('Take a request', empty('Add a home in Properties & people, or use Move in, to begin.'))
  const saved=panel('Saved reservations',s.bookings.filter((b:any)=>b.kind!=='block').map((b:any)=>`<p><a href="/app/calendar?reservation=${encodeURIComponent(b.id)}">${h(b.guestName??b.summary)} · ${h(propertyName(s,b.propertyId))} · ${h(span(b))}</a> · ${h(b.lifecycle?.outcome??b.status)}</p>`).join('')||empty('No stays saved yet.'))
  return lead + inquiriesPanel(s)+quotesPanel(s)+saved+createReservation(s)+blockEditor(s)+`<div class="columns">${requestForms(s)}</div><div class="columns">${decisions(s, selected)}${arrivals(s, today, addDays(today, ARRIVAL_DAYS))}</div>`
}

/** Requested nights use the same end-exclusive property-local dates as inventory. */
export function declinedRequests(s: any, day: string) {
  if (!manager(s)) return ''
  const requests: Request[] = s.requests.filter((r: Request) => r.status === 'declined' && r.kind === 'stay' && r.channel !== 'direct' && r.start.slice(0, 10) <= day && day < r.end.slice(0, 10))
  requests.sort((a, b) => propertyName(s, a.propertyId).localeCompare(propertyName(s, b.propertyId)) || a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id))
  const rows = requests.map(r => {
    const overlap = r.overlaps && s.bookings.find((b: any) => b.id === r.overlaps && b.propertyId === r.propertyId)
    return `<article class="record decision declined"><h3>${h(propertyName(s, r.propertyId))}</h3><p>${h(channelName(r.channel))} request · ${h(r.guestName)} · ${h(span(r))}</p>
      <p class="chip chip-bad">Declined in Cabin</p><p class="reason">${h(r.reason || 'Reason unknown')}</p>
      <p><a href="/app/reservations?request=${encodeURIComponent(r.id)}#request-${encodeURIComponent(r.id)}">Request record</a>${overlap ? ` · <a href="/app/calendar?from=${encodeURIComponent(day)}&amp;reservation=${encodeURIComponent(overlap.id)}">Overlapping reservation record</a>` : ' · Overlapping record unavailable'}</p></article>`
  }).join('')
  return `<section class="panel" aria-label="Declined channel requests"><h2>Declined channel requests</h2><p class="muted">Requested nights include this home-local day; checkout is excluded. These are Cabin’s recorded decisions. A channel-side decline or expiry is not confirmed here.</p>${rows ? `<div class="jobs">${rows}</div>` : empty('No declined channel requests for this day.')}</section>`
}
