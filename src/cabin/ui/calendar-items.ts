import { h, money, memberName } from './shared'
import { channelName, nights, span, CHANNELS } from '../inventory'
import { homeSettings } from '../homes'
import { time12 } from '../clock'
import { guestKey, threadId } from '../inbox/threads'
import { GLYPHS, icon } from './icons'
import { fitted, firstAndInitial, initials, lineForms, nameForms } from './fit'
// What the timeline draws: a bar per stay or block in its channel's colour, a
// dashed bar per declined request with Cabin's reason, a chip per turnover
// with its cleaner and window, and runs of open nights at the direct rate.
// Every bar opens its details (a popover, so nothing is cut off) with the
// whole label, the dates, the door code and where to change it.
export interface Item { a: number; z: number; html: (cls: string) => string; lane?: number; pop?: string; spill?: number }
export interface View { from: string; today: string; days: number }
const dayIndex = (from: string, day: string) => Math.round((Date.parse(day) - Date.parse(from)) / 86_400_000)
const slug = (ch: string) => ch === 'booking.com' ? 'booking' : ch
export const short = (d: string, weekday = false) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { ...(weekday ? { weekday: 'short' } : {}), month: 'short', day: 'numeric', timeZone: 'UTC' } as Intl.DateTimeFormatOptions)
const usPhone = (e164: string) => /^\+1\d{10}$/.test(e164) ? `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}` : e164
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
/** The guest's name, else what the channel calls the stay: Airbnb's calendar says only "Reserved". */
export const stayLabel = (b: any) => knownGuest(b) ?? 'Reserved'
/** The guest's name when Cabin has one; null for a channel stay that names nobody. */
export const knownGuest = (b: any): string | null => b.guestName || (b.summary && !/^reserved$/i.test(b.summary) ? b.summary : null)
/** A stay's guest as a name to show: the name, else "Airbnb guest" (never Airbnb's "Reserved"). */
export const guestOf = (b: any) => knownGuest(b) ?? `${channelName(b.channel)} guest`
function placeAt(v: View, first: string, checkout: string) {
  const a = dayIndex(v.from, first), z = dayIndex(v.from, checkout)
  return { a: Math.max(0, a), z: Math.min(v.days, z), cutStart: a < 0, cutEnd: z > v.days }
}
const facts = (rows: [string, string][]) => `<dl class="pop-facts">${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('')}</dl>`
const pop = (id: string, title: string, sub: string, body: string, links: [string, string][]) => `<div class="stay-pop" id="${h(id)}" popover><header><div><h3>${h(title)}</h3><p>${h(sub)}</p></div><button type="button" class="quiet" popovertarget="${h(id)}" popovertargetaction="hide" aria-label="Close">${icon('close')}</button></header>${body}${links.length ? `<p class="pop-links">${links.map(([href, text]) => `<a href="${h(href)}">${h(text)}</a>`).join('')}</p>` : ''}</div>`

