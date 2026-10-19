import { homeDay } from './home-calendar.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
const day=n=>homeDay(n, 'America/New_York')

test('RES-002: priced phone stay extends, moves units, reconciles receipts and cancels under frozen policy',async()=>{
 const h=await harness()
 try{
  const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  const other=await h.cmd('property.save',{name:'Desert Casita',ownerName:'Luis',ownerEmail:'luis@stay.example',commissionBps:1000})
  const cleaner=await h.person('Ana')
  for(const p of [home,other]){
   await h.cmd('home.settings',{propertyId:p.id,address:'240 Lake Road',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
   await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Cabin trust'})
  }
  const input={propertyId:home.id,method:'phone',channel:'direct',sourceId:'PHONE-719',guestName:'Megan Ortiz',guestEmail:'megan@stay.example',start:day(3),end:day(6),rentCents:90000,feesCents:10000,taxCents:9000,policyName:'50% of agreed total after booking',retainedBps:5000,noShowBps:10000}
  let b=await h.cmd('reservation.create',input)
  await h.cmd('reservation.create',input,h.owner,409)
  const state=async()=>(await h.accessState()),get=async()=> (await state()).bookings.find(x=>x.id===b.id)
  const amendment={id:b.id,revision:b.revision,...input,end:day(7),rentCents:120000,reason:'Guest requested one extra night',eventId:'PHONE-719-AMEND-1'}
  await h.cmd('reservation.amend',amendment)
  await h.cmd('reservation.amend',amendment) // exact repeated source event is harmless
  await h.cmd('reservation.amend',{...amendment,rentCents:130000},h.owner,409)
  await h.cmd('reservation.amend',{...amendment,eventId:'stale-event'},h.owner,409)
  b=await get();let s=await state()
  assert.equal(b.lifecycle.history.length,2)
  assert.equal(s.turnovers.find(t=>t.bookingId===b.id&&t.status!=='cancelled').windowStart.slice(0,10),day(7))
  assert.ok(s.codes.find(c=>c.bookingId===b.id&&c.holder==='guest'&&c.status==='issued').validUntil.startsWith(day(7)))
  assert.ok(s.scheduled.filter(m=>m.bookingId===b.id&&m.status==='scheduled').every(m=>m.anchor))
  await h.cmd('ledger.post',{operation:'payment',propertyId:home.id,bookingId:b.id,amountCents:80000,sourceId:'bank-receipt-001',sourceRevision:'1',effectiveDate:day(0)})
  b=await get();assert.equal(b.reservationBalance.balanceCents,59000)
  const payment=(await state()).ledger.journals.find(j=>j.sourceType==='payment'&&j.bookingId===b.id)
  await h.cmd('ledger.reverse',{id:payment.id,effectiveDate:day(0)})
  assert.equal((await get()).reservationBalance.balanceCents,139000)
  await h.cmd('ledger.post',{operation:'payment',propertyId:home.id,bookingId:b.id,amountCents:80000,sourceId:'bank-receipt-002',sourceRevision:'1',effectiveDate:day(0)})
  const oldCodes=s.codes.filter(c=>c.bookingId===b.id&&c.status==='issued').map(c=>c.id)
  await h.cmd('reservation.amend',{...amendment,revision:b.revision,propertyId:other.id,eventId:'PHONE-719-MOVE',reason:'Guest accepted the Casita'})
  b=await get();s=await state()
  assert.equal(b.managementTerms.ownerEmail,'luis@stay.example')
  assert.equal(b.lifecycle.allocation.commissionCents,12000)
  assert.ok(oldCodes.every(id=>s.codes.find(c=>c.id===id).status==='revoked'))
  assert.equal(s.turnovers.filter(t=>t.bookingId===b.id&&t.status!=='cancelled').length,1)
  assert.equal(s.turnovers.find(t=>t.bookingId===b.id&&t.status!=='cancelled').propertyId,other.id)
  await h.cmd('reservation.end',{id:b.id,revision:b.revision,outcome:'no_show',reason:'Not yet arrival'},h.owner,409)
  await h.cmd('reservation.end',{id:b.id,revision:b.revision,outcome:'cancelled',reason:'Guest cancellation recorded by phone'})
  b=await get();s=await state()
  assert.equal(b.lifecycle.settledChargeCents,69500)
  assert.equal(b.reservationBalance.balanceCents,-10500)
  assert.equal(b.lifecycle.history.length,4)
  assert.ok(s.codes.filter(c=>c.bookingId===b.id).every(c=>c.status==='revoked'))
  assert.ok(s.scheduled.filter(m=>m.bookingId===b.id).every(m=>m.status!=='scheduled'))
  const legs=s.ledger.journals.flatMap(j=>j.lines);assert.equal(legs.reduce((n,l)=>n+l.debitCents,0),legs.reduce((n,l)=>n+l.creditCents,0))
  const page=await h.send('/app/calendar?reservation='+b.id,undefined,h.owner);assert.match(page.text,/Full reservation revision history/);assert.match(page.text,/Refund due/)
 }finally{await h.close()}
})

test('RES-002: reviewed channel amendments deduplicate, legacy edits fence, and no-show retains saved terms',async()=>{
 const h=await harness()
 try{
  const p=await h.cmd('property.save',{name:'Pine Ridge',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  const feed=(end)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:OTA-512\r\nDTSTART;VALUE=DATE:${day(4).replaceAll('-','')}\r\nDTEND;VALUE=DATE:${end.replaceAll('-','')}\r\nSUMMARY:Reserved - Megan Ortiz\r\nEND:VEVENT\r\nEND:VCALENDAR`
  for(const end of [day(6),day(7),day(7)]){const d=await h.cmd('calendar.prepare',{propertyId:p.id,channel:'airbnb',calendar:feed(end)});await h.cmd('calendar.approve',{id:d.id,revision:d.revision})}
  let b=(await h.accessState()).bookings.find(b=>b.uid==='OTA-512');assert.equal(b.lifecycle.history.length,2)
  await h.cmd('booking.details',{id:b.id,revision:b.revision,guestName:'Megan Ortiz',guestEmail:'megan@stay.example'})
  await h.cmd('booking.details',{id:b.id,revision:b.revision,guestName:'Concurrent change'},h.owner,409)
  b=(await h.accessState()).bookings.find(b=>b.uid==='OTA-512')
  await h.cmd('reservation.amend',{id:b.id,revision:b.revision,propertyId:p.id,start:day(4),end:day(6),guestName:'Megan Ortiz',guestEmail:'megan@stay.example',reason:'Guest shortened the stay by phone'})
  const source=await h.cmd('calendar.prepare',{propertyId:p.id,channel:'airbnb',calendar:feed(day(8))});await h.cmd('calendar.approve',{id:source.id,revision:source.revision})
  b=(await h.accessState()).bookings.find(b=>b.uid==='OTA-512');assert.equal(b.end,day(6));assert.equal(b.lifecycle.sourceConflict.end,day(8))
  await h.cmd('reservation.reconcile',{id:b.id,revision:b.revision,resolution:'source'})
  b=(await h.accessState()).bookings.find(b=>b.uid==='OTA-512');assert.equal(b.end,day(8));assert.equal(b.lifecycle.sourceConflict,undefined)
  const no=await h.cmd('reservation.create',{propertyId:p.id,method:'manual',channel:'direct',sourceId:'NO-SHOW-1',guestName:'Chris Lee',start:day(-2),end:day(-1),rentCents:40000,policyName:'Full no-show charge',retainedBps:0,noShowBps:10000})
  await h.cmd('reservation.end',{id:no.id,revision:no.revision,outcome:'no_show',reason:'Guest did not arrive; host confirmed'})
  b=(await h.accessState()).bookings.find(row=>row.id===no.id);assert.equal(b.lifecycle.outcome,'no_show');assert.equal(b.lifecycle.settledChargeCents,40000)
 }finally{await h.close()}
})
