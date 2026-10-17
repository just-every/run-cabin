// Demo data for `rer demo` and the hosted demo (modules/demo runs it once, after
// the owner exists): Blue Ridge Getaways, a dozen rentals with imported Airbnb
// and Booking.com calendars, stays from three weeks back to four weeks ahead,
// photographed turnovers done, assigned and waiting for approval, owner
// statements approved and in draft, and calendar reviews waiting for a person.
// Every record is made by Cabin's own commands (calendar parsing and clash
// checks, the approval fences, photo validation, the statement fee maths) run as
// the person who would have done it, at the time they would have done it. The
// rows are then written with fixed ids and ON CONFLICT DO NOTHING, so a repeat
// is a no-op. Nothing is fetched or sent.
import type { Bindings } from './auth.server'
import type { Actor, Booking, CalendarDraft, Context, Data, StatementLine } from './cabin/model'
import { load } from './cabin/storage'
import { calendarBaseline, calendarCommand } from './cabin/calendars'
import { turnoverCommand } from './cabin/turnovers'
import { statementCommand } from './cabin/statements'
import { peopleCommand } from './cabin/people'
import { sha } from './cabin/model'
import { captions, cleaners, homes, members, type DemoHome } from './cabin/demo/portfolio'
import { DAY, calendarFile, channelUid, opening, plan, random, type Stay } from './cabin/demo/stays'
import { base64, roomPhoto } from './cabin/demo/photos'
import { monthLines } from './cabin/demo/ledger'

const HOUR = 3_600_000, MIN = 60_000
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
type Handler = (c: Context, name: string, input: Record<string, unknown>) => Promise<any>

