import type { Bindings } from '../../auth.server'
import { type Context, type GuestMessage, newId } from '../model'
import { load, mutate, SYSTEM } from '../storage'
import { facts } from './render'
import { inboxSettings } from './settings'
import { aiDraft, aiKey, DraftError } from './ai'
import { messageKey } from './threads'
import { attachControl, automaticReply, replySources } from './reply-policy'
import { templateDraft } from './templates'
export { templateDraft } from './templates'
// Every guest message gets a drafted reply that waits in the thread for a
// person: from the install's AI key when one is saved, else from a template
// picked by what the guest asked. Nothing is sent until someone sends it.
/** Writes the waiting draft for a guest message in the same commit; an AI draft starts as 'drafting' and is filled in after it. */
export function startDraft(c: Context, origin: string, inbound: GuestMessage, ai: boolean, ownerEmail = '') {
 const b = inbound.bookingId ? c.data.bookings.find(r => r.id === inbound.bookingId) : null, f = b ? facts(c.data, origin, b) : null
 const base = templateDraft(f, inbound.text)
 for (const old of c.data.messages) if (old.status === 'draft' && messageKey(c.data, old) === messageKey(c.data, inbound)) Object.assign(old, { status: 'discarded', detail: 'Replaced by a draft for the newer message', revision: newId() })
 const draft: GuestMessage = { ...inbound, id: newId(), revision: newId(), direction: 'out', source: ai ? 'ai' : 'template', status: ai ? 'drafting' : 'draft', subject: inbound.subject ? (/^re:/i.test(inbound.subject) ? inbound.subject : `Re: ${inbound.subject}`) : `Your stay at ${f?.home ?? 'our home'}`, text: ai ? '' : base.text, detail: ai ? null : base.detail, replyTo: inbound.id, headerId: null, sentBy: null, approvalId: null, scheduledId: null, providerId: null, grounds: ai ? [] : base.grounds, createdAt: c.now, sentAt: null }
 attachControl(c, origin, draft, ownerEmail); c.data.messages.push(draft); return draft
}
/** Fills AI drafts after their commit. A failed call leaves a visible failure and an empty reply for the host. */
export async function finishDrafts(env: Bindings) {
 const data = await load(env.DB), waiting = data.messages.filter(m => m.status === 'drafting').slice(0, 5)
 if (!waiting.length) return
 const config = await aiKey(env, inboxSettings(data))
 for (const d of waiting) {
  const b = d.bookingId ? data.bookings.find(r => r.id === d.bookingId) ?? null : null, f = b ? facts(data, env.AUTH_ORIGIN, b) : null
  const key = messageKey(data, d), history = data.messages.filter(m => m.id !== d.id && (b?m.bookingId===b.id:m.bookingId===null) && (m.direction === 'in' || m.status === 'sent') && messageKey(data, m) === key).sort((x, y) => (x.sentAt ?? x.createdAt).localeCompare(y.sentAt ?? y.createdAt)).map(m => ({ from: m.direction === 'in' ? 'guest' as const : 'host' as const, text: m.text }))
  let result: { text: string; grounds: string[]; detail: string | null; source: GuestMessage['source']; classification?: { confidence: number; topic: 'checkin' | 'checkout' | 'instructions' | 'other'; needsHost: boolean; instructionId: string | null } }
  try {
   if (!config) throw new DraftError('The saved AI key cannot be used on this install.')
   const r = await aiDraft(config, f, history, { db: env.DB, actor: { ...SYSTEM, id: 'cabin:ai-replies', isAgent: true }, kind: 'messages', id: d.id, revision: d.revision, propertyId: d.propertyId, bookingId: d.bookingId }, b ? replySources(data, env.AUTH_ORIGIN, b) : null)
   result = { text: r.text, grounds: r.grounds, detail: [r.needsHost ? 'Needs you: the facts do not settle this.' : '', r.note].filter(Boolean).join(' ') || null, source: 'ai', classification: { confidence: r.confidence, topic: r.topic, needsHost: r.needsHost, instructionId: r.instructionId } }
  } catch (error) {
   result = { text: '', grounds: [], detail: `AI draft failed: ${error instanceof DraftError ? error.message : 'unexpected error'} Write the reply here, or fix the AI settings before the next guest message.`, source: 'ai' }
  }
  await mutate(env.DB, SYSTEM, 'message.drafted', c => { const row = c.data.messages.find(m => m.id === d.id); if (!row || row.status !== 'drafting') return null; const { classification, ...fields } = result; Object.assign(row, { ...fields, status: 'draft', revision: newId() }); if (row.control && classification) Object.assign(row.control, classification); automaticReply(c, env.AUTH_ORIGIN, row); c.entityId = row.id; return row }).catch(() => null)
 }
}
