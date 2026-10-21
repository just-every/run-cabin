import type { Bindings } from '../../../auth.server'
import { type Context, type GuestMessage, need, text, newId } from '../../model'
import { threads } from '../threads'
import { replyTarget } from '../target'
import { facts, fill } from '../render'
import { teamSettings, activeManager } from './settings'
import { ensureCase, liveClaim, openTasks, reservationLabel, notifyMember } from './cases'
const MINUTE = 60_000
const who = (c: Context) => c.data.members.find(m => m.id === c.actor.memberId)?.name ?? c.actor.email
const thread = (c: Context, id: unknown) => { const t = threads(c.data).find(r => r.id === text(id, 'thread')); need(t, 'Thread not found', 404); return t }
/** Two people never answer one guest at once: while another person is replying, or replied a moment ago, a reply is refused naming them. */
export function claimGuard(c: Context, threadId: string) {
 const row = c.data.threadCases.find(r => r.id === threadId), live = row && liveClaim(row, Date.parse(c.now))
 need(!live || live.byId === c.actor.id, live?.sent ? `${live.byName} just replied to this guest. Read their message in the thread before sending another.` : `${live?.byName} is replying to this guest. Wait for them or ask them to hand the thread over.`, 409)
}
/** A sent reply claims the thread for two minutes so the next person sees it before answering again. */
export function markReply(c: Context, threadId: string) {
 const t = threads(c.data).find(r => r.id === threadId); if (!t) return
 if (!c.data.threadCases.some(r => r.id === threadId) && !teamSettings(c.data).since) return
 ensureCase(c, t).claim = { byId: c.actor.id, byName: who(c), until: new Date(Date.parse(c.now) + 2 * MINUTE).toISOString(), sent: true }
}
export async function teamCommand(env: Bindings, c: Context, name: string, p: Record<string, unknown>) {
 if (!name.startsWith('thread.')) return undefined
 const t = thread(c, p.thread), row = ensureCase(c, t), team = teamSettings(c.data); c.entityId = row.id
 if (name === 'thread.note') {
  const note = { id: newId(), at: c.now, byName: who(c), text: text(p.text, 'note', 2000), promise: p.promise === true || p.promise === 'on', doneAt: null }
  row.notes.push(note); return note
 }
 if (name === 'thread.promise.done') {
  const note = row.notes.find(n => n.id === p.id && n.promise); need(note, 'Promise not found', 404); note.doneAt ??= c.now; return note
 }
 if (name === 'thread.triage') {
  const labels = String(p.labels ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); need(labels.length <= 8 && labels.every(l => l.length <= 24), 'Use up to eight labels of 24 characters or fewer')
  need(p.urgency === 'normal' || p.urgency === 'urgent', 'Choose normal or urgent')
  Object.assign(row, { labels: [...new Set(labels)], urgency: p.urgency })
  if (row.status === 'open' && row.waitingSince) row.dueAt = new Date(Date.parse(row.waitingSince) + (row.urgency === 'urgent' ? team.urgentMinutes : team.normalMinutes) * MINUTE).toISOString()
  return row
 }
 if (name === 'thread.assign') {
  const to = activeManager(c.data, p.memberId); need(to, 'Choose an active manager')
  Object.assign(row, { assigneeId: to.id, route: `Assigned by ${who(c)}`, acceptedByName: null, acceptedAt: null, status: row.status === 'answered' ? 'answered' : 'open' })
  notifyMember(c, row, t, to.id, `Guest thread assigned to you: ${row.guest}`, `${who(c)} assigned this guest thread to you. Accept it in Cabin to take responsibility.`); return row
 }
 if (name === 'thread.accept') {
  need(row.status === 'open', 'Nothing in this thread is waiting for an accountable person', 409)
  Object.assign(row, { status: 'accepted', acceptedByName: who(c), acceptedAt: c.now, assigneeId: c.actor.memberId ?? row.assigneeId }); return row
 }
 if (name === 'thread.claim') {
  claimGuard(c, row.id); row.claim = { byId: c.actor.id, byName: who(c), until: new Date(Date.parse(c.now) + 5 * MINUTE).toISOString(), sent: false }; return row.claim
 }
 if (name === 'thread.handover') {
  const to = activeManager(c.data, p.memberId); need(to, 'Choose an active manager')
  const handover = { id: newId(), at: c.now, fromName: who(c), toId: to.id, toName: to.name, summary: text(p.summary, 'handover summary', 2000), reservation: reservationLabel(c.data, t), tasks: openTasks(c.data, row.propertyId), promises: row.notes.filter(n => n.promise && !n.doneAt).map(n => ({ id: n.id, text: n.text })) }
  row.handovers.push(handover); row.claim = null
  Object.assign(row, { assigneeId: to.id, route: `Handed over by ${who(c)}`, acceptedByName: null, acceptedAt: null })
  if (row.status === 'accepted') row.status = 'open'
  if (row.status === 'open' && row.waitingSince) row.dueAt = new Date(Date.parse(c.now) + (row.urgency === 'urgent' ? team.urgentMinutes : team.normalMinutes) * MINUTE).toISOString()
  notifyMember(c, row, t, to.id, `Guest thread handed over to you: ${row.guest}`, `${who(c)} handed this thread to you: ${handover.summary}`); return handover
 }
 if (name === 'thread.template') {
  const tpl = team.templates.find(r => r.id === p.templateId); need(tpl, 'Template not found', 404)
  const { b, last, r } = await replyTarget(env, c, t), f = b ? facts(c.data, env.AUTH_ORIGIN, b) : null
  const body = f ? fill(tpl.text, f) : tpl.text.replace(/\{guest\}/g, t.name.split(/\s+/)[0] || 'there').replace(/\{(home|checkin|checkout|address|code|stay_link|action_link)\}/g, '[add details]')
  const draft: GuestMessage = { id: newId(), revision: newId(), propertyId: b?.propertyId ?? null, bookingId: b?.id ?? last?.bookingId ?? null, email: r.email, phone: r.phone, ref: last?.ref ?? null, channel: r.channel, direction: 'out', source: 'template', status: 'draft', subject: last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : 'About your stay', text: body, detail: `Template “${tpl.title}”. Edit it, then send.`, replyTo: last?.id ?? null, headerId: null, sentBy: null, approvalId: null, scheduledId: null, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
  c.data.messages.push(draft); return draft
 }
 need(false, 'Unknown thread command', 404)
}
