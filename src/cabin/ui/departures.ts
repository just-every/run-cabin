import type { Booking, Turnover } from '../model'
import { homeSettings } from '../homes'
import { channelName } from '../inventory'
import { checkoutTime } from '../turnover-window'
import { when } from '../clock'
import { atHome } from './ops'
import { guestOf } from './calendar-grid'
import { h, empty, manager, propertyName } from './shared'

/** Departures belong to the home's calendar, whether or not another guest is due. */
export function departures(s: any, day: string) {
  if (!manager(s)) return ''
  const stays: Booking[] = s.bookings.filter((b: Booking) => b.status === 'confirmed' && !b.cancelled && (b.kind ?? 'stay') === 'stay' && b.end.slice(0, 10) === day)
  stays.sort((a, b) => propertyName(s, a.propertyId).localeCompare(propertyName(s, b.propertyId)) || checkoutTime(homeSettings(s, a.propertyId), a).localeCompare(checkoutTime(homeSettings(s, b.propertyId), b)))
  const cards = stays.map(b => {
    const settings = homeSettings(s, b.propertyId), scheduled = checkoutTime(settings, b)
    const turnover: Turnover | undefined = s.turnovers.find((t: Turnover) => t.bookingId === b.id && t.propertyId === b.propertyId && t.status !== 'cancelled' && t.status !== 'draft' && t.bookingRevision === b.revision)
    const out = turnover?.checkedOut
    const actual = out && Number.isFinite(Date.parse(out.at)) ? `<time datetime="${h(out.at)}">${h(atHome(s, b.propertyId, out.at))}</time>` : 'Unknown · no current check-out recorded'
    const source = out ? out.source === 'cleaner' ? 'Cleaner observation' : out.source === 'staff' ? 'Staff entry' : 'Unknown source' : 'Unknown'
    const reservation = `/app/calendar?from=${encodeURIComponent(day)}&amp;reservation=${encodeURIComponent(b.id)}`
    return `<article class="record"><h3>${h(propertyName(s, b.propertyId))}</h3><p>${h(guestOf(b))} · ${h(channelName(b.channel))}</p>
      <dl class="facts"><dt>Scheduled check-out</dt><dd><time datetime="${h(scheduled)}">${h(when(scheduled))}</time> · ${h(settings.timeZone)}</dd>
      <dt>Actual check-out</dt><dd>${actual}</dd><dt>Source</dt><dd>${source}</dd></dl>
      <p><a href="${reservation}">Reservation record</a>${turnover ? ` · <a href="/app/turnovers#turnover-${h(turnover.id)}">Turnover</a>` : ' · Turnover unknown · none recorded for this reservation revision'}</p></article>`
  }).join('')
  return `<section class="panel" aria-label="Departures"><h2>Departures</h2><p class="muted">${h(day)} at each home. Scheduled times do not confirm that guests have left.</p>${cards ? `<div class="jobs">${cards}</div>` : empty('No confirmed stay departures on this local day.')}</section>`
}