/** One stay or block: the guest (or "Reserved", or the block's reason) first, then nights and the arrival. */
export function stayBar(s: any, v: View, b: any, clash: Set<string>, arrivalsUntil: string): Item | null {
  const n = nights(b), at = placeAt(v, n.first, n.checkout); if (at.z <= at.a) return null
  const block = (b.kind ?? 'stay') === 'block', count = dayIndex(n.first, n.checkout), channel = channelName(b.channel)
  const fromFeed = b.channel !== 'direct' && block
  const [name, ...rest] = String(block ? (b.channel === 'direct' ? b.summary || 'Blocked' : 'Blocked') : stayLabel(b)).split(' · ')
  const named = !block && !!b.guestName
  const paid = b.channel === 'direct' && !block ? s.direct?.stays?.find((d: any) => d.bookingId === b.id && ['paid', 'confirmed'].includes(d.phase)) : null
  const settings = homeSettings(s, b.propertyId), arrives = b.arrivalTime ?? (block ? null : settings.checkInTime)
  const parts = [...rest, plural(count, 'night'), ...(fromFeed || (!block && !named) ? [channel] : []), ...(paid ? [`${money(paid.quote.totalCents)} paid`] : []), ...(b.arrivalTime ? [`arrives ${time12(b.arrivalTime)}`] : [])]
  const code = !block && n.first >= v.today ? s.codes?.find((c: any) => c.bookingId === b.id && c.holder === 'guest' && c.status === 'issued') : null
  const others = CHANNELS.filter(ch => ch !== b.channel).map(channelName)
  const title = `${channel} · ${block ? 'blocked' : stayLabel(b)} · ${span(b)}${clash.has(b.id) ? ' · overlaps another stay' : ''} · closed on ${others.slice(0, -1).join(', ')} and ${others.at(-1)}`
  const kind = block ? (b.channel === 'direct' ? 'block' : `block ch-${slug(b.channel)}`) : `ch-${slug(b.channel)}`
  const id = `stay-${b.id}`, nightsShort = `${count} nt${count === 1 ? '' : 's'}`
  // A named stay shortens to "Brooke S.", then initials; a stay its channel names nobody
  // keeps its channel mark as its label, and its nights go on the detail line.
  const guest = !block && !!knownGuest(b)
  const first = guest ? [...new Set([name, ...firstAndInitial(name), ...nameForms(name, [initials(name), initials(name)[0]])])] : [name, '']
  const turnover = s.turnovers?.find((t: any) => t.bookingId === b.id && !['draft', 'cancelled'].includes(t.status))
  const thread = !block && (b.guestEmail || b.guestPhone || s.messages?.some((m: any) => m.bookingId === b.id)) ? threadId(guestKey(b,s)) : null
  const source = block
    ? b.channel === 'booking.com' ? 'Booking.com’s calendar closes these nights (“CLOSED - Not available”) without saying whether a guest booked them, so Cabin keeps them as a block.' : b.channel === 'direct' ? 'Blocked in Cabin.' : `${channel}’s calendar marks these nights not available.`
    : b.source === 'request' ? `Taken in Cabin as a ${channel} ${b.channel === 'direct' ? 'booking' : 'request'}.` : b.source === 'migration' ? 'Moved in from your previous system.' : named ? `From the ${channel} calendar; the guest’s name was added in Cabin.` : `From the ${channel} calendar, which names no guest. Add the guest’s name under Reservations.`
  const details = pop(id, block ? `${name}${rest.length ? ' · ' + rest.join(' · ') : ''}` : stayLabel(b), `${channel} · ${short(n.first, true)} → ${short(n.checkout, true)} · ${plural(count, 'night')}`,
    facts([['Check-in', block ? '' : `${short(n.first, true)}${arrives ? `, ${time12(arrives)}` : ''}`], ['Check-out', block ? '' : `${short(n.checkout, true)}, ${time12(settings.checkOutTime)}`], ['Door code', code ? `${code.code}` : ''], ['Paid', paid ? money(paid.quote.totalCents) : ''], ['Email', b.guestEmail ?? ''], ['Phone', b.guestPhone ? usPhone(b.guestPhone) : ''], ['Turnover', turnover ? `${turnover.cleanerId ? memberName(s, turnover.cleanerId) : 'No cleaner yet'}${turnover.windowStart ? ` · ${short(turnover.windowStart.slice(0, 10), true)}, ${time12(turnover.windowStart.slice(11, 16))}` : ''}` : ''], ['Overlap', clash.has(b.id) ? 'Another stay holds some of these nights' : '']]) + `<p class="pop-note">${h(source)}</p>`,
    [...(!block && n.first >= v.today && n.first < arrivalsUntil ? [[`/app/reservations#${id}`, 'Guest details'] as [string, string]] : []), ...(thread ? [[`/app/inbox?thread=${thread}`, 'Messages'] as [string, string]] : []), ...(turnover ? [[`/app/turnovers#turnover-${turnover.id}`, 'Turnover'] as [string, string]] : [])])
  return { a: at.a, z: at.z, pop: details, html: cls => `<button type="button" class="bar ${kind}${guest ? '' : ' keep-mark'}${clash.has(b.id) ? ' clash' : ''}${at.cutStart ? ' cut-start' : ''}${at.cutEnd ? ' cut-end' : ''} ${cls}" title="${h(title)}" popovertarget="${h(id)}">${block && b.channel === 'direct' ? GLYPHS.block : GLYPHS[b.channel] ?? ''}<span class="t">${clash.has(b.id) ? '<em>Collision</em>' : ''}${fitted('b', first)}${fitted('small', guest ? lineForms(parts.join(' · '), [plural(count, 'night'), nightsShort, `${count}n`]) : [...new Set([parts.join(' · '), parts.filter(x => x !== channel).join(' · '), plural(count, 'night'), nightsShort, `${count}n`])])}${code ? `<small class="code">${icon('lock')}Code ${h(code.code)}</small>` : ''}<small class="when">${h(short(n.first, true))} → ${h(short(n.checkout, true))}</small></span></button>` }
}

