import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {harness} from './harness.mjs'

// CABIN-01: property content and immutable effective management terms through product doors.
test('CABIN-01: two units retain their content and original stay allocations after an agreement amendment',async()=>{
 const h=await harness()
 try{
  const photo=(await readFile('tests/fixtures/checklist.png')).toString('base64')
  const p=await h.cmd('property.save',{name:'Lake Loft · North',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
  const second=await h.cmd('property.save',{name:'Desert Casita',ownerName:'Morgan Lee',ownerEmail:'morgan@stay.example',commissionBps:1500})
  const profile=await h.cmd('property.profile',{propertyId:p.id,buildingName:'Lake House',unitName:'North loft',address:'20 Lake Street, Ithaca, NY',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',occupancyLimit:4,amenities:['Lake access','Wi-Fi'],houseRules:'Quiet after 10 pm.',emergencyName:'Dale Reed',emergencyPhone:'+1 607 555 0101',listingIds:{airbnb:'HM-NORTH',vrbo:'VR-NORTH','booking.com':'BK-NORTH'},photos:[{photo,mimeType:'image/png'}]})
  await h.cmd('property.profile',{propertyId:second.id,address:'31 Mesa Road, Tucson, AZ',timeZone:'America/Phoenix',checkInTime:'15:00',checkOutTime:'11:00',occupancyLimit:2,amenities:['Patio']})
  assert.equal((await h.send('/api/cabin/photos/'+profile.photos[0].id,undefined,h.owner)).status,200)
  const request=await h.cmd('reservation.request',{propertyId:p.id,channel:'airbnb',start:'2026-11-01',end:'2026-11-04',guestName:'Megan Ortiz'})
  const original=(await h.state()).bookings.find(b=>b.id===request.bookingId).managementTerms
  await h.cmd('property.terms',{propertyId:p.id,propertyRevision:p.revision,effectiveFrom:'2026-10-20',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2500,terms:'25% of gross rent; approved repairs separately.'})
  assert.deepEqual((await h.state()).bookings.find(b=>b.id===request.bookingId).managementTerms,original)
  const newer=await h.cmd('reservation.request',{propertyId:p.id,channel:'airbnb',start:'2026-11-08',end:'2026-11-11',guestName:'Luis Chen'})
  const current=(await h.state()).bookings.find(b=>b.id===newer.bookingId).managementTerms
  assert.equal(current.commissionBps,2500)
  await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Lake House LLC'})
  for(const [r,start] of [[request,'11/01/2026'],[newer,'11/08/2026']]){
   const b=(await h.state()).bookings.find(b=>b.id===r.bookingId)
   await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:`Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n11/15/2026,Reservation,${b.uid},${start},3,USD,1000.00,30.00,970.00,${b.id}\n`})
  }
  const statement=await h.cmd('statement.prepare',{propertyId:p.id,month:'2026-11'})
  assert.equal(statement.managementFeeCents,45000)
  assert.deepEqual(statement.lines.filter(l=>l.category==='gross').map(l=>l.commissionBps),[2000,2500])
  assert.equal((await h.state()).ledger.journals[0].ownerKey,createHash('sha256').update('karen@stay.example').digest('hex'))
  await h.cmd('direct.configure',{propertyId:p.id,enabled:true,slug:'north-loft',description:'Lake access and a sunny loft.',nightlyCents:18000,cleaningCents:5000,extraGuestCents:0,includedGuests:2,maxGuests:6,minNights:1,maxNights:30,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'',taxBps:0,countyTaxLabel:'',countyTaxBps:0,agreement:'Quiet hours after 10 pm.',requireIdentity:false})
  const q=await h.send('/book/north-loft/quote',{start:'2026-12-01',end:'2026-12-04',guests:2})
  assert.equal(q.status,200,q.text);assert.equal(q.value.quote.managementVersion,current.id)
  assert.equal((await h.send('/book/north-loft/quote',{start:'2026-12-01',end:'2026-12-04',guests:5})).status,400)
  const page=await h.send('/app/people',undefined,h.owner);assert.ok(page.text.includes('North loft')&&page.text.includes('America/Phoenix'))
  await h.cmd('property.profile',{...profile,photos:[],homeRevision:'wrong',address:'Edited address'},h.owner,409)
  const cleaner=await h.person('Ana')
  await h.cmd('property.terms',{propertyId:p.id},cleaner.cookie,403)
  assert.equal((await h.send('/api/cabin/photos/'+profile.photos[0].id,undefined,cleaner.cookie)).status,404)
 }finally{await h.close()}
})
