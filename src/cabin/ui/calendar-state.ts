import { channelName } from '../inventory'
import { homeSettings } from '../homes'
import { homeReadiness } from '../readiness'
import { instant, time12, wall, zoneAbbr } from '../clock'
import { money } from './shared'

export const directStay = (s: any, b: any) => s.direct?.stays?.find((d: any) => d.bookingId === b.id)
export const connectionName = (c: any) => c.name || channelName(String(c.channel))
export function bookingKind(s: any, b: any) {
  const direct = directStay(s, b)
  if (direct && direct.phase !== 'confirmed') return 'Checkout hold'
  if ((b.kind ?? 'stay') !== 'block') return 'Stay'
  if (b.channel !== 'direct') return 'Channel block'
  if (/owner|personal stay/i.test(b.summary)) return 'Owner block'
  return /maintenance/i.test(b.summary) ? 'Maintenance block' : 'Block'
}
export function paymentState(s: any, b: any) {
  const d = directStay(s, b)
  if (!d) return { label: (b.kind ?? 'stay') === 'block' ? 'Not applicable · no guest revenue' : b.channel === 'direct' ? 'Unknown · no payment recorded' : 'Unknown · not supplied by the channel calendar', short: (b.kind ?? 'stay') === 'block' ? '' : 'Payment unknown' }
  if (!d.paymentId) return { label: d.phase === 'expired' ? 'Checkout expired · no payment recorded' : 'Unpaid · checkout payment pending', short: 'Unpaid' }
  const mode = d.paymentMode === 'live' ? '' : ' in test mode'
  return { label: `${money(d.quote.totalCents)} paid${mode}${d.phase === 'paid' ? ' · confirmation pending' : ''}`, short: `Paid${mode}` }
}
/** Inventory cannot be called open while any connected source is unreadable or overdue. */
export function availability(s: any, propertyId: string, now = Date.now()) {
  const connections = s.connections.filter((c: any) => c.propertyId === propertyId)
  const stale = connections.filter((c: any) => c.status === 'stale' || (c.status === 'ok' && (!Number.isFinite(Date.parse(c.nextPollAt)) || Date.parse(c.nextPollAt) <= now)))
  const unknown = connections.filter((c: any) => c.status !== 'ok' || !Number.isFinite(Date.parse(c.lastSuccessAt)))
  const unconnected = [...s.feeds, ...s.bookings.filter((b: any) => b.status === 'confirmed' && b.channel !== 'direct')].some((f: any) => f.propertyId === propertyId && !connections.some((c: any) => c.channel === f.channel && (!f.connectionId || c.id === f.connectionId)))
  if (stale.length) return { state: 'stale', label: `Availability stale · ${stale.map(connectionName).join(', ')}; last held nights retained` }
  if (!connections.length || unknown.length || unconnected) return { state: 'unknown', label: 'Availability unknown · a channel calendar has no current successful read' }
  return { state: 'fresh', label: 'Calendar reads current · polled iCal does not guarantee against double booking' }
}
/** A timestamp is an instant; date-only bookings remain wall dates at the home. */
export function bookingMoment(s: any, b: any, side: 'arrival' | 'departure') {
  const settings = homeSettings(s, b.propertyId), d = directStay(s, b), zone = d?.timeZone ?? settings.timeZone
  const raw = side === 'arrival' ? b.start : b.end
  const override = side === 'arrival' ? b.arrivalTime : null
  const saved = side === 'arrival' ? d?.arrivalAt : d?.departureAt
  let local: string, ms: number
  if (!override && (saved || /T.*(?:Z|[+-]\d\d:\d\d)$/.test(raw))) {
    ms = Date.parse(saved || raw); local = wall(ms, zone)
  } else {
    const clock = override || (raw.includes('T') ? raw.slice(11, 16) : side === 'arrival' ? settings.checkInTime : settings.checkOutTime)
    local = `${raw.slice(0, 10)}T${clock}`; ms = instant(local, zone)
  }
  const date = new Date(local.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `${date}, ${time12(local.slice(11, 16))} ${zoneAbbr(ms, zone)} (${zone})`
}
/** Readiness belongs to this arrival, rather than whichever stay is next today. */
export function bookingReadiness(s: any, b: any) {
  if ((b.kind ?? 'stay') === 'block') return null
  const p = s.properties.find((p: any) => p.id === b.propertyId)
  const readiness = homeReadiness(s, p, b.start.slice(0, 10))
  if (readiness.arrival?.id !== b.id) return { ...readiness, state: 'unknown', reasons: ['Another arrival holds this date; resolve the overlap before confirming readiness'] }
  return readiness
}
export const readinessLabel = (r: ReturnType<typeof bookingReadiness>) => !r ? 'Not applicable' : r.state === 'ready' ? 'Ready' : r.state === 'unknown' ? 'Readiness unknown' : 'Not ready'
export function syncTime(value: string | null | undefined, zone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Never'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }) + ` (${zone})`
}
