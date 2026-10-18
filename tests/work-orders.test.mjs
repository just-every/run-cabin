import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {harness} from './harness.mjs'

// OPS-004: reports, spend authority, inventory, inspected evidence, owner cost and recurrence.
test('OPS-004: a guest appliance report becomes accepted, approved, inspected work with one owner expense and next visit',async()=>{
 const h=await harness()
 try{
  const vendor=await h.person('Dale'),inspector=await h.person('Ana'),manager=await h.person('Morgan','manager'),other=await h.person('Luis')
  const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:home.id,address:'20 Lake Street, Ithaca, NY',timeZone:'America/New_York',maintenanceId:vendor.id,checklist:['Ready']})
  await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Lake House LLC'})
  const stay=await h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',start:'2026-11-01',end:'2026-11-04',guestName:'Megan Ortiz'})
  const code=(await h.state()).codes.find(c=>c.bookingId===stay.bookingId&&c.holder==='guest'),bytes=await readFile('tests/fixtures/checklist.png'),photo={photo:bytes.toString('base64'),mimeType:'image/png'}
  const report=new FormData();report.set('action','maintenance');report.set('title','Dishwasher leaking');report.set('note','Water at the front left corner');report.set('photoFiles',new File([bytes],'dishwasher.png',{type:'image/png'}))
  const response=await fetch(h.origin+'/stay/'+code.link,{method:'POST',headers:{origin:h.origin},body:report,redirect:'manual'})
  assert.equal(response.status,303,await response.text())
  let task=(await h.state()).tasks.find(t=>t.title==='Dishwasher leaking')
  assert.equal(task.assigneeId,vendor.id);assert.equal(task.photos.length,1)
  assert.ok((await h.state()).notices.some(n=>n.recordId===task.id&&n.status==='sent'))
  const act=async(name,input={},cookie=h.owner,status=200)=>{const result=await h.cmd(name,{id:task.id,revision:task.revision,...input},cookie,status);if(status===200)task=result;return result}
  await act('work.configure',{asset:'Kitchen dishwasher DW-04',priority:'urgent',dueDate:'2026-11-05',checklist:['Replace inlet seal','Run a leak test'],requiresInspection:true,inspectorId:inspector.id,recurrenceDays:30,spendLimitCents:10000,unavailableStart:'2026-11-05',unavailableEnd:'2026-11-07'})
  const blockId=task.work.blockId
  assert.equal((await h.cmd('reservation.request',{propertyId:home.id,channel:'vrbo',start:'2026-11-05',end:'2026-11-06',guestName:'Overlapping request'})).status,'declined')
  await h.cmd('reservation.cancel',{id:blockId,revision:(await h.state()).bookings.find(row=>row.id===blockId).revision},h.owner,409)
  await act('work.accept',{},vendor.cookie)
  await h.cmd('task.assign',{id:task.id,revision:task.revision,assigneeId:other.id},h.owner,409)
  await act('work.quote',{description:'Replace seal and test',amountCents:15000,photos:[photo]},vendor.cookie)
  const stale=task.revision
  await act('work.quote',{description:'Replace seal, test and clean',amountCents:15000,photos:[photo]},vendor.cookie)
  await h.cmd('work.approveQuote',{id:task.id,revision:stale},h.owner,409)
  await act('work.approveQuote',{},manager.cookie,403)
  await act('work.approveQuote',{approveOverLimit:true})
  await act('work.invoice',{reference:'DALE-105',amountCents:16000,photos:[photo]},vendor.cookie,400)
  await act('work.invoice',{reference:'DALE-105',amountCents:15000,photos:[photo]},vendor.cookie)
  await act('work.approveInvoice',{},manager.cookie,403)
  await act('work.approveInvoice',{approveOverLimit:true})
  const expense=(await h.state()).workExpenses.find(e=>e.taskId===task.id);assert.equal(expense.ownerEmail,'karen@stay.example');assert.equal(expense.amountCents,15000)
  await act('work.complete',{checks:['Replace inlet seal'],note:'Only seal replaced',photos:[photo]},vendor.cookie,400)
  await act('work.complete',{checks:['Replace inlet seal','Run a leak test'],note:'Seal replaced; no leak during cycle',photos:[photo]},vendor.cookie)
  assert.equal(task.status,'open');assert.equal((await h.state()).bookings.find(b=>b.id===blockId).status,'confirmed')
  await act('work.inspect',{note:'Vendor cannot self inspect'},vendor.cookie,403)
  await act('work.inspect',{note:'Damp at hose; correct and test again',accepted:false},inspector.cookie)
  assert.equal(task.work.completed,undefined)
  await act('work.complete',{checks:['Replace inlet seal','Run a leak test'],note:'Hose tightened; full cycle stayed dry',photos:[photo]},vendor.cookie)
  await act('work.inspect',{note:'Full cycle inspected, floor and fittings dry'},inspector.cookie)
  assert.equal(task.status,'closed');assert.equal((await h.state()).bookings.find(b=>b.id===blockId).status,'cancelled')
  assert.equal((await h.state()).tasks.filter(t=>t.work?.recurrenceOf===task.id).length,1)
  await act('work.inspect',{note:'Repeated click'},inspector.cookie,409)
  const ledger=(await h.state()).ledger.journals.filter(j=>j.sourceType==='maintenance-expense');assert.equal(ledger.length,1);assert.equal(ledger[0].ownerKey,createHash('sha256').update('karen@stay.example').digest('hex'));assert.equal(ledger[0].lines.reduce((s,l)=>s+l.debitCents-l.creditCents,0),0)
  assert.equal((await h.state(other.cookie)).tasks.some(t=>t.id===task.id),false)
  assert.equal((await h.send('/api/cabin/photos/'+task.photos[0].id,undefined,other.cookie)).status,404)
  assert.equal((await h.state(inspector.cookie)).workExpenses.length,0)
  assert.equal((await h.state(inspector.cookie)).tasks.find(t=>t.id===task.id).work.ownerTerms,undefined)
  const follow=await h.cmd('task.raise',{sourceTaskId:task.id,title:'Cabinet hinge loose',photos:[photo]},inspector.cookie);assert.equal(follow.assigneeId,vendor.id)
 }finally{await h.close()}
})
