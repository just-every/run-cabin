import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { run, harness } from './harness.mjs'

const property = (h, extra = {}) => h.cmd('property.save', { name: 'Banksia House', ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 1500, ...extra })
const ics = events => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Cabin documented fixture//EN\r\n' + events.map(e => `BEGIN:VEVENT\r\nUID:${e.uid}\r\nDTSTART;VALUE=DATE:${e.start}\r\nDTEND;VALUE=DATE:${e.end}\r\nSUMMARY:${e.summary ?? 'Reserved'}\r\n${e.cancelled ? 'STATUS:CANCELLED\r\n' : ''}END:VEVENT\r\n`).join('') + 'END:VCALENDAR\r\n'
const event = { uid: 'stay-1', start: '20261101', end: '20261105', summary: 'Coastal stay' }
async function booking(h, p, stay = event) {
  const d = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([stay]) })
  await h.cmd('calendar.approve', { id: d.id, revision: d.revision })
  return (await h.state()).bookings.find(b => b.uid === event.uid)
}
const photo = (await readFile('tests/fixtures/checklist.png')).toString('base64')
const csv = 'external_id,name,owner_name,owner_email,commission_bps\nhome-one,Banksia House,Morgan Lee,morgan@stay.example,1500\nhome-two,Ocean Loft,Alex Chen,alex@stay.example,1000\n'

test('native invitations, current roles, cleaner isolation, CSRF and revoked access', () => run(async h => {
  await h.state('', 401)
  const p = await property(h), cleaner = await h.person('Taylor'), other = await h.person('Casey'), manager = await h.person('Riley', 'manager')
  await h.cmd('property.save', { name: 'Bad' }, cleaner.cookie, 403)
  await h.cmd('member.save', { name: 'Bad' }, manager.cookie, 403)
  await h.cmd('statement.prepare', { propertyId: p.id }, cleaner.cookie, 403)
  const result = await h.send('/api/cabin/command', { name: 'property.save', input: {} }, h.owner, { origin: 'https://cross.example' })
  assert.equal(result.status, 403)
  const visible = await h.state(other.cookie)
  assert.equal(visible.bookings.length, 0); assert.equal(visible.statements.length, 0)
  await h.cmd('member.save', { id: cleaner.id, revision: cleaner.revision, name: cleaner.name, email: cleaner.email, role: 'cleaner', active: false })
  await h.state(cleaner.cookie, 403)
}))

test('two calendar snapshots flag clashes, retain freshness and require exact reconciled approval', () => run(async h => {
  const p = await property(h)
  const first = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([event]) })
  assert.equal((await h.state()).bookings.length, 0)
  await h.cmd('calendar.approve', { id: first.id, revision: 'outdated' }, h.owner, 409)
  await h.cmd('calendar.approve', { id: first.id, revision: first.revision })
  const second = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Booking.com', calendar: ics([{ uid: 'booking-2', start: '20261104', end: '20261107' }]) })
  assert.equal(second.clashes.length, 1)
  await h.cmd('calendar.approve', { id: second.id, revision: second.revision })
  let state = await h.state()
  assert.equal(state.feeds.length, 2); assert.ok(state.feeds.every(f => f.importedAt && f.approvedAt))
  const same = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([event]) })
  await h.cmd('calendar.approve', { id: same.id, revision: same.revision })
  assert.equal((await h.state()).bookings.length, 2)
  const changed = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([{ ...event, end: '20261106' }]) })
  assert.equal((await h.state()).bookings.find(b => b.uid === event.uid).end.slice(0,10), '2026-11-05')
  await h.cmd('calendar.approve', { id: changed.id, revision: changed.revision })
  const removed = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([]) })
  assert.equal((await h.state()).bookings.find(b => b.uid === event.uid).status, 'confirmed')
  await h.cmd('calendar.approve', { id: removed.id, revision: removed.revision })
  state = await h.state(); assert.equal(state.bookings.find(b => b.uid === event.uid).status, 'cancelled')
  assert.ok(state.approvals.every(a => a.actorId && a.revision))
}))

test('end-exclusive dates, stale snapshots and malformed calendar files cannot silently alter bookings', () => run(async h => {
  const p = await property(h); await booking(h,p)
  const adjacent = await h.cmd('calendar.prepare', { propertyId:p.id,channel:'Booking.com',calendar:ics([{uid:'adjacent',start:'20261105',end:'20261108'}]) })
  assert.equal(adjacent.clashes.length,0)
  const rival = await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261106'}])})
  const fresh = await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261107'}])})
  await h.cmd('calendar.approve',{id:fresh.id,revision:fresh.revision})
  await h.cmd('calendar.approve',{id:rival.id,revision:rival.revision},h.owner,409)
  await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:'not a calendar'},h.owner,400)
  await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261031'}])},h.owner,400)
}))

