import { homeDay } from './home-calendar.mjs'
import { attestArrival } from './readiness-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
const day = n => homeDay(n, 'America/New_York')
const mime = (id, question) => `From: Guest <guest@stay.example>\r\nTo: guests@stay.example\r\nSubject: Arrival\r\nMessage-ID: <${id}@stay.example>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${question}`

test('MESSAGE-004: narrow property authority, sourced drafts, escalation and exact human sending', async () => {
 let question = 'checkin', confidence = 99
 const h = await harness({outbound: async request => {
  if(new URL(request.url).hostname !== 'api.anthropic.com') return new Response('unexpected',{status:599})
  return Response.json({content:[{type:'text',text:JSON.stringify({reply:'A reply from the saved facts.', grounds:['check-in time'], needs_host:question==='other', note:question==='other'?'Unknown amenity requires a person.':'',topic:question,confidence,instruction_id:null})}]})
 }})
 try {
  const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:home.id,address:'240 Lake Road',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',checklist:['Ready'],photosRequired:1})
  await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
  const settings=async()=>(await h.accessState()).inbox[0]
  const policy=async(extra={})=>h.cmd('inbox.reply.policy',{revision:(await settings()).revision,propertyId:home.id,managerEmail:'manager@stay.example',from:'00:00',until:'23:59',replyMinutes:5,minConfidence:95,checkin:true,enabled:true,instructionTitle:'Parking',instructionAnswer:'Use the two marked spaces.',...extra})
  await policy()
  await h.cmd('inbox.ai.save',{key:'fixture-network-edge-key',revision:(await settings()).revision})
  const req=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',guestEmail:'guest@stay.example',start:day(3),end:day(6)})
  const receive=async(id,q)=>{const r=await h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=guest@stay.example&to=guests@stay.example`,{method:'POST',body:mime(id,q)});assert.equal(r.status,200)}
  await receive('supported','What is check-in time?')
  let s=await h.accessState(), auto=s.messages.find(m=>m.control?.automatic)
  assert.equal(auto.status,'sent');assert.match(auto.text,/16|4 pm/);assert.ok(auto.approvalId)
  question='other'
  await receive('unsupported','Is there a rooftop pool?')
  s=await h.accessState();let draft=s.messages.find(m=>m.status==='draft')
  assert.ok(draft.control.escalatedAt);assert.equal(draft.control.assignedEmail,'manager@stay.example')
  assert.ok(s.notices.some(n=>n.kind==='inbox'&&n.recordId===draft.id&&n.status==='sent'))
  await h.cmd('message.send',{id:draft.id,revision:draft.revision,text:'I checked with Karen: the home has no rooftop pool.'})
  s=await h.accessState();assert.equal(s.messages.find(m=>m.id===draft.id).text,'I checked with Karen: the home has no rooftop pool.')
  await h.cmd('message.send',{id:draft.id,revision:draft.revision},h.owner,409)
  question='checkin';confidence=70
  await receive('low-confidence','Please confirm arrival details')
  s=await h.accessState();draft=s.messages.find(m=>m.status==='draft')
  assert.equal(draft.control.automatic,undefined)
  // A deadline passes without approval; Cron escalates and never sends the draft.
  const stored=JSON.parse((await h.db.prepare("SELECT data FROM cb_records WHERE id=?").bind(draft.id).first()).data)
  stored.control.dueAt=new Date(Date.now()-60000).toISOString()
  await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(stored),draft.id).run()
  await h.mf.getWorker().then(w=>w.scheduled({cron:'*/5 * * * *'}))
  s=await h.accessState();assert.equal(s.messages.find(m=>m.id===draft.id).status,'draft');assert.ok(s.messages.find(m=>m.id===draft.id).control.escalatedAt)
  // Changed instructions fence previously drafted source claims.
  await policy({instructionAnswer:'Use the garage instead.'})
  await h.cmd('message.send',{id:draft.id,revision:s.messages.find(m=>m.id===draft.id).revision},h.owner,409)
  question='checkin';confidence=99
  await receive('compensation','Can we have early check-in and a refund?')
  assert.ok((await h.accessState()).messages.some(m=>m.status==='draft'&&m.replyTo))
  await policy({enabled:false})
  await receive('off','What is check-in time?')
  assert.ok((await h.accessState()).messages.some(m=>m.status==='draft'))
  const queued=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(auto.id).first()).data);queued.status='pending';await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(queued),auto.id).run()
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  assert.equal((await h.accessState()).messages.find(m=>m.id===auto.id).status,'draft','revoked automatic authority fences a queued send')
  assert.ok(req.bookingId)
 } finally {await h.close()}
})

test('MESSAGE-004 OPS-005: human early-arrival approval follows readiness and changes guest/cleaner access once',async()=>{
 const day = n => homeDay(n, 'Pacific/Honolulu')
 const h=await harness()
 try{
  const home=await h.cmd('property.save',{name:'Ready Lake Loft',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  const cleaner=await h.person('Luis')
  await h.cmd('home.settings',{propertyId:home.id,address:'240 Lake Road',timeZone:'Pacific/Honolulu',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
  await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
  const prev=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Previous guest',start:day(-3),end:day(-1)})
  const req=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',guestEmail:'guest@stay.example',start:day(2),end:day(5)})
  await h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=guest@stay.example&to=guests@stay.example`,{method:'POST',body:mime('early','Can we check in at 2 pm?')})
  let s=await h.accessState(),b=s.bookings.find(b=>b.id===req.bookingId),m=s.messages.find(m=>m.direction==='in')
  const approve=()=>h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true})
  await h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true},h.owner,409)
  // A real completed turnover after a checked-out stay supplies readiness evidence.
  // Historical stays do not auto-dispatch; use the public prepare/approve doors.
  let turnover=s.turnovers.find(t=>t.bookingId===prev.bookingId)
  if(!turnover){turnover=await h.cmd('turnover.prepare',{bookingId:prev.bookingId,cleanerId:cleaner.id,dueDate:day(2),checklist:['Ready']});await h.cmd('turnover.approve',{id:turnover.id,revision:turnover.revision})}
  s=await h.accessState();turnover=s.turnovers.find(t=>t.bookingId===prev.bookingId)
  await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:['Ready'],photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}],caption:'Ready for Megan'},cleaner.cookie)
  await attestArrival(h,req.bookingId)
  await approve()
  s=await h.accessState();assert.equal(s.bookings.find(b=>b.id===req.bookingId).arrivalTime,'14:00')
  assert.ok(s.codes.find(c=>c.bookingId===req.bookingId&&c.holder==='guest').validFrom.endsWith('T14:00'))
  assert.ok(s.turnovers.find(t=>t.bookingId===prev.bookingId).windowEnd.endsWith('T14:00'))
  assert.equal(s.messages.filter(m=>m.source==='host'&&m.approvalId&&m.bookingId===req.bookingId).length,1)
  await h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true},h.owner,409)
 }finally{await h.close()}
})

