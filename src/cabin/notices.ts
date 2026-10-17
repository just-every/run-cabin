import { type AccessCode, type Context, type HomeSettings, type Notice, type Notified, type Task, type Turnover, newId } from './model'
import { between, time12, ZONES } from './clock'
import { homeSettings } from './homes'
// The emails a cleaner or maintenance person gets, written into the same commit
// as the change that causes them and sent after it (notify.ts). Each turnover
// keeps what its cleaner was last told; any difference sends exactly one email.
const zoneName = (zone: string) => `${ZONES.find(([z]) => z === zone)?.[1] ?? zone} time`
const home = (c: Context, id: string) => c.data.properties.find(p => p.id === id)?.name ?? 'the home'
function push(c: Context, memberId: string, propertyId: string, kind: Notice['kind'], recordId: string, subject: string, text: string) {
 const m = c.data.members.find(r => r.id === memberId); if (!m?.active) return
 c.data.notices.push({ id: newId(), revision: newId(), propertyId, memberId, email: m.email, kind, recordId, subject, text: `Hi ${m.name},\n\n${text}`, status: 'pending', detail: null, createdAt: c.now, sentAt: null })
}
function details(c: Context, s: HomeSettings, t: Turnover, code: AccessCode) {
 const next = t.nextBookingId ? `The next guests arrive at ${time12(t.windowEnd!.slice(11, 16))}.` : 'No next arrival is booked yet.'
 return [`When: ${between(t.windowStart!, t.windowEnd!)} (${zoneName(s.timeZone)}), after the guests check out. ${next}`, `Address: ${s.address || 'not entered yet; ask your manager'}`, `Door code: ${code.code} (works ${between(code.validFrom, code.validUntil)})`, '', 'Checklist:', ...t.checklist.map(i => `- ${i}`), '', `When the home is ready, mark it ready in Cabin with at least ${t.photosRequired ?? 1} photo${(t.photosRequired ?? 1) === 1 ? '' : 's'}. Report anything broken from the job.`].join('\n')
}
export function assignmentNotice(c: Context, s: HomeSettings, t: Turnover, code: AccessCode | null) {
 const now: Notified | null = t.status === 'approved' && t.cleanerId && code ? { cleanerId: t.cleanerId, windowStart: t.windowStart!, windowEnd: t.windowEnd!, code: code.code } : null, before = t.notified ?? null
 if (JSON.stringify(now) === JSON.stringify(before)) return
 const name = home(c, t.propertyId)
 if (before && (!now || before.cleanerId !== now.cleanerId)) {
  const cancelled = t.status === 'cancelled'
  push(c, before.cleanerId, t.propertyId, cancelled ? 'cancelled' : 'removed', t.id, `${cancelled ? 'Cancelled' : 'Reassigned'}: turnover at ${name} · ${between(before.windowStart, before.windowEnd)}`, `The turnover at ${name} on ${between(before.windowStart, before.windowEnd)} is ${cancelled ? `cancelled: ${(t.cancelReason ?? 'cancelled').toLowerCase()}` : 'now assigned to someone else'}. Its door code ${before.code} no longer works for you.`)
 }
 if (now && code) {
  const changed = before?.cleanerId === now.cleanerId
  push(c, now.cleanerId, t.propertyId, changed ? 'changed' : 'assigned', t.id, `${changed ? 'Changed' : 'New'}: turnover at ${name} · ${between(now.windowStart, now.windowEnd)}`, `${changed ? `The turnover at ${name} changed. This replaces the earlier email.` : `You have the turnover at ${name}.`}\n\n${details(c, s, t, code)}`)
 }
 t.notified = now
}
export function taskNotice(c: Context, task: Task) {
 if (task.status !== 'open' || !task.assigneeId || task.notified === task.assigneeId) return
 const name = home(c, task.propertyId), s = homeSettings(c, task.propertyId)
 push(c, task.assigneeId, task.propertyId, 'task', task.id, `Maintenance: ${task.title} · ${name}`, [`${task.raisedByName} added a maintenance task for you at ${name}: ${task.title}.`, task.note ? `\n${task.note}` : '', `\nAddress: ${s.address || 'not entered yet; ask your manager'}`, task.blocking ? 'This keeps the home from being ready for its next guests until it is closed.' : 'It does not hold up the next arrival.', task.photos.length ? `${task.photos.length} photo${task.photos.length === 1 ? '' : 's'} attached in Cabin.` : ''].filter(Boolean).join('\n'))
 task.notified = task.assigneeId
}
