import type { Bindings } from '../../auth.server'
import { type Context, type GuestMessage, newId } from '../model'
import { load, mutate, SYSTEM } from '../storage'
import { facts, fill, type Facts } from './render'
import { inboxSettings } from './settings'
import { aiDraft, aiKey, DraftError } from './ai'
import { messageKey } from './threads'
// Every guest message gets a drafted reply that waits in the thread for a
// person: from the install's AI key when one is saved, else from a template
// picked by what the guest asked. Nothing is sent until someone sends it.
const TEMPLATES = {
 access: 'Hi {guest},\n\nThanks for your message. Check-in at {home} is {checkin}.\n\nAddress: {address}\nDoor code: {code}\n\nYour stay page has the code and directions: {stay_link}',
 checkout: 'Hi {guest},\n\nCheck-out from {home} is {checkout}. I will check whether anything else is possible and let you know.',
 other: 'Hi {guest},\n\nThanks for your message about your stay at {home}. I will get back to you shortly.',
}
export function templateDraft(f: Facts | null, question: string) {
 if (!f) return { text: 'Hi,\n\nThanks for your message. I will get back to you shortly.', grounds: [] as string[] }
 const kind = /\b(code|door|lock|key|keys|get in|check.?in|arriv\w*|address|directions)\b/i.test(question) ? 'access' : /\b(check.?out|late|leave|leaving|depart\w*)\b/i.test(question) ? 'checkout' : 'other'
 return { text: fill(TEMPLATES[kind], f), grounds: kind === 'access' ? ['check-in time', 'address', 'door code', 'stay page'] : kind === 'checkout' ? ['check-out time'] : ['stay dates'] }
}
/** Writes the waiting draft for a guest message in the same commit; an AI draft starts as 'drafting' and is filled in after it. */
export function startDraft(c: Context, origin: string, inbound: GuestMessage, ai: boolean) {
 const b = inbound.bookingId ? c.data.bookings.find(r => r.id === inbound.bookingId) : null, f = b ? facts(c.data, origin, b) : null
 const base = templateDraft(f, inbound.text)
 for (const old of c.data.messages) if (old.status === 'draft' && messageKey(c.data, old) === messageKey(c.data, inbound)) Object.assign(old, { status: 'discarded', detail: 'Replaced by a draft for the newer message', revision: newId() })
 const draft: GuestMessage = { ...inbound, id: newId(), revision: newId(), direction: 'out', source: ai ? 'ai' : 'template', status: ai ? 'drafting' : 'draft', subject: inbound.subject ? (/^re:/i.test(inbound.subject) ? inbound.subject : `Re: ${inbound.subject}`) : `Your stay at ${f?.home ?? 'our home'}`, text: ai ? '' : base.text, detail: null, replyTo: inbound.id, headerId: null, sentBy: null, approvalId: null, scheduledId: null, providerId: null, grounds: ai ? [] : base.grounds, createdAt: c.now, sentAt: null }
 c.data.messages.push(draft); return draft
}
/** Fills AI drafts after their commit. A failed call leaves the template reply with the reason beside it. */
export async function finishDrafts(env: Bindings) {
 const data = await load(env.DB), waiting = data.messages.filter(m => m.status === 'drafting').slice(0, 5)
 if (!waiting.length) return
 const config = await aiKey(env, inboxSettings(data))
 for (const d of waiting) {
  const b = d.bookingId ? data.bookings.find(r => r.id === d.bookingId) ?? null : null, f = b ? facts(data, env.AUTH_ORIGIN, b) : null
  const key = messageKey(data, d), history = data.messages.filter(m => m.id !== d.id && (m.direction === 'in' || m.status === 'sent') && messageKey(data, m) === key).sort((x, y) => (x.sentAt ?? x.createdAt).localeCompare(y.sentAt ?? y.createdAt)).map(m => ({ from: m.direction === 'in' ? 'guest' as const : 'host' as const, text: m.text }))
  const asked = data.messages.find(m => m.id === d.replyTo)?.text ?? ''
  let result: { text: string; grounds: string[]; detail: string | null; source: GuestMessage['source'] }
  try {
   if (!config) throw new DraftError('The saved AI key cannot be used on this install.')
   const r = await aiDraft(config, f, history)
   result = { text: r.text, grounds: r.grounds, detail: [r.needsHost ? 'Needs you: the facts do not settle this.' : '', r.note].filter(Boolean).join(' ') || null, source: 'ai' }
  } catch (error) {
   const t = templateDraft(f, asked)
   result = { text: t.text, grounds: t.grounds, detail: `AI draft failed: ${error instanceof DraftError ? error.message : 'unexpected error'} This is the template reply.`, source: 'template' }
  }
  await mutate(env.DB, SYSTEM, 'message.drafted', c => { const row = c.data.messages.find(m => m.id === d.id); if (!row || row.status !== 'drafting') return null; Object.assign(row, { ...result, status: 'draft', revision: newId() }); c.entityId = row.id; return row }).catch(() => null)
 }
}
