import { h, panel, empty, propertyName } from './shared'
import { addDays, channelName, describe } from '../inventory'
import { DAYS, SPANS, collisions, grid, isDay } from './calendar-grid'
import { stayPanel } from './stay-panel'
import { icon } from './icons'
import type { Extras } from './index'
// The host's main screen: every home's nights by channel, with the stay that
// needs attention and what waits for approval beside it.
export function calendar(s: any, extras: Extras = {}) {
  const today = new Date().toISOString().slice(0, 10), from = isDay(extras.from) ? extras.from : today
  const days = SPANS.some(([n]) => String(n) === extras.days) ? Number(extras.days) : DAYS
  const one = s.properties.find((p: any) => p.id === extras.home), homes = one ? [one] : s.properties
  const query = { from: from === today ? null : from, days: days === DAYS ? null : days, home: one?.id ?? null }
  const link = (change: Record<string, string | number | null>) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries({ ...query, ...change })) if (v !== null && v !== undefined) q.set(k, String(v)); const text = q.toString(); return h(`/app/calendar${text ? '?' + text : ''}`) }
  const range = `${new Date(from + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${new Date(addDays(from, days - 1) + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
  const tools = `<div class="cal-tools"><nav class="segmented" aria-label="Dates shown">${SPANS.map(([n, label]) => `<a href="${link({ days: n === DAYS ? null : n })}"${n === days ? ' aria-current="true"' : ''}>${h(label)}</a>`).join('')}</nav>${from !== today ? `<a class="button quiet" href="${link({ from: null })}">Today</a>` : ''}<a class="button primary" href="/app/reservations#request">${icon('plus')}New reservation</a></div>`
  const top = `<div class="cal-top"><div class="page-heading"><p class="eyebrow">Calendar${one ? ` · <a href="${link({ home: null })}">All homes</a>` : ''}</p><h1>${h(range)}</h1></div>${tools}</div>`
  if (!s.properties.length) return top + panel('No homes yet', empty('Add a home in Properties & people, or use Move in, to begin.'))
  const late = collisions(s.bookings).map(([a, b]) => `<p>${h(propertyName(s, a.propertyId))}: ${h(describe(a))} overlaps ${h(describe(b))}</p>`)
  const failing = s.connections.filter((r: any) => r.status === 'stale').map((r: any) => `<p>${h(propertyName(s, r.propertyId))} · ${h(channelName(r.channel))}: ${h(r.error)}</p>`)
  const stale = failing.length ? `<div class="notice error" role="alert"><strong>${failing.length} calendar link${failing.length === 1 ? '' : 's'} failing</strong>${failing.join('')}<p>Cabin keeps the nights each link last held. Fix the link under <a href="/app/channels">Channels</a>.</p></div>` : ''
  const alert = late.length ? `<div class="notice error" role="alert"><strong>${late.length} double booking${late.length === 1 ? '' : 's'} to resolve</strong>${late.join('')}<p>Both stays are kept. Cancel or move one on its channel.</p></div>` : ''
  return top + alert + stale + `<div class="cal-layout${days === 28 ? ' month' : ''}">${grid(s, { from, today, days, homes, link })}${stayPanel(s, today, addDays(from, days), homes)}</div><p class="muted cal-note">Calendar links are polled every 15 to 60 minutes, so a channel can still sell a night before it hears; any such collision shows here at once. Cabin never accepts an overlapping request.</p>`
}
