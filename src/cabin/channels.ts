import { sharingAllowed, restorationPaused } from './connections/guard'
import type { Bindings } from '../auth.server'
import { type Actor, type Connection, need, fail, text, newId, manager, property, exact } from './model'
import { load, mutate, SYSTEM } from './storage'
import { parseCalendar } from './calendar-file'
import { applyChanges, channelBookings, reconcile } from './calendars'
import { channel, channelName } from './inventory'
// Live iCal both ways for channels Cabin has no partner API with yet (SYNC-009):
// each home polls its Airbnb, Vrbo and Booking.com export links on a schedule,
// applies stays and blocks, and keeps its last good nights when a fetch fails.
export const MANAGED_LINE = 'Live calendar links are not available yet on RER Managed hosting: it cannot reach Airbnb, Vrbo or Booking.com until RER adds a provider relay. They work on a self-hosted install; meanwhile paste a calendar file below.'
const FETCH_MS = 20_000, MAX_BYTES = 1_000_000, PER_RUN = 25

/** RER Managed relays mail through RER and sets an installation beside a remote management origin; it has no route out to providers yet. */
export function managedInstall(env: Bindings) {
 if (String(env.MAIL_PROVIDER) === 'rer') return true
 if (!env.RER_INSTALLATION_ID || !env.RER_MANAGEMENT_ORIGIN) return false
 try { return !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.RER_MANAGEMENT_ORIGIN).hostname) } catch { return true }
}
export function feedUrl(value: unknown) {
 const raw = text(value, 'calendar link', 2000); let url: URL
 try { url = new URL(raw) } catch { return fail('Paste the full calendar link, starting with https://') }
 need(url.protocol === 'https:', 'Use the https:// calendar link the channel gives you')
 need(!url.username && !url.password && !/^(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname), 'Use the channel’s public calendar link')
 return url.toString()
}
const later = (at: string, minutes: number) => new Date(Date.parse(at) + minutes * 60_000).toISOString()
async function fetchFeed(url: string): Promise<string> {
 let response: Response
 try { response = await fetch(url, { headers: { accept: 'text/calendar, text/plain;q=0.8', 'user-agent': 'Cabin calendar sync' }, redirect: 'manual', signal: AbortSignal.timeout(FETCH_MS) }) }
 catch (error) { return fail((error as Error)?.name === 'TimeoutError' ? `The channel did not answer within ${FETCH_MS / 1000} seconds` : 'Could not reach the channel. Check the link, then sync again.', 502) }
 need(response.ok, `The channel answered ${response.status}${response.status === 404 || response.status === 403 ? ': copy a fresh link from the channel' : ''}`, 502)
 need(Number(response.headers.get('content-length') ?? 0) <= MAX_BYTES, 'The calendar is larger than 1 MB', 502)
 const reader = response.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
 if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { await reader.cancel(); fail('The calendar is larger than 1 MB', 502) } chunks.push(value) }
 const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
 return new TextDecoder().decode(bytes)
}
/** Fetch first, then apply in one guarded commit. A failed fetch or parse marks the link stale and keeps every night it last held. */
export async function syncConnection(env: Bindings, actor: Actor, id: string) {
 const found = (await load(env.DB)).connections.find(r => r.id === id); need(found, 'Calendar link not found', 404)
 let body: string | null = null, error: string | null = null
 try { need(!found.restorePaused, 'Reconnect this restored calendar with a fresh link.', 409); await sharingAllowed(env.DB, 'calendars'); body = await fetchFeed(found.url) } catch (e) { error = (e as Error).message }
 return mutate(env.DB, actor, 'channel.sync', async c => {
  const row = c.data.connections.find(r => r.id === id); need(row, 'Calendar link not found', 404); property(c, row.propertyId)
  need(row.revision === found.revision, 'Calendar link changed while syncing. Sync the current link again.', 409)
  const before = row.status; Object.assign(row, { revision: newId(), lastAttemptAt: c.now, nextPollAt: later(c.now, row.intervalMinutes) })
  let changes = 0
  if (body !== null) {
   const old = channelBookings(c, row.propertyId, row.channel, row.channel === 'ical' ? row.id : undefined)
   try { const parsed = parseCalendar(body, old, { bytes: MAX_BYTES, events: 2000 }), events = row.channel === 'ical' ? parsed.map(e => ({ ...e, kind: 'block' as const, guestName: undefined, summary: row.name || 'External calendar block' })) : parsed, found = reconcile(old, events); applyChanges(c, row.propertyId, row.channel, found, row.channel === 'ical' ? row.id : undefined); changes = found.length; Object.assign(row, { status: 'ok', error: null, lastSuccessAt: c.now, events: events.filter(e => !e.cancelled).length }); if (changes) row.lastChangeAt = c.now; if (row.exception && !row.exception.resolvedAt) row.exception.resolvedAt = c.now }
   catch (e) { error = `The channel sent a calendar Cabin cannot read: ${(e as Error).message}` }
  }
  if (error) {
   Object.assign(row, { status: 'stale', error })
   if (!row.exception || row.exception.resolvedAt) row.exception = { id: newId(), assignedTo: row.createdBy, assignedName: row.createdBy, openedAt: c.now, resolvedAt: null }
   if (row.exception.assignedName === row.createdBy) { const owner = await c.db.prepare('SELECT display_name AS name FROM oa_operators WHERE id=?').bind(row.createdBy).first<{name:string}>(); row.exception.assignedName = owner?.name || 'Connection manager' }
  }
  c.entityId = row.id; return { connection: row, changes, statusChanged: before !== row.status }
 }, r => actor.role !== 'system' || r.changes > 0 || r.statusChanged)
}
/** The Worker's Cron: every link whose poll is due, oldest first, a bounded number per run. */
export async function syncDue(env: Bindings) {
 if (managedInstall(env) || await restorationPaused(env.DB)) return []
 const now = new Date().toISOString(), due = (await load(env.DB)).connections.filter(r => r.nextPollAt <= now).sort((a, b) => a.nextPollAt.localeCompare(b.nextPollAt)).slice(0, PER_RUN), results = []
 for (const row of due) {
  try { results.push(await syncConnection(env, SYSTEM, row.id)) }
  catch (error) { console.error('Calendar sync failed', row.id, (error as Error).message) }
 }
 return results
}
export async function channelCommand(env: Bindings, actor: Actor, name: string, p: Record<string, unknown>) {
 if (name === 'channel.connect' || name === 'channel.update') {
  manager(actor); need(!managedInstall(env), MANAGED_LINE, 409)
  const saved = await mutate(env.DB, actor, name, c => {
   const prop = property(c, p.propertyId), ch = p.channel === 'ical' ? 'ical' : channel(p.channel, false), interval = p.intervalMinutes === undefined || p.intervalMinutes === '' ? 15 : Number(p.intervalMinutes)
   need(Number.isInteger(interval) && interval >= 15 && interval <= 60, 'Sync every 15 to 60 minutes')
   const id = name === 'channel.update' ? text(p.id, 'calendar link ID') : ch === 'ical' ? newId() : `${prop.id}:${ch}`, old = c.data.connections.find(r => r.id === id)
   if (name === 'channel.update') { need(old && old.propertyId === prop.id && old.channel === ch, 'Calendar link not found', 404); exact(old, p.revision) }
   const row: Connection = { id, revision: newId(), propertyId: prop.id, channel: ch, url: feedUrl(p.url), intervalMinutes: interval, status: 'pending', error: null, lastAttemptAt: null, lastSuccessAt: old?.lastSuccessAt ?? null, lastChangeAt: old?.lastChangeAt ?? null, nextPollAt: c.now, events: old?.events ?? 0, createdBy: old?.createdBy || actor.id, ...(ch === 'ical' ? { name: text(p.name, 'calendar name', 100) } : {}), ...(old?.exception ? { exception: old.exception } : {}) }
   if (old) Object.assign(old, row); else c.data.connections.push(row)
   c.entityId = id; return row
  })
  return syncConnection(env, actor, saved.id)
 }
 if (name === 'channel.sync') { manager(actor); need(!managedInstall(env), MANAGED_LINE, 409); return syncConnection(env, actor, text(p.id, 'calendar link ID')) }
 if (name === 'channel.assign') {
  manager(actor)
  return mutate(env.DB, actor, name, async c => {
   const row = c.data.connections.find(r => r.id === text(p.id, 'calendar link ID')); need(row?.exception && !row.exception.resolvedAt, 'Open sync exception not found', 404)
   const assignee = text(p.assignedTo, 'responsible manager')
   const operator = await c.db.prepare("SELECT id,display_name AS name FROM oa_operators WHERE id=? AND status='active' AND role='owner'").bind(assignee).first<{id:string;name:string}>()
   const member = c.data.members.find(m => m.id === assignee && m.active && m.role === 'manager')
   need(operator || member, 'Choose the installation owner or an active manager')
   Object.assign(row.exception, { assignedTo: assignee, assignedName: operator?.name || member!.name }); row.revision = newId(); c.entityId = row.id; return row
  })
 }
 if (name === 'channel.disconnect') {
  manager(actor)
  return mutate(env.DB, actor, name, c => {
   const id = text(p.id, 'calendar link ID'), at = c.data.connections.findIndex(r => r.id === id); need(at >= 0, 'Calendar link not found', 404)
   const [row] = c.data.connections.splice(at, 1); c.queries.push({ sql: "DELETE FROM cb_records WHERE kind='connections' AND id=?", params: [id] }); c.entityId = id
   return { id, disconnected: true, channel: channelName(row.channel) }
  })
 }
 return fail('Unknown command', 404)
}
