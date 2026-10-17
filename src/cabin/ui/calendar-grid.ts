import { h, money } from './shared'
import { addDays, channelName, nights, overlaps, span, CHANNELS } from '../inventory'
import { homeSettings } from '../homes'
import { GLYPHS, icon } from './icons'
// The timeline: one row per home, days across. Each stay is a bar in its
// channel's colour; a block is grey; the turnover sits on the checkout day; a
// declined request stays visible as a dashed bar with Cabin's reason; open
// nights show the home's direct nightly rate. Items that would overlap move to
// another lane in the same row. Placement uses classes (cabin's CSP refuses
// inline styles): s-N and w-N set the grid column, ln-N the lane, x-N today.
export const DAYS = 14
export const SPANS: [number, string][] = [[7, 'Week'], [14, '2 weeks'], [28, 'Month']]
const dayIndex = (from: string, day: string) => Math.round((Date.parse(day) - Date.parse(from)) / 86_400_000)
const slug = (ch: string) => ch === 'booking.com' ? 'booking' : ch
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
export function time12(t?: string | null) { if (!t) return ''; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'am' : 'pm'}` }
export const stayLabel = (b: any) => b.guestName || (b.summary && !/^reserved$/i.test(b.summary) ? b.summary : 'Reserved')
const short = (d: string, weekday = false) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { ...(weekday ? { weekday: 'short' } : {}), month: 'short', day: 'numeric', timeZone: 'UTC' } as Intl.DateTimeFormatOptions)
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

interface Item { a: number; z: number; html: (cls: string) => string; lane?: number }
function placeAt(from: string, days: number, first: string, checkout: string) {
  const a = dayIndex(from, first), z = dayIndex(from, checkout)
  return { a: Math.max(0, a), z: Math.min(days, z), cutStart: a < 0, cutEnd: z > days }
}
const where = (a: number, z: number) => `s-${a + 1} w-${z - a}`
function lanes(items: Item[]) {
  const taken: [number, number][][] = []
  for (const item of items) {
    let lane = taken.findIndex(row => row.every(([a, z]) => item.z <= a || item.a >= z))
    if (lane < 0) { lane = taken.length; taken.push([]) }
    taken[lane].push([item.a, item.z]); item.lane = lane + 1
  }
  return Math.max(1, taken.length)
}
function stayBar(s: any, from: string, today: string, days: number, b: any, clash: Set<string>): Item | null {
  const n = nights(b), at = placeAt(from, days, n.first, n.checkout); if (at.z <= at.a) return null
  const block = (b.kind ?? 'stay') === 'block', count = dayIndex(n.first, n.checkout)
  const [name, ...rest] = String(block ? (b.channel === 'direct' ? b.summary || 'Blocked' : `Blocked on ${channelName(b.channel)}`) : stayLabel(b)).split(' · ')
  const direct = b.channel === 'direct' && !block ? s.direct?.stays?.find((d: any) => d.bookingId === b.id && ['paid', 'confirmed'].includes(d.phase)) : null
  const sub = [...rest, `${count} night${count === 1 ? '' : 's'}`, ...(direct ? [`${money(direct.quote.totalCents)} paid`] : []), ...(b.arrivalTime ? [`arrives ${time12(b.arrivalTime)}`] : [])].join(' · ')
  const code = !block && n.first >= today ? s.codes?.find((c: any) => c.bookingId === b.id && c.holder === 'guest' && c.status === 'issued') : null
  const others = CHANNELS.filter(ch => ch !== b.channel).map(channelName)
  const title = `${channelName(b.channel)} · ${block ? 'blocked' : stayLabel(b)} · ${span(b)}${clash.has(b.id) ? ' · overlaps another stay' : ''} · closed on ${others.slice(0, -1).join(', ')} and ${others.at(-1)}`
  const kind = block ? 'block' : `ch-${slug(b.channel)}`
  return { a: at.a, z: at.z, html: cls => `<div class="bar ${kind}${clash.has(b.id) ? ' clash' : ''}${at.cutStart ? ' cut-start' : ''}${at.cutEnd ? ' cut-end' : ''} ${cls}" title="${h(title)}">${block ? GLYPHS.block : GLYPHS[b.channel] ?? ''}<span class="t"><b>${clash.has(b.id) ? '<em>Collision</em> ' : ''}${h(name)}</b><small>${h(sub)}</small>${code ? `<small class="code">${icon('lock')}Code ${h(code.code)}</small>` : ''}<small class="when">${h(short(n.first, true))} → ${h(short(n.checkout, true))}</small></span></div>` }
}
function turnoverChip(s: any, from: string, days: number, t: any, held: Item[]): Item | null {
  const due = (t.windowStart ?? t.dueDate).slice(0, 10), at = dayIndex(from, due); if (at < 0 || at >= days) return null
  const next = Math.min(days, ...held.filter(x => x.a >= at).map(x => x.a)), wide = Math.max(1, Math.min(2, next - at))
  const cleaner = s.members.find((m: any) => m.id === t.cleanerId)?.name?.split(' ')[0]
  const done = t.status === 'completed', none = t.status === 'unassigned' || !t.cleanerId
  const window = t.windowStart ? `${time12(t.windowStart.slice(11, 16))}–${time12(t.windowEnd.slice(11, 16))}` : t.status === 'draft' ? 'Draft' : done ? 'Ready' : none ? 'Assign one' : 'Scheduled'
  const title = `Turnover · ${none ? 'no cleaner yet' : cleaner} · ${done ? 'ready' : t.status === 'draft' ? 'draft for review' : 'scheduled'} · ${short(due, true)}`
  return { a: at, z: at + wide, html: cls => `<a class="clean${done ? ' done' : ''}${none ? ' none' : ''} ${cls}" href="/app/turnovers#turnover-${h(t.id)}" title="${h(title)}">${done ? icon('check') : none ? icon('alert') : icon('broom')}<span class="t"><b>${h(none ? 'No cleaner' : cleaner ?? 'Cleaner')}</b><small>${h(window)}</small><small class="when">${h(short(due, true))}</small></span></a>` }
}
function declinedBar(from: string, days: number, r: any): Item | null {
  const at = placeAt(from, days, r.start.slice(0, 10), r.end.slice(0, 10)); if (at.z <= at.a) return null
  const what = r.kind === 'block' ? 'Block' : `${r.guestName}`
  return { a: at.a, z: at.z, html: cls => `<a class="bar declined ${cls}" href="/app/reservations" title="${h(`${channelName(r.channel)} request declined · ${what} · ${span(r)} · ${r.reason ?? ''}`)}">${icon('alert')}${r.kind === 'block' ? '' : GLYPHS[r.channel] ?? ''}<span class="t"><b>Request declined</b><small>${h(r.reason ?? '')}</small><small class="when">${h(what)} · ${h(short(r.start.slice(0, 10), true))} → ${h(short(r.end.slice(0, 10), true))}</small></span></a>` }
}
/** Runs of two or more open nights, with the home's direct nightly rate. */
function openNights(from: string, days: number, held: Item[], rate: number | null): Item[] {
  if (!rate) return []
  const free = Array.from({ length: days }, (_, i) => !held.some(x => i >= x.a && i < x.z)), runs: Item[] = []
  for (let i = 0; i < days;) {
    if (!free[i]) { i++; continue }
    let j = i; while (j < days && free[j]) j++
    const n = j - i
    if (n >= 2 && j < days) runs.push({ a: i, z: j, html: cls => `<span class="vacant ${cls}" title="${n} open nights at ${h(money(rate))} a night direct"><span class="t"><b>${h(money(rate).replace(/\.00$/, ''))}</b><small>${n} nights open</small></span></span>` })
    i = j
  }
  return runs
}
export interface GridView { from: string; today: string; days: number; homes: any[]; link: (q: Record<string, string | number | null>) => string }
export function grid(s: any, v: GridView) {
  const { from, today, days } = v, end = addDays(from, days)
  const clash = new Set(collisions(s.bookings).flat().map(b => b.id))
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)), t = dayIndex(from, today)
  const months: [string, number, number][] = []
  dates.forEach((d, i) => { const m = new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); if (months.at(-1)?.[0] === m) months.at(-1)![2]++; else months.push([m, i, 1]) })
  const monthBar = `<div class="tl-months"><a class="step" href="${v.link({ from: addDays(from, -7) })}" aria-label="Earlier">${icon('back')}</a><div class="tl-grid d${days}">${months.map(([m, i, n]) => `<span class="month ${where(i, i + n)}">${h(m)}</span>`).join('')}</div><a class="step" href="${v.link({ from: addDays(from, 7) })}" aria-label="Later">${icon('chevron')}</a></div>`
  const head = `<div class="tl-head"><span class="tl-label">${v.homes.length === s.properties.length ? `All ${s.properties.length} home${s.properties.length === 1 ? '' : 's'}` : h(v.homes[0]?.name ?? '')}</span><div class="tl-grid d${days}">${dates.map((d, i) => { const w = new Date(d + 'T00:00:00Z'); return `<span class="day ${where(i, i + 1)}${d === today ? ' today' : ''}${[0, 6].includes(w.getUTCDay()) ? ' weekend' : ''}"><abbr title="${h(w.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }))}">${h(w.toLocaleDateString('en-US', { weekday: days > 14 ? 'narrow' : 'short', timeZone: 'UTC' }))}</abbr><b>${w.getUTCDate()}</b>${d === today ? '<em>Today</em>' : ''}</span>` }).join('')}</div></div>`
  const rows = v.homes.map((p: any) => {
    const stays = s.bookings.filter((b: any) => b.propertyId === p.id && b.status === 'confirmed' && overlaps(b, { start: from, end })).sort((a: any, b: any) => a.start.localeCompare(b.start))
    const bars = stays.map((b: any) => stayBar(s, from, today, days, b, clash)).filter(Boolean) as Item[]
    const chips = s.turnovers.filter((x: any) => x.propertyId === p.id && x.status !== 'cancelled' && !(x.status === 'draft' && s.turnovers.some((y: any) => y.bookingId === x.bookingId && y.status !== 'draft' && y.status !== 'cancelled'))).map((x: any) => turnoverChip(s, from, days, x, bars)).filter(Boolean) as Item[]
    const declined = s.requests.filter((r: any) => r.propertyId === p.id && r.status === 'declined' && overlaps(r, { start: from, end })).map((r: any) => declinedBar(from, days, r)).filter(Boolean) as Item[]
    const direct = s.direct?.homes?.find((d: any) => d.propertyId === p.id && d.enabled)
    const items = [...bars, ...chips, ...declined, ...openNights(from, days, [...bars, ...chips], direct?.nightlyCents ?? null)]
    const count = lanes(items), place = town(s, p.id)
    const label = `<div class="tl-label">${homeThumb(s, p)}<div><h3>${h(p.name)}</h3>${place ? `<p>${h(place)}</p>` : ''}${direct ? `<span class="rate" title="Direct booking nightly rate">${h(money(direct.nightlyCents).replace(/\.00$/, ''))}/night</span>` : ''}</div></div>`
    const now = t >= 0 && t < days ? `<i class="now x-${t + 1}" aria-hidden="true"></i>` : ''
    return `<div class="tl-row">${label}<div class="tl-grid tl-track d${days} lanes-${count}">${now}${[...items].sort((x, y) => x.a - y.a).map(x => x.html(`${where(x.a, x.z)} ln-${x.lane}`)).join('') || '<p class="tl-free">No stays in these dates</p>'}</div></div>`
  }).join('')
  const legend = `<p class="tl-legend"><span class="key ch-airbnb">${GLYPHS.airbnb}Airbnb</span><span class="key ch-vrbo">${GLYPHS.vrbo}Vrbo</span><span class="key ch-booking">${GLYPHS['booking.com']}Booking.com</span><span class="key ch-direct">${GLYPHS.direct}Direct</span><span class="key block">${GLYPHS.block}Blocked</span><span class="key declined">Request declined</span><span class="note">A night held on any channel closes on every other channel through Cabin’s calendar links.</span></p>`
  return `<section class="panel tl-card" aria-label="Calendar of every home, ${h(short(from))} to ${h(short(addDays(from, days - 1)))}"><div class="tl-scroll" role="region" aria-label="Homes by day" tabindex="0"><div class="tl d${days}">${monthBar}${head}${rows}</div></div>${legend}</section>`
}
