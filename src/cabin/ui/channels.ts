import { h, badge, form, hidden } from './shared'
import { channelName } from '../inventory'
import { EXPORT_SLUGS, exportPath } from '../ical-export'
import { MANAGED_LINE } from '../channels'
// Per home: the channel links Cabin polls (in) and Cabin's own links to paste
// into each channel (out), with last-synced time, next poll and any error.
const OTAS = ['airbnb', 'vrbo', 'booking.com'] as const
export const when = (iso?: string | null, timeZone = 'America/New_York') => iso ? `<time datetime="${h(iso)}">${h(new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' }))}</time>` : 'never'
const STATUS: Record<string, string> = { ok: 'Synced', pending: 'Waiting for first sync', stale: 'Sync failing' }
function inbound(s: any, p: any, ch: string) {
  const zone = s.homeSettings.find((r: any) => r.propertyId === p.id)?.timeZone || 'America/New_York'
  const row = s.connections.find((r: any) => r.propertyId === p.id && r.channel === ch)
  if (!row) return s.managed ? `<p class="muted">${h(channelName(ch))}: not connected.</p>` : form('channel.connect', 'calendar', hidden('propertyId', p.id) + hidden('channel', ch) + `<label>${h(channelName(ch))} calendar link<input name="url" type="url" inputmode="url" placeholder="https://…ics" required></label><p class="muted">Copy the export (iCal) link from ${h(channelName(ch))}’s calendar sync settings.</p><label>Sync every<select name="intervalMinutes"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>`, `Connect ${channelName(ch)}`, 'class="connect"')
  const host = (() => { try { return new URL(row.url).host } catch { return 'link' } })()
  return `<div class="link-row${row.status === 'stale' ? ' failing' : ''}"><div class="record-title"><h4>${h(channelName(ch))} <span class="muted">· ${h(host)}</span></h4>${badge(STATUS[row.status] ?? row.status)}</div>
<p class="muted">Last synced ${when(row.lastSuccessAt, zone)} · last change ${when(row.lastChangeAt, zone)} · next ${when(row.nextPollAt, zone)} · every ${row.intervalMinutes} min · ${row.events} event${row.events === 1 ? '' : 's'}</p>
${row.error ? `<p class="link-error" role="alert"><strong>Last attempt ${when(row.lastAttemptAt, zone)} failed.</strong> ${h(String(row.error).replace(/([^.!?])$/, '$1.'))} Cabin keeps the nights it last read until a good sync.</p>` : ''}
${s.managed ? '' : `<div class="actions">${form('channel.sync', 'calendar', hidden('id', row.id), 'Sync now')}${form('channel.disconnect', 'calendar', hidden('id', row.id), 'Disconnect', 'class="quiet"')}</div>`}</div>`
}
function outbound(s: any, p: any) {
  const zone = s.homeSettings.find((r: any) => r.propertyId === p.id)?.timeZone || 'America/New_York'
  const feed = s.exports.find((e: any) => e.propertyId === p.id)
  if (!feed) return `<p>Publish this home’s export links, then paste each into its channel so nights held anywhere close there.</p>${form('export.publish', 'calendar', hidden('propertyId', p.id), 'Create export links')}`
  const urls = ([...OTAS, 'all'] as const).map(ch => `<label>${ch === 'all' ? 'Any other calendar' : `Paste into ${h(channelName(ch))}`}<input type="text" readonly value="${h(s.origin + exportPath(feed, EXPORT_SLUGS[ch]))}"></label>`).join('')
  return `${urls}<p class="muted">Each channel’s link lists every night held elsewhere and never its own stays. Created ${when(feed.createdAt, zone)}.</p>${form('export.publish', 'calendar', hidden('propertyId', p.id), 'Replace links (old links stop working)', 'class="quiet"')}`
}
export function channels(s: any) {
  if (!s.properties.length) return ''
  const homes = s.properties.map((p: any) => {
    const rows = s.connections.filter((r: any) => r.propertyId === p.id), failing = rows.filter((r: any) => r.status === 'stale').length
    const summary = `${rows.length} of 3 channels connected${failing ? ` · ${failing} failing` : ''}${s.exports.some((e: any) => e.propertyId === p.id) ? ' · export links ready' : ''}`
    return `<details class="home-links"${failing ? ' open' : ''}><summary><strong>${h(p.name)}</strong> <span class="muted">${h(summary)}</span></summary><div class="links"><section><h3>Calendars Cabin reads</h3>${OTAS.map(ch => inbound(s, p, ch)).join('')}</section><section><h3>Cabin’s links for your channels</h3>${outbound(s, p)}</section></div></details>`
  }).join('')
  return `<section class="panel" id="channels"><h2>Channel calendars</h2>${s.managed ? `<p class="notice">${h(MANAGED_LINE)}</p>` : '<p>Cabin reads each channel’s calendar link on a schedule and publishes its own link for each channel, so availability flows both ways. Airbnb, Vrbo and Booking.com partner APIs come later.</p>'}${homes}</section>`
}
