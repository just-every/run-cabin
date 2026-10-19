import { homeDay } from './home-calendar.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'

const property = (h, name) => h.cmd('property.save', { name, ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 1500 })
const calendar = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.map(e => `BEGIN:VEVENT\r\nUID:${e.uid}\r\nDTSTART${e.start.includes('T') ? '' : ';VALUE=DATE'}:${e.start}\r\nDTEND${e.end.includes('T') ? '' : ';VALUE=DATE'}:${e.end}\r\nSUMMARY:${e.summary}\r\nEND:VEVENT\r\n`).join('')}END:VCALENDAR\r\n`
const row = (page, name) => page.split('<div class="tl-row">').slice(1).find(part => part.includes(`<h3>${name}</h3>`))?.split('<p class="tl-legend">')[0]
const record = page => page.split('aria-label="Reservation record"')[1]
const day = n => homeDay(n, 'America/New_York')
const config = { enabled: true, slug: 'calendar-home', description: 'A home for the calendar flow.', nightlyCents: 18000, cleaningCents: 0, extraGuestCents: 0, includedGuests: 2, maxGuests: 4, minNights: 1, maxNights: 30, minGapNights: 0, depositCents: 0, releaseHours: 0, taxLabel: '', taxBps: 0, countyTaxLabel: '', countyTaxBps: 0, agreement: 'Quiet hours after 10 pm.', requireIdentity: false }

test('staff navigate a twenty-home portfolio, filter inventory and drill into overlapping stays and owner blocks across a DST change', async () => {
  const feeds = {
    'airbnb.example': calendar([{ uid: 'dst-stay', start: '20261101T053000Z', end: '20261104T150000Z', summary: 'Reserved - Ana Ruiz' }]),
    'vrbo.example': calendar([{ uid: 'overlap', start: '20261102', end: '20261105', summary: 'Reserved - Blake Chen' }])
  }
  const h = await harness({ outbound: request => { const body = feeds[new URL(request.url).hostname]; assert.ok(body, 'only the connected calendar hosts are called'); return new Response(body, { headers: { 'content-type': 'text/calendar' } }) } })
  try {
    const homes = []
    for (let n = 1; n <= 20; n++) homes.push(await property(h, `Portfolio home ${n}`))
    const p = homes[0]
    await h.cmd('home.settings', { propertyId: p.id, address: '10 Oak St, Asheville, NC 28801', timeZone: 'America/New_York', checklist: ['Beds and bathrooms'], checkInTime: '16:00', checkOutTime: '10:00' })
    await h.cmd('reservation.request', { propertyId: p.id, channel: 'direct', start: '2026-10-01', end: '2026-10-03', guestName: 'Previous guest' })
    await h.cmd('channel.connect', { propertyId: p.id, channel: 'airbnb', url: 'https://airbnb.example/feed.ics' })
    await h.cmd('channel.connect', { propertyId: p.id, channel: 'vrbo', url: 'https://vrbo.example/feed.ics' })
    const owner = await h.cmd('reservation.request', { propertyId: p.id, kind: 'block', start: '2026-11-29', end: '2026-12-01', note: 'Owner personal stay' })
    const issue = await h.cmd('task.raise', { propertyId: p.id, title: 'Front door will not latch', blocking: true })
    const state = await h.state(), stay = state.bookings.find(b => b.uid === 'dst-stay'), overlap = state.bookings.find(b => b.uid === 'overlap')
    const portfolio = await h.send('/app/calendar?from=2026-11-01&days=28', undefined, h.owner)
    assert.equal(portfolio.status, 200)
    assert.equal((portfolio.text.match(/class="tl-row"/g) || []).length, 20)
    assert.ok(row(portfolio.text, 'Portfolio home 20'))
    assert.match(row(portfolio.text, p.name), /Owner personal stay/, 'month includes its final nights')
    const filtered = await h.send(`/app/calendar?from=2026-11-01&days=7&home=${p.id}&channel=airbnb`, undefined, h.owner)
    assert.equal((filtered.text.match(/class="tl-row"/g) || []).length, 1)
    assert.match(row(filtered.text, p.name), /Ana Ruiz/)
    assert.doesNotMatch(row(filtered.text, p.name), /Blake Chen|class="vacant/)
    assert.match(filtered.text, /Collision/)
    const details = await h.send(`/app/calendar?from=2026-11-01&days=1&home=${p.id}&channel=airbnb&reservation=${stay.id}`, undefined, h.owner)
    const detail = record(details.text)
    assert.match(detail, /1:30 am EDT \(America\/New_York\)/)
    assert.match(detail, /10 am EST \(America\/New_York\)/)
    assert.match(detail, /Not ready/)
    assert.ok(detail.includes(`/app/maintenance#task-${issue.id}`))
    assert.ok(detail.includes(`reservation=${overlap.id}`))
    assert.match(detail, /Unknown · not supplied by the channel calendar/)
    assert.match(detail, /Last successful read/)
    const block = record((await h.send(`/app/calendar?reservation=${owner.bookingId}`, undefined, h.owner)).text)
    assert.match(block, /Owner block record/)
    assert.match(block, /Owner personal stay/)
    assert.match(block, /Not applicable · no guest revenue/)
    const past = record((await h.send(`/app/calendar?from=2020-01-01&reservation=${stay.id}`, undefined, h.owner)).text)
    assert.ok(past.includes(stay.uid), 'the authoritative record remains addressable outside the displayed dates')
    const missing = await h.send('/app/calendar?reservation=missing-record', undefined, h.owner)
    assert.match(record(missing.text), /Reservation unavailable/)
    assert.match(record(missing.text), /Availability is unknown/)
  } finally { await h.close() }
})

