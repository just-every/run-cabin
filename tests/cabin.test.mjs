import { rooms as capacityRooms, sourceRoom } from './capacity-support.mjs'
import { seamEdge } from './seam-edge.mjs'
import { homeDay } from './home-calendar.mjs'
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

const day = n => homeDay(n, 'America/New_York'), ymd = n => day(n).replace(/-/g, '')
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
    const page = await h.send(`/app/calendar?from=${day(0)}&days=14`, undefined, h.owner)
    assert.equal(page.status, 200); assert.ok(page.text.includes(declined.reason))
  } finally { await h.close() }
})

test('PMS team invitations enforce each role’s property/actions, private read scopes and immediate offboarding',async()=>{
 const edge=seamEdge(),requests=edge.calls,h=await harness({auth:{SEAM_API_KEY:'synthetic-cabin-1'},outbound:edge.outbound})
 try{
  const p=await property(h,{name:'Pine Ridge Private',ownerEmail:'rentalowner@stay.example'}),other=await property(h,{name:'Lake Loft Confidential',ownerEmail:'otherowner@stay.example'})
  for(const home of [p,other])await h.cmd('home.settings',{propertyId:home.id,address:'200 Synthetic Road',timeZone:'America/New_York',checklist:['Ready']})
  await h.cmd('owner.policy',{propertyId:p.id,calendarVisibility:'availability',expenseLimitCents:0,maxStayNights:14,noticeDays:0,agreement:'Explicit personal-stay request terms'})
  const a=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',guestName:'Pine Guest',guestEmail:'pine@stay.example',start:day(3),end:day(5)}),b=await h.cmd('reservation.request',{propertyId:other.id,channel:'direct',guestName:'Lake Secret Guest',guestEmail:'lake@stay.example',start:day(3),end:day(5)})
  const statements=[]
  for(const home of [p,other]){const s=await h.cmd('statement.prepare',{propertyId:home.id,month:'2026-11',lines:[{description:'Rent',amountCents:10000}]});await h.cmd('statement.approve',{id:s.id,revision:s.revision});statements.push(s)}
  await h.cmd('direct.agreement.template',{propertyId:other.id,agreementTitle:'Private rental terms',agreementState:'NY',agreement:'Private identity and rental evidence',agreementRequired:true,agreementBlockAccess:false})
  await h.cmd('direct.agreement.request',{bookingId:b.bookingId})
  const docs=(await h.accessState()).rentalAgreements.find(r=>r.bookingId===b.bookingId),document=docs.documents.at(-1)
  const roles=[
   ['manager',['operations:read','calendar:read','finance:read','reports:read','identity:read','task.raise'],'task.raise'],
   ['reservation',['calendar:read','reservations:read','booking.details'],'booking.details'],
   ['guest_service',['reservations:read','inbox:read','operations:read','access:read','booking.details'],'booking.details'],
   ['accountant',['finance:read','reports:read','statement.prepare'],'statement.prepare'],
   ['inspector',['operations:read','access:read','task.raise'],'task.raise'],
   ['cleaner',['operations:read','access:read','task.raise'],'task.raise'],
   ['maintenance',['operations:read','access:read','task.raise'],'task.raise'],
   ['rental_owner',['owners:read','rentalOwner.stay.request'],'rentalOwner.stay.request']
  ],people=[]
  const actionInput=(name,home,booking)=>name==='booking.details'?{id:booking.bookingId,revision:booking.revision,guestName:'Updated guest',guestEmail:'updated@stay.example'}:name==='statement.prepare'?{propertyId:home.id,month:'2026-12',lines:[{description:'Scoped income',amountCents:5000}]}:name==='rentalOwner.stay.request'?{propertyId:home.id,start:day(20),end:day(22),note:'Owner personal stay'}:{propertyId:home.id,title:'Check porch light',note:'Scoped field report'}
  for(const [role,actions,action] of roles){
   const email=role==='rental_owner'?p.ownerEmail:role+'@stay.example',fields=new URLSearchParams({name:role,email,pmsRole:role,active:'true'});fields.append('propertyIds',p.id);for(const permission of actions)fields.append('actions',permission)
   const saved=await h.mf.dispatchFetch(h.origin+'/app/action?name=member.save&returnTo=/app/people',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:fields.toString()});assert.equal(saved.status,200,await saved.text())
   const member=(await h.state()).members.find(m=>m.email===email);assert.ok(member?.scope.actions.includes(action));await h.cmd('member.invite',{id:member.id});const cookie=await h.signIn(email);people.push({...member,cookie})
   const visible=await h.state(cookie);assert.ok(!JSON.stringify(visible).includes(other.id)&&!JSON.stringify(visible).includes('Lake Secret Guest'),'the state has no other-home rows or counts')
   if(['inspector','cleaner','maintenance'].includes(role)){assert.ok(!JSON.stringify(visible).includes('Pine Guest'));assert.equal(visible.verifications.length,0);assert.equal(visible.statements.length,0)}
   let serviceTurnover
   if(['inspector','cleaner','maintenance'].includes(role)){serviceTurnover=(await h.state()).turnovers.find(t=>t.bookingId===a.bookingId&&t.status!=='cancelled');if(serviceTurnover.cleanerId!==member.id)await h.cmd('turnover.assign',{id:serviceTurnover.id,revision:serviceTurnover.revision,cleanerId:member.id})}
   a.revision=(await h.state()).bookings.find(b=>b.id===a.bookingId).revision;b.revision=(await h.state()).bookings.find(r=>r.id===b.bookingId).revision
   await h.cmd(action,{...actionInput(action,p,a),...(serviceTurnover?{turnoverId:serviceTurnover.id}:{})},cookie)
   await h.cmd(action,actionInput(action,other,b),cookie,404)
   for(const route of [`/api/cabin/statements/${statements[1].id}.csv`,`/api/cabin/statements/${statements[1].id}.pdf`,`/api/cabin/agreements/${docs.id}/${document.id}`])assert.ok([403,404].includes((await h.send(route,undefined,cookie)).status),role+' cannot read another home’s documents')
   await h.cmd('agent.create',{label:'Unauthorized key'},cookie,403)
   await h.cmd('provider.sharing',{id:'seam',operation:'credential',SEAM_API_KEY:'synthetic-cabin-2'},cookie,403)
   assert.equal((await h.send('/api/cabin/agent/context',undefined,cookie)).status,401)
   if(role==='rental_owner'){assert.equal((await h.send('/app/rental-owner/statements/'+statements[0].id+'.csv',undefined,cookie)).status,200);assert.equal((await h.send('/app/rental-owner/statements/'+statements[1].id+'.csv',undefined,cookie)).status,404);const own=await h.send('/app/rental-owner/api/state',undefined,cookie);assert.deepEqual(own.value.properties.map(p=>p.id),[p.id])}
   const humanPage=await h.send(role==='accountant'?'/app/reports':role==='rental_owner'?'/app':'/app/maintenance',undefined,cookie)
   if(role==='accountant'||role==='rental_owner'||role==='manager'||['inspector','cleaner','maintenance'].includes(role))assert.equal(humanPage.status,200,humanPage.text)
  }
  const manager=people[0],scopedReport=await h.send('/api/cabin/reports.json?from=2026-11-01&until=2026-12-01',undefined,people[3].cookie)
  assert.equal(scopedReport.status,200,scopedReport.text);assert.deepEqual(scopedReport.value.properties.map(p=>p.id),[p.id]);assert.ok(!scopedReport.text.includes(other.id))
  // A real connected device code is removed on offboarding, not merely hidden in the UI.
  const cleaner=people.find(m=>m.scope.pmsRole==='cleaner'),settings=(await h.state()).homeSettings.find(s=>s.propertyId===p.id)
  await h.cmd('home.settings',{...settings,cleanerId:cleaner.id,lockDeviceId:'synthetic-cabin-3'})
  const assigned=(await h.state()).turnovers.find(t=>t.bookingId===a.bookingId&&t.status!=='cancelled');if(assigned.cleanerId!==cleaner.id)await h.cmd('turnover.assign',{id:assigned.id,revision:assigned.revision,cleanerId:cleaner.id})
  const code=(await h.accessState()).codes.find(c=>c.holder==='cleaner'&&c.memberId===cleaner.id&&c.status==='issued');assert.ok(code?.lock.providerId)
  await h.cmd('member.save',{...cleaner,active:false})
  const after=(await h.accessState()).codes.find(c=>c.id===code.id);assert.equal(after.status,'revoked');assert.equal(after.lock.state,'removed');assert.ok(requests.some(r=>r.path.endsWith('/delete')&&r.body.access_code_id===code.lock.providerId))
  const saved=await h.cmd('report.save',{name:'Queued scope check',filters:{from:day(1),until:day(30),property:p.id}}),schedule=await h.cmd('report.schedule',{savedReportId:saved.id,savedReportRevision:saved.revision,recipientKind:'member',recipientMemberId:manager.id,period:'saved-window',cadence:'once',format:'json',nextRunAt:new Date(Date.now()+86400000).toISOString(),consent:true})
  for(const person of people.filter(p=>p.id!==cleaner.id))await h.cmd('member.save',{...person,active:false})
  const due=new Date(Date.now()-60000).toISOString();await h.db.prepare("UPDATE cb_report_schedules SET next_run_at=?,data=json_set(data,'$.nextRunAt',?) WHERE id=?").bind(due,due,schedule.id).run();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  const sharing=await h.send('/api/cabin/report-sharing.json',undefined,h.owner),refused=sharing.value.reportRuns.find(r=>r.scheduleId===schedule.id)
  assert.equal(refused.status,'refused');assert.ok(!refused.artifact);assert.ok(sharing.value.reportFollowups.some(f=>f.runId===refused.id))

  for(const person of people){await h.state(person.cookie,403);await h.cmd('task.raise',{propertyId:p.id,title:'Offboarded',note:'Must not run'},person.cookie,403)}
 }finally{await h.close()}
})

