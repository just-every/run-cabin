import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
const day = n => new Date(Date.now()+n*86400000).toISOString().slice(0,10)
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
  const settings=async()=>(await h.state()).inbox[0]
  const policy=async(extra={})=>h.cmd('inbox.reply.policy',{revision:(await settings()).revision,propertyId:home.id,managerEmail:'manager@stay.example',from:'00:00',until:'23:59',replyMinutes:5,minConfidence:95,checkin:true,enabled:true,instructionTitle:'Parking',instructionAnswer:'Use the two marked spaces.',...extra})
  await policy()
  await h.cmd('inbox.ai.save',{key:'fixture-network-edge-key',revision:(await settings()).revision})
  const req=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',guestEmail:'guest@stay.example',start:day(3),end:day(6)})
  const receive=async(id,q)=>{const r=await h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=guest@stay.example&to=guests@stay.example`,{method:'POST',body:mime(id,q)});assert.equal(r.status,200)}
  await receive('supported','What is check-in time?')
  let s=await h.state(), auto=s.messages.find(m=>m.control?.automatic)
  assert.equal(auto.status,'sent');assert.match(auto.text,/16|4 pm/);assert.ok(auto.approvalId)
  question='other'
  await receive('unsupported','Is there a rooftop pool?')
  s=await h.state();let draft=s.messages.find(m=>m.status==='draft')
  assert.ok(draft.control.escalatedAt);assert.equal(draft.control.assignedEmail,'manager@stay.example')
  assert.ok(s.notices.some(n=>n.kind==='inbox'&&n.recordId===draft.id&&n.status==='sent'))
  await h.cmd('message.send',{id:draft.id,revision:draft.revision,text:'I checked with Karen: the home has no rooftop pool.'})
  s=await h.state();assert.equal(s.messages.find(m=>m.id===draft.id).text,'I checked with Karen: the home has no rooftop pool.')
  await h.cmd('message.send',{id:draft.id,revision:draft.revision},h.owner,409)
  question='checkin';confidence=70
  await receive('low-confidence','Please confirm arrival details')
  s=await h.state();draft=s.messages.find(m=>m.status==='draft')
  assert.equal(draft.control.automatic,undefined)
  // A deadline passes without approval; Cron escalates and never sends the draft.
  const stored=JSON.parse((await h.db.prepare("SELECT data FROM cb_records WHERE id=?").bind(draft.id).first()).data)
  stored.control.dueAt=new Date(Date.now()-60000).toISOString()
  await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(stored),draft.id).run()
  await h.mf.getWorker().then(w=>w.scheduled({cron:'*/5 * * * *'}))
  s=await h.state();assert.equal(s.messages.find(m=>m.id===draft.id).status,'draft');assert.ok(s.messages.find(m=>m.id===draft.id).control.escalatedAt)
  // Changed instructions fence previously drafted source claims.
  await policy({instructionAnswer:'Use the garage instead.'})
  await h.cmd('message.send',{id:draft.id,revision:s.messages.find(m=>m.id===draft.id).revision},h.owner,409)
  question='checkin';confidence=99
  await receive('compensation','Can we have early check-in and a refund?')
  assert.ok((await h.state()).messages.some(m=>m.status==='draft'&&m.replyTo))
  await policy({enabled:false})
  await receive('off','What is check-in time?')
  assert.ok((await h.state()).messages.some(m=>m.status==='draft'))
  assert.ok(req.bookingId)
 } finally {await h.close()}
})

test('MESSAGE-004 OPS-005: human early-arrival approval follows readiness and changes guest/cleaner access once',async()=>{
 const h=await harness()
 try{
  const home=await h.cmd('property.save',{name:'Ready Lake Loft',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  const cleaner=await h.person('Luis')
  await h.cmd('home.settings',{propertyId:home.id,address:'240 Lake Road',timeZone:'Pacific/Honolulu',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
  await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
  const prev=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Previous guest',start:day(-3),end:day(-1)})
  const req=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',guestEmail:'guest@stay.example',start:day(2),end:day(5)})
  await h.mf.dispatchFetch(`${h.origin}/cdn-cgi/local/email?from=guest@stay.example&to=guests@stay.example`,{method:'POST',body:mime('early','Can we check in at 2 pm?')})
  let s=await h.state(),b=s.bookings.find(b=>b.id===req.bookingId),m=s.messages.find(m=>m.direction==='in')
  const approve=()=>h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true})
  await h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true},h.owner,409)
  // A real completed turnover after a checked-out stay supplies readiness evidence.
  // Historical stays do not auto-dispatch; use the public prepare/approve doors.
  let turnover=s.turnovers.find(t=>t.bookingId===prev.bookingId)
  if(!turnover){turnover=await h.cmd('turnover.prepare',{bookingId:prev.bookingId,cleanerId:cleaner.id,dueDate:day(2),checklist:['Ready']});await h.cmd('turnover.approve',{id:turnover.id,revision:turnover.revision})}
  s=await h.state();turnover=s.turnovers.find(t=>t.bookingId===prev.bookingId)
  await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:['Ready'],photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}],caption:'Ready for Megan'},cleaner.cookie)
  await approve()
  s=await h.state();assert.equal(s.bookings.find(b=>b.id===req.bookingId).arrivalTime,'14:00')
  assert.ok(s.codes.find(c=>c.bookingId===req.bookingId&&c.holder==='guest').validFrom.endsWith('T14:00'))
  assert.ok(s.turnovers.find(t=>t.bookingId===prev.bookingId).windowEnd.endsWith('T14:00'))
  assert.equal(s.messages.filter(m=>m.source==='host'&&m.approvalId&&m.bookingId===req.bookingId).length,1)
  await h.cmd('message.arrival.approve',{bookingId:b.id,bookingRevision:b.revision,messageId:m.id,arrivalTime:'14:00',confirm:true},h.owner,409)
 }finally{await h.close()}
})
