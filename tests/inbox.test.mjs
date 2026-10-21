import { homeDay } from './home-calendar.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'

// Synthetic homes and guests. The only fakes are the network edges: the paid
// mail transport (tests/mail-edge.mjs), the AI provider, and Twilio's and
// Booking.com's messaging APIs answering in their documented shapes
// (tests/fixtures/twilio, tests/fixtures/booking).
const fixture = async path => JSON.parse(await readFile(`tests/fixtures/${path}.json`, 'utf8'))
const day = n => homeDay(n, 'America/New_York'), ymd = n => day(n).replace(/-/g, '')
const ics = events => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Cabin documented fixture//EN\r\n' + events.map(e => `BEGIN:VEVENT\r\nUID:${e.uid}\r\nDTSTART;VALUE=DATE:${e.start}\r\nDTEND;VALUE=DATE:${e.end}\r\nSUMMARY:${e.summary}\r\nEND:VEVENT\r\n`).join('') + 'END:VCALENDAR\r\n'
const ADDRESS = '18 Fernwood Lane, Boone, NC 28607', INBOX = 'guests@cabin.example', TWILIO = 'twilio-fixture-token'
const mime = ({ from, replyTo, subject, id, text }) => [`From: ${from}`, `To: Fernwood Cabin <${INBOX}>`, ...(replyTo ? [`Reply-To: ${replyTo}`] : []), `Subject: ${subject}`, `Message-ID: <${id}>`, 'Date: Sat, 17 Oct 2026 09:00:00 -0400', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', text].join('\r\n')

test('a stay’s check-in message withholds unverified access and goes out on time, the guest’s replies by email and text join one thread, and drafted replies wait for the host', async () => {
  const calls = []
  const outbound = async request => {
    const url = new URL(request.url), body = await request.text()
    calls.push({ host: url.host, path: url.pathname + url.search, method: request.method, body, headers: Object.fromEntries(request.headers) })
    if (url.host === 'api.anthropic.com') return Response.json({ id: 'msg_fixture', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'Hi Ana, yes: early bag drop is something I will confirm with the cleaner and let you know today.', grounds: ['check-in time'], needs_host: true, note: 'Early drop-off is not in the stay facts.' }) }] })
    if (url.host === 'api.twilio.com') return Response.json({ ...await fixture('twilio/messages_create'), to: new URLSearchParams(body).get('To'), body: new URLSearchParams(body).get('Body') }, { status: 201 })
    if (url.host === 'supply-xml.booking.com') {
      if (url.pathname.endsWith('/messages/latest')) { const r = await fixture('booking/messages_latest'); r.data.messages[0].content = 'Is there parking for two cars?'; return Response.json(r) }
      if (request.method === 'PUT') return Response.json(await fixture('booking/confirm'))
      if (url.pathname.includes('/conversations/type/reservation')) return Response.json(await fixture('booking/conversation_by_reservation'))
      return Response.json(await fixture('booking/send_message'))
    }
    return new Response('unexpected', { status: 599 })
  }
  const h = await harness({ outbound, auth: { TWILIO_ACCOUNT_SID: 'ACfixture00000000000000000000000000', TWILIO_AUTH_TOKEN: TWILIO, TWILIO_FROM: '+18285550100', BOOKING_MESSAGING_USER: 'fixture-machine', BOOKING_MESSAGING_PASSWORD: 'fixture-secret' } })
  try {
    const mail = async to => (await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r => JSON.parse(r.message)).filter(m => m.to.includes(to))
    const email = (raw, to = INBOX) => h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=${encodeURIComponent('bounces+42@relay.example')}&to=${encodeURIComponent(to)}`, { method: 'POST', body: raw })
    const settings = async () => (await h.accessState()).inbox.find(r => r.id === 'inbox') ?? { revision: '' }
    const home = await h.cmd('property.save', { name: 'Fernwood Cabin', ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 2000 })
    await h.cmd('home.settings', { propertyId: home.id, address: ADDRESS, timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: '10:00', checklist: ['Beds made'], photosRequired: 1 })
    await h.cmd('inbox.address', { address: INBOX, revision: '' })
    // Check-in instructions at check-in time itself: tomorrow, not due yet.
    const schedule = hours => ({ checkinEnabled: true, checkinHours: hours, checkoutEnabled: true, checkoutHours: 14, reviewEnabled: true, reviewHours: 4 })
    await h.cmd('inbox.schedule', { ...schedule(0), revision: (await settings()).revision })
    const request = await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', kind: 'stay', guestName: 'Ana Ruiz', guestEmail: 'Ana@Guest.example', start: day(1), end: day(3) })
    let s = await h.accessState()
    const stay = s.bookings.find(b => b.id === request.bookingId), code = s.codes.find(r => r.bookingId === stay.id && r.holder === 'guest')
    const row = rule => s.scheduled.find(r => r.bookingId === stay.id && r.rule === rule)
    assert.equal(stay.guestEmail, 'ana@guest.example')
    assert.deepEqual(['checkin', 'checkout', 'review'].map(r => row(r).status), ['scheduled', 'scheduled', 'scheduled'])
    assert.equal(await mail('ana@guest.example').then(m => m.length), 0)

    // Two days ahead instead: now due, so it goes out at once with the guest's door code and stay page.
    await h.cmd('inbox.schedule', { ...schedule(48), revision: (await settings()).revision })
    s = await h.accessState()
    const [sent] = await mail('ana@guest.example')
    assert.ok(!sent.text.includes(code.code) && sent.text.includes(ADDRESS) && !sent.text.includes(`/stay/${code.link}`), sent.text)
    assert.equal(sent.replyTo, INBOX); assert.equal(sent.headers['Auto-Submitted'], 'auto-generated')
    assert.equal(row('checkin').status, 'sent')
    assert.ok(Date.parse(row('checkin').sentAt) - Math.max(Date.parse(row('checkin').dueAt), Date.parse(row('checkin').createdAt)) < 5 * 60_000, 'submitted within five minutes of falling due')
    assert.equal(row('checkout').status, 'scheduled')

    // The stay moves four days later: every message moves with it, and the check-in details already sent go out again at the new time.
    const before = row('checkout').dueAt, sentFor = row('checkin').dueAt
    await h.cmd('reservation.move', { id: stay.id,revision:(await h.accessState()).bookings.find(row=>row.id===stay.id).revision, start: day(5), end: day(7) })
    s = await h.accessState()
    assert.equal(Date.parse(row('checkout').dueAt) - Date.parse(before), 4 * 86_400_000)
    assert.deepEqual([row('checkin').status, Date.parse(row('checkin').dueAt) - Date.parse(sentFor)], ['scheduled', 4 * 86_400_000])
    assert.equal(await mail('ana@guest.example').then(m => m.length), 1, 'not again before its new time')

    // Ana replies from her mail app: her words land in her thread, tied to the stay, with a drafted reply that waits.
    const refused = await email(mime({ from: 'Ana Ruiz <ana@guest.example>', subject: 'Hello', id: 'stray@guest.example', text: 'Wrong address' }), 'other@cabin.example')
    assert.notEqual(refused.status, 200)
    await email(mime({ from: 'Ana Ruiz <ana@guest.example>', subject: `Re: ${sent.subject}`, id: 'reply-1@guest.example', text: 'Hi! What was the door code again? We land around 3.\r\n\r\nOn Sat, Oct 17, 2026 at 9:00 AM Fernwood Cabin <auth@stay.example> wrote:\r\n> Welcome to Fernwood Cabin.' }))
    s = await h.accessState()
    const asked = s.messages.find(m => m.direction === 'in' && m.headerId === '<reply-1@guest.example>')
    assert.equal(asked.bookingId, stay.id); assert.equal(asked.text, 'Hi! What was the door code again? We land around 3.')
    assert.ok(!s.messages.some(m => m.text.includes('stray') || m.text === 'Wrong address'))
    let draft = s.messages.find(m => m.status === 'draft' && m.replyTo === asked.id)
    assert.equal(draft.source, 'template'); assert.ok(draft.text.includes(code.code))
    assert.equal(await mail('ana@guest.example').then(m => m.length), 1, 'nothing is sent without the host')
    const thread = (await h.send(`/app/inbox`, undefined, h.owner)).text
    assert.match(thread, /waiting for your nod/)

    // The host edits and sends it: exactly that text goes out once, threaded under Ana's message.
    await h.cmd('message.send', { id: draft.id, revision: draft.revision, text: `Hi Ana, the door code is ${code.code}. Safe travels!` })
    const replies = await mail('ana@guest.example')
    assert.equal(replies.length, 2); assert.equal(replies[1].text, `Hi Ana, the door code is ${code.code}. Safe travels!`)
    assert.equal(replies[1].headers['In-Reply-To'], '<reply-1@guest.example>')
    s = await h.accessState()
    draft = s.messages.find(m => m.id === draft.id)
    assert.equal(draft.status, 'sent'); assert.ok(s.approvals.some(a => a.kind === 'message' && a.recordId === draft.id))
    await h.cmd('message.send', { id: draft.id, revision: draft.revision }, h.owner, 409)

    // A text from Ana's phone joins the same thread, and the reply goes back as a text through Twilio.
    await h.cmd('booking.details', { id: stay.id,revision:(await h.accessState()).bookings.find(row=>row.id===stay.id).revision, guestName: 'Ana Ruiz', guestEmail: 'ana@guest.example', guestPhone: '(828) 555-0142' })
    const fields = { ...await fixture('twilio/incoming'), From: '+18285550142', Body: 'Running an hour late, sorry!' }, url = `${h.origin}/inbound/sms`
    const signature = createHmac('sha1', TWILIO).update(url + Object.keys(fields).sort().map(k => k + fields[k]).join('')).digest('base64')
    assert.equal((await h.mf.dispatchFetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'forged' }, body: new URLSearchParams(fields) })).status, 403)
    assert.equal((await h.mf.dispatchFetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body: new URLSearchParams(fields) })).status, 200)
    s = await h.accessState()
    const texted = s.messages.find(m => m.channel === 'sms' && m.direction === 'in')
    assert.equal(texted.bookingId, stay.id)
    const smsDraft = s.messages.find(m => m.replyTo === texted.id && m.status === 'draft')
    assert.equal(smsDraft.channel, 'sms')
    await h.cmd('message.send', { id: smsDraft.id, revision: smsDraft.revision, text: 'No problem, see you soon.' })
    const sms = calls.find(c => c.host === 'api.twilio.com')
    assert.deepEqual([new URLSearchParams(sms.body).get('To'), new URLSearchParams(sms.body).get('Body')], ['+18285550142', 'No problem, see you soon.'])

    // A reply through a forwarding relay names Ana in Reply-To: it joins her thread, and the install's AI key drafts the answer.
    await h.cmd('inbox.ai.save', { key: 'sk-ant-fixture-key', revision: (await settings()).revision })
    assert.ok(!Object.hasOwn((await settings()).ai,'keySealed'),'the sealed key never leaves the server')
    await email(mime({ from: 'Relay <relay@forward.example>', replyTo: 'Ana Ruiz <ana@guest.example>', subject: 'Bags', id: 'reply-2@forward.example', text: 'Could we drop our bags early?' }))
    s = await h.accessState()
    const bags = s.messages.find(m => m.headerId === '<reply-2@forward.example>'), aiDraft = s.messages.find(m => m.replyTo === bags.id)
    assert.deepEqual([bags.email, bags.bookingId, aiDraft.status, aiDraft.source], ['ana@guest.example', stay.id, 'draft', 'ai'])
    assert.match(aiDraft.text, /confirm with the cleaner/); assert.match(aiDraft.detail, /Needs you/)
    const asking = calls.find(c => c.host === 'api.anthropic.com')
    assert.equal(asking.headers['x-api-key'], 'sk-ant-fixture-key'); assert.equal(JSON.parse(asking.body).model, 'claude-opus-5-5')
    assert.equal(await mail('ana@guest.example').then(m => m.length), 2, 'an AI draft is not sent either')

    // A Booking.com guest's message arrives on the Cron and the reply goes back through Booking.com's API.
    await h.cmd('inbox.channels', { [`booking_${home.id}`]: '8011855', revision: (await settings()).revision })
    const draftFeed = await h.cmd('calendar.prepare', { propertyId: home.id, channel: 'booking.com', calendar: ics([{ uid: 'bdc-1', start: ymd(10), end: ymd(12), summary: 'Lena Park' }]) })
    await h.cmd('calendar.approve', { id: draftFeed.id, revision: draftFeed.revision })
    s = await h.accessState()
    const lena = s.bookings.find(b => b.uid === 'bdc-1')
    await h.cmd('booking.details', { id: lena.id,revision:(await h.accessState()).bookings.find(row=>row.id===lena.id).revision, guestName: 'Lena Park', channelRef: '3812391309' })
    await (await h.mf.getWorker()).scheduled({ cron: '*/5 * * * *' })
    s = await h.accessState()
    const parking = s.messages.find(m => m.channel === 'booking.com' && m.direction === 'in')
    assert.deepEqual([parking.bookingId, parking.text], [lena.id, 'Is there parking for two cars?'])
    assert.ok(calls.some(c => c.method === 'PUT' && c.path.includes('number_of_messages=1')))
    const lenaDraft = s.messages.find(m => m.replyTo === parking.id && m.status === 'draft')
    await h.cmd('message.send', { id: lenaDraft.id, revision: lenaDraft.revision, text: 'Yes, two cars fit in the driveway.' })
    const posted = calls.find(c => c.method === 'POST' && c.host === 'supply-xml.booking.com')
    assert.equal(posted.path, '/messaging/properties/8011855/conversations/f3a9c29d-480d-5f5b-a6c0-65451e335353')
    assert.deepEqual(JSON.parse(posted.body), { message: { content: 'Yes, two cars fit in the driveway.' } })
    // An Airbnb guest with no email cannot receive an automatic check-in message through a read-only browser connection.
    const airbnb = await h.cmd('calendar.prepare', { propertyId: home.id, channel: 'airbnb', calendar: ics([{ uid: 'abnb-1', start: ymd(1), end: ymd(2), summary: 'Reserved' }]) })
    await h.cmd('calendar.approve', { id: airbnb.id, revision: airbnb.revision })
    s = await h.accessState()
    const quiet = s.scheduled.find(r => r.bookingId === s.bookings.find(b => b.uid === 'abnb-1').id && r.rule === 'checkin')
    assert.equal(quiet.status, 'unavailable'); const unavailable=s.messages.find(m=>m.scheduledId===quiet.id);assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.providerId,null)

    // Cancelling Ana's stay cancels the messages still waiting; the cleaner sees no guest messages at all.
    await h.cmd('reservation.cancel', { id: stay.id ,revision:(await h.accessState()).bookings.find(row=>row.id===stay.id).revision})
    s = await h.accessState()
    assert.deepEqual([row('checkin').status, row('checkout').status, row('review').status], ['cancelled', 'cancelled', 'cancelled'])
    const cleaner = await h.person('Taylor')
    const theirs = await h.accessState(cleaner.cookie)
    assert.deepEqual([theirs.messages.length, theirs.scheduled.length], [0, 0])
  } finally { await h.close() }
})

test('a reviewed returning guest’s question is answered for their upcoming stay, and a new check-out time re-sends the corrected door-code hours', async () => {
  const h = await harness({})
  try {
    // The home's own date: its first stay checked out at midnight there today, so it is over whatever the hour.
    const local = n => new Date(Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()) + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
    const mail = async () => (await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r => JSON.parse(r.message)).filter(m => m.to.includes('megan@guest.example'))
    const settings = async () => (await h.accessState()).inbox.find(r => r.id === 'inbox') ?? { revision: '' }
    const home = await h.cmd('property.save', { name: 'Saltbox on the Bay', ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 2000 })
    const hours = async out => h.cmd('home.settings', { propertyId: home.id, revision: (await h.accessState()).homeSettings.find(r => r.propertyId === home.id)?.revision ?? '', address: ADDRESS, timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: out, checklist: ['Beds made'], photosRequired: 1 })
    await hours('00:00')
    await h.cmd('inbox.address', { address: INBOX, revision: '' })
    await h.cmd('inbox.schedule', { checkinEnabled: true, checkinHours: 48, checkoutEnabled: false, checkoutHours: 14, reviewEnabled: true, reviewHours: 4, revision: (await settings()).revision })
    await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', kind: 'stay', guestName: 'Rowan Price', guestEmail: 'rowan@guest.example', start: local(-6), end: local(-2) })
    const thanks = async () => (await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r => JSON.parse(r.message)).filter(m => m.to.includes('rowan@guest.example') && m.subject.includes('Thank you for staying'))
    assert.equal((await thanks()).length, 1)
    const past = await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', kind: 'stay', guestName: 'Megan Hale', guestEmail: 'megan@guest.example', start: local(-2), end: local(0) })
    const next = await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', kind: 'stay', guestName: 'Megan Hale', guestEmail: 'megan@guest.example', start: local(1), end: local(3) })
    assert.equal(past.status, 'accepted'); assert.equal(next.status, 'accepted')
    assert.notEqual(past.bookingId, next.bookingId)
    const profiles = (await h.accessState()).guests, previousGuest = profiles.find(g => g.bookingId === past.bookingId), returningGuest = profiles.find(g => g.bookingId === next.bookingId)
    await h.cmd('guest.merge', { id: previousGuest.id, revision: previousGuest.revision, intoId: returningGuest.id, intoRevision: returningGuest.revision, reason: 'Guest confirmed both reservation references in the conversation.', confirm: 'yes' })
    const [first] = (await mail()).filter(m => m.subject.startsWith('Check-in details'))
    assert.ok(first, 'check-in details for the upcoming stay went out')

    const raw = mime({ from: 'Megan Hale <megan@guest.example>', subject: 'Saturday', id: 'megan-1@guest.example', text: 'Hi, what is the door code for our check-in?' })
    await h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=${encodeURIComponent('megan@guest.example')}&to=${encodeURIComponent(INBOX)}`, { method: 'POST', body: raw })
    let s = await h.accessState()
    const asked = s.messages.find(m => m.headerId === '<megan-1@guest.example>'), draft = s.messages.find(m => m.replyTo === asked.id)
    const code = s.codes.find(r => r.bookingId === next.bookingId && r.holder === 'guest')
    assert.equal(asked.bookingId, next.bookingId, 'the stay that already checked out is not the one she is asking about')
    assert.ok(draft.text.includes(code.code), draft.text)

    // The home now checks out at 3 am: the guest's code ends earlier, and the check-in details she already has are corrected.
    await hours('03:00')
    s = await h.accessState()
    const moved = s.codes.find(r => r.bookingId === next.bookingId && r.holder === 'guest')
    assert.notEqual(moved.validUntil, code.validUntil)
    const sent = (await mail()).filter(m => m.subject.includes('Check-in details'))
    assert.equal(sent.length, 2)
    assert.match(sent[1].subject, /^Updated: /)
    assert.ok(!sent[1].text.includes(moved.code) && sent[1].text.includes('3 am'), sent[1].text)
    await hours('03:00')
    assert.equal((await mail()).filter(m => m.subject.includes('Check-in details')).length, 2, 'sent once per change')
    assert.equal((await thanks()).length, 1, 'a review request whose words did not change is not sent again')
  } finally { await h.close() }
})

