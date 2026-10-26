import { sharesCapacity } from '../capacity'
import { inspectionNotice } from './notices'
import { type Context, type Task, type StoredPhoto, need, text, integer, newId, manager, owner, exact, property } from '../model'
import { photoList, storePhotos } from '../photos'
import { overlaps, addDays } from '../inventory'
import { day } from '../direct/rules'
import { managementFor } from '../properties/terms'
import { postWorkExpense } from './expenses'
import type { WorkOrder, WorkApproval } from './types'

const COMMANDS = new Set(['work.configure', 'work.accept', 'work.decline', 'work.quote', 'work.approveQuote', 'work.invoice', 'work.approveInvoice', 'work.complete', 'work.inspect'])
const flag = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1'
function items(v: unknown, label: string) {
 const raw = typeof v === 'string' ? v.split(/\r?\n/).filter(s => s.trim()) : v
 need(Array.isArray(raw) && raw.length > 0 && raw.length <= 50, `Enter 1 to 50 ${label}`)
 const values = raw.map(item => text(item, label, 250))
 need(new Set(values).size === values.length, `${label} must be unique`)
 return values
}
function member(c: Context, id: unknown): string | null {
 if (id === null || id === '') return null
 const value = text(id, 'person ID')
 need(c.data.members.some(m => m.id === value && m.active), 'Choose an active person')
 return value
}
function vendor(c: Context, task: Task) {
 if (c.actor.role === 'owner' || c.actor.role === 'manager') { manager(c.actor); return }
 need(c.actor.role === 'cleaner' && task.assigneeId === c.actor.memberId && c.data.members.some(m => m.id === c.actor.memberId && m.active), 'Only the assigned vendor may update this work', 403)
}
function usedPhotos(task: Task, work: WorkOrder): string[] {
 return [...task.photos, ...task.closePhotos, ...(work.quote?.photos ?? []), ...(work.invoice?.photos ?? []), ...(work.completed?.photos ?? [])].map(p => p.id)
}
function ownerTerms(c: Context, task: Task, dueDate: string) {
 const turnover = c.data.turnovers.find(t => t.id === task.turnoverId)
 const booking = turnover && c.data.bookings.find(b => b.id === turnover.bookingId)
 return structuredClone(booking?.managementTerms ?? managementFor(c.data, task.propertyId, dueDate))
}
async function evidence(c: Context, task: Task, work: WorkOrder, p: Record<string, unknown>, caption: string): Promise<StoredPhoto[]> {
 return storePhotos(c, task.id, photoList(p, 1), caption, usedPhotos(task, work))
}
function approval(c: Context, task: Task, amountCents: number, p: Record<string, unknown>, kind: string): WorkApproval {
 manager(c.actor)
 const overLimit = amountCents > task.work!.spendLimitCents
 if (overLimit) { owner(c.actor); need(flag(p.approveOverLimit), 'Explicitly approve this amount above the spend limit') }
 const result: WorkApproval = { id: newId(), by: c.actor.id, at: c.now, revision: task.revision, ...(overLimit ? { overLimit: true } : {}) }
 c.data.approvals.push({ id: result.id, kind, recordId: task.id, revision: task.revision, actorId: c.actor.id, at: c.now })
 return result
}
function configure(c: Context, task: Task, p: Record<string, unknown>) {
 manager(c.actor)
 const old = task.work
 need(!old?.accepted && !old?.completed && !old?.quote && !old?.invoice, 'Accepted work is fixed. Finish this order before dispatching a different scope.', 409)
 const dueDate = day(p.dueDate ?? old?.dueDate ?? c.now.slice(0, 10))
 const priority = p.priority ?? old?.priority ?? 'normal'
 need(priority === 'normal' || priority === 'urgent', 'Choose normal or urgent priority')
 const inspectorId = p.inspectorId === 'installation-owner' ? 'installation-owner' : p.inspectorId === undefined ? old?.inspectorId ?? null : member(c, p.inspectorId)
 const requiresInspection = p.requiresInspection === undefined ? old?.requiresInspection ?? false : flag(p.requiresInspection)
 need(!inspectorId || inspectorId==='installation-owner' || c.data.members.some(m => m.id === inspectorId && m.active), 'Choose an active inspector')
 need(!requiresInspection || inspectorId, 'Choose the person who inspects this work')
 const spendLimitCents = p.spendLimitCents === undefined ? old?.spendLimitCents ?? 0 : integer(Number(p.spendLimitCents), 'Spend limit in cents', 0, 99_999_999)
 if (p.spendLimitCents !== undefined && spendLimitCents !== (old?.spendLimitCents ?? 0)) owner(c.actor)
 const work: WorkOrder = {
  ...old, asset: text(p.asset ?? old?.asset ?? task.title, 'asset', 200), priority, dueDate,
  checklist: items(p.checklist ?? old?.checklist ?? ['Verify repair'], 'checklist items'),
  requiresInspection, inspectorId, recurrenceDays: integer(Number(p.recurrenceDays ?? old?.recurrenceDays ?? 0), 'Recurrence days', 0, 365), spendLimitCents,
  ownerTerms: old?.ownerTerms ?? ownerTerms(c, task, dueDate),
 }
 let assigneeId = task.assigneeId
 if (p.assigneeId !== undefined) assigneeId = member(c, p.assigneeId)
 else if (!assigneeId) {
  const defaultId = c.data.homeSettings.find(h => h.propertyId === task.propertyId)?.maintenanceId
  if (defaultId && c.data.members.some(m => m.id === defaultId && m.active)) assigneeId = defaultId
 }
 if (p.unavailableStart || p.unavailableEnd) {
  const start = day(p.unavailableStart), end = day(p.unavailableEnd)
  need(start < end, 'Unavailable end must follow its start')
  need(Date.parse(end) - Date.parse(start) <= 365 * 86_400_000, 'Block at most 365 nights')
  need(!c.data.bookings.some(b => sharesCapacity(c.data,b.propertyId,task.propertyId) && b.status === 'confirmed' && b.id !== work.blockId && overlaps(b, { start, end })), 'Those nights overlap confirmed inventory', 409)
  const existing = work.blockId ? c.data.bookings.find(b => b.id === work.blockId) : undefined
  need(!work.blockId || existing?.status === 'confirmed', 'The work inventory block changed; review inventory before continuing', 409)
  if (existing) Object.assign(existing, { start, end, revision: newId() })
  else {
   const id = newId()
   c.data.bookings.push({ id, revision: newId(), uid: `cabin-work-${task.id}`, propertyId: task.propertyId, channel: 'direct', kind: 'block', start, end, summary: `Maintenance: ${task.title}`, status: 'confirmed', cancelled: false, approvedAt: c.now, source: 'request' })
   work.blockId = id
  }
 }
 if (assigneeId !== task.assigneeId) task.notified = null
 task.assigneeId = assigneeId
 if (work.blockId) task.blocking = true
 task.work = work
 task.notified=null
}

