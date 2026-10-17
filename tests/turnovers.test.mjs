import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'

// Synthetic homes, guests and staff. The only fakes are the network edges: the
// paid mail transport (tests/mail-edge.mjs) and Seam's lock API, which answers
// with responses in its documented shape (tests/fixtures/seam).
const photo = (await readFile('tests/fixtures/checklist.png')).toString('base64')
const seamFixture = async name => JSON.parse(await readFile(`tests/fixtures/seam/access_codes_${name}.json`, 'utf8'))
const day = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10), ymd = n => day(n).replace(/-/g, '')
const ics = events => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Cabin documented fixture//EN\r\n' + events.map(e => `BEGIN:VEVENT\r\nUID:${e.uid}\r\nDTSTART;VALUE=DATE:${e.start}\r\nDTEND;VALUE=DATE:${e.end}\r\nSUMMARY:${e.summary}\r\nEND:VEVENT\r\n`).join('') + 'END:VCALENDAR\r\n'
const ADDRESS = '18 Fernwood Lane, Boone, NC 28607'

test('every stay creates its turnover and door codes, the cleaner is emailed and marks it ready with photos', async () => {
  const lock = []
  const outbound = async request => {
    const url = new URL(request.url)
    if (url.host !== 'connect.getseam.com') return new Response('unexpected', { status: 599 })
    const body = await request.json(), action = url.pathname.split('/').pop(), reply = await seamFixture(action)
    lock.push({ action, body, auth: request.headers.get('authorization') })
    if (action === 'create') Object.assign(reply.access_code, { access_code_id: `ac-${lock.length}`, code: body.code, starts_at: body.starts_at, ends_at: body.ends_at })
    return Response.json(reply)
  }
  const h = await harness({ outbound, auth: { SEAM_API_KEY: 'seam_test_fixture' } })
  try {
    const mail = async to => (await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r => JSON.parse(r.message)).filter(m => m.to.includes(to))
    const home = await h.cmd('property.save', { name: 'Fernwood Cabin', ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 2000 })
    const taylor = await h.person('Taylor'), casey = await h.person('Casey'), dale = await h.person('Dale')
    const settings = await h.cmd('home.settings', { propertyId: home.id, address: ADDRESS, timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: '10:00', cleanerId: taylor.id, maintenanceId: dale.id, checklist: ['Beds made', 'Kitchen clean'], photosRequired: 3, lockDeviceId: 'device-fixture-1' })
    assert.equal(settings.cleanerId, taylor.id)

    // A direct booking and an Airbnb stay right after it.
    const direct = await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', kind: 'stay', guestName: 'Ana Ruiz', start: day(3), end: day(6) })
    const feed = stay => h.cmd('calendar.prepare', { propertyId: home.id, channel: 'airbnb', calendar: ics([stay]) }).then(d => h.cmd('calendar.approve', { id: d.id, revision: d.revision }))
    await feed({ uid: 'airbnb-fern-1', start: ymd(6), end: ymd(9), summary: 'Reserved - Kai Moana' })
    let s = await h.state()
    const ana = s.bookings.find(b => b.id === direct.bookingId), kai = s.bookings.find(b => b.uid === 'airbnb-fern-1')
    const live = b => s.turnovers.filter(t => t.bookingId === b.id && t.status !== 'cancelled')
    assert.equal(live(ana).length, 1); assert.equal(live(kai).length, 1)
    let first = live(ana)[0]
    assert.deepEqual([first.status, first.cleanerId, first.windowStart, first.windowEnd, first.nextBookingId], ['approved', taylor.id, `${day(6)}T10:00`, `${day(6)}T16:00`, kai.id])
    const guestCode = b => s.codes.find(r => r.bookingId === b.id && r.holder === 'guest')
    assert.deepEqual([guestCode(ana).validFrom, guestCode(ana).validUntil], [`${day(3)}T16:00`, `${day(6)}T10:00`])
    assert.match(guestCode(kai).code, /^\d{4}$/)
    const taylorCode = s.codes.find(r => r.turnoverId === first.id && r.memberId === taylor.id && r.status === 'issued')
    assert.deepEqual([taylorCode.validFrom, taylorCode.validUntil], [first.windowStart, first.windowEnd])

    // Taylor is emailed the window, address and code; every code went to the lock.
    let sent = await mail('taylor@stay.example')
    const assigned = sent.find(m => m.text.includes(taylorCode.code))
    assert.ok(assigned && assigned.text.includes(ADDRESS) && assigned.subject.includes('Fernwood Cabin'))
    assert.equal(s.notices.find(n => n.recordId === first.id).status, 'sent')
    s = await h.state()
    assert.ok(s.codes.every(r => r.lock.state === 'set' && r.lock.providerId))
    assert.ok(lock.every(call => call.auth === 'Bearer seam_test_fixture'))
    const atHome = iso => new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/New_York' }).slice(0, 16).replace(' ', 'T')
    const pushed = lock.find(call => call.action === 'create' && call.body.code === guestCode(ana).code)
    assert.deepEqual([pushed.body.device_id, atHome(pushed.body.starts_at), atHome(pushed.body.ends_at)], ['device-fixture-1', `${day(3)}T16:00`, `${day(6)}T10:00`])

    // Reassigning sends the job to Casey with fresh digits and tells Taylor.
    await h.cmd('turnover.assign', { id: first.id, revision: first.revision, cleanerId: casey.id })
    s = await h.state(); first = s.turnovers.find(t => t.id === first.id)
    const caseyCode = s.codes.find(r => r.turnoverId === first.id && r.memberId === casey.id && r.status === 'issued')
    assert.equal(s.codes.find(r => r.id === taylorCode.id).status, 'revoked')
    assert.ok((await mail('casey@stay.example')).some(m => m.text.includes(caseyCode.code) && m.text.includes(ADDRESS)))
    assert.equal((await mail('taylor@stay.example')).length, sent.length + 1)
    assert.ok(lock.some(call => call.action === 'delete' && call.body.access_code_id === taylorCode.lock.providerId))

    // Airbnb moves Kai's stay a day later: the turnover before it, its codes and Casey's email move with it.
    await feed({ uid: 'airbnb-fern-1', start: ymd(7), end: ymd(10), summary: 'Reserved - Kai Moana' })
    s = await h.state(); first = s.turnovers.find(t => t.id === first.id)
    assert.equal(first.windowEnd, `${day(7)}T16:00`)
    assert.equal(s.codes.find(r => r.id === caseyCode.id).validUntil, `${day(7)}T16:00`)
    assert.equal(guestCode(kai).validFrom, `${day(7)}T16:00`)
    assert.ok((await mail('casey@stay.example')).length >= 2)
    assert.equal(s.turnovers.filter(t => t.bookingId === kai.id && t.status !== 'cancelled').length, 1)

    // Casey sees only their own job and code: no guest codes or names.
    const mine = await h.state(casey.cookie)
    assert.deepEqual(mine.turnovers.map(t => t.id), [first.id]); assert.deepEqual(mine.codes.map(r => r.id), [caseyCode.id])
    assert.ok(mine.bookings.every(b => !b.guestName)); assert.equal(mine.homeSettings[0].address, ADDRESS)

    // Ready from the phone with several photos; fewer than the home asks for are refused.
    const out = await h.cmd('turnover.checkout', { id: first.id }, casey.cookie)
    assert.equal(out.checkedOut.source, 'cleaner'); await h.cmd('turnover.checkout', { id: first.id }, casey.cookie, 409)
    const ready = { id: first.id, revision: first.revision, checks: first.checklist, caption: 'Ready for Kai', photos: [1, 2, 3].map(() => ({ photo, mimeType: 'image/png' })) }
    await h.cmd('turnover.complete', { ...ready, photos: ready.photos.slice(0, 1) }, casey.cookie, 400)
    await h.cmd('turnover.complete', ready, taylor.cookie, 404)
    const done = await h.cmd('turnover.complete', ready, casey.cookie)
    assert.equal(done.completion.photos.length, 3)
    for (const p of done.completion.photos) assert.equal((await h.mf.dispatchFetch(`${h.origin}/api/cabin/photos/${p.id}`, { headers: { cookie: h.owner } })).status, 200)
    const board = async () => (await h.send(`/app/readiness?from=${day(7)}`, undefined, h.owner)).text
    assert.match(await board(), /class="home-ready ready"/)

    // A broken patio light, reported from the turnover with a photo, goes to Dale and holds the home.
    const task = await h.cmd('task.raise', { turnoverId: first.id, title: 'Patio light out', blocking: true, photos: [{ photo, mimeType: 'image/png' }] }, casey.cookie)
    assert.equal(task.assigneeId, dale.id)
    assert.ok((await mail('dale@stay.example')).some(m => m.subject.includes('Patio light out') && m.text.includes(ADDRESS)))
    assert.match(await board(), /class="home-ready not-ready"/)
    const fixed = (await h.state(dale.cookie)).tasks.find(t => t.id === task.id)
    await h.cmd('task.close', { id: fixed.id, revision: fixed.revision, note: 'New bulb', photos: [{ photo, mimeType: 'image/png' }] }, dale.cookie)
    assert.match(await board(), /class="home-ready ready"/)

    // The guest's stay page shows their code; cancelling the stay cancels its turnover and code.
    s = await h.state()
    const page = await h.send(`/stay/${guestCode(kai).link}`, undefined, '')
    assert.equal(page.status, 200); assert.ok(page.text.includes(guestCode(kai).code))
    const later = s.turnovers.find(t => t.bookingId === kai.id && t.status === 'approved')
    await feed({ uid: 'airbnb-fern-other', start: ymd(20), end: ymd(22), summary: 'Reserved' })
    s = await h.state()
    assert.equal(s.turnovers.find(t => t.id === later.id).status, 'cancelled')
    assert.equal(guestCode(kai).status, 'revoked')
    assert.ok(!(await h.send(`/stay/${guestCode(kai).link}`, undefined, '')).text.includes(`>${guestCode(kai).code}<`))
    assert.ok(s.notices.some(n => n.kind === 'cancelled' && n.recordId === later.id && n.memberId === taylor.id && n.status === 'sent'))
  } finally { await h.close() }
})
