// Demo data for `rer demo` and the hosted demo (modules/demo runs it once, after
// the owner exists): Blue Ridge Getaways, a dozen rentals with their addresses,
// times and default cleaners, imported Airbnb and Booking.com calendars written
// as those channels write them (Airbnb names every stay "Reserved", Booking.com
// sends "CLOSED - Not available"), Vrbo and direct stays taken as requests with
// the guest's name, guest names the manager added to upcoming Airbnb stays, a
// Vrbo request Cabin declined because it overlaps an Airbnb stay, stays from
// three weeks back to four weeks ahead, photographed turnovers done, assigned and
// waiting for approval, owner statements approved and in draft, calendar reviews
// waiting for a person, and guests' questions with drafted replies.
// Every record is made by Cabin's own commands (calendar parsing and clash
// checks, the approval fences, photo validation, the statement fee maths) run as
// the person who would have done it, at the time they would have done it. The
// rows are then written with fixed ids and ON CONFLICT DO NOTHING, so a repeat
// is a no-op. Nothing is fetched or sent. The seed ends as every commit does:
// dispatch issues door codes and turnovers, and guest messages are scheduled.
import type { Bindings } from './auth.server'
import { type Actor, type Booking, type CalendarDraft, type Context, type Data, type GuestMessage, type Request, type StatementLine, kinds, newId } from './cabin/model'
import { load } from './cabin/storage'
import { reservationCommand } from './cabin/inventory'
import { homeCommand } from './cabin/homes'
import { configure } from './cabin/direct/rules'
import { dispatch } from './cabin/dispatch'
import { scheduleMessages } from './cabin/inbox/schedule'
import { stayFor } from './cabin/inbox/threads'
import { startDraft } from './cabin/inbox/drafts'
import { INBOX_SYSTEM } from './cabin/inbox/inbound'
import { calendarBaseline, calendarCommand } from './cabin/calendars'
import { turnoverCommand } from './cabin/turnovers'
import { statementCommand } from './cabin/statements'
import { peopleCommand } from './cabin/people'
import { sha } from './cabin/model'
import { captions, cleaners, homes, members, type DemoHome } from './cabin/demo/portfolio'
import { DAY, FEED_SUMMARY, calendarFile, channelUid, date, opening, plan, random, type Stay } from './cabin/demo/stays'
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
  // Each home's address, times and default cleaner, and its direct nightly rate
  // (the direct booking page is set up but not published).
  for (const [i, home] of homes.entries()) await run(owner, now - 110 * DAY + i * HOUR, homeCommand, 'home.settings', { propertyId: home.id, address: home.address, timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: '10:00', cleanerId: cleanerOf(home).id, checklist: home.checklist, photosRequired: 1 })
  const direct = homes.map(home => configure({ enabled: false, slug: home.id.replace(/^demo-home-/, ''), description: `${home.name} in ${home.address.split(', ').slice(-2, -1)[0]}, North Carolina.`, nightlyDollars: home.nightly, cleaningDollars: home.cleaning, extraGuestCents: 0, includedGuests: 4, maxGuests: 6, minNights: 2, maxNights: 14, minGapNights: 0, depositCents: 0, releaseHours: 48, taxLabel: 'North Carolina', taxBps: 475, countyTaxLabel: '', countyTaxBps: 0, agreement: `Rental agreement for ${home.name}. Check-in is at 4 pm and check-out at 10 am. Up to 6 guests. No smoking and no parties. Quiet hours are 10 pm to 8 am. The guest is responsible for damage beyond normal wear.` }, home.id))
  c.queries = []

  // Two calendar imports per channel feed: one about four weeks ago, and the latest
  // in the last day or so (one feed is going stale), each reviewed and approved.
  const stays = plan(today), early = today + 3
  const firefly = homes.find(h => h.id === 'demo-home-firefly')!
  // Firefly Hollow's next Vrbo stay is the one a new Airbnb reservation clashes with below.
  const pivot = stays.find(s => s.home === firefly && s.start > today + 4)!
  if (pivot.source === 'feed') Object.assign(pivot, { channel: 'vrbo', source: 'request', summary: pivot.guest })
  const feeds = homes.flatMap(home => (['airbnb', 'booking.com'] as const).map(channel => ({ home, channel, stays: stays.filter(s => s.home === home && s.channel === channel) }))).filter(f => f.stays.length)
  // Vrbo and direct (phone and email) stays, each taken as a request when the guest booked.
  const bookingIds = new Map<Stay, string>(), requestedAt = new Map<Stay, number>()
  for (const [i, s] of stays.filter(s => s.source === 'request').entries()) {
    const at = Math.max(now - 70 * DAY, s.start * DAY - (12 + (i * 7) % 30) * DAY) + 9 * HOUR + (i % 6) * 47 * MIN
    const contact = s.channel === 'direct' ? { guestEmail: `${s.guest.toLowerCase().replace(/^the /, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.com` } : { guestPhone: `828-555-01${String(10 + i).slice(-2)}` }
    const row: Request = await run(i % 2 ? dana : owner, at, reservationCommand, 'reservation.request', { propertyId: s.home.id, channel: s.channel, kind: 'stay', guestName: s.guest, start: date(s.start), end: date(s.end), ...contact })
    if (!row.bookingId) throw new Error(`The demo's ${s.channel} stay at ${s.home.name} overlaps another stay`)
    bookingIds.set(s, row.bookingId); requestedAt.set(s, at)
  }
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
  const photos = new Map<number, string>(), bookingOf = (s: Stay): Booking => c.data.bookings.find(b => bookingIds.has(s) ? b.id === bookingIds.get(s) : b.propertyId === s.home.id && b.uid === s.uid)!
  // Airbnb's calendar names no guest: for most upcoming Airbnb stays the manager
  // copied the guest's name and phone from the Airbnb app into Cabin.
  for (const [i, s] of stays.filter(s => s.channel === 'airbnb' && s.start >= today - 3 && s.start <= today + 24).entries()) {
    if (i % 4 === 3) continue
    await run(dana, Math.min(approvedAt.get(s.uid)! + 3 * HOUR, now - 2 * HOUR), reservationCommand, 'booking.details', { id: bookingOf(s).id, guestName: s.guest, guestPhone: `828-555-02${String(10 + i).slice(-2)}` })
  }
  // Booking.com's calendar closes nights without saying whether a guest booked
  // them, so Cabin keeps them as blocks and prepares no turnover for them.
  const due = stays.filter(s => s.channel !== 'booking.com' && s.end >= today - 14 && s.end <= today + 12).sort((a, b) => a.end - b.end || a.home.name.localeCompare(b.home.name))
  for (const [i, s] of due.entries()) {
    const booking = bookingOf(s), cleaner = cleanerOf(s.home), finished = s.end * DAY + 19 * HOUR + (i % 5) * 25 * MIN
    const preparedAt = Math.max((approvedAt.get(s.uid) ?? requestedAt.get(s)!) + 40 * MIN, s.end * DAY - 3 * DAY + 14 * HOUR)
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
  const laurel = homes.find(h => h.id === 'demo-home-laurel-ridge')!, lake = homes.find(h => h.id === 'demo-home-lake-lure')!
  const added = [opening(stays, laurel, today + 6, 3)], second = opening([...stays, { home: laurel, start: added[0], end: added[0] + 3 } as Stay], laurel, added[0] + 3, 2)
  await run(agent, now - 50 * MIN, calendarCommand, 'calendar.prepare', { propertyId: laurel.id, channel: 'airbnb', calendar: calendarFile('airbnb', [...feedOf(laurel.id, 'airbnb'), { uid: channelUid('airbnb', random(101)), start: added[0], end: added[0] + 3, summary: FEED_SUMMARY.airbnb! }, { uid: channelUid('airbnb', random(102)), start: second, end: second + 2, summary: FEED_SUMMARY.airbnb! }], now - 50 * MIN) })
  await run(dana, now - 35 * MIN, calendarCommand, 'calendar.prepare', { propertyId: firefly.id, channel: 'airbnb', calendar: calendarFile('airbnb', [...feedOf(firefly.id, 'airbnb'), { uid: channelUid('airbnb', random(103)), start: pivot.start + 1, end: pivot.start + 4, summary: FEED_SUMMARY.airbnb! }], now - 35 * MIN) })
  const lakeFeed = feedOf(lake.id, 'airbnb'), dropped = lakeFeed.find(s => s.start > today + 12) ?? lakeFeed[lakeFeed.length - 1]
  await run(dana, now - 20 * MIN, calendarCommand, 'calendar.prepare', { propertyId: lake.id, channel: 'airbnb', calendar: calendarFile('airbnb', lakeFeed.map(s => s === dropped ? { ...s, cancelled: true } : s), now - 20 * MIN) })

  // A week-long Vrbo request whose first nights fall on an Airbnb stay in the
  // first homes on the calendar: Cabin declines it and names the stay it hit.
  const ahead = (s: Stay) => stays.filter(o => o.home === s.home && o.start >= s.end).sort((x, y) => x.start - y.start)[0]?.start ?? today + 60
  const taken = [...homes].sort((x, y) => x.name.localeCompare(y.name)).flatMap(home => stays.filter(s => s.home === home && s.channel === 'airbnb' && s.end - s.start >= 3 && s.end >= today + 4 && s.end <= today + 18 && ahead(s) - s.end >= 3))[0]
  await run(dana, now - 95 * MIN, reservationCommand, 'reservation.request', { propertyId: taken.home.id, channel: 'vrbo', kind: 'stay', guestName: 'Daniel Park', start: date(taken.end - 3), end: date(taken.end + Math.min(4, ahead(taken) - taken.end)), guestPhone: '828-555-0177' })

  // As every commit does: turnovers, door codes and cleaner emails follow the
  // stays, and each stay's guest messages are scheduled.
  c.actor = dana; c.now = new Date(now - MIN).toISOString(); c.before = structuredClone(c.data)
  dispatch(c); scheduleMessages(c)

  // Guests' questions that came in this morning, each with Cabin's drafted reply.
  const questions: [Stay | undefined, string, string, number][] = [
    [stays.find(s => s.channel === 'direct' && s.start >= today && s.start <= today + 9), 'Early check-in?', 'Hi! Our flight lands in Asheville at 10 am. Is there any chance we could check in early, around 1 pm? Happy to pay for it.', 25],
    [stays.find(s => s.channel === 'direct' && s.start > today + 9), 'Question about the hot tub and parking', 'Hello, we booked for later this month. Is the hot tub open in November, and is there parking for two cars?', 70],
    [stays.find(s => s.channel === 'vrbo' && s.start >= today), 'Dog friendly?', 'Hi there, would you allow one small, well-behaved dog for our stay? She is 15 lb.', 140],
  ]
  for (const [s, subject, text, ago] of questions) {
    const b = s && bookingOf(s); if (!b) continue
    c.actor = INBOX_SYSTEM; c.now = new Date(now - ago * MIN).toISOString()
    const known = stayFor(c.data, { email: b.guestEmail, phone: b.guestPhone }, now) ?? b
    const row: GuestMessage = { id: newId(), revision: newId(), propertyId: known.propertyId, bookingId: known.id, email: b.guestEmail ?? null, phone: b.guestPhone ?? null, ref: null, channel: b.guestEmail ? 'email' : 'sms', direction: 'in', source: 'guest', status: 'received', subject: b.guestEmail ? subject : '', text, detail: null, replyTo: null, headerId: null, sentBy: null, approvalId: null, scheduledId: null, providerId: null, grounds: [], createdAt: c.now, sentAt: null }
    c.data.messages.push(row); startDraft(c, env.AUTH_ORIGIN, row, false)
    events.push({ actor: INBOX_SYSTEM, at: now - ago * MIN, name: 'message.received', entityId: row.id })
  }

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
    ...kinds.flatMap(kind => ((data[kind] ?? []) as { id: string; revision?: string }[]).map(row => q('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT DO NOTHING', kind, row.id, row.revision ?? row.id, JSON.stringify(row)))),
    ...direct.map(home => q('INSERT INTO cb_direct_homes(property_id,slug,data) VALUES(?,?,?) ON CONFLICT DO NOTHING', home.propertyId, home.slug, JSON.stringify({ ...home, revision: `demo-direct-${home.slug}` }))),
    ...data.approvals.map(a => q('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', a.id, a.kind, a.recordId, a.revision, a.actorId, a.at)),
    ...c.queries.map(({ sql, params }) => { need(sql.startsWith('INSERT INTO cb_photos(')); return q(sql + ' ON CONFLICT DO NOTHING', ...params.map(v => typeof v === 'string' ? remap(v) : v)) }),
    ...events.map((e, i) => q('INSERT INTO cb_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING', `demo-event-${i + 1}`, e.actor.id, e.actor.role, e.name, e.entityId && remap(e.entityId), at(e.at))),
    q('INSERT INTO cb_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING', 'demo-agent-key', operator.id, operator.version, 'Monthly statement assistant', await sha('demo-agent-key:' + crypto.randomUUID()), now - 12 * DAY, now + 18 * DAY),
    q('INSERT INTO cb_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING', 'demo-agent-key-old', operator.id, operator.version, 'Calendar sync script (old laptop)', await sha('demo-agent-key-old:' + crypto.randomUUID()), now - 75 * DAY, now - 45 * DAY, now - 52 * DAY),
    q('UPDATE cb_meta SET version=version+1 WHERE id=1'),
  ])
}

function need(condition: boolean): asserts condition { if (!condition) throw new Error('The demo writes only turnover photos from command queries') }