test('approved turnover reaches only its cleaner and needs all checks plus authenticated photo evidence', () => run(async h => {
  const p=await property(h),b=await booking(h,p,{...event,start:'20260101',end:'20260105'}),cleaner=await h.person('Taylor'),other=await h.person('Casey')
  const draft=await h.cmd('turnover.prepare',{bookingId:b.id,cleanerId:cleaner.id,checklist:['Linen changed','Keys checked']})
  assert.equal((await h.state(cleaner.cookie)).turnovers.length,0)
  await h.cmd('turnover.approve',{id:draft.id,revision:draft.revision},cleaner.cookie,403)
  await h.cmd('turnover.approve',{id:draft.id,revision:draft.revision})
  assert.equal((await h.state(cleaner.cookie)).turnovers.length,1)
  assert.equal((await h.state(other.cookie)).turnovers.length,0)
  const input={id:draft.id,revision:draft.revision,checks:draft.checklist,photo,mimeType:'image/png',caption:'Linen and keys ready'}
  await h.cmd('turnover.complete',input,other.cookie,404)
  await h.cmd('turnover.complete',{...input,checks:['Linen changed']},cleaner.cookie,400)
  await h.cmd('turnover.complete',{...input,photo:btoa('not an image')},cleaner.cookie,400)
  const done=await h.cmd('turnover.complete',input,cleaner.cookie)
  assert.equal(done.status,'completed')
  const path=`/api/cabin/turnovers/${draft.id}/photo`
  assert.equal((await h.send(path,undefined,'')).status,401)
  assert.equal((await h.send(path,undefined,other.cookie)).status,404)
  const response=await h.mf.dispatchFetch(h.origin+path,{headers:{cookie:cleaner.cookie}})
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(photo,'base64'))
  await h.cmd('turnover.complete',input,cleaner.cookie,409)
}))

test('owner statement amounts are integer cents, approved once per month and frozen with safe CSV cells', () => run(async h => {
  const p=await property(h,{name:'=HYPERLINK("https://formula.example")'}),cleaner=await h.person('Taylor')
  const input={propertyId:p.id,month:'2026-11',lines:[{description:'=Income',amountCents:125001},{description:'Cleaning',amountCents:-10000}]}
  await h.cmd('statement.prepare',{...input,lines:[{description:'Fractional',amountCents:0.1}]},h.owner,400)
  const d=await h.cmd('statement.prepare',input),rival=await h.cmd('statement.prepare',input)
  assert.equal(d.managementFeeCents,17250);assert.equal(d.netCents,97751)
  await h.cmd('statement.approve',{id:d.id,revision:'old'},h.owner,409)
  await h.cmd('statement.approve',{id:d.id,revision:d.revision})
  await h.cmd('statement.approve',{id:rival.id,revision:rival.revision},h.owner,409)
  const path=`/api/cabin/statements/${d.id}.csv`,a=await h.send(path,undefined,h.owner)
  assert.equal(a.status,200);assert.ok(a.text.includes("'=Income"));assert.ok(a.text.includes('977.51'))
  assert.equal((await h.send(path,undefined,cleaner.cookie)).status,403)
  const fields=new URLSearchParams({propertyId:p.id,month:'2026-12'});fields.append('lineDescription','Room income');fields.append('lineAmount','12.75');fields.append('lineDescription','Cleaning');fields.append('lineAmount','-2.25')
  const form=await h.mf.dispatchFetch(h.origin+'/app/action?name=statement.prepare&returnTo=/app/statements',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:fields.toString()});assert.equal(form.status,200)
  const natural=(await h.state()).statements.find(s=>s.month==='2026-12');assert.deepEqual(natural.lines.map(l=>l.amountCents),[1275,-225]);assert.equal(natural.grossCents,1050)
  await h.cmd('property.save',{...p,ownerName:'Updated owner',commissionBps:2000})
  assert.equal((await h.send(path,undefined,h.owner)).text,a.text)
}))

test('bearer agents prepare all three jobs but no approval door, and revocation is immediate', () => run(async h => {
  const p=await property(h),b=await booking(h,p),cleaner=await h.person('Taylor'),key=await h.cmd('agent.create',{label:'Operations assistant'})
  const headers={authorization:`Bearer ${key.token}`}
  const send=(name,input)=>h.send('/api/cabin/agent/command',{name,input},'',headers)
  assert.equal((await h.send('/api/cabin/agent/context',undefined,'',headers)).status,200)
  const page=await h.send('/app/agent',undefined,h.owner);assert.equal(page.status,200);assert.match(page.text,/Created [^<]+ (EDT|EST)</)
  for(const [name,input] of [['calendar.prepare',{propertyId:p.id,channel:'Booking.com',calendar:ics([{uid:'next',start:'20261108',end:'20261110'}])}],['turnover.prepare',{bookingId:b.id,cleanerId:cleaner.id,checklist:['Check keys']}],['statement.prepare',{propertyId:p.id,month:'2026-11',lines:[{description:'Income',amountCents:10000}]}]]){
    const prepared=await send(name,input);assert.equal(prepared.status,200,prepared.text)
    const d=prepared.value.result
    assert.equal((await send(name.replace('.prepare','.approve'),{id:d.id,revision:d.revision})).status,403)
  }
  assert.equal((await h.send('/api/cabin/command',{name:'statement.approve',input:{}},'',headers)).status,401)
  await h.cmd('agent.revoke',{id:key.id})
  assert.equal((await h.send('/api/cabin/agent/context',undefined,'',headers)).status,401)
}))