/** Closing is one atomic command: evidence, required inspection, expense, inventory and recurrence. */
function finalClose(c: Context, task: Task, work: WorkOrder) {
 if (!work.completed || (work.requiresInspection && !work.inspected)) return
 // A paid order stays open until the exact attached invoice is approved and allocated.
 if ((work.quote?.amountCents ?? 0) > 0 && !work.invoice) return
 if (work.invoice && (!work.invoice.approved || !work.expenseId)) return
 task.status = 'closed'
 task.closedBy = c.actor.id
 task.closedAt = c.now
 task.closeNote = work.completed.note
 task.closePhotos = [...work.completed.photos]
 if (work.blockId) {
  const block = c.data.bookings.find(b => b.id === work.blockId)
  need(block && block.propertyId === task.propertyId && block.kind === 'block', 'Work inventory block not found', 409)
  Object.assign(block, { status: 'cancelled', cancelled: true, revision: newId(), approvedAt: c.now })
 }
 if (!work.recurrenceDays || work.nextTaskId) return
 const previousNext = c.data.tasks.find(t => t.work?.recurrenceOf === task.id)
 if (previousNext) { work.nextTaskId = previousNext.id; return }
 const dueDate = addDays(work.dueDate, work.recurrenceDays), id = newId()
 const defaultId = c.data.homeSettings.find(h => h.propertyId === task.propertyId)?.maintenanceId
 const assigneeId = [task.assigneeId, defaultId].find(id => id && c.data.members.some(m => m.id === id && m.active)) ?? null
 const nextWork: WorkOrder = {
  asset: work.asset, priority: work.priority, dueDate, checklist: [...work.checklist],
  requiresInspection: work.requiresInspection, inspectorId: work.inspectorId, recurrenceDays: work.recurrenceDays,
  spendLimitCents: work.spendLimitCents, recurrenceOf: task.id,
  ownerTerms: structuredClone(managementFor(c.data, task.propertyId, dueDate)),
 }
 // A future preventive visit does not inherit this repair's guest-readiness block.
 // A manager can explicitly close its inventory when scheduling that visit.
 c.data.tasks.push({ id, revision: newId(), propertyId: task.propertyId, turnoverId: null, title: task.title, note: task.note, blocking: false, assigneeId, status: 'open', photos: [], raisedBy: c.actor.id, raisedByName: c.actor.email, raisedAt: c.now, closedBy: null, closedAt: null, closeNote: '', closePhotos: [], notified: null, work: nextWork })
 work.nextTaskId = id
}

