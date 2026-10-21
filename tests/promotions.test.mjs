import { homeDay } from './home-calendar.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'

const day=n=>homeDay(n, 'America/New_York')
const allocation={commissionBase:'rent',fixedFeeCents:0,reserveBps:1000,ownerUseCleaningCents:0,passThrough:'owner',taxExpense:'owner',owners:[{name:'Morgan',email:'morgan@stay.example',bps:10000}],mapping:{owner:'Owner payable',manager:'Management revenue',reserve:'Owner reserve',tax:'Tax payable',vendor:'Vendor payable',reviewedBy:'Pat Accountant'}}
async function setup(h,preceding=false){
 const home=await h.cmd('property.save',{name:'Fernwood',ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000}),cleaner=await h.person('Casey')
 await h.cmd('property.terms',{propertyId:home.id,propertyRevision:home.revision,effectiveFrom:day(-30),ownerName:home.ownerName,ownerEmail:home.ownerEmail,commissionBps:2000,terms:'Signed management agreement',allocation})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Fernwood trust'})
 await h.cmd('cleaner.capacity',{memberId:cleaner.id,homeBase:'100 Main Street',timeZone:'America/New_York',availableFrom:'06:00',dailyJobs:4,dailyMinutes:600})
 const settings=await h.cmd('home.settings',{propertyId:home.id,address:'18 Fernwood Lane',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Inspect'],photosRequired:1,dispatch:{templateName:'Inspect and clean',instructions:'Complete before arrival',durationMinutes:120,rateCents:0,startOffsetMinutes:0,finishBeforeMinutes:0,approvedCleanerIds:[cleaner.id],offerCount:1,responseMinutes:120,reminderMinutes:30,escalationMinutes:60}})
 await h.cmd('home.drive',{propertyId:home.id,revision:settings.revision,from:'base:'+cleaner.id,minutes:10})
 if(preceding)await h.cmd('reservation.create',{propertyId:home.id,method:'phone',channel:'direct',sourceId:'PRECEDING',guestName:'Prior Guest',start:day(1),end:day(3),rentCents:40000,policyName:'Full refund',retainedBps:0,noShowBps:10000})
 let booking=await h.cmd('reservation.create',{propertyId:home.id,method:'phone',channel:'direct',sourceId:'PHONE-PROMOTION',guestName:'Megan Ortiz',guestEmail:'megan@stay.example',start:day(3),end:day(5),rentCents:40000,taxCents:4000,policyName:'Full refund',retainedBps:0,noShowBps:10000})
 for(const t of (await h.state()).turnovers.filter(t=>t.status==='unassigned')){const o=t.dispatch.offers.find(o=>o.status==='pending');await h.cmd('turnover.accept',{id:t.id,revision:t.revision,offerId:o.id},cleaner.cookie)}
 let g=(await h.state()).guests.find(g=>g.bookingId===booking.id)
 await h.cmd('guest.identity.verify',{id:g.id,revision:g.revision,identityId:g.identities.find(i=>i.kind==='email').id,source:'Guest confirmed ownership in person',confirm:'yes'})
 g=(await h.state()).guests.find(g=>g.bookingId===booking.id)
 await h.cmd('guest.consent',{id:g.id,revision:g.revision,propertyId:home.id,purpose:'offers',allowed:'yes',source:'Guest requested offers for this stay'})
 await h.cmd('promotion.configure',{propertyId:home.id,enabled:'yes',minimumNetCents:1000,providerFeeReserveCents:1000,stock:1,refundRetainedBps:5000,refundDeadlineHours:24,taxBps:1000,coupons:[{code:'DIRECT',bps:1000,from:day(0),until:day(30),minNights:2,channels:['direct']}],confirm:'yes'})
 booking=(await h.state()).bookings.find(b=>b.id===booking.id)
 return {home,booking,cleaner,create:(extra={},status=200)=>h.cmd('promotion.create',{bookingId:booking.id,bookingRevision:booking.revision,kind:'gap',title:'One more night',description:'Keep the same home and guest count.',end:day(6),baseCents:20000,costCents:0,expiresAt:new Date(Date.now()+2*86400000).toISOString(),...extra},h.owner,status)}
}
const current=async(h,id)=>(await h.state()).promotions.offers.find(o=>o.id===id)
async function send(h,o){await h.cmd('promotion.send',{id:o.id,revision:o.revision,confirm:'yes'});return current(h,o.id)}

test('WEB-005: signed gap supplement survives restart, applies once to the original stay, access, cleaner plan, balance and owner ledger, then refunds under its policy',async()=>{
 let session,paid=false,checkoutCalls=0,refundCalls=0,refund
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fixture'},outbound:async request=>{
  const path=new URL(request.url).pathname
  if(path==='/v1/checkout/sessions'&&request.method==='POST'){
   checkoutCalls++;const p=new URLSearchParams(await request.text());session={id:'cs_promotion',url:'https://checkout.stripe.com/c/pay/cs_promotion',status:'open',payment_status:'unpaid',amount_total:Number(p.get('line_items[0][price_data][unit_amount]')),currency:'usd',metadata:{promotionId:p.get('metadata[promotionId]'),bookingId:p.get('metadata[bookingId]')}};return Response.json(session)
  }
  if(path==='/v1/checkout/sessions/cs_promotion')return Response.json({...session,status:paid?'complete':'open',payment_status:paid?'paid':'unpaid',payment_intent:paid?{id:'pi_promotion',status:'succeeded',amount_received:session.amount_total,currency:'usd'}:null})
  if(path==='/v1/refunds'&&request.method==='POST'){refundCalls++;const p=new URLSearchParams(await request.text());refund={id:'re_promotion',payment_intent:p.get('payment_intent'),amount:Number(p.get('amount')),currency:'usd',status:'succeeded',metadata:{cabinRefundId:p.get('metadata[cabinRefundId]'),stayId:p.get('metadata[stayId]')}};return Response.json(refund)}
  if(path==='/v1/refunds'&&request.method==='GET')return Response.json({data:refund?[refund]:[],has_more:false})
  assert.fail('Unexpected network request '+path)
 }})
 try{
  const {home,booking,create}=await setup(h),draft=await create(),o=await send(h,draft),path=new URL(draft.url).pathname
  assert.equal((await h.send(path)).status,200)
  await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Conflict',start:day(5),end:day(6)}).then(r=>assert.equal(r.status,'declined'))
  assert.equal((await h.send(path,{action:'accept',signature:'Someone else',consent:'yes'})).status,400)
  const accepted=await h.send(path,{action:'accept',signature:'Megan Ortiz',consent:'yes'});assert.equal(accepted.status,200,accepted.text);assert.equal(checkoutCalls,1)
  assert.equal((await h.send(path,{action:'accept',signature:'Megan Ortiz',consent:'yes'})).status,409)
  await h.restart();paid=true
  assert.equal((await h.send(path,{action:'refresh'})).status,200)
  await h.cmd('promotion.reconcile',{id:o.id})
  let s=await h.accessState(),b=s.bookings.find(b=>b.id===booking.id),applied=s.promotions.offers.find(p=>p.id===o.id)
  assert.equal(applied.status,'applied');assert.equal(b.end,day(6));assert.equal(b.lifecycle.price.totalCents,66000);assert.equal(b.reservationBalance.paidCents,22000);assert.equal(b.reservationBalance.balanceCents,44000)
  assert.equal(s.bookings.filter(b=>b.id===booking.id).length,1)
  assert.ok(s.codes.find(c=>c.bookingId===booking.id&&c.holder==='guest'&&c.status==='issued').validUntil.startsWith(day(6)))
  assert.equal(s.turnovers.find(t=>t.bookingId===booking.id&&t.status!=='cancelled').windowStart.slice(0,10),day(6))
  const journals=s.ledger.journals.filter(j=>j.sourceId===o.id);assert.equal(journals.length,3)
  assert.equal(journals.flatMap(j=>j.lines).filter(l=>l.account==='ownerLiability').reduce((n,l)=>n+l.creditCents-l.debitCents,0),14400)
  assert.ok(journals.every(j=>j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0)===0))
  assert.ok(s.messages.some(m=>m.bookingId===booking.id&&m.text.includes('pi_promotion')))
  const imported=await h.cmd('payout.import',{propertyId:home.id,source:'stripe',evidenceReference:'Retained processor settlement evidence',csv:`Transaction ID,Payout ID,Payment intent ID,Date,Type,Currency,Gross amount,Fee amount,Net amount\ntxn_promotion,po_promotion,pi_promotion,${day(0)},payment,USD,220.00,3.00,217.00\n`})
  assert.equal(imported.matched,1)
  const statement=await h.cmd('statement.close.prepare',{propertyId:home.id,month:day(0).slice(0,7)})
  assert.equal(statement.netCents,14100);assert.equal(statement.managementFeeCents,4000);assert.equal(statement.taxCents,2000)
  const reportQuery='from='+day(0).slice(0,7)+'-01&until='+new Date(Date.UTC(Number(day(0).slice(0,4)),Number(day(0).slice(5,7)),1)).toISOString().slice(0,10)
  const reported=(await h.send('/api/cabin/reports.json?'+reportQuery,undefined,h.owner)).value
  assert.equal(reported.totals.grossCents,22000);assert.equal(reported.totals.feesCents,300);assert.equal(reported.totals.commissionCents,4000);assert.equal(reported.totals.taxCents,2000);assert.equal(reported.totals.netCents,15700)

  await h.cmd('promotion.cancel',{id:o.id,revision:applied.revision,confirm:'yes',reason:'Guest declined the added night before the deadline'})
  const due=await current(h,o.id);assert.equal(due.refund.amountCents,22000)
  await h.cmd('promotion.refund',{id:o.id,revision:due.revision,confirm:'yes'});await h.restart();await h.cmd('promotion.reconcile',{id:o.id})
  assert.equal(refundCalls,1);assert.equal((await current(h,o.id)).status,'refunded');s=await h.state();b=s.bookings.find(b=>b.id===booking.id);assert.equal(b.end,day(5));assert.equal(b.reservationBalance.paidCents,0);assert.equal(b.lifecycle.price.totalCents,44000)
  const refundedReport=(await h.send('/api/cabin/reports.json?'+reportQuery,undefined,h.owner)).value
  assert.equal(refundedReport.totals.refundsCents,22000);assert.equal(refundedReport.totals.commissionCents,0);assert.equal(refundedReport.totals.taxCents,0);assert.equal(refundedReport.totals.netCents,-300)

 }finally{await h.close()}
})

