import { h, heading, panel, form, select, area, approve, badge, empty, propertyName, dateRange } from './shared'
import { addDays, channelName, describe } from '../inventory'
import { DAYS, collisions, grid, isDay } from './calendar-grid'
import { channels } from './channels'
import { atHome } from './ops'
import { arrivals, decisions, requestForms } from './requests'

function reviews(s: any) {
  const feeds = s.feeds.map((f: any) => `<article class="record"><h3>${h(propertyName(s,f.propertyId))} · ${h(f.channel)}</h3><p>Last approved file: <time datetime="${h(f.importedAt)}">${h(atHome(s, f.propertyId, f.importedAt))}</time></p></article>`).join('')
  const drafts = s.calendarDrafts.filter((d: any) => d.status === 'draft').map((d: any) => `<article class="record"><div class="record-title"><h3>${h(propertyName(s,d.propertyId))} · ${h(d.channel)}</h3>${badge('Needs approval')}</div><p>Imported ${h(atHome(s, d.propertyId, d.importedAt))} · ${d.events.length} events · ${d.changes.length} changes</p>${d.clashes.length ? `<div class="notice error"><strong>${d.clashes.length} calendar clash${d.clashes.length === 1 ? '' : 'es'}</strong><p>These stays overlap another channel’s. Approving records both; resolve one on its channel.</p>${d.clashes.map((c: any) => `<p>${h(c.start)} → ${h(c.end)} · ${h(c.a)} / ${h(c.b)}</p>`).join('')}</div>` : '<p>No overlaps found in this file.</p>'}<ul>${d.changes.map((c: any) => `<li>${h(c.kind)} · ${h(c.after?.summary ?? c.before?.summary ?? c.uid)} · ${c.after ? dateRange(c.after) : 'removed from this feed'}</li>`).join('') || '<li>No changes.</li>'}</ul>${approve('calendar.approve','calendar',d,'Approve this calendar file')}</article>`).join('')
  const upload = form('calendar.prepare','calendar',select('propertyId','Home',s.properties.map((p: any) => [p.id,p.name])) + select('channel','Channel',[['airbnb','Airbnb'],['vrbo','Vrbo'],['booking.com','Booking.com']]) + area('calendar','Calendar file (.ics) contents','','placeholder="BEGIN:VCALENDAR…"') + '<p class="muted">For moving in or checking a feed by hand: paste a channel’s .ics file, review the changes, then approve.</p>','Prepare calendar review')
  return `<div class="columns">${panel('Review a calendar file',upload)}${panel('Approved calendar files',feeds || empty('No calendar files approved yet.'))}</div>` + (drafts ? panel('Calendar reviews',drafts) : '')
}
export function calendar(s: any, from?: string | null) {
  const today = new Date().toISOString().slice(0, 10), start = isDay(from) ? from : today
  const lead = heading('Vacation rental operations','Calendar','Every home’s nights across Airbnb, Vrbo, Booking.com and direct bookings. A night held anywhere closes on every channel through Cabin’s calendar links.')
  if (!s.properties.length) return lead + panel('Calendar', empty('Add a home in Properties & people, or use Move in, to begin.'))
  const late = collisions(s.bookings).map(([a, b]) => `<p>${h(propertyName(s, a.propertyId))}: ${h(describe(a))} overlaps ${h(describe(b))}</p>`)
  const honest = '<p class="notice">Calendar links are polled every 15 to 60 minutes, so a channel can still sell a night before it hears; any such collision shows here at once. Cabin never accepts an overlapping request.</p>'
  const failing = s.connections.filter((r: any) => r.status === 'stale').map((r: any) => `<p>${h(propertyName(s, r.propertyId))} · ${h(channelName(r.channel))}: ${h(r.error)}</p>`)
  const stale = failing.length ? `<div class="notice error" role="alert"><strong>${failing.length} calendar link${failing.length === 1 ? '' : 's'} failing</strong>${failing.join('')}<p>Cabin keeps the nights each link last held. Fix the link under Channel calendars.</p></div>` : ''
  const alert = late.length ? `<div class="notice error" role="alert"><strong>${late.length} double booking${late.length === 1 ? '' : 's'} to resolve</strong>${late.join('')}<p>Both stays are kept. Cancel or move one on its channel.</p></div>` : ''
  return lead + honest + alert + stale + `<section class="panel cal-panel"><h2>All homes</h2>${grid(s, start, today)}</section>` + `<div class="columns">${requestForms(s)}</div>` + `<div class="columns">${decisions(s)}${arrivals(s, today, addDays(today, DAYS))}</div>` + channels(s) + reviews(s)
}
