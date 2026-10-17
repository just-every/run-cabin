import { h } from './shared'
import { CHANNELS, addDays, channelName, nights, overlaps, span } from '../inventory'
// Homes by days: each home has one row per channel. A channel's own stays are
// coloured bars; nights held anywhere else show as Closed on that channel, the
// way Cabin's export link closes them there. Placement uses the gs-/gw- column
// classes in cabin.css because the page's CSP refuses inline styles.
export const DAYS = 14
const slug = (ch: string) => ch === 'booking.com' ? 'booking' : ch
const dayIndex = (from: string, day: string) => Math.round((Date.parse(day) - Date.parse(from)) / 86_400_000)
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
export function time12(t?: string | null) { if (!t) return ''; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'am' : 'pm'}` }
export const stayLabel = (b: any) => b.guestName || (b.summary && !/^reserved$/i.test(b.summary) ? b.summary : 'Reserved')
/** Every pair of confirmed stays on one home whose nights overlap: a channel sold a night before it heard. */
export function collisions(bookings: any[]) {
  const stays = bookings.filter(b => b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay'), found: [any, any][] = []
  for (let i = 0; i < stays.length; i++) for (let j = i + 1; j < stays.length; j++) if (stays[i].propertyId === stays[j].propertyId && overlaps(stays[i], stays[j])) found.push([stays[i], stays[j]])
  return found
}
function place(from: string, b: { start: string; end: string }) {
  const n = nights(b), a = Math.max(0, dayIndex(from, n.first)), z = Math.min(DAYS, dayIndex(from, n.checkout))
  return z > a ? { a, z, cls: `gs-${a + 2} gw-${z - a}${dayIndex(from, n.first) < 0 ? ' cut-start' : ''}${dayIndex(from, n.checkout) > DAYS ? ' cut-end' : ''}` } : null
}
function bar(from: string, b: any, clash: Set<string>) {
  const at = place(from, b); if (!at) return ''
  const count = dayIndex(nights(b).first, nights(b).checkout), block = (b.kind ?? 'stay') === 'block'
  const label = block ? (b.channel === 'direct' ? b.summary || 'Blocked' : 'Blocked') : `${stayLabel(b)}${b.arrivalTime ? ` · ${time12(b.arrivalTime)}` : ''}${at.z - at.a > 2 ? ` · ${count} night${count === 1 ? '' : 's'}` : ''}`
  const title = `${channelName(b.channel)} · ${block ? 'blocked' : stayLabel(b)} · ${span(b)}${b.arrivalTime ? ` · arriving ${time12(b.arrivalTime)}` : ''}${clash.has(b.id) ? ' · overlaps another stay' : ''}`
  return `<span class="bar ${block ? 'bar-blocked' : `bar-${slug(b.channel)}`}${clash.has(b.id) ? ' bar-collision' : ''} ${at.cls}" title="${h(title)}">${clash.has(b.id) ? '<b>Collision</b> ' : ''}${h(label)}</span>`
}
/** Nights in the window held by other channels and not by this one, merged into runs. */
function closed(from: string, own: any[], others: any[]) {
  const runs: string[] = []; let start = -1
  const heldElsewhere = (i: number) => { const d = { start: addDays(from, i), end: addDays(from, i + 1) }; return others.some(b => overlaps(b, d)) && !own.some(b => overlaps(b, d)) }
  for (let i = 0; i <= DAYS; i++) {
    const on = i < DAYS && heldElsewhere(i)
    if (on && start < 0) start = i
    if (!on && start >= 0) { runs.push(`<span class="bar bar-closed gs-${start + 2} gw-${i - start}" title="Closed here: booked or blocked on another channel">${i - start > 1 ? 'Closed' : ''}</span>`); start = -1 }
  }
  return runs.join('')
}
const cells = (from: string, today: string) => Array.from({ length: DAYS }, (_, i) => { const d = addDays(from, i), w = new Date(d + 'T00:00:00Z').getUTCDay(); return `<i class="cell gs-${i + 2}${w === 0 || w === 6 ? ' weekend' : ''}${d === today ? ' today' : ''}"></i>` }).join('')
export function grid(s: any, from: string, today: string) {
  const end = addDays(from, DAYS), live = s.bookings.filter((b: any) => b.status === 'confirmed' && overlaps(b, { start: from, end }))
  const clash = new Set(collisions(s.bookings).flat().map(b => b.id))
  const head = `<div class="cal-line cal-head"><span class="lab">Home</span>${Array.from({ length: DAYS }, (_, i) => { const d = new Date(addDays(from, i) + 'T00:00:00Z'); return `<span class="day gs-${i + 2}${addDays(from, i) === today ? ' today' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}<b>${d.getUTCDate()}</b></span>` }).join('')}</div>`
  const homes = s.properties.map((p: any) => {
    const mine = live.filter((b: any) => b.propertyId === p.id)
    const rows = CHANNELS.map(ch => {
      const own = mine.filter((b: any) => b.channel === ch), others = mine.filter((b: any) => b.channel !== ch)
      return `<div class="cal-line"><span class="lab ch ch-${slug(ch)}">${h(channelName(ch))}</span>${cells(from, today)}${closed(from, own, others)}${own.map((b: any) => bar(from, b, clash)).join('')}</div>`
    }).join('')
    return `<div class="cal-group"><div class="cal-line cal-home"><span class="lab"><strong>${h(p.name)}</strong></span></div>${rows}</div>`
  }).join('')
  const month = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const nav = `<div class="cal-nav"><p><strong>${h(month(from))} – ${h(month(addDays(from, DAYS - 1)))}</strong></p><p><a class="button" href="/app/calendar?from=${addDays(from, -7)}">Earlier</a> <a class="button" href="/app/calendar">Today</a> <a class="button" href="/app/calendar?from=${addDays(from, 7)}">Later</a></p></div>`
  const legend = `<p class="cal-legend"><span class="key bar-airbnb">Airbnb</span><span class="key bar-vrbo">Vrbo</span><span class="key bar-booking">Booking.com</span><span class="key bar-direct">Direct</span><span class="key bar-blocked">Blocked</span><span class="key bar-closed">Closed by another channel</span></p>`
  return `${nav}<div class="cal-scroll" role="region" aria-label="Calendar of every home by channel, ${h(month(from))} to ${h(month(addDays(from, DAYS - 1)))}" tabindex="0"><div class="cal-app">${head}${homes}</div></div>${legend}`
}