/** A turnover on its checkout day, in the chip lane under the stays: cleaner, window, status dot; a same-day turnover is marked. */
export function turnoverChip(s: any, v: View, t: any, width: number): Item | null {
  const due = (t.windowStart ?? t.dueDate).slice(0, 10), at = dayIndex(v.from, due); if (at < 0 || at >= v.days) return null
  const cleaner = t.cleanerId ? memberName(s, t.cleanerId).split(' ')[0] : null
  const done = t.status === 'completed', none = t.status === 'unassigned' || !t.cleanerId, draft = t.status === 'draft'
  const start = t.windowStart?.slice(11, 16), end = t.windowEnd?.slice(11, 16), oneDay = t.windowStart && t.windowEnd && t.windowStart.slice(0, 10) === t.windowEnd.slice(0, 10)
  const next = t.nextBookingId ? s.bookings.find((b: any) => b.id === t.nextBookingId) : null, same = !!next && next.start.slice(0, 10) === due
  const hour = (x: string) => time12(x).replace(/ (am|pm)$/, '')
  const who = none ? 'No cleaner' : cleaner ?? 'Cleaner'
  const by = t.windowEnd ? new Date(t.windowEnd.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : ''
  const span = !start ? [] : oneDay ? [`${time12(start)}–${time12(end!)}`, `${hour(start)}–${hour(end!)}`] : [`${time12(start)}–${by} ${time12(end!)}`, `${hour(start)}–${by} ${hour(end!)}`, `${time12(start)} → ${by}`, time12(start), hour(start)]
  const label = v.days === 28 ? `${fitted('b', [...new Set([who, initials(who)])])}${fitted('small', [...span, ''])}` : ''
  const forms = !start ? [who] : oneDay ? [`${who} ${time12(start)}–${time12(end!)}`, `${who} ${hour(start)}–${hour(end!)}`, who] : [`${who} ${time12(start)}–${by} ${time12(end!)}`, `${who} ${hour(start)}–${by} ${hour(end!)}`, `${who} ${time12(start)} → ${by}`, `${who} ${time12(start)}`, who]
  const state = done ? 'ready' : draft ? 'draft for review' : none ? 'no cleaner yet' : 'scheduled'
  const title = `Turnover · ${none ? 'no cleaner yet' : memberName(s, t.cleanerId)} · ${state} · ${short(due, true)}${start ? ` ${time12(start)}` : ''}${end ? ` until ${t.windowEnd.slice(0, 10) === due ? '' : short(t.windowEnd.slice(0, 10), true) + ' '}${time12(end)}` : ''}${same ? ' · same-day turnover: the next guests arrive that day' : ''}`
  const status = done ? 'st-done' : draft ? 'st-draft' : none ? 'st-none' : 'st-set'
  return { a: at, z: Math.min(v.days, at + width), html: cls => `<a class="clean ${status}${same ? ' same' : ''} ${cls}" href="/app/turnovers#turnover-${h(t.id)}" title="${h(title)}">${done ? icon('check') : '<i class="dot" aria-hidden="true"></i>'}${same ? `<span class="same-mark" role="img" aria-label="Same-day turnover">${icon('turn')}</span>` : ''}<span class="t">${label || fitted('b', [...new Set([...forms, initials(who)])])}</span><small class="when">${h(short(due, true))}${same ? ' · same day' : ''} · ${h(state)}</small></a>` }
}

/** A request Cabin declined, dashed red with its reason: what was asked, then why. */
export function declinedBar(s: any, v: View, r: any): Item | null {
  const at = placeAt(v, r.start.slice(0, 10), r.end.slice(0, 10)); if (at.z <= at.a) return null
  const what = r.kind === 'block' ? 'Block' : r.guestName, channel = channelName(r.channel), id = `request-${r.id}`
  const ask = r.kind === 'block' ? 'Block declined' : `${channel} request declined`, count = dayIndex(r.start.slice(0, 10), r.end.slice(0, 10))
  const held = s.bookings.find((b: any) => b.id === r.overlaps), hit = held ? channelName(held.channel) : /^Overlaps (\S+)/.exec(r.reason ?? '')?.[1] ?? ''
  const details = pop(id, ask, `${what} · ${short(r.start.slice(0, 10), true)} → ${short(r.end.slice(0, 10), true)} · ${plural(count, 'night')}`, facts([['Reason', r.reason ?? ''], ['Asked', `${short(r.requestedAt.slice(0, 10), true)} · taken by ${s.members.find((m: any) => m.id === r.requestedBy)?.name ?? 'the owner'}`], ['Note', r.note ?? '']]) + '<p class="pop-note">Cabin never accepts a request that overlaps a held night, so nothing was closed on any channel.</p>', [['/app/reservations', 'Reservations']])
  return { a: at.a, z: at.z, pop: details, html: cls => `<button type="button" class="bar declined ${cls}" title="${h(`${ask} · ${what} · ${span(r)} · ${r.reason ?? ''}`)}" popovertarget="${h(id)}">${icon('alert')}<span class="t">${fitted('b', [...new Set([ask, 'Request declined', 'Declined'])])}${fitted('small', lineForms(r.reason ?? '', hit ? [`Overlaps ${hit}`] : []))}<small class="when">${h(what)} · ${h(short(r.start.slice(0, 10), true))} → ${h(short(r.end.slice(0, 10), true))}</small></span></button>` }
}

/** Runs of two or more open nights, with the home's direct nightly rate, when its booking page is published. */
export function openNights(v: View, held: Item[], rate: number | null): Item[] {
  if (!rate) return []
  const free = Array.from({ length: v.days }, (_, i) => !held.some(x => i >= x.a && i < x.z)), runs: Item[] = []
  for (let i = 0; i < v.days;) {
    if (!free[i]) { i++; continue }
    let j = i; while (j < v.days && free[j]) j++
    const n = j - i, price = money(rate).replace(/\.00$/, '')
    if (n >= 2 && j < v.days) runs.push({ a: i, z: j, html: cls => `<span class="vacant ${cls}" title="${n} open nights at ${h(price)} a night direct"><span class="t">${fitted('b', [price, ''])}${fitted('small', [`${n} nights open`, `${n} open`, ''])}</span></span>` })
    i = j
  }
  return runs
}
