import { rooms,sourceRoom } from './capacity-support.mjs'
import { homeDay } from './home-calendar.mjs'
import { readFile } from 'node:fs/promises'
import { attestArrival } from './readiness-helpers.mjs'
import { erase } from './privacy-flow.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
const day=n=>homeDay(n, 'America/New_York')
const settings={enabled:true,slug:'pine-ridge',description:'A quiet Maine cabin near the lake.',nightlyCents:18000,cleaningCents:7500,extraGuestCents:2000,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:2,depositCents:25000,releaseHours:0,taxLabel:'Maine lodging tax',taxBps:900,countyTaxLabel:'County lodging tax',countyTaxBps:100,agreement:'No smoking. Quiet hours after 10 pm. Damage claims require evidence.',requireIdentity:true}
async function home(h){const p=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Morgan Example',ownerEmail:'morgan@stay.example',commissionBps:2000});return h.cmd('direct.configure',{...settings,propertyId:p.id})}

test('only the installation owner can configure Stripe, including against a legacy wildcard grant',async()=>{
 const provider=async h=>(await h.db.prepare('SELECT data FROM cb_direct_provider WHERE id=1').first())?.data??null
 let providerCalls=0,checkouts=0
 const h=await harness({outbound:async request=>{
  providerCalls++
  const path=new URL(request.url).pathname
  assert.equal(new URL(request.url).hostname,'api.stripe.com')
  if(path==='/v1/balance')return Response.json({object:'balance',livemode:request.headers.get('authorization')?.includes('sk_live_')})
  if(path==='/v1/checkout/sessions'){
   assert.equal(request.method,'POST')
   const id='cs_owner_check_'+(++checkouts)
   return Response.json({id,url:'https://checkout.stripe.com/c/pay/'+id})
  }
  if(path.startsWith('/v1/checkout/sessions/cs_owner_check_')){
   assert.equal(request.method,'GET')
   return Response.json({id:path.split('/').pop(),status:'complete',payment_status:'paid',metadata:{purpose:'cabin_connection_check'},payment_intent:{status:'succeeded',amount_received:100,currency:'usd'}})
  }
  assert.fail('Unexpected provider call '+path)
 }})
 try{
  const manager=await h.person('LegacyStripeManager','manager')
  assert.deepEqual(manager.scope.propertyIds,['*']);assert.deepEqual(manager.scope.actions,['*'])
  const command=(cookie,name,input)=>h.send('/api/cabin/command',{name,input},cookie)

  assert.equal((await command(h.owner,'direct.stripe.save',{mode:'test',key:'sk_test_owner1'})).status,200)
  assert.equal((await command(h.owner,'direct.stripe.save',{mode:'live',key:'sk_live_owner1',liveConsent:'yes'})).status,200)
  assert.equal((await command(h.owner,'direct.stripe.mode',{mode:'test'})).status,200)
  assert.equal((await command(h.owner,'direct.stripe.mode',{mode:'live',liveConsent:'yes'})).status,200)
  const before=await provider(h),callsBeforeManager=providerCalls

  const managerSave=await command(manager.cookie,'direct.stripe.save',{mode:'test',key:'sk_test_manager1'}),afterSave=await provider(h)
  const managerMode=await command(manager.cookie,'direct.stripe.mode',{mode:'test'}),afterMode=await provider(h)
  const managerTest=await command(manager.cookie,'direct.stripe.test',{}),afterTest=await provider(h)
  const managerPage=await h.send('/app/direct',undefined,manager.cookie),ownerPage=await h.send('/app/direct',undefined,h.owner)

  assert.equal(managerSave.status,403,managerSave.text);assert.equal(afterSave,before)
  assert.equal(managerMode.status,403,managerMode.text);assert.equal(afterMode,before)
  assert.equal(managerTest.status,403,managerTest.text);assert.equal(afterTest,before)
  assert.equal(providerCalls,callsBeforeManager,'refused setup commands do not reach Stripe')
  assert.equal(managerPage.status,200,managerPage.text);assert.doesNotMatch(managerPage.text,/Connect Stripe|direct\.stripe\.save/)
  assert.equal(ownerPage.status,200,ownerPage.text);assert.match(ownerPage.text,/Connect Stripe/)
  assert.equal((await command(h.owner,'direct.stripe.test',{})).status,200)

  const pending=await provider(h),callsBeforeCheck=providerCalls
  assert.equal(JSON.parse(pending).check.status,'pending')
  const managerCheck=await command(manager.cookie,'direct.stripe.check',{})
  assert.equal(managerCheck.status,403,managerCheck.text);assert.equal(await provider(h),pending)
  const htmlCheck=cookie=>h.mf.dispatchFetch(h.origin+'/app/action?name=direct.stripe.check&returnTo=%2Fapp%2Fdirect',{method:'POST',headers:{origin:h.origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:'',redirect:'manual'})
  const managerHtml=await htmlCheck(manager.cookie),managerError=await managerHtml.text()
  assert.equal(managerHtml.status,200,managerError);assert.match(managerError,/Owner access required/)
  assert.doesNotMatch(managerError,/Connect Stripe|direct\.stripe\.save/)
  assert.equal(providerCalls,callsBeforeCheck,'refused HTML setup and error rendering do not reach Stripe')
  assert.equal(await provider(h),pending,'refused HTML setup leaves the provider row byte-for-byte unchanged')

  const ownerHtml=await htmlCheck(h.owner),ownerResult=await ownerHtml.text()
  assert.equal(ownerHtml.status,200,ownerResult);assert.match(ownerResult,/Stripe test charge succeeded/)
  assert.equal(providerCalls,callsBeforeCheck+2,'the owner check reads the balance and checkout')
  assert.equal(JSON.parse(await provider(h)).check.status,'paid')

  assert.equal((await command(h.owner,'direct.stripe.test',{})).status,200)
  const nextPending=await provider(h),callsBeforeReturn=providerCalls
  assert.equal(JSON.parse(nextPending).check.status,'pending')
  const managerReturn=await h.send('/app/direct',undefined,manager.cookie)
  assert.equal(managerReturn.status,200,managerReturn.text)
  assert.equal(providerCalls,callsBeforeReturn);assert.equal(await provider(h),nextPending)
  const ownerReturn=await h.send('/app/direct',undefined,h.owner)
  assert.equal(ownerReturn.status,200,ownerReturn.text);assert.match(ownerReturn.text,/Passed — Stripe confirmed a \$1\.00 test payment/)
  assert.equal(providerCalls,callsBeforeReturn+1,'the owner page still reconciles a pending checkout')
  assert.equal(JSON.parse(await provider(h)).check.status,'paid')

  const p=await h.cmd('property.save',{name:'Manager Booking Home',ownerName:'Morgan Example',ownerEmail:'morgan@stay.example',commissionBps:2000})
  assert.equal((await command(manager.cookie,'direct.configure',{...settings,slug:'manager-booking-home',propertyId:p.id})).status,200)
 }finally{await h.close()}
})

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
  const receipt=(await h.accessState()).messages.find(m=>m.subject.endsWith('booking payment received'));assert.match(receipt.text,/Damage authorization: Held on card/);assert.match(receipt.text,/Cleaning fee: \$75\.00/)
  assert.equal((await h.send(`/book/stay/${token}/identity`,{})).status,303);verification=true
  const ready=await h.send(`/book/stay/${token}/refresh`,{});assert.equal(ready.value.stay.phase,'confirmed');assert.equal(ready.value.stay.identity.status,'verified')
  await h.send(`/book/stay/${token}/refresh`,{});assert.equal(holdRequests,1)
  const state=await h.accessState();assert.equal(state.bookings.filter(b=>b.channel==='direct'&&b.kind==='stay').length,1);assert.equal(state.direct.stays[0].paymentId,'pi_rent')
  const payouts=await h.cmd('payout.stripe',{});assert.equal(payouts.matched,1);assert.equal(payouts.imported[0].bookingId,state.bookings.find(b=>b.channel==='direct').id);assert.equal(payouts.imported[0].feeCents,2250);assert.equal(payouts.imported[0].netCents,72000)
  assert.equal((await h.cmd('payout.stripe',{})).duplicates.length,1)
  await h.cmd('direct.tax.filed',{id,jurisdiction:'state',reference:'Synthetic state filing fixture'});await h.cmd('direct.tax.filed',{id,jurisdiction:'county',reference:'Synthetic county filing fixture'});assert.equal((await h.accessState()).direct.stays[0].taxFilings.length,2)
  const agreement=await h.send(`/book/stay/${token}/agreement`);assert.match(agreement.text,/Signed electronically by: Alex Example/);assert.match(agreement.text,/USD 742.50/)
  const original=(await h.accessState()).rentalAgreements.find(a=>a.bookingId===state.direct.stays[0].bookingId),first=original.documents[0]
  await h.cmd('direct.agreement.amend',{bookingId:original.bookingId,revision:original.revision,reason:'Guest requested an updated quiet-hours exception',terms:'Quiet hours begin at 11 pm for this stay only.',keepPrice:'yes'})
  let renewed=(await h.accessState()).rentalAgreements.find(a=>a.id===original.id),version=renewed.documents.at(-1)
  assert.equal(version.signature,undefined);assert.equal((await h.send(`/book/stay/${token}/agreement?version=${first.id}`)).text,agreement.text)
  assert.equal((await h.send(`/book/stay/agreement/${renewed.token}`,{version:version.id,sha256:version.sha256,name:'Alex Example',email:'alex@stay.example',consent:'yes'})).status,303)
  renewed=(await h.accessState()).rentalAgreements.find(a=>a.id===original.id);assert.equal(renewed.documents.filter(d=>d.signature).length,2)
  assert.equal((await h.send(`/api/cabin/direct/stays/${id}/agreement`,undefined,'')).status,401)
  await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409);await h.cmd('direct.deposit.capture',{id,amountCents:5000,reason:'Broken lamp',evidence:'photo:synthetic-lamp'},h.owner,409)
  assert.equal((await h.accessState()).direct.stays[0].deposit.status,'requires_capture')
  const arrive=async ms=>(await h.mf.getD1Database('DB')).prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.arrivalAt',?) WHERE id=?").bind(new Date(ms).toISOString(),id).run()
  await arrive(Date.now()+3_600_000);await h.cmd('direct.checkout.complete',{id},h.owner,409)
  await arrive(Date.now()-3_600_000);await h.cmd('direct.checkout.complete',{id});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await h.accessState()).direct.stays[0].deposit.status,'canceled');assert.equal(releaseRequests,1)
  let booked=(await h.accessState()).bookings.find(b=>b.id===state.direct.stays[0].bookingId)
  await h.cmd('reservation.amend',{id:booked.id,revision:booked.revision,propertyId:cfg.propertyId,start:day(1),end:day(4),guestName:'Alex Example',guestEmail:'alex@stay.example',rentCents:64000,feesCents:7500,taxCents:6750,reason:'Guest accepted revised dates and price'})
  booked=(await h.accessState()).bookings.find(b=>b.id===booked.id);assert.equal(booked.lifecycle.price.totalCents,78250);assert.equal(booked.reservationBalance.balanceCents,4000)
  await h.cmd('reservation.end',{id:booked.id,revision:booked.revision,outcome:'cancelled',reason:'Guest cancelled the amended stay'})
  const cancelled=await h.send(`/book/stay/${token}`);assert.match(cancelled.text,/Your reservation was cancelled/);assert.doesNotMatch(cancelled.text,/Verify ID with Stripe|Authorize damage deposit/)
  assert.equal((await h.send(`/book/stay/${token}/identity`,{})).status,409)
  assert.equal((await h.send(`/book/stay/${token}/refresh`,{})).value.stay.phase,'cancelled')

 }finally{await h.close()}
})

