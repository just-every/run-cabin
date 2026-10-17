import type { Bindings } from '../../auth.server'
import { type Actor, type GuestMessage, need, text, newId, manager, exact } from '../model'
import { load, mutate } from '../storage'
import { seal } from '../seal'
import { managedInstall } from '../channels'
import { settingsCommand, stored, inboxSettings } from './settings'
import { threads } from './threads'
import { route } from './deliver'
import { receiveEmail } from './inbound'
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
  const config = await aiKey(env, inboxSettings(await load(env.DB)))
  if (!config) return { ok: false, message: managedInstall(env) ? AI_MANAGED : 'Save a key first.' }
  try { const d = await aiDraft(config, { guest: 'Sam', home: 'Sample Cabin', checkin: 'Fri Oct 23, 4 pm', checkout: 'Mon Oct 26, 10 am', address: '1 Sample Road', code: '2580', stay_link: 'https://example.com/stay' }, [{ from: 'guest', text: 'What time can we check in?' }]); return { ok: true, message: `Working: “${d.text.slice(0, 160)}”` } }
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
 return mutate(env.DB, who, name, c => {
  const settled = settingsCommand(c, name, p); if (settled !== undefined) return settled
  if (name === 'inbox.ai.remove') { stored(c, p.revision).ai = null; return { removed: true } }
  if (name === 'message.send' || name === 'message.discard') {
   const m = c.data.messages.find(r => r.id === text(p.id, 'message ID')); need(m && m.direction === 'out', 'Draft not found', 404); exact(m, p.revision)
   need(m.status === 'draft', m.status === 'drafting' ? 'This draft is still being written. Reload in a moment.' : 'This draft was already sent or discarded', 409)
   c.entityId = m.id
   if (name === 'message.discard') { Object.assign(m, { status: 'discarded', revision: newId() }); return m }
   const approval = { id: newId(), kind: 'message', recordId: m.id, revision: m.revision, actorId: who.id, at: c.now }
   c.data.approvals.push(approval)
   Object.assign(m, { text: text(p.text ?? m.text, 'reply', 4000), status: 'pending', sentBy: who.id, approvalId: approval.id, revision: newId() }); return m
  }
  if (name === 'message.retry') {
   const m = c.data.messages.find(r => r.id === text(p.id, 'message ID')); need(m && m.direction === 'out', 'Message not found', 404); need(m.status === 'failed', 'Only a failed message can be sent again', 409)
   Object.assign(m, { status: 'pending', detail: null, revision: newId() }); const s = m.scheduledId && c.data.scheduled.find(r => r.id === m.scheduledId); if (s) Object.assign(s, { status: 'sending', reason: null, revision: newId() })
   c.entityId = m.id; return m
  }
  if (name === 'message.compose') {
   const t = threads(c.data).find(r => r.id === text(p.thread, 'thread')); need(t, 'Thread not found', 404)
   const today = c.now.slice(0, 10), b = [...t.stays].reverse().find(s => s.status === 'confirmed' && s.end.slice(0, 10) >= today) ?? t.stays[t.stays.length - 1] ?? null
   const last = [...t.messages].reverse().find(m => m.direction === 'in')
   const r = last && last.channel !== 'email' ? { channel: last.channel, email: null, phone: last.phone } : b ? route(env, inboxSettings(c), b) : t.email ? { channel: 'email' as const, email: t.email, phone: null } : { unavailable: 'Cabin has no way to reach this guest yet.' }
   need(!('unavailable' in r), 'unavailable' in r ? r.unavailable : '', 409)
   const m: GuestMessage = { id: newId(), revision: newId(), propertyId: b?.propertyId ?? null, bookingId: b?.id ?? last?.bookingId ?? null, email: r.email, phone: r.phone, ref: last?.ref ?? null, channel: r.channel, direction: 'out', source: 'host', status: 'pending', subject: optional(p.subject, 'subject', 200) || (last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : 'About your stay'), text: text(p.text, 'message', 4000), detail: null, replyTo: last?.id ?? null, headerId: null, sentBy: who.id, approvalId: null, scheduledId: null, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
   c.data.messages.push(m); c.entityId = m.id; return m
  }
  need(false, 'Unknown inbox command', 404)
 })
}
