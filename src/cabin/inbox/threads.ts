import type { Booking, Data, GuestMessage, Scheduled } from '../model'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { guestRoot } from '../guests/resolve'
import type { GuestData } from '../guests/types'
// Reviewed guest links determine shared history. Unlinked contacts never merge profiles.
export const emailOf = (value: unknown) => { const v = String(value ?? '').trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) && v.length <= 254 ? v : null }
/** US numbers to E.164; other numbers must already start with +. */
export function phoneOf(value: unknown) {
 const raw = String(value ?? '').trim(); if (!raw) return null
 const digits = raw.replace(/\D/g, '')
 const e164 = raw.startsWith('+') ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : null
 return e164 && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null
}
const isStay = (b: Booking) => (b.kind ?? 'stay') === 'stay'
export const guestKey = (b: Booking,data?:Partial<GuestData>) => { const origin=data?.guests?.find(g=>g.bookingId===b.id&&!g.erasedAt); return origin ? `g:${guestRoot(data??{},origin.id)?.id??origin.id}` : `b:${b.id}` }
/** The stay a guest's message is about: their current or next stay, else their latest one. A stay is over once its home's check-out time passes, so on a changeover day the stay that starts wins over the one that just ended. */
export function stayFor(data: Pick<Data, 'bookings' | 'homeSettings'> & Partial<GuestData>, who: { email?: string | null; phone?: string | null; bookingId?: string | null }, now = Date.now()) {
 if (who.bookingId) return data.bookings.find(b => b.id === who.bookingId) ?? null
 const mine = data.bookings.filter(b => isStay(b) && ((who.email && b.guestEmail === who.email) || (who.phone && b.guestPhone === who.phone)))
 const roots=new Set(mine.map(b=>guestKey(b,data)));if(roots.size>1)return null
 const live = mine.filter(b => b.status === 'confirmed'), pool = live.length ? live : mine
 const checkout = (b: Booking) => { const s = homeSettings(data, b.propertyId); return instant(`${b.end.slice(0, 10)}T${b.departureTime ?? s.checkOutTime}`, s.timeZone) }
 const ahead = pool.filter(b => checkout(b) > now).sort((a, b) => a.start.localeCompare(b.start))
 return ahead[0] ?? pool.sort((a, b) => b.end.localeCompare(a.end))[0] ?? null
}
export function messageKey(data: Pick<Data, 'bookings'> & Partial<GuestData>, m: Pick<GuestMessage, 'bookingId' | 'email' | 'phone' | 'ref'>) {
 const b = m.bookingId ? data.bookings.find(r => r.id === m.bookingId) : null
 if (b) return guestKey(b,data)
 return m.email ? `e:${m.email}` : m.phone ? `p:${m.phone}` : `r:${m.ref ?? 'unknown'}`
}
/** A short stable id for a thread key, safe in a URL. */
export function threadId(key: string) { let x = 0x811c9dc5; for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0 } return 't' + x.toString(36) }
export interface Thread { id: string; key: string; name: string; email: string | null; phone: string | null; stays: Booking[]; messages: GuestMessage[]; scheduled: Scheduled[]; drafts: number; lastAt: string }
export function threads(data: Pick<Data, 'bookings' | 'messages' | 'scheduled'> & Partial<GuestData>): Thread[] {
 const all = new Map<string, Thread>()
 const thread = (key: string) => { let t = all.get(key); if (!t) { t = { id: threadId(key), key, name: '', email: key.startsWith('e:') ? key.slice(2) : null, phone: key.startsWith('p:') ? key.slice(2) : null, stays: [], messages: [], scheduled: [], drafts: 0, lastAt: '' }; all.set(key, t) } return t }
 const stays = new Map(data.bookings.filter(isStay).map(b => [b.id, b]))
 for (const s of data.scheduled) { const b = stays.get(s.bookingId); if (b) thread(guestKey(b,data)).scheduled.push(s) }
 for (const m of data.messages) { if (m.status === 'discarded') continue; const t = thread(messageKey(data, m)); t.messages.push(m); if (m.status === 'draft' || m.status === 'drafting') t.drafts++ }
 for (const b of stays.values()) { const t = thread(guestKey(b,data)); t.stays.push(b) }
 for (const t of all.values()) {
  t.stays.sort((a, b) => a.start.localeCompare(b.start)); t.messages.sort((a, b) => (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt))
  const named = [...t.stays].reverse().find(b => b.guestName)
  const first = t.stays[0], channel = first ? ({ airbnb: 'Airbnb', vrbo: 'Vrbo', 'booking.com': 'Booking.com', direct: 'Direct' } as Record<string, string>)[first.channel] : ''
  t.name = named?.guestName ?? (t.email ? t.email.split('@')[0] : t.phone ?? (first?.summary && !/^(reserved|not available|blocked)/i.test(first.summary) ? first.summary : `${channel} guest`.trim()))
  t.email ??= t.stays.find(b => b.guestEmail)?.guestEmail ?? null
  t.phone ??= t.stays.find(b => b.guestPhone)?.guestPhone ?? null
  t.lastAt = [...t.messages.map(m => m.sentAt ?? m.createdAt), ...t.scheduled.filter(s => s.sentAt).map(s => s.sentAt!), ...t.stays.map(b => b.approvedAt)].sort().pop() ?? ''
 }
 return [...all.values()].sort((a, b) => (b.drafts ? 1 : 0) - (a.drafts ? 1 : 0) || b.lastAt.localeCompare(a.lastAt))
}
