import { syncInquiryDeadlines, inquiryDeadlinesDue } from './inquiries'
import { type Context, type Data, newId } from '../../model'
import { wall, zoneAbbr } from '../../clock'
import { threads, type Thread } from '../threads'
import { teamSettings, activeManager } from './settings'
import { assignee, awaiting, triage, zoneOf } from './routing'
import type { ThreadCase, TeamSettings } from './types'
const MINUTE = 60_000
export const dueAt = (row: Pick<ThreadCase, 'urgency' | 'waitingSince'>, team: TeamSettings) => new Date(Date.parse(row.waitingSince!) + (row.urgency === 'urgent' ? team.urgentMinutes : team.normalMinutes) * MINUTE).toISOString()
export const liveClaim = (row: ThreadCase, now: number) => row.claim && Date.parse(row.claim.until) > now ? row.claim : null
const stayOf = (t: Thread) => [...t.stays].reverse().find(b => b.status === 'confirmed') ?? t.stays[t.stays.length - 1] ?? null
export const openTasks = (data: Pick<Data, 'tasks'>, propertyId: string | null) => data.tasks.filter(t => t.status === 'open' && t.propertyId === propertyId).map(t => ({ id: t.id, title: t.title, blocking: t.blocking }))
export const reservationLabel = (data: Pick<Data, 'properties'>, t: Thread) => { const b = stayOf(t); return b ? `${b.channel} · ${data.properties.find(p => p.id === b.propertyId)?.name ?? ''} · ${b.start.slice(0, 10)} to ${b.end.slice(0, 10)}${b.status === 'confirmed' ? '' : ' (cancelled)'}` : null }
function open(c: Context, t: Thread, team: TeamSettings, waiting: ReturnType<typeof awaiting>) {
 const b = stayOf(t)
 const row: ThreadCase = { id: t.id, revision: newId(), key: t.key, propertyId: waiting?.propertyId ?? b?.propertyId ?? null, bookingId: waiting?.bookingId ?? b?.id ?? null, guest: t.name, status: waiting ? 'open' : 'answered', urgency: 'normal', labels: [], assigneeId: null, route: '', acceptedByName: null, acceptedAt: null, waitingSince: waiting?.createdAt ?? null, dueAt: null, claim: null, notes: [], handovers: [], escalations: [] }
 c.data.threadCases.push(row)
 if (waiting) { raise(row, waiting.text); route(c, row, team) }
 return row
}
/** A guest's words can make a thread urgent or add labels; they never lower what a person set. */
function raise(row: ThreadCase, message: string) { const t = triage(message); if (t.urgency === 'urgent') row.urgency = 'urgent'; row.labels = [...new Set([...row.labels, ...t.labels])] }
export function route(c: Context, row: ThreadCase, team: TeamSettings) {
 const pick = assignee(c, row, Date.parse(c.now)); row.assigneeId = pick.memberId; row.route = pick.route
 row.dueAt = dueAt(row, team)
}
/** Called on every commit: opens a case for each unanswered guest message after team settings were first saved, closes answered ones and escalates missed deadlines until a person accepts. */
export function syncTeam(c: Context) {
 const team = teamSettings(c.data), now = Date.parse(c.now)
 syncInquiryDeadlines(c)
 if (team.since) for (const t of threads(c.data)) {
  const erased = t.stays.some(b => b.guestErasedAt), last = awaiting(t.messages), waiting = erased || (last && last.createdAt < team.since) ? null : last
  let row = c.data.threadCases.find(r => r.id === t.id)
  if (!row) { if (waiting) open(c, t, team, waiting); continue }
  Object.assign(row, { guest: t.name, key: t.key })
  if (waiting && row.waitingSince !== waiting.createdAt) {
   const reopened = row.status === 'answered'
   Object.assign(row, { waitingSince: waiting.createdAt, propertyId: waiting.propertyId ?? row.propertyId, bookingId: waiting.bookingId ?? row.bookingId })
   raise(row, waiting.text)
   if (reopened) { Object.assign(row, { status: 'open', acceptedByName: null, acceptedAt: null }); route(c, row, team) } else if (row.status === 'open') row.dueAt = dueAt(row, team)
  } else if (!waiting && row.status !== 'answered') Object.assign(row, { status: 'answered', dueAt: null })
  if (row.status === 'open' && row.dueAt && Date.parse(row.dueAt) <= now) escalate(c, row, t, team)
 }
 for (const row of c.data.threadCases) { const before = c.before.threadCases.find(r => r.id === row.id); if (!before || JSON.stringify({ ...before, revision: '' }) !== JSON.stringify({ ...row, revision: '' })) row.revision = newId() }
}
const time = (c: Context, row: ThreadCase, iso: string) => { const zone = zoneOf(c.data, row.propertyId); return `${wall(Date.parse(iso), zone).replace('T', ' ')} ${zoneAbbr(Date.parse(iso), zone)}` }
/** Everything the next person needs: the guest's words, the reservation, private notes and promises, handovers and the home's open tasks. */
export function context(c: Context, row: ThreadCase, t: Thread) {
 const waiting = awaiting(t.messages), tasks = openTasks(c.data, row.propertyId), who = (id: string | null) => c.data.members.find(m => m.id === id)?.name ?? 'nobody'
 return [`Guest: ${row.guest}`, `Reservation: ${reservationLabel(c.data, t) ?? 'not matched to a stay'}`, `Urgency: ${row.urgency}${row.labels.length ? ` · labels: ${row.labels.join(', ')}` : ''}`,
  `Waiting since ${row.waitingSince ? time(c, row, row.waitingSince) : 'n/a'}${row.dueAt ? `; response was due ${time(c, row, row.dueAt)}` : ''}`, `Assigned to ${who(row.assigneeId)} (${row.route})`,
  waiting ? `Guest wrote: ${waiting.text}` : 'No unanswered guest message.',
  row.notes.length ? `Private notes (never sent to the guest):\n${row.notes.map(n => `- ${n.promise ? (n.doneAt ? '[promise kept] ' : '[promise open] ') : ''}${n.text} (${n.byName})`).join('\n')}` : 'No private notes.',
  row.handovers.length ? `Handovers:\n${row.handovers.map(h => `- ${h.fromName} to ${h.toName}: ${h.summary}`).join('\n')}` : 'No handovers.',
  tasks.length ? `Open tasks at the home:\n${tasks.map(x => `- ${x.title}${x.blocking ? ' (blocking)' : ''}`).join('\n')}` : 'No open tasks at the home.'].join('\n')
}
export function ensureCase(c: Context, t: Thread) {
 return c.data.threadCases.find(r => r.id === t.id) ?? open(c, t, teamSettings(c.data), t.stays.some(b => b.guestErasedAt) ? null : awaiting(t.messages))
}
export function notifyMember(c: Context, row: ThreadCase, t: Thread, memberId: string | null, subject: string, intro: string) {
 const to = activeManager(c.data, memberId); if (!to) return
 if(to.scope&&(!row.propertyId||!to.scope.propertyIds.some(id=>id==='*'||id===row.propertyId)||!to.scope.actions.some(a=>a==='*'||a==='inbox:read')))return
 c.data.notices.push({ id: newId(), revision: newId(), propertyId: row.propertyId ?? '', memberId: to.id, email: to.email, kind: 'inbox', recordId: row.id, priority: row.urgency === 'urgent' ? 'urgent' : undefined, subject, text: `${intro}\n\n${context(c, row, t)}`, status: 'pending', detail: null, createdAt: c.now, sentAt: null })
}
/** The escalation manager is notified with the full context. It repeats every repeatMinutes until a person accepts the thread. */
function escalate(c: Context, row: ThreadCase, t: Thread, team: TeamSettings) {
 const to = activeManager(c.data, team.escalationMemberId); if (!to) return
 row.escalations.push({ at: c.now, toId: to.id, toName: to.name }); row.dueAt = new Date(Date.parse(c.now) + team.repeatMinutes * MINUTE).toISOString()
 row.assigneeId ??= to.id
 notifyMember(c, row, t, to.id, `Guest thread unanswered: ${row.guest}`, `${row.guest} has not had a reply in time (escalation ${row.escalations.length}). Accept the thread in Cabin to stop further escalation.`)
}
export function dueCases(data: Data, now: number) { const team = teamSettings(data); return inquiryDeadlinesDue(data,now) || !!team.since && data.threadCases.some(r => r.status === 'open' && r.dueAt && Date.parse(r.dueAt) <= now) }
/** A guest's erasure removes their words from retained cases; the case keeps its history without them. */
export function eraseCases(c: Context, bookingIds: Set<string>) {
 for (const row of c.data.threadCases.filter(r => r.bookingId && bookingIds.has(r.bookingId))) {
  Object.assign(row, { guest: 'Erased guest', status: 'answered', waitingSince: null, dueAt: null, claim: null, revision: newId() })
  for (const n of row.notes) n.text = 'Erased with the guest'
  for (const h of row.handovers) Object.assign(h, { summary: 'Erased with the guest', reservation: null, promises: [] })
 }
}