test('property-register move-in previews inertly, records the journal and guards undo against native edits', () => run(async h => {
  const preview=await h.cmd('import.preview',{csv})
  assert.equal((await h.state()).properties.length,0)
  await h.cmd('import.approve',{id:preview.id,fingerprint:'unreviewed'},h.owner,409)
  await h.cmd('import.approve',{id:preview.id,fingerprint:preview.fingerprint})
  assert.equal((await h.state()).properties.length,2)
  assert.ok((await h.state()).importJobs.some(j=>j.id===preview.id))
  await h.cmd('import.undo',{id:preview.id})
  assert.equal((await h.state()).properties.length,0)
  const again=await h.cmd('import.preview',{csv});await h.cmd('import.approve',{id:again.id,fingerprint:again.fingerprint})
  const p=(await h.state()).properties[0]
  await h.cmd('property.save',{...p,name:'Native correction'})
  const undo=await h.cmd('import.undo',{id:again.id}); assert.ok(undo.report.dispositions.some(d=>d.disposition==='retained' && d.reason==='edited'))
  assert.equal((await h.state()).properties.find(r=>r.id===p.id).name,'Native correction')
}))

const day = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10), ymd = n => day(n).replace(/-/g, '')
const nightsIn = text => [...text.matchAll(/DTSTART;VALUE=DATE:(\d{8})\r\nDTEND;VALUE=DATE:(\d{8})/g)].map(m => `${m[1]}-${m[2]}`)

test('a night booked on any channel closes on every other channel through scheduled iCal sync and export links', async () => {
  // The channel's calendar host is the only fake: a network edge serving whatever the channel would publish.
  let airbnb = ics([{ uid: 'airbnb-hm-1', start: ymd(10), end: ymd(13), summary: 'Reserved' }, { uid: 'airbnb-hm-2', start: ymd(20), end: ymd(22), summary: 'Airbnb (Not available)' }]), status = 200
  const h = await harness({ outbound: request => new URL(request.url).host === 'www.airbnb.com' ? new Response(airbnb, { status, headers: { 'content-type': 'text/calendar' } }) : new Response('unexpected', { status: 599 }) })
  try {
    const p = await property(h), links = await h.cmd('export.publish', { propertyId: p.id }), out = async slug => { const r = await h.send(`/ical/${links.token}/${slug}.ics`, undefined, ''); assert.equal(r.status, 200); return nightsIn(r.text) }
    await h.cmd('channel.connect', { propertyId: p.id, channel: 'airbnb', url: 'http://www.airbnb.com/calendar/ical/1.ics' }, h.owner, 400)
    const first = await h.cmd('channel.connect', { propertyId: p.id, channel: 'airbnb', url: 'https://www.airbnb.com/calendar/ical/4400.ics?s=fixture', intervalMinutes: 15 })
    assert.equal(first.connection.status, 'ok'); assert.equal(first.changes, 2)
    assert.deepEqual(await out('vrbo'), [`${ymd(10)}-${ymd(13)}`, `${ymd(20)}-${ymd(22)}`])
    assert.deepEqual(await out('booking-com'), await out('vrbo'))
    assert.deepEqual(await out('airbnb'), [])
    const direct = await h.cmd('reservation.request', { propertyId: p.id, channel: 'direct', kind: 'stay', guestName: 'Ana Ruiz', start: day(14), end: day(16), arrivalTime: '16:00' })
    assert.equal(direct.status, 'accepted')
    assert.ok((await out('airbnb')).includes(`${ymd(14)}-${ymd(16)}`)); assert.ok((await out('vrbo')).includes(`${ymd(14)}-${ymd(16)}`))
    // Airbnb cancels the first stay and sells another; the Cron's next due poll applies both.
    airbnb = ics([{ uid: 'airbnb-hm-2', start: ymd(20), end: ymd(22), summary: 'Airbnb (Not available)' }, { uid: 'airbnb-hm-3', start: ymd(24), end: ymd(27), summary: 'Reserved - Kai Moana' }])
    const due = () => h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.nextPollAt','2000-01-01T00:00:00.000Z') WHERE kind='connections'").run()
    await due(); await (await h.mf.getWorker()).scheduled({ cron: '*/5 * * * *' })
    assert.deepEqual(await out('vrbo'), [`${ymd(14)}-${ymd(16)}`, `${ymd(20)}-${ymd(22)}`, `${ymd(24)}-${ymd(27)}`])
    let state = await h.state(), link = state.connections[0]
    assert.equal(link.status, 'ok'); assert.ok(link.lastSuccessAt > first.connection.lastSuccessAt); assert.ok(link.nextPollAt > link.lastSuccessAt)
    assert.equal(state.bookings.find(b => b.uid === 'airbnb-hm-3').guestName, 'Kai Moana')
    // A failing channel goes stale with its error and keeps every night it last held.
    status = 503; await due(); await (await h.mf.getWorker()).scheduled({ cron: '*/5 * * * *' })
    state = await h.state(); link = state.connections[0]
    assert.equal(link.status, 'stale'); assert.ok(link.error); assert.ok(link.lastAttemptAt > link.lastSuccessAt)
    assert.ok((await out('vrbo')).includes(`${ymd(24)}-${ymd(27)}`))
    const page = await h.send(`/app/calendar?from=${day(8)}&days=14`, undefined, h.owner)
    assert.equal(page.status, 200)
    // One row per home: each stay's bar names the channels its nights close on.
    assert.match(page.text, /class="bar block[^"]*" title="Airbnb · blocked · [^"]*closed on Vrbo, Booking\.com and Direct"/)
    assert.match(page.text, /class="bar ch-direct[^"]*" title="Direct · Ana Ruiz · [^"]*closed on Airbnb, Vrbo and Booking\.com"/)
    await h.cmd('export.publish', { propertyId: p.id })
    assert.equal((await h.send(`/ical/${links.token}/vrbo.ics`, undefined, '')).status, 404)
  } finally { await h.close() }
})

