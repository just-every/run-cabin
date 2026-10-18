import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {harness} from './harness.mjs'
const photo={photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}

test('AGENT-003: guest issues bind approved sources, dispatch accepted inspected work, require guest and recurrence confirmation, and escalate emergencies',async()=>{
 const h=await harness()
 try{
  const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
  const vendor=await h.person('Dale'),backup=await h.person('Ana'),inspector=await h.person('Lee'),unrelated=await h.person('Other'),host=await h.person('Riley','manager')
  await h.cmd('home.settings',{propertyId:home.id,address:'120 Lake Drive, Asheville, NC',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',maintenanceId:vendor.id,checklist:['Clean'],photosRequired:1})
  const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+4*86400000).toISOString().slice(0,10)
  const booked=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',start,end,guestName:'Megan Ortiz',guestEmail:'megan@stay.example'})
  let policy=await h.cmd('issue.settings',{propertyId:home.id,responsibleId:host.id,inspectorId:inspector.id,vendorIds:[vendor.id,backup.id],spendLimitCents:15000,recurrenceMinutes:1,instructionCategory:'access',instructionTitle:'Check the keypad display',instructionAnswer:'Tell the host whether the keypad display is lit. Do not dismantle it.'})
  const page='/stay/'+(await h.accessState()).codes.find(c=>c.bookingId===booked.bookingId&&c.holder==='guest').link
  const guest=async body=>h.mf.dispatchFetch(h.origin+page,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'})
  assert.equal((await guest({reason:'Door keypad does not respond',category:'access'})).status,200)
  let issue=(await h.state()).recoveries.find(r=>r.issue?.category==='access')
  assert.ok(issue.issue.troubleshooting.sources.some(s=>s.includes(booked.bookingId)))
  const act=async(name,input={},cookie=h.owner,status=200)=>{const result=await h.cmd(name,{id:issue.id,revision:issue.revision,...input},cookie,status);if(status===200)issue=result;return result}
  await act('issue.accept',{},h.owner,403);await act('issue.accept',{},host.cookie)
  await act('issue.propose',{vendorId:vendor.id,estimateCents:16000});await act('issue.dispatch',{},host.cookie,409)
  await act('issue.propose',{vendorId:vendor.id,estimateCents:10000})
  policy=await h.cmd('issue.settings',{propertyId:home.id,revision:policy.revision,responsibleId:host.id,inspectorId:inspector.id,vendorIds:[vendor.id,backup.id],spendLimitCents:15000,recurrenceMinutes:1,instructionCategory:'access',instructionTitle:'Observe keypad',instructionAnswer:'Tell the host what appears on the display.'})
  await act('issue.dispatch',{},host.cookie,409)
  await act('issue.propose',{vendorId:vendor.id,estimateCents:10000});await act('issue.troubleshoot',{},host.cookie);await act('issue.dispatch',{},host.cookie)
  let task=(await h.state()).tasks.find(t=>t.id===issue.issue.taskId)
  const work=async(name,input={},cookie=vendor.cookie,status=200)=>{const result=await h.cmd(name,{id:task.id,revision:task.revision,...input},cookie,status);if(status===200)task=result;issue=(await h.state()).recoveries.find(r=>r.id===issue.id);return result}
  await work('work.accept',{},unrelated.cookie,404)
  await work('work.decline',{note:'Cannot arrive today'})
  assert.equal(issue.issue.declines.length,1)
  await act('issue.propose',{vendorId:backup.id,estimateCents:0},host.cookie);await act('issue.dispatch',{},host.cookie)
  task=(await h.state()).tasks.find(t=>t.id===issue.issue.taskId)
  await work('work.accept',{},backup.cookie)
  await work('work.complete',{checks:task.work.checklist,note:'Replaced keypad batteries; host tested entry',photos:[photo]},backup.cookie)
  assert.equal((await guest({action:'issue-response',caseId:issue.id,revision:issue.revision,response:'fixed',evidence:'It opens now'})).status,409)
  await work('work.inspect',{note:'Independent host entry test passed'},inspector.cookie)
  assert.ok(issue.issue.confirmationMessageId)
  assert.equal((await guest({action:'issue-response',caseId:issue.id,revision:issue.revision,response:'fixed',evidence:'I tested the door; it opens'})).status,303)
  issue=(await h.state()).recoveries.find(r=>r.id===issue.id)
  assert.notEqual(issue.status,'closed')
  assert.equal((await guest({action:'issue-response',caseId:issue.id,revision:issue.revision,response:'still_fixed',evidence:'Still opens'})).status,409)
  await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.issue.recurrenceDueAt',?) WHERE id=?").bind(new Date(Date.now()-1000).toISOString(),issue.id).run()
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  issue=(await h.state()).recoveries.find(r=>r.id===issue.id)
  assert.ok(issue.issue.recurrenceRequestedAt)
  assert.equal((await guest({action:'issue-response',caseId:issue.id,revision:issue.revision,response:'still_fixed',evidence:'I checked again later; the door still works'})).status,303)
  assert.equal((await h.state()).recoveries.find(r=>r.id===issue.id).status,'closed')
  await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
  const mime='From: Megan <megan@stay.example>\r\nTo: guests@stay.example\r\nSubject: Urgent\r\nMessage-ID: <emergency-1@stay.example>\r\nContent-Type: text/plain\r\n\r\nThere is smoke and sparks at the appliance.'
  assert.equal((await h.mf.dispatchFetch(h.origin+'/cdn-cgi/local/email?from=megan@stay.example&to=guests@stay.example',{method:'POST',body:mime})).status,200)
  let s=await h.state(),emergency=s.recoveries.find(r=>r.issue?.category==='emergency')
  assert.equal(emergency.issue.assignedId,host.id);assert.equal(emergency.status,'escalated');assert.match(emergency.issue.emergencyInstructions,/911/)
  assert.ok(s.notices.some(n=>n.recordId===emergency.id&&n.email===host.email&&n.status==='sent'))
  assert.ok(!s.messages.some(m=>m.bookingId===booked.bookingId&&m.text.includes('smoke')&&m.status==='sent'))
  assert.equal((await h.send('/api/cabin/command',{name:'issue.dispatch',input:{id:emergency.id,revision:emergency.revision}},unrelated.cookie)).status,403)
  assert.equal((await h.state(unrelated.cookie)).recoveries.some(r=>r.issue),false)
 }finally{await h.close()}
})
