import { h, money, memberName, propertyName, approve } from './shared'
import { homeReadiness } from '../readiness'
import { homeSettings } from '../homes'
import { channelName } from '../inventory'
import { wall, time12, when, between } from '../clock'
import { statementMonth } from '../finance/presentation'
import { stayLabel, town, homeThumb } from './calendar-grid'
import { icon } from './icons'
// Beside the calendar: the home whose next arrival is not ready yet, what
// already happened to put it right (the turnover's history, door codes and
// the cleaner's email, each with its time), what is still missing, the drafts
// a person must approve, and the home's latest owner statement.
const day = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const NOTICE: Record<string, string> = { assigned: 'Job sent to', changed: 'New window sent to', removed: 'Taken off the job:', cancelled: 'Cancellation sent to', task: 'Task sent to' }
interface Step { at: string; title: string; note: string; tone: 'done' | 'muted' | 'bad' }
function stamp(s: any, propertyId: string, iso: string, today: string) {
  const local = wall(Date.parse(iso), homeSettings(s, propertyId).timeZone)
  return local.slice(0, 10) === today ? time12(local.slice(11, 16)) : new Date(local.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
function steps(s: any, x: any): Step[] {
  const t = x.turnover, list: Step[] = []
  if (!t) return list
  const who = (id: string | null) => id ? memberName(s, id) : 'nobody'
  for (const old of s.turnovers.filter((r: any) => r.bookingId === t.bookingId && r.id !== t.id && r.status === 'cancelled')) list.push({ at: old.history?.at(-1)?.at ?? old.preparedAt, title: 'Earlier turnover cancelled', note: old.cancelReason ?? 'Cancelled', tone: 'muted' })
  const made = `${t.checklist.length} checklist items · ${t.photosRequired ?? 1} photo${(t.photosRequired ?? 1) === 1 ? '' : 's'} to mark ready`
  if (!t.history?.some((e: any) => e.action === 'created')) list.push({ at: t.preparedAt, title: t.source === 'auto' ? 'Turnover dispatched' : 'Turnover prepared by hand', note: made, tone: 'done' })
  let previous: string | null = null
  for (const e of t.history ?? []) {
    if (e.action === 'created') { list.push({ at: e.at, title: 'Turnover dispatched', note: e.cleanerId ? `Cleaner: ${who(e.cleanerId)} · ${made}` : `No default cleaner · ${made}`, tone: e.cleanerId ? 'done' : 'bad' }); previous = e.cleanerId; continue }
    const title = e.action === 'assigned' ? (previous && previous !== e.cleanerId ? `Reassigned to ${who(e.cleanerId)}` : `${who(e.cleanerId)} assigned`) : e.action === 'approved' ? 'Approved and assigned' : e.action === 'checked out' ? 'Guests checked out' : e.action === 'completed' ? 'Marked ready' : e.action === 'replaced' ? 'Replaced by an approved turnover' : e.action === 'cancelled' ? 'Turnover cancelled' : e.action.charAt(0).toUpperCase() + e.action.slice(1)
    const note = e.action === 'approved' ? `Cleaner: ${who(e.cleanerId)}` : e.action === 'completed' ? (t.completion?.caption ?? '') : e.action === 'assigned' && previous && previous !== e.cleanerId ? `Was ${who(previous)}` : ''
    list.push({ at: e.at, title, note, tone: 'done' }); previous = e.cleanerId
  }
  const arriving = t.nextBookingId ?? x.arrival?.id
  for (const c of s.codes.filter((r: any) => r.turnoverId === t.id || (r.holder === 'guest' && r.bookingId === arriving))) list.push({ at: c.createdAt, title: c.status === 'revoked' ? `Door code ${c.code} revoked` : `Door code ${c.code} issued`, note: c.status === 'revoked' ? c.reason ?? '' : `${c.holder === 'guest' ? 'Guest' : `Cleaner ${c.memberId ? memberName(s, c.memberId) : ''}`.trim()} · works ${between(c.validFrom, c.validUntil)}`, tone: c.status === 'revoked' ? 'muted' : 'done' })
  for (const n of s.notices.filter((r: any) => r.recordId === t.id)) list.push({ at: n.sentAt ?? n.createdAt, title: `${NOTICE[n.kind] ?? 'Emailed'} ${memberName(s, n.memberId)}`, note: n.status === 'sent' ? n.subject : n.status === 'suppressed' ? 'Email not sent: development mode sends no mail' : n.status === 'unavailable' ? 'Email not sent: no mail provider is set up' : n.detail ?? n.status, tone: n.status === 'sent' ? 'done' : n.status === 'failed' ? 'bad' : 'muted' })
  return list.filter(r => r.at).sort((a, b) => a.at.localeCompare(b.at)).slice(-6)
}
function waiting(s: any, propertyId: string | null) {
  const mine = (r: any) => !propertyId || r.propertyId === propertyId
  const turnovers = s.turnovers.filter((t: any) => t.status === 'draft' && mine(t)).map((t: any) => ({ title: `Turnover for ${propertyName(s, t.propertyId)}`, note: `${memberName(s, t.cleanerId)} · checkout ${day(t.dueDate)} · ${t.checklist.length} checklist items`, act: approve('turnover.approve', 'calendar', t, 'Approve'), review: `/app/turnovers#turnover-${t.id}` }))
  const files = s.calendarDrafts.filter((d: any) => d.status === 'draft' && mine(d)).map((d: any) => ({ title: `${channelName(d.channel)} calendar file · ${propertyName(s, d.propertyId)}`, note: `${d.changes.length} change${d.changes.length === 1 ? '' : 's'}${d.clashes.length ? ` · ${d.clashes.length} clash${d.clashes.length === 1 ? '' : 'es'} with another channel` : ' · no overlaps'}`, act: approve('calendar.approve', 'calendar', d, 'Approve'), review: `/app/channels#review-${d.id}`, bad: d.clashes.length > 0 }))
  const statements = s.statements.filter((r: any) => r.status === 'draft' && mine(r)).map((r: any) => ({ title: `${statementMonth(r.month)} statement · ${r.propertyName}`, note: `Owner payout ${money(r.netCents)} · approving emails ${r.ownerName}`, act: '', review: `/app/statements#statement-${r.id}` }))
  return [...files, ...turnovers, ...statements] as { title: string; note: string; act: string; review: string; bad?: boolean }[]
}
const card = (w: { title: string; note: string; act: string; review: string; bad?: boolean }) => `<article class="ask${w.bad ? ' bad' : ''}"><div class="ask-text">${icon(w.bad ? 'alert' : 'agent')}<div><strong>${h(w.title)}</strong><p>${h(w.note)}</p></div></div><div class="actions">${w.act}<a class="button quiet" href="${h(w.review)}">Review</a></div></article>`
export function recovery(s: any, today: string, until: string, homes: any[]) {
  const all = homes.map((p: any) => homeReadiness(s, p, today)), shaky = all.filter(x => x.state !== 'ready' && (!x.arrival || x.arrival.start.slice(0, 10) < until)).sort((a, b) => (a.arrival?.start ?? '9999').localeCompare(b.arrival?.start ?? '9999'))
  const x = shaky[0]
  if (!x) {
    const asks = waiting(s, homes.length === 1 ? homes[0].id : null)
    return `<aside class="panel recovery" aria-label="Readiness"><header>${icon('readiness')}<h2>${all.length === 1 ? 'Your home is ready' : `All ${all.length} homes ready`}</h2></header><p class="muted">Every turnover before the next arrival is done with its photos and no blocking maintenance task is open.</p>${asks.length ? `<section><h3>Waiting for your approval</h3>${asks.slice(0, 3).map(card).join('')}</section>` : ''}<p><a href="/app/readiness">Open readiness</a></p></aside>`
  }
  const p = x.property, a = x.arrival, t = x.turnover, place = town(s, p.id)
  const subject = t ? `${day(t.windowStart ?? t.dueDate)} turnover` : a ? `${day(a.start)} arrival` : 'Next stay'
  const done = steps(s, x).map(r => `<li class="${r.tone}"><span class="mark" aria-hidden="true">${r.tone === 'bad' ? icon('alert') : icon('check')}</span><time>${h(stamp(s, p.id, r.at, today))}</time><div><strong>${h(r.title)}</strong>${r.note ? `<small>${h(r.note)}</small>` : ''}</div></li>`).join('')
  const open = `<li class="pending"><span class="mark" aria-hidden="true"></span><time>Now</time><div><strong>${x.state === 'unknown' ? 'Not known yet' : 'Not ready'}</strong><small>${h(x.reasons.join('. '))}.</small></div></li>`
  const asks = waiting(s, p.id), others = asks.length ? [] : waiting(s, null).filter(w => w.act)
  const statement = s.statements.filter((r: any) => r.propertyId === p.id).sort((a: any, b: any) => b.month.localeCompare(a.month))[0]
  return `<aside class="panel recovery" aria-label="Stay recovery"><header>${icon('spark')}<h2>Stay recovery</h2></header>
  <div class="stay-home">${homeThumb(s, p)}<div><h3>${h(p.name)}</h3><p>${h(place || `${homes.length - shaky.length} of ${homes.length} homes ready`)}</p></div></div>
  ${a ? `<p class="next">Next arrival <strong>${h(stayLabel(a).split(' · ')[0])}</strong> · ${h(channelName(a.channel))} · ${h(when(`${a.start.slice(0, 10)}T${a.arrivalTime ?? homeSettings(s, p.id).checkInTime}`))}</p>` : ''}
  <section><h3>${h(subject)} – ${h(x.reasons[0] ?? 'not ready')}</h3><ol class="steps">${done}${open}</ol>${t ? `<p class="more"><a href="/app/turnovers#turnover-${h(t.id)}">Open this turnover</a></p>` : ''}</section>
  ${asks.length || others.length ? `<section><h3>${asks.length ? 'Waiting for your approval' : 'Also waiting for you'}</h3>${(asks.length ? asks : others).slice(0, 2).map(card).join('')}</section>` : ''}
  ${statement ? `<section class="balance"><h3>${h(statementMonth(statement.month))} owner payout</h3><div class="money-line"><strong class="money">${h(money(statement.netCents))}</strong><span class="chip ${statement.status === 'approved' ? 'chip-good' : 'chip-wait'}"><span class="dot"></span>${statement.status === 'approved' ? 'Approved' : 'In review'}</span></div><p class="muted">${h(statement.ownerName)} · management ${(statement.commissionBps / 100).toFixed(2)}% · <a href="/app/statements#statement-${h(statement.id)}">Statement</a></p></section>` : ''}
  </aside>`
}
