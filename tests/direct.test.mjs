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
  const original=(await h.state()).rentalAgreements.find(a=>a.bookingId===state.direct.stays[0].bookingId),first=original.documents[0]
  await h.cmd('direct.agreement.amend',{bookingId:original.bookingId,revision:original.revision,reason:'Guest requested an updated quiet-hours exception',terms:'Quiet hours begin at 11 pm for this stay only.',keepPrice:'yes'})
  let renewed=(await h.state()).rentalAgreements.find(a=>a.id===original.id),version=renewed.documents.at(-1)
  assert.equal(version.signature,undefined);assert.equal((await h.send(`/book/stay/${token}/agreement?version=${first.id}`)).text,agreement.text)
  assert.equal((await h.send(`/book/stay/agreement/${renewed.token}`,{version:version.id,sha256:version.sha256,name:'Alex Example',email:'alex@stay.example',consent:'yes'})).status,303)
  renewed=(await h.state()).rentalAgreements.find(a=>a.id===original.id);assert.equal(renewed.documents.filter(d=>d.signature).length,2)
  assert.equal((await h.send(`/api/cabin/direct/stays/${id}/agreement`,undefined,'')).status,401)
  await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409);await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409)
  assert.equal((await h.state()).direct.stays[0].deposit.status,'requires_capture')
  const arrive=async ms=>(await h.mf.getD1Database('DB')).prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.arrivalAt',?) WHERE id=?").bind(new Date(ms).toISOString(),id).run()
  await arrive(Date.now()+3_600_000);await h.cmd('direct.checkout.complete',{id},h.owner,409)
  await arrive(Date.now()-3_600_000);await h.cmd('direct.checkout.complete',{id});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await h.state()).direct.stays[0].deposit.status,'canceled');assert.equal(releaseRequests,1)
 }finally{await h.close()}
})

test('rental agreements work without outside accounts: versioned property terms, guest signing, changed dates, retained downloads and access gates',async()=>{
 const h=await harness({outbound:()=>assert.fail('Rental agreements must not need an outside provider')})
 try{
  const manager=await h.person('AgreementManager','manager'),cleaner=await h.person('AgreementCleaner')
  const p=await h.cmd('property.save',{name:'Agreement Home',ownerName:'Casey Owner',ownerEmail:'casey@stay.example',commissionBps:2000})
  const policy={propertyId:p.id,agreementTitle:'Maine vacation rental terms',agreementState:'ME',agreement:'No smoking. Pets only with written agreement.',agreementRequired:true,agreementBlockAccess:true}
  const template=await h.cmd('direct.agreement.template',policy,manager.cookie)
  await h.cmd('inbox.schedule',{checkinEnabled:true,checkinHours:720,checkoutEnabled:false,reviewEnabled:false})
  const stay=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',start:day(7),end:day(10),guestName:'Sam Guest',guestEmail:'sam@stay.example'})
  let state=await h.state(),a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId),d=a.documents.at(-1)
  assert.ok(a.token);assert.equal(d.signature,undefined);assert.equal(state.codes.filter(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued').length,0)
  assert.equal(state.messages.filter(m=>m.bookingId===stay.bookingId&&m.scheduledId).length,0,'configured check-in instructions remain unsent until signing')
  const link=`/book/stay/agreement/${a.token}`,signature={version:d.id,sha256:d.sha256,name:'Sam Guest',email:'sam@stay.example',consent:'yes'}
  assert.match((await h.send(link)).text,/No smoking/)
  assert.equal((await h.send(link,{...signature,version:'stale'})).status,409)
  assert.equal((await h.send(link,signature,'',{origin:'https://unapproved.example'})).status,403)
  assert.equal((await h.send(link,{...signature,email:'someone@stay.example'})).status,400)
  assert.equal((await h.send(link,signature)).status,303)
  state=await h.state();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);d=a.documents.at(-1)
  const originalUrl=link+'/document/'+d.id,original=await h.send(originalUrl),code=state.codes.find(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued')
  assert.ok(code);assert.match((await h.send('/stay/'+code.link)).text,new RegExp(code.code));assert.match(original.text,/Email at signing: sam@stay.example/)
  assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`)).status,401)
  assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`,undefined,cleaner.cookie)).status,403)
  const redacted=await h.state(cleaner.cookie);assert.equal(redacted.rentalAgreements.length,0);assert.equal(redacted.rentalTemplates.length,0)
  const next=await h.cmd('direct.agreement.template',{...policy,templateRevision:template.revision,agreement:'No smoking. One approved dog is allowed.'},manager.cookie)
  state=await h.state();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,1);assert.ok(a.documents[0].signature);assert.equal(next.versions.length,2)
  await h.cmd('direct.agreement.amend',{bookingId:stay.bookingId,revision:a.revision,start:day(8),end:day(11),reason:'Guest moved arrival and added their dog',terms:'One dog is approved for the amended dates.',useCurrentTemplate:'yes'},manager.cookie)
  state=await h.state();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);const amended=a.documents.at(-1)
  assert.equal(amended.signature,undefined);assert.equal(amended.templateVersion,next.currentVersion);assert.equal(amended.start,day(8));assert.equal(state.bookings.find(b=>b.id===stay.bookingId).start,day(8));assert.equal(state.codes.find(c=>c.id===code.id).status,'revoked')
  const blocked=await h.send('/stay/'+code.link);assert.doesNotMatch(blocked.text,new RegExp(`<p class="code">${code.code}</p>`));assert.match(blocked.text,/Review and sign/)
  assert.equal((await h.send(originalUrl)).text,original.text,'original signed document and evidence remain byte-for-byte downloadable')
  assert.equal((await h.send(link,signature)).status,409,'old consent cannot satisfy the amendment')
  const renewed={...signature,version:amended.id,sha256:amended.sha256}
  assert.equal((await h.send(link,renewed)).status,303);assert.equal((await h.send(link,renewed)).status,303,'repeated signing is idempotent')
  state=await h.state();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,2);assert.equal(a.documents.filter(d=>d.signature).length,2)
  const newCode=state.codes.find(c=>c.bookingId===stay.bookingId&&c.status==='issued'&&c.holder==='guest');assert.ok(newCode);assert.notEqual(newCode.id,code.id)
  await h.cmd('inbox.schedule',{checkinEnabled:true,checkinHours:720,checkoutEnabled:false,reviewEnabled:false,revision:state.inbox[0].revision})
  state=await h.state();assert.ok(state.messages.some(m=>m.bookingId===stay.bookingId&&m.scheduledId&&m.text.includes(newCode.code)))
  await h.cmd('reservation.move',{id:stay.bookingId,start:day(9),end:day(12)})
  state=await h.state();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,3);assert.equal(a.documents.at(-1).signature,undefined,'moving through the ordinary reservation command also requests renewed consent')
  const b=state.bookings.find(b=>b.id===stay.bookingId);await h.cmd('privacy.erase',{entity:'guest',id:b.id,revision:b.revision})
  assert.equal((await h.send(link)).status,404);assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`,undefined,h.owner)).text,original.text,'staff retain the immutable legal record after guest-link revocation')
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
