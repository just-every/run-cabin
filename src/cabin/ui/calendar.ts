import { h, panel, empty, propertyName } from './shared'
import { addDays, channelName, describe, CHANNELS, overlaps } from '../inventory'
import { localDay } from '../clock'
import { homeSettings } from '../homes'
import { DAYS, SPANS, collisions, grid, isDay } from './calendar-grid'
import { stayPanel } from './stay-panel'
import { reservationPanel } from './calendar-detail'
import { connectionName } from './calendar-state'
import { icon } from './icons'
import type { Extras } from './index'
// The existing homes-by-days timeline and recovery panel, with addressable
// reservation records and filters that never change the inventory underneath.
export function calendar(s: any, extras: Extras = {}) {
  const one = s.properties.find((p: any) => p.id === extras.home)
  const homes = extras.home ? one ? [one] : [] : s.properties
  const today = s.properties.length ? localDay(Date.now(), homeSettings(s, one?.id ?? s.properties[0].id).timeZone) : new Date().toISOString().slice(0, 10)
  const chosen = isDay(extras.from) ? extras.from : today
  const mode = SPANS.some(([n]) => String(n) === extras.days) ? Number(extras.days) : DAYS
  const from = mode === DAYS ? chosen.slice(0, 7) + '-01' : chosen
  const days = mode === DAYS ? new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)).getUTCDate() : mode
  const channel = extras.channel || null
  const query = { from, days: mode === DAYS ? null : mode, home: extras.home || null, channel, reservation: extras.reservation || null }
  const link = (change: Record<string, string | number | null>) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries({ ...query, ...change })) if (v !== null && v !== undefined) q.set(k, String(v)); return `/app/calendar${q.size ? '?' + q.toString() : ''}` }
  const date = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const range = days === 1 ? date(from) : `${date(from)} – ${date(addDays(from, days - 1))}`
  const tools = `<div class="cal-tools"><nav class="segmented" aria-label="Dates shown">${SPANS.map(([n, label]) => `<a href="${h(link({ days: n === DAYS ? null : n, reservation: null }))}"${n === mode ? ' aria-current="true"' : ''}>${h(label)}</a>`).join('')}</nav><a class="button quiet" href="${h(link({ from: today, reservation: null }))}">Today</a><a class="button primary" href="/app/reservations#request">${icon('plus')}New reservation</a></div>`
  const top = `<div class="cal-top"><div class="page-heading"><p class="eyebrow">Calendar${one ? ` · <a href="${h(link({ home: null, reservation: null }))}">All homes</a>` : ''}</p><h1>${h(range)}</h1></div>${tools}</div>`
  if (!s.properties.length) return top + panel('No homes yet', empty('Add a home in Properties & people, or use Move in, to begin.'))
  const channels: string[] = [...new Set<string>([...CHANNELS, ...s.connections.map((c: any) => c.channel), ...s.bookings.map((b: any) => b.channel), ...(channel ? [channel] : [])])]
  const filters = `<form class="cal-filters" method="get" action="/app/calendar" aria-label="Calendar filters"><input type="hidden" name="days" value="${mode}"><label>From<input type="date" name="from" value="${h(from)}" required></label><label>Property<select name="home" aria-label="Property"><option value="">All homes</option>${s.properties.map((p: any) => `<option value="${h(p.id)}"${p.id === one?.id ? ' selected' : ''}>${h(p.name)}</option>`).join('')}</select></label><label>Channel<select name="channel" aria-label="Channel"><option value="">All channels</option>${channels.map(ch => `<option value="${h(ch)}"${ch === channel ? ' selected' : ''}>${h(channelName(ch))}</option>`).join('')}</select></label><button type="submit">Apply filters</button>${one || channel ? `<a href="${h(link({ home: null, channel: null, reservation: null }))}">Clear filters</a>` : ''}</form>`
  const end = addDays(from, days), ids = new Set(homes.map((p: any) => p.id))
  const pairs = collisions(s.bookings.filter((b:any)=>ids.has(b.propertyId)&&overlaps(b,{start:from,end})))
  const late = pairs.filter(([a, b]) => ids.has(a.propertyId) && (!channel || a.channel === channel || b.channel === channel) && overlaps(a, { start: from, end }) && overlaps(b, { start: from, end })).map(([a, b]) => `<p>${h(propertyName(s, a.propertyId))}: <a href="${h(link({ reservation: a.id }))}">${h(describe(a))}</a> overlaps <a href="${h(link({ reservation: b.id }))}">${h(describe(b))}</a></p>`)
  const failing = s.connections.filter((r: any) => ids.has(r.propertyId) && (r.status !== 'ok' || !r.lastSuccessAt || !Number.isFinite(Date.parse(r.nextPollAt)) || Date.parse(r.nextPollAt) <= Date.now())).map((r: any) => `<p>${h(propertyName(s, r.propertyId))} · ${h(connectionName(r))}: ${h(r.error || (r.status === 'pending' ? 'No successful read yet' : 'Calendar read overdue'))}</p>`)
  const stale = failing.length ? `<div class="notice error" role="alert"><strong>${failing.length} calendar link${failing.length === 1 ? '' : 's'} need attention</strong>${failing.join('')}<p>Availability is stale or unknown. Cabin keeps the nights each link last held. Fix the link under <a href="/app/channels">Channels</a>.</p></div>` : ''
  const alert = late.length ? `<div class="notice error" role="alert"><strong>${late.length} double booking${late.length === 1 ? '' : 's'} to resolve</strong>${late.join('')}<p>Both stays are kept. Cancel or move one on its channel.</p></div>` : ''
  if (!homes.length) return top + filters + panel('Property unavailable', empty('No property matches this filter. Availability is unknown.'))
  const previous = mode === DAYS ? addDays(from, -1).slice(0, 7) + '-01' : addDays(from, -days)
  const next = addDays(from, days)
  const side = extras.reservation ? reservationPanel(s, extras.reservation, h(link({ reservation: null }))) : stayPanel(s, today, homes)
  return top + filters + alert + stale + `<div class="cal-layout${extras.reservation?' reservation-record':''}${mode === DAYS ? ' month' : ''}">${grid(s, { from, today, days, homes, channel, previous, next, link, clashes: new Set(pairs.flat().map(b=>b.id)) })}${side}</div><p class="muted cal-note">Calendar links are polled every 15 to 60 minutes, so a channel can still sell a night before it hears; any such collision shows here at once. Cabin never accepts an overlapping request.${channel ? ' Channel filters hide other stays; they do not make their nights available.' : ''}</p>`
}