test('MESSAGE-002: an after-hours lockout is routed to the person on shift, noted privately, claimed, handed over and escalated with its full context until someone accepts', async () => {
 const h = await harness(), zone = 'America/New_York'
 const hm = minutes => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now() + minutes * 60_000))
 try {
  const home = await h.cmd('property.save', { name: 'Lake Loft', ownerName: 'Karen', ownerEmail: 'karen@stay.example', commissionBps: 2000 })
  await h.cmd('home.settings', { propertyId: home.id, address: '240 Lake Road', timeZone: zone, checkInTime: '16:00', checkOutTime: '10:00', checklist: ['Ready'], photosRequired: 1 })
  await h.cmd('inbox.address', { address: 'guests@stay.example', revision: '' })
  const [ana, ben, dana, luis] = [await h.person('Ana', 'manager'), await h.person('Ben', 'manager'), await h.person('Dana', 'manager'), await h.person('Luis')]
  const team = async input => h.cmd('inbox.team.set', { revision: (await h.accessState()).inbox[0].revision, ...input })
  await team({ section: 'response', normalMinutes: 240, urgentMinutes: 30, repeatMinutes: 30, escalationMemberId: dana.id })
  await team({ section: 'route', propertyId: home.id, urgency: 'urgent', memberId: ana.id })
  await team({ section: 'shift', memberId: ana.id, days: [0, 1, 2, 3, 4, 5, 6], from: hm(120), until: hm(180) })
  await team({ section: 'shift', memberId: ben.id, days: [0, 1, 2, 3, 4, 5, 6], from: hm(-60), until: hm(60) })
  await team({ section: 'template', title: 'Lockout help', text: 'Hi {guest}, we are on it. Your stay page: {stay_link}' })
  await h.cmd('reservation.request', { propertyId: home.id, channel: 'direct', guestName: 'Megan Ortiz', guestEmail: 'guest@stay.example', start: day(0), end: day(3) })
  await h.cmd('task.raise', { propertyId: home.id, title: 'Front door keypad is loose', blocking: true })
  const guestWrites = text => h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=guest@stay.example&to=guests@stay.example`, { method: 'POST', body: mime(`m${Math.random()}`, text) })
  const cases = async () => (await h.accessState()).threadCases
  const age = async id => { const row = JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(id).first()).data); row.dueAt = new Date(Date.now() - 60_000).toISOString(); await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(row), id).run(); await (await h.mf.getWorker()).scheduled({ cron: '*/5 * * * *' }) }
  const say = async (name, input, who) => { const r = await h.send('/api/cabin/command', { name, input }, who.cookie); return r }
  assert.equal((await guestWrites("Help, I'm locked out and the door code doesn't work")).status, 200)
  let [row] = await cases()
  assert.equal(row.urgency, 'urgent'); assert.ok(row.labels.includes('access'))
  assert.equal(row.assigneeId, ben.id, 'Ana is off shift, so the person on shift takes the urgent route'); assert.match(row.route, /On shift/)
  assert.equal(Date.parse(row.dueAt) - Date.parse(row.waitingSince), 30 * 60_000)
  // A private note and promise stay inside the team: never a message, never mail.
  const note = (await h.cmd('thread.note', { thread: row.id, text: 'Promised a callback within 15 minutes', promise: true }, ben.cookie))
  let s = await h.accessState()
  assert.ok(!s.messages.some(m => m.text.includes('Promised a callback')))
  assert.equal((await say('message.send', { id: note.id, revision: note.id, text: 'x' }, ben)).status, 404)
  assert.equal((await say('thread.note', { thread: row.id, text: 'x' }, luis)).status, 403)
  // Two people cannot answer the guest at once.
  await h.cmd('thread.claim', { thread: row.id }, ben.cookie)
  const page = await h.send(`/app/inbox?thread=${row.id}`, undefined, ana.cookie)
  assert.match(page.text, /Ben is replying/, 'the collision shows to the other person')
  const clash = await say('message.compose', { thread: row.id, text: 'I will take it' }, ana)
  assert.equal(clash.status, 409); assert.match(clash.value.error, /Ben is replying/)
  assert.equal((await say('thread.claim', { thread: row.id }, ana)).status, 409)
  await h.cmd('thread.accept', { thread: row.id }, ben.cookie)
  await h.cmd('thread.triage', { thread: row.id, labels: 'Access, VIP', urgency: 'urgent' }, ben.cookie)
  await h.cmd('thread.assign', { thread: row.id, memberId: dana.id }, ben.cookie)
  row = (await cases())[0]; assert.deepEqual(row.labels, ['access', 'vip']); assert.equal(row.assigneeId, dana.id); assert.equal(row.status, 'open')
  await h.cmd('thread.assign', { thread: row.id, memberId: ben.id }, ben.cookie)
  await h.cmd('thread.accept', { thread: row.id }, ben.cookie)
  // Handover keeps the reservation, open tasks and prior promises, and the next person must accept.
  await h.cmd('thread.handover', { thread: row.id, memberId: ana.id, summary: 'Guest outside; code reset needed.' }, ben.cookie)
  row = (await cases())[0]
  assert.equal(row.status, 'open'); assert.equal(row.assigneeId, ana.id); assert.equal(row.acceptedByName, null)
  const handover = row.handovers[0]
  assert.match(handover.reservation, /Lake Loft/); assert.deepEqual(handover.tasks.map(t => t.title), ['Front door keypad is loose']); assert.deepEqual(handover.promises.map(p => p.text), ['Promised a callback within 15 minutes'])
  s = await h.accessState()
  assert.ok(s.notices.some(n => n.memberId === ana.id && n.recordId === row.id && /code reset needed/.test(n.text) && /Promised a callback/.test(n.text)))
  // The deadline passes: the escalation manager gets the whole picture, again and again, until accepted.
  await age(row.id); await age(row.id)
  s = await h.accessState(); row = s.threadCases[0]
  const escalations = s.notices.filter(n => n.memberId === dana.id && n.recordId === row.id && /unanswered/.test(n.subject))
  assert.equal(row.escalations.length, 2); assert.equal(escalations.length, 2)
  for (const text of ["locked out", 'Promised a callback', 'code reset needed', 'Front door keypad is loose', 'Lake Loft']) assert.match(escalations[0].text, new RegExp(text))
  await h.cmd('thread.accept', { thread: row.id }, dana.cookie)
  await age(row.id)
  row = (await cases())[0]
  assert.equal(row.status, 'accepted'); assert.equal(row.acceptedByName, 'Dana'); assert.equal(row.escalations.length, 2, 'acceptance stops escalation')
  // A template becomes a draft for a person to edit and send; one sent reply makes the next person wait.
  const draft = await h.cmd('thread.template', { thread: row.id, templateId: (await h.accessState()).inbox[0].team.templates[0].id }, ana.cookie)
  assert.equal(draft.status, 'draft'); assert.match(draft.text, /^Hi Megan, we are on it/)
  await h.cmd('message.send', { id: draft.id, revision: draft.revision, text: draft.text }, ana.cookie)
  row = (await cases())[0]; assert.equal(row.status, 'answered')
  const second = await say('message.compose', { thread: row.id, text: 'Also from me' }, ben)
  assert.equal(second.status, 409); assert.match(second.value.error, /Ana just replied/)
  const toGuest = (await h.db.prepare('SELECT message FROM rer_mail_development_outbox').all()).results.map(r => JSON.parse(r.message)).filter(m => m.to.includes('guest@stay.example'))
  assert.ok(toGuest.length && toGuest.every(m => !m.text.includes('Promised a callback')), 'a private note is never delivered to the guest')
 } finally { await h.close() }
})
