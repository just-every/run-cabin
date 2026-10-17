import {test} from 'node:test'
import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)
const settings={enabled:true,slug:'pine-ridge',description:'A quiet Maine cabin near the lake.',nightlyCents:18000,cleaningCents:7500,extraGuestCents:2000,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:2,depositCents:25000,releaseHours:0,taxLabel:'Maine lodging tax',taxBps:900,countyTaxLabel:'County lodging tax',countyTaxBps:100,agreement:'No smoking. Quiet hours after 10 pm. Damage claims require evidence.',requireIdentity:true}
async function home(h){const p=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Morgan Example',ownerEmail:'morgan@stay.example',commissionBps:2000});return h.cmd('direct.configure',{...settings,propertyId:p.id})}

test('a signed direct checkout receives Stripe test payment, verifies identity, holds a deposit and closes every channel export',async()=>{
 let payment=false,session,verification=false,holdRequests=0,releaseRequests=0,depositStatus='requires_capture'
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fake'},outbound:async request=>{
  const u=new URL(request.url),p=u.pathname,form=new URLSearchParams(request.method==='POST'?await request.text():'');assert.equal(u.hostname,'api.stripe.com');assert.ok(request.headers.get('stripe-version'),'every Stripe call names the API version Cabin is written against');assert.equal(form.has('payment_method_types[0]'),false)
  if(p==='/v1/checkout/sessions'&&request.method==='POST'){
   assert.equal(form.get('payment_intent_data[setup_future_usage]'),'off_session');assert.equal(form.get('allowed_payment_method_types[0]'),'card')
   session={id:'cs_test_booking',url:'https://checkout.stripe.com/c/pay/cs_test_booking',metadata:{stayId:form.get('metadata[stayId]')},customer:'cus_synthetic',amount_total:74250};return Response.json(session)
  }
  if(p==='/v1/checkout/sessions/cs_test_booking')return Response.json({...session,status:'complete',payment_status:payment?'paid':'unpaid',payment_intent:payment?{id:'pi_rent',status:'succeeded',amount_received:74250,currency:'usd',payment_method:'pm_synthetic'}:null})
  if(p==='/v1/payouts')return Response.json({data:[{id:'po_usd_fixture',status:'paid',currency:'usd',automatic:true,arrival_date:Math.floor(Date.now()/1000)}],has_more:false})
  if(p==='/v1/balance_transactions')return Response.json({data:[{id:'txn_rent_fixture',type:'charge',currency:'usd',amount:74250,fee:2250,net:72000,source:{id:'ch_rent_fixture',payment_intent:'pi_rent'}}],has_more:false})
  if(p==='/v1/payment_intents'){holdRequests++;assert.equal(form.get('capture_method'),'manual');assert.equal(form.get('amount'),'25000');return Response.json({id:'pi_deposit',status:'requires_capture'})}
  if(p==='/v1/payment_intents/pi_deposit')return Response.json({id:'pi_deposit',status:depositStatus,latest_charge:{payment_method_details:{card:{capture_before:Math.floor(Date.now()/1000)+6*86400}}}})
  if(p==='/v1/payment_intents/pi_deposit/cancel'){releaseRequests++;depositStatus='canceled';return Response.json({id:'pi_deposit',status:depositStatus})}
  if(p==='/v1/identity/verification_sessions')return Response.json({id:'vs_synthetic',status:'requires_input',url:'https://verify.stripe.com/start/synthetic'})
  if(p==='/v1/identity/verification_sessions/vs_synthetic')return Response.json({id:'vs_synthetic',status:verification?'verified':'requires_input'})
  assert.fail('Unexpected provider call '+p)
 }})
 try{
  const cfg=await home(h),p={start:day(0),end:day(3),guests:3}
  const q=await h.send('/book/pine-ridge/quote',p);assert.equal(q.status,200);assert.equal(q.value.quote.totalCents,74250);assert.deepEqual(q.value.quote.taxes.map(t=>t.amountCents),[6075,675])
  const book=await h.send('/book/pine-ridge/checkout',{...p,homeRevision:cfg.revision,guestName:'Alex Example',email:'alex@stay.example',signature:'Alex Example',consent:'yes',identityConsent:'yes'});assert.equal(book.status,200,book.text)
  const {token,id}=book.value
  const exportFeed=await h.cmd('export.publish',{propertyId:cfg.propertyId});assert.ok(exportFeed.token)
  for(const ch of ['airbnb','vrbo','booking-com']){const r=await h.send(`/ical/${exportFeed.token}/${ch}.ics`);assert.equal(r.status,200,r.text);assert.match(r.text,new RegExp(day(0).replace(/-/g,'')))}
  const overlap=await h.send('/book/pine-ridge/quote',p);assert.equal(overlap.status,409);assert.match(overlap.value.error,/no longer available/)
  const unpaid=await h.send(`/book/stay/${token}/refresh`,{});assert.equal(unpaid.value.stay.phase,'held');assert.equal(holdRequests,0)
  payment=true
  const paid=await h.send(`/book/stay/${token}/refresh`,{});assert.equal(paid.status,200,paid.text);assert.equal(paid.value.stay.phase,'paid');assert.equal(paid.value.stay.deposit.status,'requires_capture')
  const receipt=(await h.state()).messages.find(m=>m.subject.endsWith('booking payment received'));assert.match(receipt.text,/Damage authorization: Held on card/);assert.match(receipt.text,/Cleaning fee: \$75\.00/)
  assert.equal((await h.send(`/book/stay/${token}/identity`,{})).status,303);verification=true
  const ready=await h.send(`/book/stay/${token}/refresh`,{});assert.equal(ready.value.stay.phase,'confirmed');assert.equal(ready.value.stay.identity.status,'verified')
  await h.send(`/book/stay/${token}/refresh`,{});assert.equal(holdRequests,1)
  const state=await h.state();assert.equal(state.bookings.filter(b=>b.channel==='direct'&&b.kind==='stay').length,1);assert.equal(state.direct.stays[0].paymentId,'pi_rent')
  const payouts=await h.cmd('payout.stripe',{});assert.equal(payouts.matched,1);assert.equal(payouts.imported[0].bookingId,state.bookings.find(b=>b.channel==='direct').id);assert.equal(payouts.imported[0].feeCents,2250);assert.equal(payouts.imported[0].netCents,72000)
  assert.equal((await h.cmd('payout.stripe',{})).duplicates.length,1)
  await h.cmd('direct.tax.filed',{id,jurisdiction:'state',reference:'Synthetic state filing fixture'});await h.cmd('direct.tax.filed',{id,jurisdiction:'county',reference:'Synthetic county filing fixture'});assert.equal((await h.state()).direct.stays[0].taxFilings.length,2)
  const agreement=await h.send(`/book/stay/${token}/agreement`);assert.match(agreement.text,/Signed electronically by: Alex Example/);assert.match(agreement.text,/USD 742.50/)
  assert.equal((await h.send(`/api/cabin/direct/stays/${id}/agreement`,undefined,'')).status,401)
  await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409);await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409)
  assert.equal((await h.state()).direct.stays[0].deposit.status,'requires_capture')
  const arrive=async ms=>(await h.mf.getD1Database('DB')).prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.arrivalAt',?) WHERE id=?").bind(new Date(ms).toISOString(),id).run()
  await arrive(Date.now()+3_600_000);await h.cmd('direct.checkout.complete',{id},h.owner,409)
  await arrive(Date.now()-3_600_000);await h.cmd('direct.checkout.complete',{id});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await h.state()).direct.stays[0].deposit.status,'canceled');assert.equal(releaseRequests,1)
 }finally{await h.close()}
})