test('WEB-005: coupon scope, cleaning conflict, consent withdrawal, extra stock and expiring inventory holds are enforced through public endpoints',async()=>{
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fixture'},outbound:async request=>{assert.equal(new URL(request.url).pathname,'/v1/checkout/sessions');return Response.json({id:'cs_coupon_fixture',url:'https://checkout.stripe.com/c/pay/cs_coupon_fixture'})}})
 try{
  const {home,booking,create}=await setup(h,true)
  await create({coupon:'UNKNOWN'},409)
  await h.cmd('promotion.create',{bookingId:booking.id,bookingRevision:booking.revision,kind:'early',title:'Early arrival',description:'Arrive before normal check-in.',time:'11:00',baseCents:5000,costCents:0,expiresAt:new Date(Date.now()+2*86400000).toISOString()},h.owner,409)
  const early=await create({kind:'early',title:'Paid early arrival',time:'13:00',baseCents:5000}),sentEarly=await send(h,early)
  assert.equal(sentEarly.target.arrivalTime,'13:00');assert.equal((await h.send(new URL(early.url).pathname)).status,200)
  const extra=await create({kind:'extra',title:'Breakfast hamper',baseCents:5000}),sentExtra=await send(h,extra)
  await create({kind:'extra',title:'Breakfast hamper',baseCents:5000},409)
  const gap=await create({coupon:'DIRECT'});assert.equal(gap.discountCents,2000);await send(h,gap)
  await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.expiresAt',?) WHERE kind='promotionOffers' AND id=?").bind(new Date(Date.now()-1000).toISOString(),gap.id).run()
  await h.restart();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  assert.equal((await h.send(new URL(gap.url).pathname)).status,410)
  const state=await h.state();assert.equal(state.bookings.find(b=>b.id===state.promotions.offers.find(o=>o.id===gap.id).holdId).status,'cancelled')
  const g=state.guests.find(g=>g.bookingId===booking.id)
  await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.status','pending') WHERE kind='messages' AND id=?").bind(sentEarly.messageId).run()
  await h.cmd('guest.consent',{id:g.id,revision:g.revision,propertyId:home.id,purpose:'offers',allowed:'no',source:'Guest withdrew offers consent'})
  assert.equal((await h.state()).messages.find(m=>m.id===sentEarly.messageId).status,'discarded')
  assert.equal((await h.send(new URL(early.url).pathname,{action:'accept',signature:'Megan Ortiz',consent:'yes'})).status,409)
  const cleaner=await h.person('Restricted');await h.cmd('promotion.send',{id:sentExtra.id,revision:sentExtra.revision,confirm:'yes'},cleaner.cookie,403)
  assert.deepEqual((await h.state(cleaner.cookie)).promotions,{policies:[],offers:[]})
  const cfg=await h.cmd('direct.configure',{propertyId:home.id,enabled:true,slug:'fernwood',description:'A private woodland home',nightlyCents:20000,cleaningCents:0,extraGuestCents:0,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'Configured state tax',taxBps:1000,countyTaxLabel:'',countyTaxBps:0,agreement:'Quiet hours after 10 pm.',requireIdentity:false})
  const dates={start:day(10),end:day(12),guests:2,couponCode:'DIRECT'}
  const quote=await h.send('/book/fernwood/quote',dates);assert.equal(quote.status,200);assert.equal(quote.value.quote.rentCents,36000);assert.equal(quote.value.quote.totalCents,39600)
  assert.equal((await h.send('/book/fernwood/quote',{...dates,couponCode:'UNKNOWN'})).status,409)
  const checkout=await h.send('/book/fernwood/checkout',{...dates,homeRevision:cfg.revision,guestName:'New Visitor',email:'new@stay.example',signature:'New Visitor',consent:'yes'});assert.equal(checkout.status,200,checkout.text)
  const quoted=(await h.state()).direct.stays.find(s=>s.id===checkout.value.id);assert.equal(quoted.quote.totalCents,quote.value.quote.totalCents);assert.equal(quoted.quote.coupon.code,'DIRECT')

 }finally{await h.close()}
})