export async function seedDemo(env: Bindings, { ownerEmail, now: seededAt }: { ownerEmail: string; now: Date }) {
  const db = env.DB, now = seededAt.getTime(), today = Math.floor(now / DAY)
  if (await db.prepare('SELECT 1 FROM cb_properties WHERE id=?').bind(homes[0].id).first()) return
  const operator = await db.prepare("SELECT id,version FROM oa_operators WHERE lower(email)=lower(?) AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string; version: number }>()
  if (!operator) throw new Error('The demo rentals need their owner first')
  const person = (id: string, role: Actor['role'], email: string): Actor => ({ id, email, role, isAgent: role === 'agent', memberId: role === 'manager' || role === 'cleaner' ? id : undefined, operatorVersion: operator.version, ...(role === 'agent' ? { keyId: 'demo-agent-key' } : {}) })
  const owner = person(operator.id, 'owner', ownerEmail.toLowerCase()), agent = person(operator.id, 'agent', ownerEmail.toLowerCase())
  const dana = person('demo-member-dana', 'manager', members[0].email)
  const cleanerOf = (home: DemoHome) => { const m = cleaners[homes.indexOf(home) % cleaners.length]; return person(m.id, 'cleaner', m.email) }

  // Cabin's commands run against an in-memory copy of the (empty) workspace, as the
  // person who would have acted and at that moment; their rows are written below.
  const before = await load(db), c: Context = { db, actor: owner, before, data: structuredClone(before), queries: [], now: '', entityId: null }
  const events: { actor: Actor; at: number; name: string; entityId: string | null }[] = [], fixed = new Map<string, string>([[operator.id, operator.id]])
  const run = async (actor: Actor, at: number, handler: Handler, name: string, input: Record<string, unknown>) => {
    c.actor = actor; c.now = new Date(Math.min(at, now - MIN)).toISOString(); c.entityId = null
    const result = await handler(c, name, input)
    events.push({ actor, at: Math.min(at, now - MIN), name, entityId: c.entityId }); return result
  }

  // The portfolio and the team, set up months ago.
  for (const [i, home] of homes.entries()) {
    const row = await run(owner, now - 140 * DAY + i * 3 * HOUR, peopleCommand, 'property.save', { name: home.name, ownerName: home.ownerName, ownerEmail: home.ownerEmail, commissionBps: home.commissionBps })
    fixed.set(row.id, home.id); c.data.properties.push({ ...row, id: home.id })
  }
  for (const [i, m] of members.entries()) {
    const row = await run(owner, now - 120 * DAY + i * DAY, peopleCommand, 'member.save', { name: m.name, email: m.email, role: m.role, active: m.active })
    fixed.set(row.id, m.id); c.data.members.push({ ...row, id: m.id })
  }
  c.queries = []

  // Two calendar imports per channel feed: one about four weeks ago, and the latest
  // in the last day or so (one feed is going stale), each reviewed and approved.
  const stays = plan(today), early = today + 3
  const feeds = homes.flatMap(home => (['airbnb', 'booking.com'] as const).map(channel => ({ home, channel, stays: stays.filter(s => s.home === home && s.channel === channel) }))).filter(f => f.stays.length)
  const approvedAt = new Map<string, number>()
  for (const [round, start] of [[0, now - 27 * DAY], [1, now - 30 * HOUR]] as const) {
    for (const [i, feed] of feeds.entries()) {
      const included = round ? feed.stays : feed.stays.filter(s => s.start < early)
      if (!included.length) continue
      const imported = feed.home.id === 'demo-home-weaverville' && round ? now - 9 * DAY : start + i * 47 * MIN
      const preparer = i % 3 === 0 ? agent : i % 3 === 1 ? dana : owner, approver = preparer === dana ? owner : dana
      const draft: CalendarDraft = await run(preparer, imported, calendarCommand, 'calendar.prepare', { propertyId: feed.home.id, channel: feed.channel, calendar: calendarFile(feed.channel, included, imported) })
      const approved = imported + (20 + (i * 17) % 70) * MIN
      await run(approver, approved, calendarCommand, 'calendar.approve', { id: draft.id, revision: draft.revision })
      for (const s of included) approvedAt.set(s.uid, Math.min(approvedAt.get(s.uid) ?? Infinity, approved))
    }
  }

  // Turnovers for checkouts from two weeks ago to twelve days ahead: done with a
  // photo, approved and assigned, or prepared and waiting for approval.
  const photos = new Map<number, string>(), bookingOf = (s: Stay): Booking => c.data.bookings.find(b => b.propertyId === s.home.id && b.uid === s.uid)!
  const due = stays.filter(s => s.end >= today - 14 && s.end <= today + 12).sort((a, b) => a.end - b.end || a.home.name.localeCompare(b.home.name))
  for (const [i, s] of due.entries()) {
    const booking = bookingOf(s), cleaner = cleanerOf(s.home), finished = s.end * DAY + 19 * HOUR + (i % 5) * 25 * MIN
    const preparedAt = Math.max(approvedAt.get(s.uid)! + 40 * MIN, s.end * DAY - 3 * DAY + 14 * HOUR)
    if (s.end > today + 6 && i % 2) continue
    const row = await run(i % 4 === 0 ? agent : dana, Math.min(preparedAt, now - 2 * HOUR), turnoverCommand, 'turnover.prepare', { bookingId: booking.id, cleanerId: cleaner.id, checklist: s.home.checklist })
    if (s.end > today + 6) continue
    await run(i % 3 === 0 ? owner : dana, Math.min(preparedAt + 2 * HOUR, now - HOUR), turnoverCommand, 'turnover.approve', { id: row.id, revision: row.revision })
    if (finished >= now) continue
    const variant = (homes.indexOf(s.home) + i) % 8
    if (!photos.has(variant)) photos.set(variant, base64(await roomPhoto(variant)))
    const options = captions.filter(text => s.home.hotTub || !text.includes('Hot tub'))
    await run(cleaner, finished, turnoverCommand, 'turnover.complete', { id: row.id, revision: row.revision, checks: s.home.checklist, photo: photos.get(variant), mimeType: 'image/png', caption: options[i % options.length] })
  }

  // Owner statements: the month before last approved, last month approved or in review.
  const month = (back: number) => { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return { key: d.toISOString().slice(0, 7), next: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) } }
  for (const back of [2, 1]) {
    const { key, next } = month(back)
    for (const [i, home] of homes.entries()) {
      const prepared = next + DAY + 9 * HOUR + i * 20 * MIN, lines: StatementLine[] = monthLines(home, key, i + back * 5)
      if (prepared >= now - HOUR) continue
      const row = await run(i % 2 ? agent : dana, prepared, statementCommand, 'statement.prepare', { propertyId: home.id, month: key, lines })
      const approve = prepared + DAY + 2 * HOUR + i * 15 * MIN
      if (back === 1 && (i % 3 === 2 || approve >= now - HOUR)) continue
      await run(i % 2 ? dana : owner, approve, statementCommand, 'statement.approve', { id: row.id, revision: row.revision })
    }
  }

  // Calendar reviews waiting today: new stays, a Booking.com stay that clashes with
  // an Airbnb one, and a cancellation.
  const feedOf = (id: string, channel: Stay['channel']) => stays.filter(s => s.home.id === id && s.channel === channel)
  const laurel = homes.find(h => h.id === 'demo-home-laurel-ridge')!, firefly = homes.find(h => h.id === 'demo-home-firefly')!, lake = homes.find(h => h.id === 'demo-home-lake-lure')!
  const added = [opening(stays, laurel, today + 6, 3)], second = opening([...stays, { home: laurel, start: added[0], end: added[0] + 3 } as Stay], laurel, added[0] + 3, 2)
  await run(agent, now - 50 * MIN, calendarCommand, 'calendar.prepare', { propertyId: laurel.id, channel: 'airbnb', calendar: calendarFile('airbnb', [...feedOf(laurel.id, 'airbnb'), { uid: channelUid('airbnb', random(101)), start: added[0], end: added[0] + 3, summary: 'Lauren Price · 4 guests' }, { uid: channelUid('airbnb', random(102)), start: second, end: second + 2, summary: 'Andre Lewis · 2 guests' }], now - 50 * MIN) })
  const overlap = stays.find(s => s.home === firefly && s.channel === 'airbnb' && s.start > today + 4) ?? stays.filter(s => s.home === firefly).at(-1)!
  await run(dana, now - 35 * MIN, calendarCommand, 'calendar.prepare', { propertyId: firefly.id, channel: 'booking.com', calendar: calendarFile('booking.com', [...feedOf(firefly.id, 'booking.com'), { uid: channelUid('booking.com', random(103)), start: overlap.start + 1, end: overlap.start + 4, summary: 'Megan Foley · 3 guests' }], now - 35 * MIN) })
  const lakeFeed = feedOf(lake.id, 'airbnb'), dropped = lakeFeed.find(s => s.start > today + 12) ?? lakeFeed[lakeFeed.length - 1]
  await run(dana, now - 20 * MIN, calendarCommand, 'calendar.prepare', { propertyId: lake.id, channel: 'airbnb', calendar: calendarFile('airbnb', lakeFeed.map(s => s === dropped ? { ...s, cancelled: true } : s), now - 20 * MIN) })

  // Fixed, readable ids for every record the commands made.
  const name = (prefix: string, rows: { id: string }[]) => rows.forEach((row, i) => fixed.set(row.id, `demo-${prefix}-${i + 1}`))
  name('stay', c.data.bookings); name('calendar-review', c.data.calendarDrafts); name('turnover', c.data.turnovers); name('statement', c.data.statements); name('approval', c.data.approvals)
  name('photo', c.data.turnovers.flatMap(t => t.completion ? [{ id: t.completion.photoId }] : []))
  let revision = 0
  const remap = (text: string) => text.replace(uuid, id => { if (!fixed.has(id)) fixed.set(id, `demo-rev-${++revision}`); return fixed.get(id)! })
  const data: Data = JSON.parse(remap(JSON.stringify(c.data)))
  for (const draft of data.calendarDrafts) if (draft.status === 'draft') draft.baseline = await calendarBaseline({ ...c, data }, draft.propertyId)

  const q = (sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values)
  const at = (ms: number) => new Date(ms).toISOString()
  await db.batch([
    q('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING', operator.id, now - 140 * DAY),
    ...data.properties.map(p => q('INSERT INTO cb_properties(id,name,owner_name,owner_email,commission_bps,version) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', p.id, p.name, p.ownerName, p.ownerEmail, p.commissionBps, p.revision)),
    ...data.members.map(m => q('INSERT INTO cb_members(id,name,email,role,active,version) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', m.id, m.name, m.email, m.role, m.active ? 1 : 0, m.revision)),
    ...(['feeds', 'calendarDrafts', 'bookings', 'turnovers', 'statements'] as const).flatMap(kind => (data[kind] as { id: string; revision?: string }[]).map(row => q('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT DO NOTHING', kind, row.id, row.revision ?? row.id, JSON.stringify(row)))),
    ...data.approvals.map(a => q('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', a.id, a.kind, a.recordId, a.revision, a.actorId, a.at)),
    ...c.queries.map(({ sql, params }) => { need(sql.startsWith('INSERT INTO cb_photos(')); return q(sql + ' ON CONFLICT DO NOTHING', ...params.map(v => typeof v === 'string' ? remap(v) : v)) }),
    ...events.map((e, i) => q('INSERT INTO cb_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', `demo-event-${i + 1}`, e.actor.id, e.actor.role, e.name, e.entityId && remap(e.entityId), at(e.at))),
    q('INSERT INTO cb_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING', 'demo-agent-key', operator.id, operator.version, 'Monthly statement assistant', await sha('demo-agent-key:' + crypto.randomUUID()), now - 12 * DAY, now + 18 * DAY),
    q('INSERT INTO cb_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING', 'demo-agent-key-old', operator.id, operator.version, 'Calendar sync script (old laptop)', await sha('demo-agent-key-old:' + crypto.randomUUID()), now - 75 * DAY, now - 45 * DAY, now - 52 * DAY),
    q('UPDATE cb_meta SET version=version+1 WHERE id=1'),
  ])
}

function need(condition: boolean): asserts condition { if (!condition) throw new Error('The demo writes only turnover photos from command queries') }