test('unpaid checkout inventory and failed channel reads remain held and never appear as open nights', async () => {
  let failed = false
  const source = calendar([{ uid: 'live-stay', start: day(12).replaceAll('-', ''), end: day(15).replaceAll('-', ''), summary: 'Reserved - Casey Rivera' }])
  const h = await harness({ auth: { STRIPE_TEST_SECRET_KEY: 'sk_test_fake' }, outbound: request => {
    const url = new URL(request.url)
    if (url.hostname === 'airbnb.example') return new Response(source, { status: failed ? 503 : 200 })
    assert.equal(url.hostname, 'api.stripe.com')
    assert.equal(url.pathname, '/v1/checkout/sessions')
    return Response.json({ id: 'cs_test_calendar', url: 'https://checkout.stripe.com/c/pay/cs_test_calendar' })
  } })
  try {
    const p = await property(h, 'Calendar payment home')
    const settings = await h.cmd('direct.configure', { ...config, propertyId: p.id })
    const connection = await h.cmd('channel.connect', { propertyId: p.id, channel: 'airbnb', url: 'https://airbnb.example/feed.ics' })
    const checkout = await h.send('/book/calendar-home/checkout', { start: day(5), end: day(8), guests: 2, homeRevision: settings.revision, guestName: 'Unpaid guest', email: 'unpaid@stay.example', signature: 'Unpaid guest', consent: 'yes' })
    assert.equal(checkout.status, 200, checkout.text)
    const state = await h.state(), hold = state.direct.stays.find(d => d.id === checkout.value.id), live = state.bookings.find(b => b.uid === 'live-stay')
    const unpaid = record((await h.send(`/app/calendar?reservation=${hold.bookingId}`, undefined, h.owner)).text)
    assert.match(unpaid, /Unpaid guest/)
    assert.match(unpaid, /Unpaid · checkout payment pending/)
    failed = true
    await h.cmd('channel.sync', { id: connection.connection.id })
    const stale = await h.send(`/app/calendar?from=${day(0)}&days=14&home=${p.id}&reservation=${live.id}`, undefined, h.owner)
    assert.match(row(stale.text, p.name), /Availability stale/)
    assert.match(row(stale.text, p.name), /Casey Rivera/)
    assert.doesNotMatch(row(stale.text, p.name), /class="vacant/)
    assert.match(record(stale.text), /Last successful read/)
    assert.match(record(stale.text), /Open sync exception/)
    assert.equal((await h.state()).bookings.find(b => b.id === live.id).status, 'confirmed')
    failed = false
    await h.cmd('channel.sync', { id: connection.connection.id })
    const recovered = await h.send(`/app/calendar?from=${day(0)}&days=14&home=${p.id}`, undefined, h.owner)
    assert.doesNotMatch(row(recovered.text, p.name), /Availability stale|Availability unknown/)
    assert.match(row(recovered.text, p.name), /class="vacant/)
  } finally { await h.close() }
})
