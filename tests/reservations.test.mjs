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


test('RES-006: issued quotes retain revisions, reserve until expiry and convert once with current price and inventory',async()=>{
 const {quoteHarness,quoteDay}=await import('./quotes-support.mjs'),h=await quoteHarness()
 try{
  const cleaner=await h.person('QuoteCleaner'),manager=await h.person('QuoteManager','manager')
  await h.cmd('quote.issue',h.input,cleaner.cookie,403)
  let q=await h.cmd('quote.issue',h.input,manager.cookie),path=await h.link(q)
  const page=await h.send(path);assert.equal(page.status,200,page.text);assert.match(page.text,/\$58[,.]300|\$583\.00/);assert.match(page.text,/50% cancellation/);assert.match(page.text,/3 guests/)
  const old=q.revision
  assert.equal((await h.send('/book/harbor-house/quote',h.input)).status,409,'quote inventory hold closes public search')
  q=await h.cmd('quote.revise',{id:q.id,revision:q.revision,...h.input,guests:2})
  await h.cmd('quote.revise',{id:q.id,revision:old,...h.input},h.owner,409)
  assert.equal((await h.accept(q,path,{staffQuoteRevision:old})).status,409);assert.equal(h.creates,0)
  assert.equal(q.versions.length,2);assert.equal(q.versions[0].price.totalCents,58300);assert.equal(q.versions[1].price.totalCents,55000)
  assert.doesNotMatch((await h.send('/api/cabin/state',undefined,h.owner)).text,new RegExp(path.split('/').at(-1)))
  assert.equal((await h.send('/api/cabin/quotes/'+q.id+'/link',undefined,cleaner.cookie)).status,403)
  await h.restart()
  const responses=await Promise.all([h.accept(q,path,{guests:2}),h.accept(q,path,{guests:2})]);assert.equal(responses.filter(r=>r.status===200).length>=1,true,responses.map(r=>r.text).join(' '));assert.ok(responses.every(r=>[200,303,409].includes(r.status)));assert.equal(h.creates,1)
  const first=responses.find(r=>r.status===200).value
  assert.equal((await h.accept(q,path,{guests:2})).status,303,'repeated acceptance returns the same private booking')
  h.pay();const refresh=await h.send('/book/stay/'+first.token+'/refresh',{});assert.equal(refresh.value.stay.phase,'confirmed',refresh.text)
  const state=await h.state(),result=state.staffQuotes.find(r=>r.id===q.id),b=state.bookings.find(b=>b.id===result.bookingId)
  assert.equal(result.status,'accepted');assert.equal(result.acceptedRevision,q.revision);assert.equal(state.bookings.filter(b=>b.kind==='stay'&&b.status==='confirmed').length,1);assert.equal(b.guestName,h.input.guestName);assert.equal(state.direct.stays[0].quote.totalCents,55000);assert.equal(state.direct.stays[0].signature.name,h.input.guestName)
  let expired=await h.cmd('quote.issue',{...h.input,start:quoteDay(25),end:quoteDay(28)}),expiredPath=await h.link(expired)
  expired=await h.cmd('quote.expire',{id:expired.id,revision:expired.revision});assert.equal((await h.send(expiredPath)).status,409);assert.equal((await h.send('/book/harbor-house/quote',{start:quoteDay(25),end:quoteDay(28),guests:2})).status,200)
  const timed=await h.cmd('quote.issue',{...h.input,start:quoteDay(35),end:quoteDay(38),expiresAt:new Date(Date.now()+1500).toISOString()});const timedPath=await h.link(timed);await new Promise(r=>setTimeout(r,1600));await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await h.send(timedPath)).status,409);assert.equal((await h.state()).bookings.find(b=>b.id===timed.holdBookingId).status,'cancelled')
  let rate=await h.cmd('quote.issue',{...h.input,start:quoteDay(45),end:quoteDay(48),hold:false}),ratePath=await h.link(rate)
  const changed=await h.cmd('direct.configure',{...h.cfg,revision:h.home.revision,nightlyCents:16000})
  assert.equal((await h.send(ratePath)).status,409);assert.equal((await h.accept(rate,ratePath)).status,409);assert.equal(h.creates,1,'changed terms never create an obsolete Stripe charge')
  rate=await h.cmd('quote.revise',{...h.input,start:quoteDay(45),end:quoteDay(48),hold:false,id:rate.id,revision:rate.revision})
  await h.cmd('reservation.request',{propertyId:h.p.id,channel:'direct',start:quoteDay(45),end:quoteDay(48),guestName:'Rival guest'})
  assert.equal((await h.send(ratePath)).status,409);assert.equal((await h.accept(rate,ratePath,{start:quoteDay(45),end:quoteDay(48),homeRevision:changed.revision})).status,409);assert.equal(h.creates,1)
  const {erase}=await import('./privacy-flow.mjs'),latest=(await h.state()).bookings.find(row=>row.id===b.id)
  await erase(h,{entity:'guest',id:latest.id,revision:latest.revision})
  assert.equal((await h.send(path)).status,404,'erasure revokes the quote and resulting booking capabilities')
  assert.doesNotMatch(JSON.stringify((await h.state()).staffQuotes),/alex@stay\.example|Alex Rivera/)
 }finally{await h.close()}
})