test('rental agreements work without outside accounts: versioned property terms, guest signing, changed dates, retained downloads and access gates',async()=>{
 const h=await harness({outbound:()=>assert.fail('Rental agreements must not need an outside provider')})
 try{
  const manager=await h.person('AgreementManager','manager'),cleaner=await h.person('AgreementCleaner')
  const p=await h.cmd('property.save',{name:'Agreement Home',ownerName:'Casey Owner',ownerEmail:'casey@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:p.id,address:'18 Harbor Road, Portland, ME',timeZone:'America/New_York',cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
  const previous=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',start:day(-4),end:day(-1),guestName:'Previous guest'})
  const policy={propertyId:p.id,agreementTitle:'Maine vacation rental terms',agreementState:'ME',agreement:'No smoking. Pets only with written agreement.',agreementRequired:true,agreementBlockAccess:true}
  const template=await h.cmd('direct.agreement.template',policy,manager.cookie)
  await h.cmd('inbox.schedule',{checkinEnabled:true,checkinHours:720,checkoutEnabled:false,reviewEnabled:false})
  const stay=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',start:day(7),end:day(10),guestName:'Sam Guest',guestEmail:'sam@stay.example'})
  let state=await h.accessState(),a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId),d=a.documents.at(-1)
  assert.ok(a.token);assert.equal(d.signature,undefined);assert.equal(state.codes.filter(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued').length,0)
  assert.equal(state.messages.filter(m=>m.bookingId===stay.bookingId&&m.scheduledId).length,0,'configured check-in instructions remain unsent until signing')
  const link=`/book/stay/agreement/${a.token}`,signature={version:d.id,sha256:d.sha256,name:'Sam Guest',email:'sam@stay.example',consent:'yes'}
  assert.match((await h.send(link)).text,/No smoking/)
  assert.equal((await h.send(link,{...signature,version:'stale'})).status,409)
  assert.equal((await h.send(link,signature,'',{origin:'https://unapproved.example'})).status,403)
  assert.equal((await h.send(link,{...signature,email:'someone@stay.example'})).status,400)
  assert.equal((await h.send(link,signature)).status,303)
  state=await h.accessState();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);d=a.documents.at(-1)
  const originalUrl=link+'/document/'+d.id,original=await h.send(originalUrl),code=state.codes.find(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued')
  assert.ok(code);const guestCookie=await h.verifyGuest(code.link);assert.match((await h.send('/stay/'+code.link,undefined,guestCookie)).text,new RegExp(code.code));assert.match(original.text,/Email at signing: sam@stay.example/)
  assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`)).status,401)
  assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`,undefined,cleaner.cookie)).status,403)
  const redacted=await h.accessState(cleaner.cookie);assert.equal(redacted.rentalAgreements.length,0);assert.equal(redacted.rentalTemplates.length,0)
  const next=await h.cmd('direct.agreement.template',{...policy,templateRevision:template.revision,agreement:'No smoking. One approved dog is allowed.'},manager.cookie)
  state=await h.accessState();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,1);assert.ok(a.documents[0].signature);assert.equal(next.versions.length,2)
  await h.cmd('direct.agreement.amend',{bookingId:stay.bookingId,revision:a.revision,start:day(8),end:day(11),reason:'Guest moved arrival and added their dog',terms:'One dog is approved for the amended dates.',useCurrentTemplate:'yes'},manager.cookie)
  state=await h.accessState();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);const amended=a.documents.at(-1)
  assert.equal(amended.signature,undefined);assert.equal(amended.templateVersion,next.currentVersion);assert.equal(amended.start,day(8));assert.equal(state.bookings.find(b=>b.id===stay.bookingId).start,day(8));assert.equal(state.codes.find(c=>c.id===code.id).status,'revoked')
  const blocked=await h.send('/stay/'+code.link,undefined,guestCookie);assert.doesNotMatch(blocked.text,new RegExp(`<p class="code">${code.code}</p>`));assert.match(blocked.text,/Review and sign/)
  assert.equal((await h.send(originalUrl)).text,original.text,'original signed document and evidence remain byte-for-byte downloadable')
  assert.equal((await h.send(link,signature)).status,409,'old consent cannot satisfy the amendment')
  const renewed={...signature,version:amended.id,sha256:amended.sha256}
  assert.equal((await h.send(link,renewed)).status,303);assert.equal((await h.send(link,renewed)).status,303,'repeated signing is idempotent')
  state=await h.accessState();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,2);assert.equal(a.documents.filter(d=>d.signature).length,2)
  const newCode=state.codes.find(c=>c.bookingId===stay.bookingId&&c.status==='issued'&&c.holder==='guest');assert.ok(newCode);assert.notEqual(newCode.id,code.id)
  let cleaning=await h.cmd('turnover.prepare',{bookingId:previous.bookingId,cleanerId:cleaner.id,dueDate:day(8),checklist:['Ready']})
  await h.cmd('turnover.approve',{id:cleaning.id,revision:cleaning.revision})
  cleaning=(await h.accessState()).turnovers.find(t=>t.id===cleaning.id)
  await h.cmd('turnover.complete',{id:cleaning.id,revision:cleaning.revision,checks:['Ready'],caption:'Physical cleaning before arrival',photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}]},cleaner.cookie)
  await attestArrival(h,stay.bookingId)
  state=await h.accessState()
  await h.cmd('inbox.schedule',{checkinEnabled:true,checkinHours:720,checkoutEnabled:false,reviewEnabled:false,revision:state.inbox[0].revision})
  state=await h.accessState();assert.ok(state.messages.some(m=>m.bookingId===stay.bookingId&&m.scheduledId&&m.text.includes(newCode.code)))
  await h.cmd('reservation.move',{id:stay.bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===stay.bookingId).revision,start:day(9),end:day(12)})
  state=await h.accessState();a=state.rentalAgreements.find(a=>a.bookingId===stay.bookingId);assert.equal(a.documents.length,3);assert.equal(a.documents.at(-1).signature,undefined,'moving through the ordinary reservation command also requests renewed consent')
  const b=state.bookings.find(b=>b.id===stay.bookingId);await erase(h,{entity:'guest',id:b.id,revision:b.revision})
  assert.equal((await h.send(link)).status,404);assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`,undefined,h.owner)).status,404);const held=(await h.accessState()).privacy.holds.find(v=>v.sourceTable==='cb_records:rentalAgreements'&&v.sourceId===a.id);const retained=await h.cmd('privacy.hold.read',{id:held.id});assert.equal((await h.send(`/api/cabin/privacy/holds/${held.id}/document/${d.id}`,undefined,h.owner)).text,original.text,'owner retains the exact signed legal record in an isolated hold')
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
  assert.match((await h.accessState()).direct.stays[0].error,/HTTP 400/)
  refuse=false
  const retry=await h.send(path+'/pay',{});assert.equal(retry.status,303);assert.equal(retry.headers.get('location'),'https://checkout.stripe.com/c/pay/cs_test_retry');assert.equal(created,2)
  const after=await h.send(path);assert.match(after.text,/Pay with Stripe/);assert.doesNotMatch(after.text,/Try payment again/)
 }finally{await h.close()}
})

test('direct booking enforces dated rates, notice, buffers, saved terms and checkout refusals',{timeout:120000},async()=>{
 const day=n=>homeDay(n,'America/New_York',Date.parse('2030-01-01T17:00:00Z'));let allowPayment=false,charged=0
 const h=await harness({assets:true,now:'2030-01-01T17:00:00Z',auth:{STRIPE_TEST_SECRET_KEY:['sk','test','syntheticcabin1'].join('_')},outbound:async request=>{assert.ok(allowPayment,'invalid checkout never calls Stripe');const f=new URLSearchParams(await request.text());charged=[...f].filter(([k])=>/line_items\[\d+\]\[price_data\]\[unit_amount\]/.test(k)).reduce((sum,[,v])=>sum+Number(v),0);return Response.json({id:'synthetic-cabin-1',url:'https://checkout.stripe.com/synthetic-cabin-1'})}})
 try{
  let cfg=await home(h)
  const short=await h.send('/book/pine-ridge/quote',{start:day(20),end:day(21),guests:2});assert.equal(short.status,400);assert.match(short.value.error,/at least 2 nights/)
  await h.cmd('reservation.request',{propertyId:cfg.propertyId,channel:'airbnb',start:day(20),end:day(23),guestName:'Calendar guest'})
  const gap=await h.send('/book/pine-ridge/quote',{start:day(24),end:day(27),guests:2});assert.equal(gap.status,400);assert.match(gap.value.error,/gap shorter than 2/)
  const stale=await h.send('/book/pine-ridge/checkout',{start:day(30),end:day(33),guests:2,homeRevision:'outdated'});assert.equal(stale.status,409);assert.match(stale.value.error,/terms changed/)
  const csrf=await h.send('/book/pine-ridge/checkout',{},'',{origin:'https://elsewhere.example'});assert.equal(csrf.status,403)
  assert.equal((await h.accessState()).direct.stays.length,0)
  cfg=await h.cmd('direct.configure',{...settings,propertyId:cfg.propertyId,revision:cfg.revision,advanceNoticeDays:2,bookingWindowDays:90,preparationNights:2,policyName:'Retain one quarter',retainedBps:2500})
  const rate=async input=>{cfg=await h.cmd('direct.rate.save',{propertyId:cfg.propertyId,revision:cfg.revision,...input})}
  await rate({start:'2030-01-16',end:'2030-01-17',weekday:'all',nightlyCents:25000})
  await h.cmd('direct.rate.save',{propertyId:cfg.propertyId,revision:cfg.revision,start:'2030-01-16',end:'2030-01-19',weekday:3,nightlyCents:20000},h.owner,409)
  const cleaner=await h.person('RateCleaner');await h.cmd('direct.rate.remove',{propertyId:cfg.propertyId,revision:cfg.revision,rateId:cfg.rates[0].id},cleaner.cookie,403)
  const good={start:'2030-01-15',end:'2030-01-18',guests:3}
  let q=await h.send('/book/pine-ridge/quote',good);assert.equal(q.status,200,q.text);assert.deepEqual(q.value.quote.nightlyRates,[{date:'2030-01-15',amountCents:18000},{date:'2030-01-16',amountCents:25000},{date:'2030-01-17',amountCents:18000}]);assert.equal(q.value.quote.rentCents,61000);assert.equal(q.value.quote.extraGuestCents,6000);assert.equal(q.value.quote.totalCents,81950)
  q=await h.send('/book/pine-ridge/quote',{start:'2030-01-17',end:'2030-01-19',guests:2});assert.equal(q.status,200,q.text);assert.equal(q.value.quote.rentCents,36000,'end date is excluded')
  const signed={homeRevision:cfg.revision,guestName:'Alex Example',email:'alex@stay.example',signature:'Alex Example',consent:'yes',identityConsent:'yes'}
  for(const [input,status,reason] of [[{start:day(1),end:day(4),guests:2},400,/advance notice/],[{start:day(91),end:day(94),guests:2},400,/within 90 days/],[{start:day(23),end:day(26),guests:2},409,/preparation nights/],[{start:day(16),end:day(20),guests:2},409,/preparation nights/]]){
   for(const door of ['quote','checkout']){const refused=await h.send('/book/pine-ridge/'+door,{...signed,...input});assert.equal(refused.status,status,refused.text);assert.match(refused.value.error,reason)}
  }
  q=await h.send('/book/pine-ridge/quote',{start:day(25),end:day(28),guests:2});assert.equal(q.status,200,q.text)
  await rate({start:'2030-01-14',end:'2030-01-16',weekday:2,nightlyCents:20000})
  q=await h.send('/book/pine-ridge/quote',{start:'2030-01-14',end:'2030-01-17',guests:2});assert.equal(q.status,200,q.text);assert.deepEqual(q.value.quote.nightlyRates.map(r=>r.amountCents),[18000,20000,25000],'weekday matching and fallback are per night')
  const old=await h.send('/book/pine-ridge/checkout',{...signed,...good});assert.equal(old.status,409);assert.match(old.value.error,/terms changed/)
  await h.cmd('direct.rate.remove',{propertyId:cfg.propertyId,revision:cfg.revision,rateId:cfg.rates.at(-1).id});cfg=(await h.accessState()).direct.homes[0]
  // Use a different stay so the browser's priced dates remain available.
  allowPayment=true;const accepted=await h.send('/book/pine-ridge/checkout',{...signed,homeRevision:cfg.revision,start:day(40),end:day(43),guests:3});assert.equal(accepted.status,200,accepted.text);assert.equal(charged,74250)
  cfg=await h.cmd('direct.configure',{...settings,propertyId:cfg.propertyId,revision:cfg.revision,advanceNoticeDays:2,bookingWindowDays:90,preparationNights:2,policyName:'New full charge',retainedBps:10000})
  await h.restart();const retained=(await h.accessState()).direct.stays[0];assert.equal(retained.quote.cancellationPolicy.retainedBps,2500);assert.match(retained.signature.text,/Retain one quarter/);assert.equal(retained.quote.totalCents,74250);assert.equal((await h.send('/book/stay/'+accepted.value.token+'/agreement')).status,200)
  const renewed=await h.send('/book/pine-ridge/quote',good);assert.equal(renewed.status,200,renewed.text);assert.equal(renewed.value.quote.totalCents,81950,'editing booking settings retains saved dated rates')
  const whole=await h.cmd('property.save',{name:'Linked rules home',ownerName:'Morgan Example',ownerEmail:'morgan@stay.example',commissionBps:2000}),linked=await h.cmd('direct.configure',{...settings,propertyId:whole.id,slug:'linked-rules',minGapNights:0,preparationNights:2})
  const {a}=await rooms(h,whole);await sourceRoom(h,a,'2030-02-20','2030-02-23')
  for(const door of ['quote','checkout']){const refusal=await h.send('/book/linked-rules/'+door,{...signed,homeRevision:linked.revision,start:'2030-02-18',end:'2030-02-20',guests:2});assert.equal(refusal.status,409,refusal.text);assert.match(refusal.value.error,/preparation nights/)}
  const edge=await h.send('/book/linked-rules/quote',{start:'2030-02-16',end:'2030-02-18',guests:2});assert.equal(edge.status,200,edge.text)
  const managed=await harness({auth:{MAIL_PROVIDER:'rer'}})
  try{await home(managed);const no=await managed.send('/book/pine-ridge/checkout',{});assert.equal(no.status,409);assert.match(no.value.error,/not available yet/)}finally{await managed.close()}
 }finally{await h.close()}
})

test('WEB-004 risk policy assigns failed checks, offers consented manual review and fences access and erased links',async()=>{
 let redacted=false
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fixture'},outbound:async request=>{
  const path=new URL(request.url).pathname
  if(path==='/v1/identity/verification_sessions')return Response.json({id:'vs_review',status:'requires_input',url:'https://verify.stripe.com/start/review'})
  if(path==='/v1/identity/verification_sessions/vs_review/redact'){redacted=true;return Response.json({id:'vs_review',redaction:{status:'redacted'}})}
  if(path==='/v1/identity/verification_sessions/vs_review')return Response.json({id:'vs_review',status:'requires_input',last_error:{code:'document_unverified_other'}})
  assert.fail('Unexpected provider request '+path)
 }})
 try{
  const manager=await h.person('Reviewer','manager'),other=await h.person('Other','manager'),cleaner=await h.person('Cleaner')
  let homeConfig=await home(h)
  const policy={identityMode:'risk',identityLeadDays:0,identityMinGuests:3,identityMinTotalDollars:0,identityReviewerId:manager.id,identityBlockAccess:true,identityBeforeConfirmation:false,identityRetentionDays:1}
  homeConfig=await h.cmd('direct.configure',{...settings,...policy,propertyId:homeConfig.propertyId,revision:homeConfig.revision})
  const request=await h.cmd('reservation.request',{propertyId:homeConfig.propertyId,channel:'airbnb',guestName:'Alex Example',guestEmail:'alex@stay.example',start:day(3),end:day(6)})
  let s=await h.accessState(),v=s.verifications.find(v=>v.bookingId===request.bookingId)
  assert.ok(v.reasons.some(reason=>reason.includes('unavailable')),'missing channel party size requires review, rather than pretending a low risk')
  assert.equal(v.policy.reviewerId,manager.id)
  assert.equal(s.codes.filter(c=>c.bookingId===request.bookingId&&c.holder==='guest'&&c.status==='issued').length,0)
  const raw=JSON.parse((await h.db.prepare('SELECT data FROM cb_verifications WHERE id=?').bind(v.id).first()).data),link='/book/verification/'+raw.token
  const post=async(action,body)=>h.mf.dispatchFetch(h.origin+link+'/'+action,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'})
  assert.equal((await post('stripe',{})).status,400)
  assert.equal((await post('stripe',{consent:'yes'})).status,303)
  assert.equal((await post('refresh',{})).status,200)
  s=await h.accessState();v=s.verifications.find(row=>row.id===v.id);assert.equal(v.status,'requires_input')
  assert.equal((await post('manual',{consent:'yes'})).status,200)
  s=await h.accessState();v=s.verifications.find(row=>row.id===v.id)
  const decision={id:v.id,revision:v.revision,outcome:'approved',method:'In-person check by assigned manager',reference:'Front desk appointment',reason:'Guest matched the reservation identity during the agreed manual review.'}
  await h.cmd('direct.verification.decide',decision,other.cookie,403)
  const limited=(await h.accessState(other.cookie)).verifications.find(row=>row.id===v.id)
  assert.equal(limited.provider,undefined);assert.equal(limited.decision,undefined);assert.equal(limited.token,undefined)
  assert.equal((await h.accessState(cleaner.cookie)).verifications?.length??0,0)
  await h.cmd('direct.configure',{...settings,...policy,identityMode:'none',propertyId:homeConfig.propertyId,revision:homeConfig.revision})
  assert.equal((await h.accessState()).verifications.find(row=>row.id===v.id).policy.mode,'risk','an existing reservation keeps its policy snapshot')
  await h.cmd('direct.verification.decide',decision,manager.cookie)
  await h.cmd('direct.verification.decide',decision,manager.cookie,409)
  s=await h.accessState();assert.equal(s.verifications.find(row=>row.id===v.id).status,'approved')
  assert.ok(s.codes.some(c=>c.bookingId===request.bookingId&&c.holder==='guest'&&c.status==='issued'))
  const booking=s.bookings.find(b=>b.id===request.bookingId)
  await erase(h,{entity:'guest',id:booking.id,revision:booking.revision})
  assert.equal((await h.send(link)).status,404)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  const erased=JSON.parse((await h.db.prepare('SELECT data FROM cb_verifications WHERE id=?').bind(v.id).first()).data)
  assert.equal(erased.status,'erased');assert.equal(erased.provider,undefined);assert.equal(erased.decision,undefined);assert.ok(redacted)
 }finally{await h.close()}
})

test('PAY-003 settles approved claims, rent refunds, saved cancellations and changes once with receipts and balanced tax and owner books',async()=>{
 const sessions=new Map(),payments=new Map(),refunds=new Map(),writes={capture:0,release:0,refund:0},captureKeys=[];let lostRefund=false,declineCapture=true
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fake'},outbound:async request=>{
  const u=new URL(request.url),p=u.pathname,f=new URLSearchParams(request.method==='POST'?await request.text():'')
  assert.equal(u.hostname,'api.stripe.com')
  if(p==='/v1/checkout/sessions'&&request.method==='POST'){
   const id='cs_'+sessions.size,stayId=f.get('metadata[stayId]');let amount=0
   for(const [k,v] of f)if(k.endsWith('[unit_amount]'))amount+=Number(v)
   const pi={id:'pi_rent_'+sessions.size,status:'succeeded',amount_received:amount,amount,currency:'usd',payment_method:'pm_test'},s={id,url:'https://checkout.stripe.com/'+id,metadata:{stayId},customer:'cus_test',status:'complete',payment_status:'paid',payment_intent:pi};sessions.set(id,s);payments.set(pi.id,pi);return Response.json(s)
  }
  if(p.startsWith('/v1/checkout/sessions/'))return Response.json(sessions.get(p.split('/').at(-1)))
  if(p==='/v1/payment_intents'&&request.method==='POST'){
   const id='pi_damage_'+payments.size,payment={id,status:'requires_capture',amount:Number(f.get('amount')),amount_received:0,amount_capturable:Number(f.get('amount')),currency:'usd',latest_charge:{payment_method_details:{card:{capture_before:Math.floor(Date.now()/1000)+2*86400}}}};payments.set(id,payment);return Response.json(payment)
  }
  if(p.startsWith('/v1/payment_intents/')){
   const [,id,action]=p.match(/\/payment_intents\/([^/]+)(?:\/(.*))?/),payment=payments.get(id);assert.ok(payment,p)
   if(action==='capture'){captureKeys.push(request.headers.get('idempotency-key'));assert.equal(f.has('final_capture'),false);if(captureKeys.length>1&&captureKeys[0]===captureKeys.at(-1))return Response.json({error:{type:'idempotency_error'}},{status:400});if(declineCapture){declineCapture=false;return Response.json({error:{type:'invalid_request_error'}},{status:400})}writes.capture++;payment.status='succeeded';payment.amount_received=Number(f.get('amount_to_capture'));payment.amount_capturable=0}
   if(action==='cancel'){writes.release++;payment.status='canceled'}
   return Response.json(payment)
  }
  if(p==='/v1/refunds'&&request.method==='GET')return Response.json({data:[...refunds.values()].filter(r=>r.payment_intent===u.searchParams.get('payment_intent')),has_more:false})
  if(p.startsWith('/v1/refunds/'))return Response.json(refunds.get(p.split('/').at(-1)))
  if(p==='/v1/refunds'&&request.method==='POST'){
   writes.refund++;const r={id:'re_'+writes.refund,payment_intent:f.get('payment_intent'),amount:Number(f.get('amount')),currency:'usd',status:'succeeded',metadata:{stayId:f.get('metadata[stayId]'),cabinRefundId:f.get('metadata[cabinRefundId]')}};refunds.set(r.id,r)
   if(lostRefund){lostRefund=false;return new Response('lost response',{status:502})}return Response.json(r)
  }
  assert.fail('Unexpected provider call '+p)
 }})
 try{
  let cfg=await home(h);cfg=await h.cmd('direct.configure',{...settings,requireIdentity:false,retainedBps:2500,policyName:'Retain 25% of the saved booking total on cancellation',propertyId:cfg.propertyId,revision:cfg.revision})
  await h.cmd('ledger.configure',{propertyId:cfg.propertyId,legalEntity:'Owner trust'})
  const cleaner=await h.person('RefundCleaner')
  const book=async(n,end=n+3)=>{
   const result=await h.send('/book/pine-ridge/checkout',{start:day(n),end:day(end),guests:2,homeRevision:cfg.revision,guestName:'Refund Guest',email:'refund@stay.example',signature:'Refund Guest',consent:'yes'});assert.equal(result.status,200,result.text)
   assert.equal((await h.send(`/book/stay/${result.value.token}/refresh`,{})).value.stay.phase,'confirmed');return result.value
  }
  const first=await book(0),get=async id=>(await h.accessState()).direct.stays.find(s=>s.id===id)
  const prepare=async(id,kind,amountCents)=>h.cmd('direct.refund.prepare',{id,kind,...(amountCents?{amountCents}:{}),reason:'Guest-approved settlement',evidence:'Retained guest request and incident evidence'})
  const approve=async(id,r,status=200)=>h.cmd('direct.refund.approve',{id,refundId:r.id,revision:r.revision,confirm:'yes'},h.owner,status)
  const totals=async id=>{const s=await get(id),journals=(await h.state()).ledger.journals.filter(j=>j.bookingId===s.bookingId);for(const j of journals)assert.equal(j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0),0);const balance=key=>journals.flatMap(j=>j.lines).filter(l=>l.account===key).reduce((n,l)=>n+l.creditCents-l.debitCents,0);return {owner:balance('ownerLiability'),tax:balance('taxes'),hold:balance('damageHolds')}}
  assert.match((await get(first.id)).error,/expires before/,'a provider expiry two days away is flagged immediately on refresh')
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  assert.match((await get(first.id)).error,/expires before/,'long authorization is flagged to a person before expiry')
  await h.db.prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.arrivalAt',?) WHERE id=?").bind(new Date(Date.now()-3600000).toISOString(),first.id).run()
  await h.cmd('direct.checkout.complete',{id:first.id})
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:5000,reason:'Broken lamp',evidence:'photo:lamp'},cleaner.cookie,403)
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:5000,reason:'Broken lamp',evidence:''},h.owner,400)
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:5000,reason:'Broken lamp',evidence:'photo:lamp'},h.owner,400)
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:5000,reason:'Broken lamp',evidence:'photo:lamp'})
  assert.equal(captureKeys.length,1,'uncertain capture never automatically resubmits')
  let pending=await get(first.id),review={id:first.id,revision:pending.revision,confirm:'yes',reference:'Stripe request log: rejected validation; full hold remains'}
  await h.cmd('direct.deposit.reconcile',review,cleaner.cookie,403)
  await h.cmd('direct.deposit.reconcile',{...review,confirm:'no'},h.owner,400)
  await h.cmd('direct.deposit.reconcile',{...review,revision:'stale'},h.owner,409)
  const held=payments.get(pending.deposit.id);held.amount_capturable-=1
  await h.cmd('direct.deposit.reconcile',review,h.owner,409);held.amount_capturable+=1
  await h.cmd('direct.deposit.reconcile',review)
  pending=await get(first.id);assert.equal(pending.deposit.reviewRequired,true);assert.equal(pending.depositReconciliations[0].prior.claimCents,5000);assert.ok(pending.depositReconciliations[0].prior.approvedBy)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(captureKeys.length,1)
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:4000,reason:'Broken lamp',evidence:'photo:lamp'},h.owner,409)
  await h.cmd('direct.deposit.capture',{id:first.id,amountCents:5000,reason:'Broken lamp',evidence:'photo:lamp'})
  assert.equal(writes.capture,1);assert.equal(captureKeys.length,2);assert.notEqual(captureKeys[0],captureKeys[1]);assert.equal((await get(first.id)).deposit.capturedCents,5000);assert.equal((await totals(first.id)).hold,0)
  const draft=await prepare(first.id,'rent',10000);assert.equal(draft.amounts.totalCents,11000)
  await approve(first.id,{...draft,revision:'stale'},409)
  await h.cmd('direct.refund.approve',{id:first.id,refundId:draft.id,revision:draft.revision,confirm:'yes'},cleaner.cookie,403)
  lostRefund=true;await approve(first.id,draft,502);assert.equal((await get(first.id)).refunds[0].status,'uncertain')
  await h.cmd('direct.refund.prepare',{id:first.id,kind:'full',reason:'Second request',evidence:'Guest request'},h.owner,409)
  await h.restart();await approve(first.id,draft);await approve(first.id,draft);assert.equal(writes.refund,1)
  assert.deepEqual(await totals(first.id),{owner:56500,tax:5150,hold:0})
  let state=await h.accessState(),firstStay=await get(first.id),booking=state.bookings.find(b=>b.id===firstStay.bookingId)
  assert.equal(booking.reservationBalance.balanceCents,0)
  const receipt=state.messages.find(m=>m.id===firstStay.refunds[0].messageId);assert.equal(receipt.status,'sent');assert.match(receipt.text,/USD 110.00/)
  assert.equal(state.messages.filter(m=>m.subject==='Your refund receipt').length,1)
  assert.match((await h.send('/book/stay/'+first.token)).text,/Stripe confirmed your refund/)
  // Map the original levies after the refund: importing the source must not double liabilities.
  await h.cmd('tax.profile.save',{propertyId:cfg.propertyId,country:'US',state:'Maine',county:'Example County',city:'Unincorporated'})
  for(const [level,bps] of [['state',900],['county',100],['city',0]]){
   const j=await h.cmd('tax.jurisdiction.save',{propertyId:cfg.propertyId,level,registrationStatus:bps?'active':'not-required',registrationReference:'Tax registration',partner:'Accountant',recipient:'accountant@stay.example',source:'Reviewed registration'})
   await h.cmd('tax.rule.save',{jurisdictionId:j.id,taxType:'lodging',bps,from:day(-1),until:day(365),source:'Reviewed effective tax law'})
  }
  await h.cmd('tax.source.direct',{stayId:first.id,confirm:'yes'})
  assert.deepEqual(await totals(first.id),{owner:56500,tax:5150,hold:0})
  state=await h.state();assert.equal(state.taxes.lines.filter(l=>l.bookingId===booking.id).reduce((n,l)=>n+l.hostCents,0),5150)
  const full=await prepare(first.id,'full');await approve(first.id,full);await approve(first.id,full)
  assert.deepEqual(await totals(first.id),{owner:5000,tax:0,hold:0})
  const damageRefund=await prepare(first.id,'deposit',5000);await approve(first.id,damageRefund)
  assert.deepEqual(await totals(first.id),{owner:0,tax:0,hold:0})
  const cancelled=await book(10),cancelledStay=await get(cancelled.id)
  await h.db.prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.depositDueAt',?) WHERE id=?").bind(new Date(Date.now()-3600000).toISOString(),cancelled.id).run()
  await h.cmd('direct.refresh',{id:cancelled.id});booking=(await h.state()).bookings.find(b=>b.id===cancelledStay.bookingId)
  await h.cmd('reservation.end',{id:booking.id,revision:booking.revision,outcome:'cancelled',reason:'Guest cancellation request'})
  const cancelPlan=await prepare(cancelled.id,'settlement');assert.equal(cancelPlan.amounts.totalCents,50737)
  await approve(cancelled.id,cancelPlan);await approve(cancelled.id,cancelPlan)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await get(cancelled.id)).deposit.status,'canceled')
  assert.deepEqual(await totals(cancelled.id),{owner:16913,tax:0,hold:0})
  assert.equal((await h.send('/book/stay/'+cancelled.token+'/deposit',{})).status,409)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal((await get(cancelled.id)).error,undefined)
  assert.match((await h.send('/book/stay/'+cancelled.token)).text,/Stripe confirmed your refund/)
  const changed=await book(20),changedStay=await get(changed.id);booking=(await h.state()).bookings.find(b=>b.id===changedStay.bookingId)
  await h.cmd('reservation.amend',{id:booking.id,revision:booking.revision,start:day(20),end:day(22),propertyId:cfg.propertyId,guestName:'Refund Guest',guestEmail:'refund@stay.example',rentCents:36000,feesCents:7500,taxCents:4350,reason:'Guest accepted shortening to two nights'})
  const changePlan=await prepare(changed.id,'settlement');assert.equal(changePlan.amounts.totalCents,19800);await approve(changed.id,changePlan)
  assert.deepEqual(await totals(changed.id),{owner:43500,tax:4350,hold:0})
  assert.equal((await h.state()).bookings.find(b=>b.id===booking.id).reservationBalance.balanceCents,0)
  // A third active authorization, no claim: the existing cron performs automatic release once.
  const unclaimed=await book(30)
  await h.db.prepare("UPDATE cb_direct_stays SET data=json_set(data,'$.depositDueAt',?,'$.arrivalAt',?) WHERE id=?").bind(new Date(Date.now()-3600000).toISOString(),new Date(Date.now()-3600000).toISOString(),unclaimed.id).run()
  await h.cmd('direct.refresh',{id:unclaimed.id});await h.cmd('direct.checkout.complete',{id:unclaimed.id})
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  assert.equal((await get(unclaimed.id)).deposit.status,'canceled');assert.equal(writes.release,2)
  assert.equal((await h.send('/app/direct',undefined,h.owner)).status,200)
 }finally{await h.close()}
})


test('scheduled collections require current reservation terms, guest consent and Stripe configuration before any external effect',async()=>{
 const {collectionHome,collectionBooking,createCollection,collectionState,guestCollection,day}=await import('./collection-support.mjs')
 let outbound=0;const h=await harness({outbound:async()=>{outbound++;throw new Error('No provider effect is authorized')}})
 try{
  const p=await collectionHome(h),b=await collectionBooking(h,p),schedule=await createCollection(h,b)
  assert.equal(schedule.status,'consent_required');assert.deepEqual(schedule.jobs.map(j=>j.amountCents),[3000,2000,8000]);assert.equal(schedule.policy,b.lifecycle.policy.name)
  await createCollection(h,b).then(()=>assert.fail('duplicate schedule'),error=>assert.match(error.message,/already has/))
  const g=await guestCollection(h,b);assert.equal((await h.send(g.path,undefined,'',{accept:'application/json'})).status,401)
  assert.equal((await h.send(g.path,{action:'consent',signature:'x'.repeat(9000)},g.cookie)).status,413)
  const privateView=(await h.send(g.path,undefined,g.cookie,{accept:'application/json'})).value;assert.equal(privateView.authority,undefined);assert.equal(privateView.assigneeId,undefined);assert.equal(privateView.history,undefined);assert.equal(privateView.consent,undefined)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(outbound,0)
  assert.equal((await h.send(g.path,{action:'consent',revision:schedule.revision,signature:b.guestName,consent:'yes'},g.cookie)).status,503)
  assert.equal(outbound,0,'missing configuration fails before egress')
  const current=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.amend',{id:b.id,revision:current.revision,propertyId:p.id,start:day(20),end:day(22),guestName:b.guestName,guestEmail:b.guestEmail,reason:'Guest reviewed new dates'})
  const changed=await collectionState(h,schedule.id);assert.equal(changed.status,'consent_required');assert.notEqual(changed.jobs[2].dueAt,schedule.jobs[2].dueAt)
  await h.cmd('direct.collection.revise',{id:changed.id,revision:changed.revision,depositCents:5000,installmentCents:1000,installmentDays:10,balanceDays:3,confirm:'yes'})
  const revised=await collectionState(h,schedule.id);assert.equal(revised.jobs.filter(j=>j.status==='scheduled').reduce((n,j)=>n+j.amountCents,0),13000);assert.ok(revised.history.some(v=>v.detail.includes('remaining balance')))
  await h.cmd('direct.collection.retry',{id:changed.id,jobId:changed.jobs[0].id,revision:changed.revision,reference:'synthetic-cabin-1',confirm:'yes'},h.owner,409)
  const cleaner=await h.person('CollectionCleaner');assert.equal((await h.state(cleaner.cookie)).direct.collections,undefined)
  await h.cmd('direct.collection.create',{bookingId:b.id,depositCents:1,assigneeId:cleaner.id},cleaner.cookie,403)
  const owner=(await h.state()).actor.id,b2=await collectionBooking(h,p,30)
  await h.cmd('direct.collection.create',{bookingId:b2.id,depositCents:13001,assigneeId:owner},h.owner,400)
  await h.cmd('direct.collection.create',{bookingId:b2.id,depositCents:3000,mode:'live',assigneeId:owner},h.owner,400)
  const booking=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.end',{id:b.id,revision:booking.revision,outcome:'cancelled',reason:'Guest cancelled'})
  await h.restart();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(outbound,0)
  assert.ok((await collectionState(h,schedule.id)).jobs.every(j=>j.status==='suppressed'))
 }finally{await h.close()}
})


test('scheduled collection reconciles provider interruptions, failed follow-up, revised mandates and revoked authority without duplicate charges',{timeout:120000},async()=>{
 const {collectionProviderJourney}=await import('./collection-support.mjs');await collectionProviderJourney()
})


test('source-backed cash and cleared-check receipts post once, retain evidence and reduce only the correct outstanding balance',async()=>{
 const {collectionHome,collectionBooking,day}=await import('./collection-support.mjs'),h=await harness({outbound:async()=>assert.fail('Manual receipts have no processor effect')})
 try{
  const home=await collectionHome(h);await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic trust entity'})
  const b=await collectionBooking(h,home),source=async(method,amountCents)=>({bookingId:b.id,revision:(await h.state()).bookings.find(v=>v.id===b.id).revision,method,amountCents,reference:'synthetic-cabin-'+method,receivedAt:day(0),note:'Verified custody and original source evidence',confirm:'yes'})
  const cash=await source('cash',3000);await h.cmd('direct.manual.receive',{...cash,confirm:'no'},h.owner,400)
  const first=await h.cmd('direct.manual.receive',{...cash,amountCents:undefined,amountDollars:'30.00'});assert.equal((await h.cmd('direct.manual.receive',cash)).id,first.id)
  await h.cmd('direct.manual.receive',{...cash,amountCents:3001},h.owner,409)
  const check=await source('check',2000),second=await h.cmd('direct.manual.receive',check)
  assert.equal(second.manualReceipt.method,'check');assert.equal(second.manualReceipt.reference,check.reference)
  const balance=(await h.state()).bookings.find(v=>v.id===b.id).reservationBalance;assert.equal(balance.paidCents,5000);assert.equal(balance.balanceCents,8000)
  const cleaner=await h.person('ManualReceiptCleaner');await h.cmd('direct.manual.receive',await source('cash',1000),cleaner.cookie,403)
  await h.cmd('direct.manual.receive',{...await source('cash',9000),reference:'synthetic-cabin-overpayment'},h.owner,409)
  await h.cmd('direct.manual.receive',{...await source('cash',1000),reference:'synthetic-cabin-future',receivedAt:day(2)},h.owner,400)
  await h.restart();const state=await h.state(),receipts=state.ledger.journals.filter(j=>j.manualReceipt);assert.equal(receipts.length,2);assert.equal(state.bookings.find(v=>v.id===b.id).reservationBalance.paidCents,5000)
  assert.ok(receipts.every(j=>j.sourceType==='payment'&&j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0)===0));assert.ok(receipts.every(j=>j.manualReceipt.note===check.note))
 }finally{await h.close()}
})


test('scoped financial roles can use their own payment doors and cannot read or mutate another property schedule or manual receipt',async()=>{
 const {collectionScopedJourney}=await import('./collection-support.mjs');await collectionScopedJourney()
})
