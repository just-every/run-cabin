import { h, money } from './shared'
import { addDays, overlaps } from '../inventory'
import { homeSettings } from '../homes'
import { GLYPHS, icon } from './icons'
import { type Item, declinedBar, openNights, short, stayBar, turnoverChip } from './calendar-items'
export { stayLabel, knownGuest, guestOf } from './calendar-items'
// The timeline: one row per home, days across. Each home's row stacks its
// stays and blocks first, then any declined requests, then a lane of turnover
// chips under the checkout days, so a same-day turnover never squeezes between
// two bars. Items that would overlap move to another lane of their kind.
// Placement uses classes (cabin's CSP refuses inline styles): s-N and w-N set
// the grid column, ln-N the lane, x-N today.
export const DAYS = 28
export const SPANS: [number, string][] = [[7, 'Week'], [14, '2 weeks'], [28, 'Month']]
/** The next two weeks: what Reservations lists as arrivals. */
export const ARRIVAL_DAYS = 14
/** Days a turnover chip spans at each view, so its cleaner and window can show. */
const CHIP: Record<number, number> = { 7: 2, 14: 3, 28: 4 }
/** How many days a declined request's label may take, its own nights included. */
const SPILL: Record<number, number> = { 14: 4, 28: 7 }
const dayIndex = (from: string, day: string) => Math.round((Date.parse(day) - Date.parse(from)) / 86_400_000)
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
export function time12(t?: string | null) { if (!t) return ''; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'am' : 'pm'}` }
/** Every pair of confirmed stays on one home whose nights overlap: a channel sold a night before it heard. */
export function collisions(bookings: any[]) {
  const stays = bookings.filter(b => b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay'), found: [any, any][] = []
  for (let i = 0; i < stays.length; i++) for (let j = i + 1; j < stays.length; j++) if (stays[i].propertyId === stays[j].propertyId && overlaps(stays[i], stays[j])) found.push([stays[i], stays[j]])
  return found
}
/** "Asheville, NC" from "12 Elm St, Asheville, NC 28801". */
export const town = (s: any, propertyId: string) => { const parts = homeSettings(s, propertyId).address.split(',').map((x: string) => x.trim()).filter(Boolean); return parts.length >= 2 ? `${parts.at(-2)}, ${parts.at(-1)!.replace(/\s+\d{5}(-\d{4})?$/, '')}` : '' }
/** The home's latest ready photo, from its cleaner's last completed turnover. */
export const thumb = (s: any, propertyId: string) => s.turnovers.filter((t: any) => t.propertyId === propertyId && t.status === 'completed' && t.completion).sort((a: any, b: any) => b.completion.completedAt.localeCompare(a.completion.completedAt))[0]?.completion.photoId ?? null
export const homeThumb = (s: any, p: any) => { const id = thumb(s, p.id); return id ? `<img class="thumb" src="/api/cabin/photos/${h(id)}" alt="" loading="lazy">` : `<span class="thumb none" aria-hidden="true">${icon('home')}</span>` }

const where = (a: number, z: number) => `s-${a + 1} w-${z - a}`
/** Puts each item in the first lane from `first` where it overlaps nothing; returns the next free lane. */
function lanes(items: Item[], first: number) {
  const taken: [number, number][][] = []
  for (const item of items) {
    let lane = taken.findIndex(row => row.every(([a, z]) => item.z <= a || item.a >= z))
    if (lane < 0) { lane = taken.length; taken.push([]) }
    taken[lane].push([item.a, item.z]); item.lane = first + lane
  }
  return first + taken.length
}
export interface GridView { from: string; today: string; days: number; homes: any[]; link: (q: Record<string, string | number | null>) => string }
export function grid(s: any, v: GridView) {
  const { from, today, days } = v, end = addDays(from, days), arrivalsUntil = addDays(today, ARRIVAL_DAYS)
  const clash = new Set(collisions(s.bookings).flat().map(b => b.id))
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)), t = dayIndex(from, today)
  const months: [string, number, number][] = []
  dates.forEach((d, i) => { const m = new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); if (months.at(-1)?.[0] === m) months.at(-1)![2]++; else months.push([m, i, 1]) })
  const monthBar = `<div class="tl-months"><a class="step" href="${v.link({ from: addDays(from, -7) })}" aria-label="Earlier">${icon('back')}</a><div class="tl-grid d${days}">${months.map(([m, i, n]) => `<span class="month ${where(i, i + n)}">${h(n < 3 ? m.split(' ')[0] : m)}</span>`).join('')}</div><a class="step" href="${v.link({ from: addDays(from, 7) })}" aria-label="Later">${icon('chevron')}</a></div>`
  const head = `<div class="tl-head"><span class="tl-label">${v.homes.length === s.properties.length ? `All ${s.properties.length} home${s.properties.length === 1 ? '' : 's'}` : h(v.homes[0]?.name ?? '')}</span><div class="tl-grid d${days}">${dates.map((d, i) => { const w = new Date(d + 'T00:00:00Z'); return `<span class="day ${where(i, i + 1)}${d === today ? ' today' : ''}${[0, 6].includes(w.getUTCDay()) ? ' weekend' : ''}"><abbr title="${h(w.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }))}">${h(w.toLocaleDateString('en-US', { weekday: days > 14 ? 'narrow' : 'short', timeZone: 'UTC' }))}</abbr><b>${w.getUTCDate()}</b>${d === today ? '<em>Today</em>' : ''}</span>` }).join('')}</div></div>`
  const pops: string[] = []
  const rows = v.homes.map((p: any) => {
    const stays = s.bookings.filter((b: any) => b.propertyId === p.id && b.status === 'confirmed' && overlaps(b, { start: from, end })).sort((a: any, b: any) => a.start.localeCompare(b.start))
    const bars = stays.map((b: any) => stayBar(s, v, b, clash, arrivalsUntil)).filter(Boolean) as Item[]
    const jobs = s.turnovers.filter((x: any) => x.propertyId === p.id && x.status !== 'cancelled' && !(x.status === 'draft' && s.turnovers.some((y: any) => y.bookingId === x.bookingId && y.status !== 'draft' && y.status !== 'cancelled'))).sort((a: any, b: any) => (a.windowStart ?? a.dueDate).localeCompare(b.windowStart ?? b.dueDate))
    const chips = jobs.map((x: any) => turnoverChip(s, v, x, CHIP[days] ?? 2)).filter(Boolean) as Item[]
    // A chip gives way to the next one rather than stacking, down to two days.
    chips.forEach((c, i) => { const next = chips[i + 1]; if (next && next.a < c.z) c.z = Math.max(next.a, Math.min(c.z, c.a + 2)) })
    const declined = s.requests.filter((r: any) => r.propertyId === p.id && r.status === 'declined' && overlaps(r, { start: from, end })).map((r: any) => declinedBar(s, v, r)).filter(Boolean) as Item[]
    const direct = s.direct?.homes?.find((d: any) => d.propertyId === p.id)
    const vacant = openNights(v, bars, direct?.enabled ? direct.nightlyCents : null)
    const count = lanes(chips, lanes(declined, lanes([...bars, ...vacant], 1))) - 1, place = town(s, p.id)
    // A short declined request's reason runs on past its last night while its lane is free.
    for (const d of declined) { const next = Math.min(days, ...declined.filter(o => o !== d && o.lane === d.lane && o.a >= d.z).map(o => o.a)); d.spill = Math.max(0, Math.min(next - d.z, (SPILL[days] ?? 0) - (d.z - d.a))) }
    for (const x of [...bars, ...declined]) if (x.pop) pops.push(x.pop)
    const label = `<div class="tl-label">${homeThumb(s, p)}<div><h3>${h(p.name)}</h3>${place ? `<p>${h(place)}</p>` : ''}${direct ? `<span class="rate" title="${direct.enabled ? 'Direct booking nightly rate' : 'Direct nightly rate (booking page not published)'}">${h(money(direct.nightlyCents).replace(/\.00$/, ''))}/night</span>` : ''}</div></div>`
    const now = t >= 0 && t < days ? `<i class="now x-${t + 1}" aria-hidden="true"></i>` : ''
    const items = [...bars, ...vacant, ...declined, ...chips].sort((x, y) => (x.lane! - y.lane!) || x.a - y.a)
    return `<div class="tl-row">${label}<div class="tl-grid tl-track d${days} lanes-${count}">${now}${items.map(x => x.html(`${where(x.a, x.z + (x.spill ?? 0))}${x.spill ? ` spill nw-${x.z - x.a}` : ''} ln-${x.lane}`)).join('') || '<p class="tl-free">No stays in these dates</p>'}</div></div>`
  }).join('')
  const legend = `<p class="tl-legend"><span class="key ch-airbnb">${GLYPHS.airbnb}Airbnb</span><span class="key ch-vrbo">${GLYPHS.vrbo}Vrbo</span><span class="key ch-booking">${GLYPHS['booking.com']}Booking.com</span><span class="key ch-direct">${GLYPHS.direct}Direct</span><span class="key block">${GLYPHS.block}Blocked</span><span class="key declined">${icon('alert')}Request declined</span><span class="key k-turn"><i class="dot"></i>Turnover</span><span class="key k-same">${icon('turn')}Same-day turnover</span><span class="note">Airbnb’s calendar names every stay “Reserved” and Booking.com’s closes nights without a guest, so their bars show a guest only once you add one under Reservations. A night held on any channel closes on every other channel through Cabin’s calendar links. Select a bar for its details.</span></p>`
  return `<section class="panel tl-card" aria-label="Calendar of every home, ${h(short(from))} to ${h(short(addDays(from, days - 1)))}"><div class="tl-scroll" role="region" aria-label="Homes by day" tabindex="0"><div class="tl d${days}">${monthBar}${head}${rows}</div></div>${legend}${pops.join('')}</section>`
}