test('source inquiries require exact reviewed identity, deduplicate replay and leave inventory and channel outcomes unchanged',async()=>{
 const {inquirySource,sourceInquiry,inquiryClock}=await import('./inquiries-support.mjs'),h=await harness({now:inquiryClock})
 try{
  const source=await inquirySource(h)
  await source.read();let s=await h.state(),q=s.inquiries[0]
  assert.equal(q.status,'needs_review');assert.equal(s.messages.length,0);assert.equal(s.bookings.length,0)
  await source.review(q,h.owner,409);await source.settings()
  await source.review(q,source.cleaner.cookie,403);await source.review(q,source.manager.cookie,403)
  await source.review(q,h.owner,409,'Same guest name is not source identity')
  await source.read([{...sourceInquiry,threadId:'synthetic-cabin-other-thread'}],'needs_you')
  await source.read([sourceInquiry,{...sourceInquiry,reservationId:'synthetic-cabin-4',guestName:'Different guest'}],'needs_you')
  assert.equal((await h.state()).inquiries.length,1)
  await h.cmd('channelAgent.disconnect',{id:source.profile.id});await source.review(q,h.owner,409)
  assert.equal((await h.state()).messages.length,0,'revoked channel authority cannot create a native inquiry thread')
  await source.connect();await source.review(q,h.owner,409)
  await source.read();q=(await h.state()).inquiries[0]
  await source.review(q);await source.read();await h.restart();await source.read()
  s=await h.state();q=s.inquiries[0]
  assert.equal(s.inquiries.length,1);assert.equal(s.messages.filter(m=>m.direction==='in').length,1)
  assert.equal(q.status,'inquiry');assert.equal(q.quoteCents,58325);assert.equal(q.guests,3);assert.equal(q.deadline,sourceInquiry.deadline);assert.ok(q.threadId)
  assert.equal(s.bookings.length,0);assert.equal(s.requests.length,0);assert.equal(s.codes.length,0);assert.equal(s.turnovers.length,0)
  const outsiderHome=await h.cmd('property.save',{name:'Synthetic other cabin',ownerName:'Synthetic other owner',ownerEmail:h.auth.OWNER_EMAIL,commissionBps:1500})
  const currentManager=(await h.state()).members.find(m=>m.id===source.manager.id)
  const scoped=await h.cmd('member.save',{id:currentManager.id,revision:currentManager.revision,name:'Synthetic scoped service',email:source.manager.email,pmsRole:'guest_service',propertyIds:[source.p.id],actions:['inbox:read','reservations:read'],active:true})
  const scopedCookie=await h.signIn(scoped.email)
  assert.equal((await h.state(scopedCookie)).inquiries[0].quoteCents,58325,'permitted reservation staff can read the retained USD quote')
  const latestScope=(await h.state()).members.find(m=>m.id===scoped.id)
  await h.cmd('member.save',{id:latestScope.id,revision:latestScope.revision,name:latestScope.name,email:latestScope.email,pmsRole:'guest_service',propertyIds:[outsiderHome.id],actions:['inbox:read','reservations:read'],active:true})
  assert.equal((await h.state(await h.signIn(latestScope.email))).inquiries.length,0,'another home cannot read inquiry identity or price')
  await h.cmd('channelAgent.disconnect',{id:source.profile.id});await h.cmd('inquiry.erase',{id:q.id,revision:q.revision,confirm:'yes'})
  await source.connect();await source.read(undefined,'needs_you');await source.read([{...sourceInquiry,status:'confirmed'}],'needs_you');await source.read([{...sourceInquiry,reservationId:'synthetic-cabin-new-inquiry'}],'needs_you')
  s=await h.state();assert.equal(s.inquiries[0].status,'erased');assert.ok(s.messages.every(m=>m.status==='discarded'));assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM cb_records WHERE kind='channelAgentEvidence'").first()).n,0,'erasure withdraws source screenshots');assert.doesNotMatch(JSON.stringify(s.inquiries),/Synthetic guest|May we stay/)
  assert.equal((await h.send('/app/reservations',undefined,source.cleaner.cookie)).status,403)
 }finally{await h.close()}
})