test('guest search covers retained message history and explicit guest/message pages without merging shared contacts', async () => {
 const h=await harness()
 try {
  const p=await h.cmd('property.save',{name:'synthetic-cabin-1',ownerName:'Synthetic owner',ownerEmail:'owner@synthetic.example',commissionBps:1500})
  const put=(kind,row)=>h.db.prepare('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?)').bind(kind,row.id,row.revision??row.id,JSON.stringify(row))
  const bookings=Array.from({length:27},(_,n)=>({id:`synthetic-cabin-booking-${n}`,revision:`synthetic-cabin-revision-${n}`,uid:`synthetic-cabin-event-${n}`,propertyId:p.id,channel:'direct',status:'confirmed',kind:'stay',start:'2026-03-01',end:'2026-03-03',approvedAt:`2026-01-${String(n+1).padStart(2,'0')}T00:00:00Z`,summary:`Synthetic guest ${n}`,guestName:`Synthetic guest ${n}`,guestEmail:'shared@synthetic.example'}))
  const messages=Array.from({length:55},(_,n)=>({id:`synthetic-cabin-message-${n}`,revision:`synthetic-cabin-message-revision-${n}`,propertyId:p.id,bookingId:bookings[0].id,email:'shared@synthetic.example',phone:null,ref:null,channel:'email',direction:'in',source:'guest',status:'received',subject:'Synthetic stay',text:n===0?'Retained indigo telescope request':`Synthetic message ${n}`,createdAt:new Date(Date.UTC(2026,0,1,0,n)).toISOString(),sentAt:null,detail:null,replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:null,grounds:[]}))
  const offPageDraft={...messages[0],id:'synthetic-cabin-message-draft',revision:'synthetic-cabin-draft-revision',bookingId:bookings[26].id,direction:'out',status:'draft',source:'host',text:'A separate conversation is waiting for review'}
  await h.db.batch([...bookings.map(b=>put('bookings',b)),...messages.map(m=>put('messages',m)),put('messages',offPageDraft)])
  const first=await h.send('/app/inbox',undefined,h.owner);assert.equal(first.status,200,first.text)
  assert.match(first.text,/of 27 guests/);assert.equal((first.text.match(/class="thread-row/g)||[]).length,25)
  const second=await h.send('/app/inbox?page=2',undefined,h.owner);assert.equal(second.status,200,second.text);assert.equal((second.text.match(/class="thread-row/g)||[]).length,2)
  const search=await h.send('/app/inbox?q=indigo%20telescope',undefined,h.owner);assert.equal(search.status,200,search.text);assert.match(search.text,/of 1 guests/);assert.match(search.text,/of 55 messages/);assert.doesNotMatch(search.text,/Retained indigo telescope request/)
  const inboxNav=search.text.match(/<a href="\/app\/inbox"[^>]*>[\s\S]*?<\/a>/)?.[0];assert.match(inboxNav??'',/<b class="count"[^>]*>1<\/b>/,'a search omitting the drafted conversation retains the truthful portfolio pending count')
  const older=search.text.match(/href="([^"]*messages=2[^"]*)"/);assert.ok(older,'older messages are explicitly addressable')
  const history=await h.send(older[1].replaceAll('&amp;','&'),undefined,h.owner);assert.equal(history.status,200,history.text);assert.match(history.text,/Retained indigo telescope request/);assert.match(history.text,/of 55 messages/)
  const empty=await h.send('/app/inbox?q=missing-synthetic-value',undefined,h.owner);assert.equal(empty.status,200,empty.text);assert.match(empty.text,/of 0 guests/)
 } finally {await h.close()}
})
