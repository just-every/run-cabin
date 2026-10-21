import type { Bindings } from '../../auth.server'
import { type Context, need } from '../model'
import { inboxSettings } from './settings'
import { route } from './deliver'
import type { Thread } from './threads'
/** Where a person's reply in this thread goes: the guest's latest channel, else the stay's own contact route. */
export async function replyTarget(env: Bindings, c: Context, t: Thread) {
 const today = c.now.slice(0, 10), b = [...t.stays].reverse().find(s => s.status === 'confirmed' && s.end.slice(0, 10) >= today) ?? t.stays[t.stays.length - 1] ?? null
 const last = [...t.messages].reverse().find(m => m.direction === 'in')
 const r = last && last.channel !== 'email' ? { channel: last.channel, email: null, phone: last.phone } : b ? await route(env, inboxSettings(c), b) : t.email ? { channel: 'email' as const, email: t.email, phone: null } : { unavailable: 'Cabin has no way to reach this guest yet.' }
 need(!('unavailable' in r), 'unavailable' in r ? r.unavailable : '', 409)
 return { b, last, r }
}
