import type { Bindings } from '../../auth.server'
import { type Context, type Data, type GuestMessage, type Booking, need, text, integer, newId, property } from '../model'
import { load, mutate, SYSTEM } from '../storage'
import { homeSettings } from '../homes'
import { wall } from '../clock'
import { inboxSettings, stored, mailbox } from './settings'
import { facts } from './render'
import { homeReadiness } from '../readiness'

export const replyPolicy = (data: Pick<Data, 'inbox'>, propertyId: string | null) => inboxSettings(data).replyPolicies?.find(p => p.propertyId === propertyId)
/** Saved sources include live operational state; a changed source fences a waiting reply. */
export function replySources(data: Data, origin: string, b: Booking) {
 const p = replyPolicy(data, b.propertyId), home = data.properties.find(p => p.id === b.propertyId)!
 const ready = homeReadiness(data, home, b.start.slice(0, 10))
 return { facts: facts(data, origin, b), instructions: p?.instructions ?? [], operations: { readiness: ready.state, reasons: ready.reasons, arrival: b.arrivalTime ?? homeSettings(data, b.propertyId).checkInTime }, policyRevision: p?.revision ?? '' }
}
export function policyCommand(c: Context, name: string, input: Record<string, unknown>) {
 if (name !== 'inbox.reply.policy') return undefined
 const home = property(c, input.propertyId), row = stored(c, input.revision)
 const from = text(input.from, 'reply hours start', 5), until = text(input.until, 'reply hours end', 5)
 need([from, until].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) && from < until, 'Choose a same-day reply window')
 const managerEmail = mailbox(input.managerEmail); need(managerEmail, 'Enter the responsible manager email')
 const old = row.replyPolicies?.find(p => p.propertyId === home.id)
 const title = String(input.instructionTitle ?? '').trim(), answer = String(input.instructionAnswer ?? '').trim()
 need(!!title === !!answer, 'Enter both an instruction title and its approved answer')
 const instructions = title ? [{ id: old?.instructions[0]?.id ?? newId(), title: text(title, 'instruction title', 100), answer: text(answer, 'approved instruction', 2000) }] : []
 const topics = ['checkin', 'checkout', 'instructions'].filter(t => input[t] === true || input[t] === 'on')
 const policy = { propertyId: home.id, revision: newId(), instructions, enabled: input.enabled === true || input.enabled === 'on', topics, minConfidence: integer(Number(input.minConfidence), 'Minimum confidence', 80, 100), from, until, replyMinutes: integer(Number(input.replyMinutes), 'Reply deadline minutes', 5, 1440), managerEmail, approvedBy: c.actor.id, approvedAt: c.now }
 need(!policy.enabled || topics.length, 'Choose at least one automatic reply topic')
 row.replyPolicies = [...(row.replyPolicies ?? []).filter(p => p.propertyId !== home.id), policy]
 return policy
}
export function attachControl(c: Context, origin: string, m: GuestMessage) {
 const b = c.data.bookings.find(b => b.id === m.bookingId), p = replyPolicy(c.data, m.propertyId)
 if (!b || !p) return
 m.control = { topic: 'other', confidence: 0, needsHost: true, instructionId: null, baseline: JSON.stringify(replySources(c.data, origin, b)), assignedEmail: p.managerEmail, dueAt: new Date(Date.parse(c.now) + p.replyMinutes * 60_000).toISOString() }
}
/** Automatic authority covers source-rendered facts only, never an AI-created promise. */
export function automaticReply(c: Context, origin: string, m: GuestMessage) {
 const control = m.control, b = c.data.bookings.find(b => b.id === m.bookingId), p = replyPolicy(c.data, m.propertyId)
 if (!control || !b || b.status !== 'confirmed' || b.guestErasedAt || !p?.enabled || m.source !== 'ai' || control.needsHost || control.confidence < p.minConfidence || !p.topics.includes(control.topic)) return
 const latest = c.data.messages.find(r => r.id === m.replyTo)
 if (!latest || /\b(early|earlier|late|later|refund|discount|credit|cancel|safe\w*|emergency|relocat\w*|spend|compensat\w*|before|after|instead|change)\b/i.test(latest.text)) return
 const local = wall(Date.parse(c.now), homeSettings(c, b.propertyId).timeZone).slice(11)
 if (local < p.from || local >= p.until || control.baseline !== JSON.stringify(replySources(c.data, origin, b))) return
 const f = facts(c.data, origin, b)
 const answer = control.topic === 'checkin' ? `Check-in at ${f.home} is ${f.checkin}. Address: ${f.address}. Your stay page: ${f.stay_link}` : control.topic === 'checkout' ? `Check-out from ${f.home} is ${f.checkout}.` : p.instructions.find(i => i.id === control.instructionId)?.answer
 if (!answer) return
 m.text = `Hi ${f.guest},\n\n${answer}`
 control.automatic = true
 m.status = 'pending'; m.sentBy = p.approvedBy; m.revision = newId()
 const approval = { id: newId(), kind: 'automatic-reply', recordId: m.id, revision: m.revision, actorId: p.approvedBy, at: c.now }
 c.data.approvals.push(approval); m.approvalId = approval.id; m.detail = 'Automatic reply within the saved property policy; rendered from approved sources.'
}
export async function escalateReplies(env: Bindings) {
 const data = await load(env.DB)
 const pending = data.messages.filter(m => m.status === 'draft' && m.control && !m.control.escalatedAt && (m.control.needsHost || m.control.confidence < (replyPolicy(data, m.propertyId)?.minConfidence ?? 80) || Date.parse(m.control.dueAt) <= Date.now()))
 if (!pending.length) return
 await mutate(env.DB, SYSTEM, 'inbox.reply.escalated', c => {
  for (const old of pending) {
   const m = c.data.messages.find(m => m.id === old.id)
   if (!m?.control || m.status !== 'draft' || m.control.escalatedAt) continue
   m.control.escalatedAt = c.now; m.revision = newId()
   c.data.notices.push({ id: newId(), revision: newId(), propertyId: m.propertyId ?? '', memberId: '', email: m.control.assignedEmail, kind: 'inbox', recordId: m.id, subject: 'Guest reply needs your decision', text: `A guest reply needs your decision in Cabin. ${m.control.needsHost ? 'The question is uncertain or needs separate authority.' : 'The reply deadline has passed.'} Nothing was sent. Open the guest inbox to review the sources and draft.`, status: 'pending', detail: null, createdAt: c.now, sentAt: null })
  }
 })
}