export async function workOrderCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (!COMMANDS.has(name)) return undefined
 need(!c.actor.isAgent, 'A person must handle maintenance work and approvals', 403)
 const task = c.data.tasks.find(t => t.id === text(p.id, 'work order ID'))
 need(task, 'Work order not found', 404)
 // Do not disclose the work or its revision to unrelated vendors or inspectors.
 need(['owner', 'manager'].includes(c.actor.role) || (c.actor.role === 'cleaner' && (task.assigneeId === c.actor.memberId || (name === 'work.inspect' && task.work?.inspectorId === c.actor.memberId))), 'Work order not found', 404)
 exact(task, p.revision)
 need(task.status === 'open', 'This work order is closed', 409)
 property(c, task.propertyId)
 if (name === 'work.configure') configure(c, task, p)
 else {
  const work = task.work
  need(work, 'Configure this work order first', 409)
  if (name === 'work.accept' || name === 'work.decline') {
   vendor(c, task)
   need(!work.accepted && !work.completed && !work.quote && !work.invoice, 'This work has already been accepted', 409)
   if (name === 'work.accept') {
    // Orders raised with defaults may be accepted without a separate configure command.
    work.ownerTerms ??= ownerTerms(c, task, work.dueDate)
    work.accepted = { by: c.actor.id, at: c.now }; delete work.declined
   }
   else { work.declined = { by: c.actor.id, at: c.now, note: text(p.note, 'reason for declining', 1000) }; task.notified = null;task.assigneeId=null }
  } else if (name === 'work.quote') {
   vendor(c, task)
   need(work.accepted && !work.completed, 'Accept this work before quoting it', 409)
   need(!work.quote?.approved && !work.invoice, 'Approved quotes are fixed', 409)
   const description = text(p.description, 'quote description', 2000), amountCents = integer(Number(p.amountCents), 'Quoted cents', 0, 99_999_999)
   work.quote = { id: newId(), description, amountCents, photos: await evidence(c, task, work, p, description) }
  } else if (name === 'work.approveQuote') {
   manager(c.actor)
   need(work.accepted && work.quote && !work.quote.approved && !work.completed, 'Review an unapproved quote for accepted work', 409)
   work.quote.approved = approval(c, task, work.quote.amountCents, p, 'work.quote')
  } else if (name === 'work.invoice') {
   vendor(c, task)
   need(work.accepted && work.quote?.approved, 'An approved quote is required before invoicing', 409)
   need(!work.invoice?.approved && !work.expenseId, 'An approved invoice is fixed', 409)
   const reference = text(p.reference, 'invoice reference', 160), amountCents = integer(Number(p.amountCents), 'Invoice cents', 1, 99_999_999)
   need(amountCents <= work.quote.amountCents, 'Invoice exceeds the approved quote')
   work.invoice = { id: newId(), reference, amountCents, photos: await evidence(c, task, work, p, `Invoice ${reference}`) }
  } else if (name === 'work.approveInvoice') {
   manager(c.actor)
   need(work.invoice && !work.invoice.approved && !work.expenseId && work.quote?.approved, 'Review an unapproved invoice against its approved quote', 409)
   need(work.invoice.amountCents <= work.quote.amountCents, 'Invoice exceeds the approved quote')
   work.invoice.approved = approval(c, task, work.invoice.amountCents, p, 'work.invoice')
   work.expenseId = await postWorkExpense(c, task)
   finalClose(c, task, work)
  } else if (name === 'work.complete') {
   vendor(c, task)
   need(work.accepted && !work.completed, 'Accept this work before completing it', 409)
   need(!work.quote || work.quote.approved, 'Approve the exact quote before completing paid work', 409)
   const checks = items(p.checks, 'completed checks'), note = text(p.note, 'completion evidence', 2000)
   need(checks.length === work.checklist.length && work.checklist.every(item => checks.includes(item)), 'Complete every checklist item')
   work.completed = { by: c.actor.id, at: c.now, checks, note, photos: await evidence(c, task, work, p, note) }
   await inspectionNotice(c,task)
   finalClose(c, task, work)
  } else if (name === 'work.inspect') {
   need(work.requiresInspection && (work.inspectorId==='installation-owner'?c.actor.role==='owner':work.inspectorId && c.actor.memberId === work.inspectorId && c.data.members.some(m => m.id === work.inspectorId && m.active)), 'Only the designated active inspector may inspect this work', 403)
   need(work.completed && !work.inspected, 'Complete the work before inspecting it', 409)
   const note=text(p.note,'inspection evidence',2000),accepted=p.accepted!=='false'&&p.accepted!==false
   work.inspectionHistory=[...work.inspectionHistory??[],{by:c.actor.id,at:c.now,note,accepted}]
   if(!accepted){delete work.completed;delete work.inspected;task.revision=newId();c.entityId=task.id;return task}
   work.inspected = { by: c.actor.id, at: c.now, note }
   finalClose(c, task, work)
  }
 }
 task.revision = newId()
 c.entityId = task.id
 return task
}