test('WEB-005: paid early arrival, late checkout and extras layer on one stay and cancel in dependency order',async()=>{
 const sessions=new Map();let submitted=0
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fixture'},outbound:async request=>{
  const path=new URL(request.url).pathname
  if(path==='/v1/checkout/sessions'&&request.method==='POST'){const p=new URLSearchParams(await request.text()),id='cs_layer_'+(++submitted),row={id,url:'https://checkout.stripe.com/c/pay/'+id,status:'complete',payment_status:'paid',amount_total:Number(p.get('line_items[0][price_data][unit_amount]')),currency:'usd',metadata:{promotionId:p.get('metadata[promotionId]'),bookingId:p.get('metadata[bookingId]')}};row.payment_intent={id:'pi_layer_'+submitted,status:'succeeded',amount_received:row.amount_total,currency:'usd'};sessions.set(id,row);return Response.json(row)}
  if(path.startsWith('/v1/checkout/sessions/'))return Response.json(sessions.get(path.split('/').at(-1)))
  assert.fail('Unexpected provider request '+path)
 }})
 try{
  const {home,booking,cleaner}=await setup(h,true),ids=[]
  for(const [kind,time]of [['early','13:00'],['late','12:00'],['extra',undefined]]){
   const b=(await h.state()).bookings.find(b=>b.id===booking.id),draft=await h.cmd('promotion.create',{bookingId:b.id,bookingRevision:b.revision,kind,time,title:kind==='extra'?'Breakfast hamper':kind+' access',description:'Guest-selected service for the current stay.',baseCents:5000,costCents:0,expiresAt:new Date(Date.now()+2*86400000).toISOString()});await send(h,draft);const path=new URL(draft.url).pathname
   assert.equal((await h.send(path,{action:'accept',signature:'Megan Ortiz',consent:'yes'})).status,200);assert.equal((await h.send(path,{action:'refresh'})).status,200);ids.push(draft.id);for(const t of (await h.state()).turnovers.filter(t=>t.propertyId===home.id&&t.status==='unassigned'))await h.cmd('turnover.accept',{id:t.id,revision:t.revision,offerId:t.dispatch.offers.find(o=>o.status==='pending').id},cleaner.cookie)
  }
  let s=await h.accessState(),b=s.bookings.find(b=>b.id===booking.id),code=s.codes.find(c=>c.bookingId===b.id&&c.holder==='guest'&&c.status==='issued');assert.equal(submitted,3);assert.equal(b.arrivalTime,'13:00');assert.equal(b.departureTime,'12:00');assert.ok(code.validFrom.endsWith('T13:00'));assert.ok(code.validUntil.endsWith('T12:00'));assert.ok(s.tasks.some(t=>t.title==='Breakfast hamper'&&t.status==='open'))
  await h.cmd('reservation.move',{id:b.id,revision:b.revision,start:day(4),end:day(6)},h.owner,409)
  const first=await current(h,ids[0]);await h.cmd('promotion.cancel',{id:first.id,revision:first.revision,reason:'Cancel earlier offer out of sequence',confirm:'yes'},h.owner,409)
  for(const id of ids.reverse()){const o=await current(h,id);await h.cmd('promotion.cancel',{id,revision:o.revision,reason:'Guest cancelled the layered service',confirm:'yes'})}
  s=await h.state();b=s.bookings.find(b=>b.id===booking.id);assert.equal(b.arrivalTime,undefined);assert.equal(b.departureTime,undefined);assert.equal(b.lifecycle.price.totalCents,44000);assert.ok(s.tasks.filter(t=>t.title==='Breakfast hamper').every(t=>t.status==='closed'))
 }finally{await h.close()}
})
