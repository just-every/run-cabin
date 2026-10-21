import type { Bindings } from '../../auth.server'
import { type Actor, type GuestMessage, need, text, newId, manager, exact } from '../model'
import { load, mutate } from '../storage'
import { seal } from '../seal'
import { managedInstall } from '../channels'
import { settingsCommand, stored, inboxSettings } from './settings'
import { threads, threadId, messageKey } from './threads'
import { replyTarget } from './target'
import { teamCommand, claimGuard, markReply } from './team/commands'
import { teamSettingsCommand } from './team/settings'
import { route } from './deliver'
import { policyCommand, replySources } from './reply-policy'
import { arrivalCommand } from './arrival'
import { receiveEmail } from './inbound'
import { lifecycleCommand } from './lifecycle-settings'
import { facts } from './render'
import { AI_MANAGED, AI_MODEL, AI_PURPOSE, aiDraft, aiKey, DraftError } from './ai'
// What a person does in the inbox. A draft is sent only by message.send, which
// records who approved exactly which text; message.compose is a reply the
// person wrote themselves. Agents and the system never send a reply.
const optional = (v: unknown, label: string, max: number) => v === undefined || v === null || String(v).trim() === '' ? '' : text(v, label, max)
export async function inboxCommand(env: Bindings, who: Actor, name: string, p: Record<string, unknown>) {
 manager(who)
 if (name === 'inbox.ai.save') {
  need(!managedInstall(env), AI_MANAGED, 409)
  const key = optional(p.key, 'API key', 400), model = optional(p.model, 'model', 120) || AI_MODEL, workspace = optional(p.workspace, 'workspace ID', 120)
  const sealed = key ? await seal(env.SESSION_SECRET, AI_PURPOSE, key) : null
  return mutate(env.DB, who, name, c => {
   const row = stored(c, p.revision); need(sealed || row.ai, 'Paste the API key')
   row.ai = { model, workspace, keySealed: sealed ?? row.ai!.keySealed, keyHint: key ? `…${key.slice(-4)}` : row.ai!.keyHint, savedBy: who.email, savedAt: c.now }
   return { model, keyHint: row.ai.keyHint }
  })
 }
 if (name === 'inbox.ai.test') {
  const data = await load(env.DB), config = await aiKey(env, inboxSettings(data))
  if (!config) return { ok: false, message: managedInstall(env) ? AI_MANAGED : 'Save a key first.' }
  const stay = [...data.bookings].filter(b => b.kind === 'stay' && b.status === 'confirmed').sort((a, b) => b.start.localeCompare(a.start))[0]
  if (!stay) return { ok: false, message: 'Add a confirmed stay in Calendar first. The test uses its real saved details; nothing is sent to the guest.' }
  try {
   const f = facts(data, env.AUTH_ORIGIN, stay), d = await aiDraft(config, f, [{ from: 'guest', text: 'Any chance we can check in early, around 1 pm?' }], { db: env.DB, actor: who, kind: 'bookings', id: stay.id, revision: stay.revision, propertyId: stay.propertyId, bookingId: stay.id })
   if (!d.needsHost) return { ok: false, message: `Anthropic replied, but did not flag early check-in for your approval. Review the model setting before using it. Test reply for ${f.home}: “${d.text}” Nothing was sent.` }
   return { ok: true, message: `Working with ${config.model}, using ${f.home}'s saved stay: “${d.text}” Needs you: ${d.note || 'Early check-in requires your approval.'} Nothing was sent to the guest.` }
  }
  catch (error) { return { ok: false, message: error instanceof DraftError ? error.message : 'The AI provider could not be reached.' } }
 }
 if (name === 'inbox.try') {
  // On this computer no mail server can reach Cabin: a saved email goes through the same receiving code.
  need(env.AUTH_LOCAL === 'true', 'Not found', 404)
  const address = inboxSettings(await load(env.DB)).address; need(address, 'Enter the guest email address first', 409)
  const outcome = await receiveEmail(env, [address], new TextEncoder().encode(text(p.source, 'email source', 1_000_000).replace(/\r?\n/g, '\r\n')))
  need(!('refused' in outcome), 'refused' in outcome ? outcome.refused : '', 400)
  return outcome
 }
 return mutate(env.DB, who, name, async c => {
  const lifecycle = lifecycleCommand(c, name, p); if (lifecycle !== undefined) return lifecycle
  const policy = policyCommand(c, name, p); if (policy !== undefined) return policy
  const arrival = arrivalCommand(c, name, p); if (arrival !== undefined) return arrival
  const settled = settingsCommand(c, name, p); if (settled !== undefined) return settled
  const team = teamSettingsCommand(c, name, p) ?? await teamCommand(env, c, name, p); if (team !== undefined) return team
  if (name === 'inbox.ai.remove') { stored(c, p.revision).ai = null; return { removed: true } }
  if (name === 'message.send' || name === 'message.discard') {
   const m = c.data.messages.find(r => r.id === text(p.id, 'message ID')); need(m && m.direction === 'out', 'Draft not found', 404); exact(m, p.revision)
   need(m.status === 'draft', m.status === 'drafting' ? 'This draft is still being written. Reload in a moment.' : 'This draft was already sent or discarded', 409)
   c.entityId = m.id
   if (name === 'message.discard') { Object.assign(m, { status: 'discarded', revision: newId() }); return m }
   const tid = threadId(messageKey(c.data, m)); claimGuard(c, tid)
   const booking = c.data.bookings.find(b => b.id === m.bookingId)
   if (m.control && booking) need(m.control.baseline === JSON.stringify(replySources(c.data, env.AUTH_ORIGIN, booking)), 'The stay, instructions or readiness changed. Discard this draft and write a current reply.', 409)
   const approval = { id: newId(), kind: 'message', recordId: m.id, revision: m.revision, actorId: who.id, at: c.now }
   c.data.approvals.push(approval)
   Object.assign(m, { text: text(p.text ?? m.text, 'reply', 4000), status: 'pending', sentBy: who.id, authority:structuredClone(who), approvalId: approval.id, revision: newId() }); markReply(c, tid); return m
  }
  if (name === 'message.retry') {
   const m = c.data.messages.find(r => r.id === text(p.id, 'message ID')); need(m && m.direction === 'out', 'Message not found', 404); need(m.status === 'failed', 'Only a failed message can be sent again', 409)
   const scheduled=m.scheduledId&&c.data.scheduled.find(r=>r.id===m.scheduledId)
   if(scheduled){need(p.confirmNoDelivery==='yes','Check the provider history and confirm this attempt was not delivered before sending again',409);const reference=text(p.providerReference,'provider non-delivery evidence reference',300);m.status='discarded';m.detail='Provider non-delivery checked: '+reference;m.revision=newId();Object.assign(scheduled,{status:'scheduled',messageId:null,attemptedAt:undefined,reason:'Human verified no earlier delivery: '+reference,revision:newId()})}
   else Object.assign(m, { status: 'pending', detail: null, revision: newId() })
   c.entityId = m.id; return m
  }
  if (name === 'message.compose') {
   const t = threads(c.data).find(r => r.id === text(p.thread, 'thread')); need(t, 'Thread not found', 404)
   const { b, last, r } = await replyTarget(env, c, t)
   claimGuard(c, t.id)
   const m: GuestMessage = { id: newId(), revision: newId(), propertyId: b?.propertyId ?? null, bookingId: b?.id ?? last?.bookingId ?? null, email: r.email, phone: r.phone, ref: last?.ref ?? null, channel: r.channel, direction: 'out', source: 'host', status: 'pending', subject: optional(p.subject, 'subject', 200) || (last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : 'About your stay'), text: text(p.text, 'message', 4000), detail: null, replyTo: last?.id ?? null, headerId: null, sentBy: who.id, authority:structuredClone(who), approvalId: null, scheduledId: null, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
   c.data.messages.push(m); markReply(c, t.id); c.entityId = m.id; return m
  }
  need(false, 'Unknown inbox command', 404)
 })
}
