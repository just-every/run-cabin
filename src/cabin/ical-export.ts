import { sharingAllowed } from './connections/guard'
import type { Bindings } from '../auth.server'
import { type Booking, type Context, type ExportFeed, manager, newId, property } from './model'
import { nights } from './inventory'
// Each home publishes one secret link per channel. A channel's link lists every
// night Cabin holds except that channel's own stays, so a stay cancelled on the
// channel is never held open by its own echo. Guest details never leave Cabin.
export const EXPORT_SLUGS = { airbnb: 'airbnb', vrbo: 'vrbo', 'booking.com': 'booking-com', all: 'all' } as const
const FROM_SLUG: Record<string, string | null> = { airbnb: 'airbnb', vrbo: 'vrbo', 'booking-com': 'booking.com', all: null }
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
export const exportPath = (feed: { token: string }, slug: string) => `/ical/${feed.token}/${slug}.ics`
export async function exportCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'export.publish') return undefined
 manager(c.actor); const prop = property(c, p.propertyId), old = c.data.exports.find(e => e.propertyId === prop.id)
 const row: ExportFeed = { id: old?.id ?? newId(), revision: newId(), propertyId: prop.id, token: token(), createdAt: c.now, createdBy: c.actor.id }
 if (old) Object.assign(old, row); else c.data.exports.push(row)
 c.entityId = row.id; return row
}
const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
export function calendarExport(bookings: Booking[], now: string) {
 const today = now.slice(0, 10), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cabin//Calendar export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
 for (const b of bookings) {
  const n = nights(b); if (n.checkout <= today || n.first >= n.checkout) continue
  lines.push('BEGIN:VEVENT', `UID:${b.id}@cabin`, `DTSTAMP:${stamp(now)}`, `DTSTART;VALUE=DATE:${n.first.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${n.checkout.replace(/-/g, '')}`, 'SUMMARY:Not available', 'END:VEVENT')
 }
 return [...lines, 'END:VCALENDAR', ''].join('\r\n')
}
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow' }
/** Public by its secret: channels fetch it without a session. */
export async function icalExportResponse(request: Request, env: Bindings): Promise<Response | null> {
 const match = new URL(request.url).pathname.match(/^\/ical\/([0-9a-f]{64})\/(airbnb|vrbo|booking-com|all)\.ics$/)
 if (!match) return new Response('Not found', { status: 404, headers })
 if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { ...headers, allow: 'GET, HEAD' } })
 const feed = await env.DB.prepare("SELECT data FROM cb_records WHERE kind='exports' AND json_extract(data,'$.token')=?").bind(match[1]).first<{ data: string }>()
 if (!feed) return new Response('Not found', { status: 404, headers })
 const { propertyId } = JSON.parse(feed.data) as ExportFeed
 try { await sharingAllowed(env.DB, 'calendars','calendar:publish',propertyId) } catch { return new Response('Calendar sharing is disconnected', { status: 503, headers }) }
 const skip = FROM_SLUG[match[2]]
 const rows = (await env.DB.prepare("SELECT data FROM cb_records WHERE kind='bookings' AND json_extract(data,'$.propertyId')=?").bind(propertyId).all<{ data: string }>()).results
 const held = rows.map(r => JSON.parse(r.data) as Booking).filter(b => b.status === 'confirmed' && b.channel !== skip).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
 const body = calendarExport(held, new Date().toISOString())
 return new Response(request.method === 'HEAD' ? null : body, { headers: { ...headers, 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="cabin.ics"' } })
}
