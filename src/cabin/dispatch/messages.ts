import { type Context, type Turnover, newId } from '../model'
import { homeSettings } from '../homes'
import { between } from '../clock'
import { directions } from './planner'
import type { TurnoverOffer } from './types'

export function dispatchNotice(c: Context, t: Turnover, memberId: string, subject: string, text: string) {
 const member = c.data.members.find(m => m.id === memberId && m.active)
 if (!member) return
 c.data.notices.push({ id: newId(), revision: newId(), propertyId: t.propertyId, memberId, email: member.email, kind: 'assigned', recordId: t.id, subject, text: `Hi ${member.name},\n\n${text}\n\nOpen Cabin → Turnovers to respond or review.`, status: 'pending', detail: null, createdAt: c.now, sentAt: null })
}
export function offerNotice(c: Context, t: Turnover, offer: TurnoverOffer, reminder = false) {
 const home = homeSettings(c, t.propertyId), name = c.data.properties.find(p => p.id === t.propertyId)?.name ?? 'home', d = t.dispatch!
 const base = c.data.cleanerProfiles.find(r => r.id === offer.memberId)?.homeBase
 dispatchNotice(c, t, offer.memberId, `${reminder ? 'Reminder' : 'Turnover offer'}: ${name}`, [
  `This is an offer, awaiting your acceptance. The first eligible cleaner to accept gets this job.`,
  `When: ${between(t.windowStart!, t.windowEnd!)} (${home.timeZone}).`,
  `Address: ${home.address}`, base ? `Directions: ${directions(base, home.address)}` : '',
  `Template: ${d.templateName}. Work: ${d.durationMinutes} minutes. Rate: USD ${(d.rateCents / 100).toFixed(2)} per completed turnover.`,
  d.instructions, `Respond before ${offer.expiresAt}.`, 'Checklist:', ...t.checklist.map(item => `- ${item}`),
  'Door access is provided only after acceptance. Decline if you cannot do it.'
 ].filter(Boolean).join('\n'))
}
export function escalate(c: Context, t: Turnover, reasons: string[]) {
 const d = t.dispatch!, note = [...new Set(reasons)].join('\n')
 const task = c.data.tasks.find(k => k.turnoverId === t.id && k.title === 'Turnover needs a manager' && k.status === 'open')
 const changed = task?.note !== note
 const managers = c.data.members.filter(m => m.active && m.role === 'manager')
 if (task) { if (task.note !== note) { task.note = note; task.revision = newId(); task.notified = null } }
 else c.data.tasks.push({ id: newId(), revision: newId(), propertyId: t.propertyId, turnoverId: t.id, title: 'Turnover needs a manager', note, blocking: true, assigneeId: managers[0]?.id ?? null, status: 'open', photos: [], raisedBy: c.actor.id, raisedByName: 'Cabin dispatch', raisedAt: c.now, closedBy: null, closedAt: null, closeNote: '', closePhotos: [], notified: null })
 if (!d.escalatedAt || changed) for (const manager of managers) dispatchNotice(c, t, manager.id, 'Turnover requires action before arrival', note)
 d.escalatedAt ??= c.now
}
export function resolveEscalation(c: Context, t: Turnover) {
 for (const task of c.data.tasks) if (task.turnoverId === t.id && task.title === 'Turnover needs a manager' && task.status === 'open') Object.assign(task, { status: 'closed', revision: newId(), closedBy: c.actor.id, closedAt: c.now, closeNote: t.status === 'cancelled' ? 'Stay cancelled' : t.status === 'completed' ? 'Turnover completed' : 'Eligible cleaner accepted the current job' })
}