test('a guest whose checkout Stripe refuses gets guest wording, keeps the hold and can try payment again',async()=>{
 let refuse=true,created=0
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fake'},outbound:async request=>{
  const u=new URL(request.url)
  if(u.pathname==='/v1/checkout/sessions'&&request.method==='POST'){created++;return refuse?Response.json({error:{type:'invalid_request_error',param:'payment_method_types'}},{status:400}):Response.json({id:'cs_test_retry',url:'https://checkout.stripe.com/c/pay/cs_test_retry'})}
  assert.fail('Unexpected provider call '+u.pathname)
 }})
 try{
  const cfg=await home(h)
  const book=await h.send('/book/pine-ridge/checkout',{start:day(10),end:day(13),guests:2,homeRevision:cfg.revision,guestName:'Alex Example',email:'alex@stay.example',signature:'Alex Example',consent:'yes',identityConsent:'yes'})
  assert.equal(book.status,400);assert.doesNotMatch(book.value.error,/dashboard/i)
  const path=new URL(book.value.bookingUrl).pathname,page=await h.send(path)
  assert.equal(page.status,200);assert.doesNotMatch(page.text,/dashboard|Developers/i);assert.match(page.text,/Try payment again/)
  assert.match((await h.state()).direct.stays[0].error,/HTTP 400/)
  refuse=false
  const retry=await h.send(path+'/pay',{});assert.equal(retry.status,303);assert.equal(retry.headers.get('location'),'https://checkout.stripe.com/c/pay/cs_test_retry');assert.equal(created,2)
  const after=await h.send(path);assert.match(after.text,/Pay with Stripe/);assert.doesNotMatch(after.text,/Try payment again/)
 }finally{await h.close()}
})

test('direct booking refuses minimum nights, orphan gaps, changed terms and cross-origin checkout with the reason',async()=>{
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fake'},outbound:()=>assert.fail('An invalid booking must not call Stripe')})
 try{
  const cfg=await home(h)
  const short=await h.send('/book/pine-ridge/quote',{start:day(20),end:day(21),guests:2});assert.equal(short.status,400);assert.match(short.value.error,/at least 2 nights/)
  await h.cmd('reservation.request',{propertyId:cfg.propertyId,channel:'airbnb',start:day(20),end:day(23),guestName:'Calendar guest'})
  const gap=await h.send('/book/pine-ridge/quote',{start:day(24),end:day(27),guests:2});assert.equal(gap.status,400);assert.match(gap.value.error,/gap shorter than 2/)
  const stale=await h.send('/book/pine-ridge/checkout',{start:day(30),end:day(33),guests:2,homeRevision:'outdated'});assert.equal(stale.status,409);assert.match(stale.value.error,/terms changed/)
  const csrf=await h.send('/book/pine-ridge/checkout',{},'',{origin:'https://elsewhere.example'});assert.equal(csrf.status,403)
  assert.equal((await h.state()).direct.stays.length,0)
  const managed=await harness({auth:{MAIL_PROVIDER:'rer'}})
  try{await home(managed);const no=await managed.send('/book/pine-ridge/checkout',{});assert.equal(no.status,409);assert.match(no.value.error,/not available yet/)}finally{await managed.close()}
 }finally{await h.close()}
})