test('an overlapping request is declined with its reason and the night is never sold twice', async () => {
  // RER Managed has no route out to channels yet: links refuse, while requests and export links work.
  const h = await harness({ auth: { RER_INSTALLATION_ID: 'inst-test', RER_MANAGEMENT_ORIGIN: 'https://manage.example' } })
  try {
    const p = await property(h)
    await h.cmd('channel.connect', { propertyId: p.id, channel: 'vrbo', url: 'https://www.vrbo.com/icalendar/1.ics' }, h.owner, 409)
    const d = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'airbnb', calendar: ics([{ uid: 'airbnb-hm-9', start: ymd(5), end: ymd(8) }]) })
    await h.cmd('calendar.approve', { id: d.id, revision: d.revision })
    const airbnbStay = (await h.state()).bookings[0], links = await h.cmd('export.publish', { propertyId: p.id })
    const before = (await h.send(`/ical/${links.token}/vrbo.ics`, undefined, '')).text.replace(/DTSTAMP:\S+/g, '')
    const declined = await h.cmd('reservation.request', { propertyId: p.id, channel: 'vrbo', kind: 'stay', guestName: 'Lee Park', start: day(7), end: day(9) })
    assert.equal(declined.status, 'declined'); assert.equal(declined.overlaps, airbnbStay.id); assert.match(declined.reason, /Airbnb/)
    const blocked = await h.cmd('reservation.request', { propertyId: p.id, kind: 'block', start: day(4), end: day(6), note: 'Owner stay' })
    assert.equal(blocked.status, 'declined')
    let state = await h.state()
    assert.equal(state.bookings.filter(b => b.status === 'confirmed').length, 1); assert.equal(state.requests.length, 2)
    assert.equal((await h.send(`/ical/${links.token}/vrbo.ics`, undefined, '')).text.replace(/DTSTAMP:\S+/g, ''), before)
    const adjacent = await h.cmd('reservation.request', { propertyId: p.id, channel: 'vrbo', kind: 'stay', guestName: 'Lee Park', start: day(8), end: day(10) })
    assert.equal(adjacent.status, 'accepted')
    // Two people take the same free nights at once: one is held, the other is refused or declined.
    const race = await Promise.all(['Sam Ito', 'Noa Levi'].map(guestName => h.send('/api/cabin/command', { name: 'reservation.request', input: { propertyId: p.id, channel: 'direct', kind: 'stay', guestName, start: day(12), end: day(14) } }, h.owner)))
    assert.ok(race.every(r => r.status === 200 || r.status === 409))
    state = await h.state()
    assert.equal(state.bookings.filter(b => b.status === 'confirmed' && b.start === day(12)).length, 1)
    const page = await h.send('/app/calendar', undefined, h.owner)
    assert.equal(page.status, 200); assert.ok(page.text.includes(declined.reason))
  } finally { await h.close() }
})
