import { connections } from '../connections/ui'
import { h, badge, form, hidden, heading, panel, empty, select, area, approve, propertyName, dateRange } from './shared'
import { chip, atHome } from './ops'
import { channelName, span } from '../inventory'
import { stayLabel } from './calendar-grid'
import { EXPORT_SLUGS, exportPath } from '../ical-export'
import { MANAGED_LINE } from '../channels'
// Per home: the channel links Cabin polls (in) and Cabin's own links to paste
// into each channel (out), with last-synced time, next poll and any error.
const OTAS = ['airbnb', 'vrbo', 'booking.com'] as const
export const when = (iso?: string | null, timeZone = 'America/New_York') => iso ? `<time datetime="${h(iso)}">${h(new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' }))}</time>` : 'never'
const STATUS: Record<string, string> = { ok: 'Synced', pending: 'Waiting for first sync', stale: 'Sync failing' }
// Each channel's own calendar-sync steps, for finding its export link and pasting Cabin's.
const SYNC_HELP: Record<string, string> = {
  airbnb: 'https://www.airbnb.com/help/article/99',
  vrbo: 'https://help.vrbo.com/articles/Export-your-reservation-calendar',
  'booking.com': 'https://partner.booking.com/en-us/help/rates-availability/extranet-calendar/syncing-your-bookingcom-calendar-third-party-calendars',
}
function inbound(s: any, p: any, ch: string) {
  const zone = s.homeSettings.find((r: any) => r.propertyId === p.id)?.timeZone || 'America/New_York'
  const existing = s.connections.find((r: any) => r.propertyId === p.id && r.channel === ch)
  const row = existing?.restorePaused ? null : existing
  if (!row) return s.managed ? `<p class="muted">${h(channelName(ch))}: not connected.</p>` : form('channel.connect', 'channels', hidden('propertyId', p.id) + hidden('channel', ch) + `<label>${h(channelName(ch))} calendar link<input name="url" type="url" inputmode="url" placeholder="https://…ics" required></label><p class="muted">Copy the export (iCal) link from ${h(channelName(ch))}’s calendar sync settings${SYNC_HELP[ch] ? ` (<a href="${SYNC_HELP[ch]}" target="_blank" rel="noreferrer">${h(channelName(ch))}’s steps</a>)` : ''}.</p><label>Sync every<select name="intervalMinutes"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>`, `Connect ${channelName(ch)}`, 'class="connect"')
  return connectionCard(s, row, zone)
}
function connectionCard(s: any, row: any, zone: string) {
  const host = (() => { try { return new URL(row.url).host } catch { return 'link' } })()
  return `<div class="link-row${row.status === 'stale' ? ' failing' : ''}"><div class="record-title"><h4>${h((row.name || channelName(row.channel)))} <span class="muted">· ${h(host)}</span></h4>${badge(STATUS[row.status] ?? row.status)}</div>
<p class="muted">Last synced ${when(row.lastSuccessAt, zone)} · last change ${when(row.lastChangeAt, zone)} · next ${when(row.nextPollAt, zone)} · every ${row.intervalMinutes} min · ${row.events} event${row.events === 1 ? '' : 's'}</p>
${row.exception ? `<p${!row.exception.resolvedAt ? ' role="alert"' : ''}>${row.exception.resolvedAt ? 'Resolved' : 'Open sync exception'} · assigned to <strong>${h(row.exception.assignedName)}</strong> · opened ${when(row.exception.openedAt, zone)}${row.exception.resolvedAt ? ` · recovered ${when(row.exception.resolvedAt, zone)}` : ''}</p>${row.exception.resolvedAt ? '' : form('channel.assign', 'channels', hidden('id', row.id) + select('assignedTo', 'Responsible manager', [[row.exception.assignedTo, row.exception.assignedName], ...s.members.filter((m: any) => m.active && m.role === 'manager' && m.id !== row.exception.assignedTo).map((m: any) => [m.id, m.name])]), 'Assign exception')}` : ''}
${row.error ? `<p class="link-error" role="alert"><strong>Last attempt ${when(row.lastAttemptAt, zone)} failed.</strong> ${h(String(row.error).replace(/([^.!?])$/, '$1.'))} Cabin keeps the nights it last read until a good sync.</p>` : ''}
${row.channel === 'ical' && !s.managed ? `<details><summary>Edit calendar link</summary>${form('channel.update', 'channels', hidden('id', row.id) + hidden('revision', row.revision) + hidden('propertyId', row.propertyId) + hidden('channel', 'ical') + `<label>Calendar name<input name="name" value="${h(row.name)}" required maxlength="100"></label><label>External iCal URL<input name="url" type="url" value="${h(row.url)}" required></label><label>Sync interval (minutes)<input name="intervalMinutes" type="number" min="15" max="60" value="${row.intervalMinutes}" required></label>`, 'Save calendar link')}</details>` : ''}
${s.managed ? '' : `<div class="actions">${form('channel.sync', 'channels', hidden('id', row.id), 'Sync now')}${form('channel.disconnect', 'channels', hidden('id', row.id), 'Disconnect', 'class="danger"')}</div>`}</div>`
}
function outbound(s: any, p: any) {
  const zone = s.homeSettings.find((r: any) => r.propertyId === p.id)?.timeZone || 'America/New_York'
  const feed = s.exports.find((e: any) => e.propertyId === p.id)
  if (!feed?.token) return `<p>Publish this home’s export links, then paste each into its channel so nights held anywhere close there.</p>${form('export.publish', 'channels', hidden('propertyId', p.id), 'Create export links')}`
  const urls = ([...OTAS, 'all'] as const).map(ch => `<label>${ch === 'all' ? 'Any other calendar' : `Paste into ${h(channelName(ch))}`}<input type="text" readonly value="${h(s.origin + exportPath(feed, EXPORT_SLUGS[ch]))}"></label>`).join('')
  const here = s.local ? '<p class="notice">These links point at this computer, so Airbnb, Vrbo and Booking.com cannot read them. Put Cabin online to get links the channels can reach; on this computer they are for checking what each channel would see.</p>' : ''
  return `${here}${urls}<p class="muted">Each channel’s link lists every night held elsewhere and never its own stays. Created ${when(feed.createdAt, zone)}.</p>${form('export.publish', 'channels', hidden('propertyId', p.id), 'Replace links (old links stop working)', 'class="danger"')}`
}
function homes(s: any) {
  return s.properties.map((p: any) => {
    const rows = s.connections.filter((r: any) => r.propertyId === p.id), failing = rows.filter((r: any) => r.status === 'stale').length
    const summary = `${rows.filter((r: any) => r.channel !== 'ical').length} of 3 channels connected${failing ? ` · ${failing} failing` : ''}${s.exports.some((e: any) => e.propertyId === p.id) ? ' · export links ready' : ''}`
    return `<details class="home-links"${failing ? ' open' : ''}><summary><strong>${h(p.name)}</strong> <span class="muted">${h(summary)}</span></summary><div class="links"><section><h3>Calendars Cabin reads</h3>${OTAS.map(ch => inbound(s, p, ch)).join('')}<h3>Other iCal calendars</h3>${rows.filter((r: any) => r.channel === 'ical').map((r: any) => connectionCard(s, r, s.homeSettings.find((x: any) => x.propertyId === p.id)?.timeZone || 'America/New_York')).join('')}${s.managed ? '' : form('channel.connect', 'channels', hidden('propertyId', p.id) + hidden('channel', 'ical') + '<label>Calendar name<input name="name" maxlength="100" placeholder="Furnished Finder" required></label><label>External iCal URL<input name="url" type="url" required placeholder="https://…ics"></label><label>Sync every<select name="intervalMinutes"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label><p class="muted">Events close nights as blocks. They never send guest messages or take payments.</p>', 'Connect external calendar')}</section><section><h3>Cabin’s links for your channels</h3>${outbound(s, p)}</section></div></details>`
  }).join('')
}
// Pasted calendar files: for moving in or checking a feed by hand.
const stay = (s: any, d: any, id: string) => { const b = s.bookings.find((x: any) => x.id === id || x.uid === id) ?? d.events.find((e: any) => e.uid === id); return b ? `${stayLabel(b)}${b.channel ? ` (${channelName(b.channel)})` : ` (${channelName(d.channel)})`}` : 'a stay in this file' }
function reviews(s: any) {
  const feeds = s.feeds.map((f: any) => `<article class="record"><h3>${h(propertyName(s,f.propertyId))} · ${h(channelName(f.channel))}</h3><p class="muted">Last approved file: <time datetime="${h(f.importedAt)}">${h(atHome(s, f.propertyId, f.importedAt))}</time></p></article>`).join('')
  const drafts = s.calendarDrafts.filter((d: any) => d.status === 'draft').map((d: any) => `<article class="record" id="review-${h(d.id)}"><div class="record-title"><h3>${h(propertyName(s,d.propertyId))} · ${h(channelName(d.channel))}</h3>${chip('Needs approval', 'wait')}</div><p class="muted">Imported ${h(atHome(s, d.propertyId, d.importedAt))} · ${d.events.length} events · ${d.changes.length} changes</p>${d.clashes.length ? `<div class="notice error"><strong>${d.clashes.length} calendar clash${d.clashes.length === 1 ? '' : 'es'}</strong><p>These stays overlap another channel’s. Approving records both; resolve one on its channel.</p>${d.clashes.map((c: any) => `<p>${h(span(c))} · ${h(stay(s, d, c.a))} / ${h(stay(s, d, c.b))}</p>`).join('')}</div>` : '<p>No overlaps found in this file.</p>'}<ul class="changes">${d.changes.map((c: any) => `<li><span class="change ${h(c.kind)}">${h(c.kind)}</span> ${h(c.after?.summary ?? c.before?.summary ?? c.uid)} · ${c.after ? dateRange(c.after) : 'removed from this feed'}</li>`).join('') || '<li>No changes.</li>'}</ul>${approve('calendar.approve','channels',d,'Approve this calendar file')}</article>`).join('')
  const upload = form('calendar.prepare','channels',select('propertyId','Home',s.properties.map((p: any) => [p.id,p.name])) + select('channel','Channel',[['airbnb','Airbnb'],['vrbo','Vrbo'],['booking.com','Booking.com']]) + area('calendar','Calendar file (.ics) contents','','placeholder="BEGIN:VCALENDAR…"') + '<p class="muted">For moving in or checking a feed by hand: paste a channel’s .ics file, review the changes, then approve.</p>','Prepare calendar review')
  return (drafts ? panel('Calendar reviews',drafts) : '') + `<div class="columns">${panel('Review a calendar file',upload)}${panel('Approved calendar files',feeds || empty('No calendar files approved yet.'))}</div>`
}
export function channelPage(s: any) {
  const lead = heading('Vacation rental operations', 'Channel calendars', s.managed ? MANAGED_LINE : 'Cabin reads each channel’s calendar link on a schedule and publishes its own link for each channel, so availability flows both ways. Airbnb, Vrbo and Booking.com partner APIs come later.') + connections(s)
  if (!s.properties.length) return lead + panel('Homes', empty('Add a home in Properties & people, or use Move in, to begin.'))
  return lead + '<p class="notice">iCal is polled every 15 to 60 minutes and cannot guarantee against double bookings. Cabin keeps existing blocks when a feed fails; only an acknowledged API connection can guarantee channel closure.</p>' + `<section class="panel" id="channels"><h2>Homes</h2>${homes(s)}</section>` + reviews(s)
}
