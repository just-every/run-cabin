import { reservationEditor } from '../reservations/ui'
import { h, propertyName, memberName } from './shared'
import { homeSettings } from '../homes'
import { channelName, overlaps } from '../inventory'
import { bookingKind, bookingMoment, bookingReadiness, connectionName, directStay, paymentState, readinessLabel, syncTime, availability } from './calendar-state'

const facts = (rows: [string, string][]) => `<dl class="pop-facts">${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('')}</dl>`
export function reservationBody(s: any, b: any) {
  const settings = homeSettings(s, b.propertyId), readiness = bookingReadiness(s, b), direct = directStay(s, b)
  const kind = bookingKind(s, b), block = (b.kind ?? 'stay') === 'block'
  const jobs = s.turnovers.filter((t: any) => t.propertyId === b.propertyId && t.status !== 'cancelled' && (t.bookingId === b.id || t.nextBookingId === b.id || t.id === readiness?.turnover?.id))
  const issues = s.tasks.filter((t: any) => t.propertyId === b.propertyId && t.status === 'open')
  const cases = (s.recoveries ?? []).filter((r: any) => r.bookingId === b.id && !['closed', 'undone'].includes(r.status))
  const clash = s.bookings.filter((other: any) => other.id !== b.id && other.propertyId === b.propertyId && other.status === 'confirmed' && b.status === 'confirmed' && overlaps(b, other))
  const links = s.connections.filter((c: any) => c.propertyId === b.propertyId && c.channel === b.channel && (!b.connectionId || c.id === b.connectionId))
  const allLinks = s.connections.filter((c: any) => c.propertyId === b.propertyId)
  const source = b.source === 'request' ? 'Created in Cabin' : b.source === 'migration' ? 'Imported from the previous system' : 'Imported from a channel calendar'
  const row = facts([
    ['Home', propertyName(s, b.propertyId)], ['Type', kind], ['Status', direct ? ({ held: 'Held · awaiting payment', paid: 'Paid · confirmation pending', confirmed: 'Confirmed', expired: 'Expired checkout hold' } as Record<string, string>)[direct.phase] || direct.phase : b.status], ['Channel', channelName(b.channel)],
    ['Guest', direct?.guestName || (block ? '' : b.guestName || 'Not supplied by the channel')], ['Reason', block ? b.summary : ''],
    [block && !direct ? 'First night' : 'Arrival', block && !direct ? `${b.start.slice(0, 10)} (${settings.timeZone})` : bookingMoment(s, b, 'arrival')], [block && !direct ? 'Open again (exclusive)' : 'Departure', block && !direct ? `${b.end.slice(0, 10)} (${settings.timeZone})` : bookingMoment(s, b, 'departure')],
    ['Payment', paymentState(s, b).label], ['Readiness', `${readinessLabel(readiness)}${readiness?.reasons.length ? ' · ' + readiness.reasons.join(' · ') : ''}`],
    ['Availability', availability(s, b.propertyId).label], ['Email', b.guestEmail || direct?.email || ''], ['Phone', b.guestPhone || ''],
    ['Source', source], ['Reservation', b.id], ['Revision', b.revision], ['Source event', b.uid], ['Channel reference', b.channelRef || ''],
    ['Management agreement', b.managementTerms ? `${b.managementTerms.ownerName} · ${b.managementTerms.commissionBps/100}% · ${b.managementTerms.effectiveFrom==='0001-01-01'?'initial agreement':'from '+b.managementTerms.effectiveFrom} · ${b.managementTerms.id}` : 'Not yet recorded'],
    ['Recorded', syncTime(b.approvedAt, settings.timeZone)],
    ['Source freshness', b.channel === 'direct' ? 'Cabin inventory · updated with each saved reservation' : links.length ? links.map((c: any) => `${connectionName(c)} · ${c.status} · last success ${syncTime(c.lastSuccessAt, settings.timeZone)}`).join('; ') : 'Unknown · no live source connection']
  ])
  const turnovers = jobs.length ? `<section><h3>Turnover</h3>${jobs.map((t: any) => `<p><a href="/app/turnovers#turnover-${h(t.id)}">${h(t.bookingId === b.id ? 'After this departure' : 'Before this arrival')} · ${h(t.status)}</a> · ${h(t.cleanerId ? memberName(s, t.cleanerId) : 'No cleaner assigned')}${t.windowStart ? ` · ${h(t.windowStart.replace('T', ' '))} → ${h(t.windowEnd?.replace('T', ' ') ?? 'unknown')} (${h(settings.timeZone)})` : ''}</p>`).join('')}</section>` : '<p>No turnover recorded for this reservation.</p>'
  const problems = [...issues.map((t: any) => `<li><a href="/app/maintenance#task-${h(t.id)}">${h(t.title)}</a>${t.blocking ? ' · blocks arrival' : ''}</li>`), ...cases.map((r: any) => `<li><a href="/app/recovery#recovery-${h(r.id)}">${h(r.reason)}</a> · ${h(r.status)}</li>`)]
  const collisions = clash.length ? `<section><h3>Overlapping inventory</h3><ul>${clash.map((other: any) => `<li><a href="/app/calendar?reservation=${encodeURIComponent(other.id)}">${h(other.guestName || other.summary || bookingKind(s, other))}</a> · ${h(channelName(other.channel))}</li>`).join('')}</ul></section>` : ''
  const freshness = `<section><h3>Sync freshness</h3>${allLinks.length ? allLinks.map((c: any) => `<p><a href="/app/channels">${h(connectionName(c))}</a> · ${h(c.status)}${c.error ? ` · ${h(c.error)}` : ''}</p>${facts([['Last successful read', syncTime(c.lastSuccessAt, settings.timeZone)], ['Last applied change', syncTime(c.lastChangeAt, settings.timeZone)], ['Next poll', syncTime(c.nextPollAt, settings.timeZone)], ['Open sync exception', c.exception && !c.exception.resolvedAt ? `Assigned to ${c.exception.assignedName || c.exception.assignedTo}` : '']])}`).join('') : '<p>Unknown · no live channel calendar connected.</p>'}</section>`
  return row + reservationEditor(s,b) + collisions + turnovers + `<section><h3>Open issues</h3>${problems.length ? `<ul>${problems.join('')}</ul>` : '<p>No open maintenance or recovery issues recorded.</p>'}</section>` + freshness
}

/** A source record stays addressable for any date, including blocks and past stays. */
export function reservationPanel(s: any, id: string, back: string) {
  const b = s.bookings.find((b: any) => b.id === id)
  if (!b) return `<aside class="panel stay-panel" aria-label="Reservation record"><h2>Reservation unavailable</h2><p>The record is unavailable. Availability is unknown; no nights have been released.</p><a href="${back}">Back to calendar</a></aside>`
  const d = directStay(s, b)
  return `<aside class="panel stay-panel" aria-label="Reservation record"><header><h2>${h(bookingKind(s, b))} record</h2></header><h3>${h(b.guestName || d?.guestName || b.summary || 'Reserved')}</h3>${reservationBody(s, b)}<p class="pop-links"><a href="${back}">Back to calendar</a>${d ? '<a href="/app/direct">Manage direct payment</a>' : ''}<a href="/app/reservations">Manage reservations</a></p></aside>`
}