test('linked physical rooms preserve independent capacity through source cancellation and whole-home sale',async()=>{
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const whole=await property(h),{a,b,profile}=await capacityRooms(h,whole),start='2026-12-10',end='2026-12-13'
  const links=[];for(const p of [a,b,whole])links.push(await h.cmd('export.publish',{propertyId:p.id}))
  const out=async(i,slug='airbnb')=>(await h.send(`/ical/${links[i].token}/${slug}.ics`)).text
  await sourceRoom(h,a,start,end)
  assert.match(await out(2),/20261210/,'same-channel whole-home export includes room closure')
  assert.doesNotMatch(await out(1),/20261210/,'independent room B stays open')
  const rival=await h.cmd('reservation.request',{propertyId:b.id,channel:'direct',guestName:'Room B guest',start,end});assert.equal(rival.status,'accepted')
  const denied=await h.cmd('reservation.request',{propertyId:whole.id,channel:'direct',guestName:'Whole guest',start,end});assert.equal(denied.status,'declined')
  await h.cmd('property.profile',{propertyId:a.id,occupancyLimit:2,inventoryUnits:[b.id]},h.owner,409)
  await sourceRoom(h,a,start,end,true)
  assert.match(await out(2),/20261210/,'room B still holds the whole home')
  let row=(await h.state()).bookings.find(r=>r.id===rival.bookingId);await h.cmd('reservation.cancel',{id:row.id,revision:row.revision})
  assert.doesNotMatch(await out(2),/20261210/)
  const sold=await h.cmd('reservation.request',{propertyId:whole.id,channel:'direct',guestName:'Whole guest',start,end});assert.equal(sold.status,'accepted')
  assert.match(await out(0),/20261210/);assert.match(await out(1),/20261210/)
  assert.equal((await h.cmd('reservation.request',{propertyId:a.id,channel:'direct',kind:'block',note:'Maintenance',start,end})).status,'declined')
  const boundary=await h.cmd('reservation.request',{propertyId:a.id,channel:'direct',guestName:'Next guest',start:end,end:'2026-12-15'});assert.equal(boundary.status,'accepted')
  const conflict=await sourceRoom(h,a,start,end);assert.equal(conflict.clashes.length,1,'authoritative conflicting source stays remain visible')
  assert.equal((await h.state()).bookings.filter(r=>r.status==='confirmed'&&r.start===start).length,2)
  const page=await h.send('/app/calendar?from=2026-12-01',undefined,h.owner);assert.equal(page.status,200);assert.match(page.text,/Shared inventory/)
 }finally{await h.close()}
})
