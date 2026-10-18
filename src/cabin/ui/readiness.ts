import { readinessEvidence } from '../readiness/ui'
import { h, heading, empty, memberName } from './shared'
import { chip, codeLine, lockNote, windowText, photos, checkedOut } from './ops'
import { portfolio } from '../readiness'
import { localDay, dayName, when } from '../clock'
import { homeSettings } from '../homes'
import { channelName } from '../inventory'
import { guestOf } from './calendar-grid'
// The owner's portfolio view: for a chosen day, is each home ready for its next
// guests? Each card shows the next arrival, the turnover before it, the door
// code and the photos the cleaner sent back.
const addDay = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const STATE = { ready: ['Ready ✓', 'good'], 'not-ready': ['Not ready', 'bad'], unknown: ['Not known yet', 'wait'] } as const
export function readiness(s: any, from?: string | null) {
  const zone = s.properties[0] ? homeSettings(s, s.properties[0].id).timeZone : 'America/New_York', today = localDay(Date.now(), zone)
  const day = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : today, r = portfolio(s, day), label = dayName(day, today)
  const title = !r.total ? 'No homes yet' : r.ready === r.total ? (r.total === 1 ? `Your home is ready for ${label}` : `All ${r.total} homes ready for ${label}`) : `${r.ready} of ${r.total} homes ready for ${label}`
  const notReady = r.homes.filter(x => x.state !== 'ready').map(x => x.property.name)
  const days = Array.from({ length: 8 }, (_, i) => addDay(today, i)).map(d => `<a href="/app/readiness?from=${d}" ${d === day ? 'aria-current="page"' : ''}>${h(dayName(d, today))}</a>`).join('')
  const cards = r.homes.map(x => {
    const [text, tone] = STATE[x.state], a = x.arrival, t = x.turnover, done = t?.status === 'completed'
    const list = done ? t!.completion?.photos ?? [{ id: t!.completion?.photoId }] : []
    return `<article class="home-ready ${x.state}"><div class="record-title"><h3>${h(x.property.name)}</h3>${chip(text, tone)}</div>
    <dl class="facts"><dt>Next arrival</dt><dd>${a ? `${h(guestOf(a))} · <span class="ch ch-${a.channel === 'booking.com' ? 'booking' : h(a.channel)}">${h(channelName(a.channel))}</span> · ${h(when(`${a.start.slice(0, 10)}T${a.arrivalTime ?? homeSettings(s, x.property.id).checkInTime}`))}` : 'None booked'}</dd>
    <dt>Turnover</dt><dd>${t ? `<a href="/app/turnovers#turnover-${h(t.id)}">${h(done ? 'Done' : t.status === 'unassigned' ? 'No cleaner yet' : 'Scheduled')}</a>${t.cleanerId ? ` · ${h(memberName(s, t.cleanerId))}` : ''} · ${h(windowText(t))}${t.checkedOut ? `<br><span class="checked-out">${h(checkedOut(s, t))}</span>` : ''}` : '—'}</dd>
    <dt>Photos</dt><dd>${t ? `${done ? list.length : 0} / ${h(t.photosRequired ?? 1)}` : '—'}</dd></dl>
    ${x.guestCode ? `<div class="doors">${codeLine(s, x.guestCode, 'Door code')}</div>${lockNote(s, x.guestCode)}` : ''}
    ${x.reasons.length ? `<ul class="reasons">${x.reasons.map(reason => `<li>${h(reason)}</li>`).join('')}</ul>` : ''}
    ${readinessEvidence(s,x)}${photos(list.slice(0, 4), `${x.property.name} ready photo`)}${list.length > 4 ? `<p class="muted"><a href="/app/turnovers#turnover-${h(t!.id)}">All ${list.length} photos</a></p>` : ''}</article>`
  }).join('')
  return heading('Readiness', title, notReady.length ? `Not ready: ${notReady.join(', ')}. Readiness requires completed cleaning, resolved maintenance, attested supplies and access, and inspector acceptance. Every exception records its guest impact.` : 'Readiness requires completed cleaning, resolved maintenance, attested supplies and access, and inspector acceptance. Every exception records its guest impact.')
    + `<nav class="days" aria-label="Choose a day">${days}<form class="pick-day" method="get" action="/app/readiness"><label><span class="muted">Any day</span><input type="date" name="from" value="${h(day)}" required></label><button type="submit" class="quiet">Show</button></form></nav>` + (cards ? `<div class="ready-grid">${cards}</div>` : empty('Add homes and stays to see readiness.'))
}
