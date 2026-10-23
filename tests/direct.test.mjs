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

test('direct booking refuses minimum nights, orphan gaps, changed terms and cross-origin checkout with the reason',async()=>{
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fake'},outbound:()=>assert.fail('An invalid booking must not call Stripe')})
 try{
  const cfg=await home(h)
  const short=await h.send('/book/pine-ridge/quote',{start:day(20),end:day(21),guests:2});assert.equal(short.status,400);assert.match(short.value.error,/at least 2 nights/)
  await h.cmd('reservation.request',{propertyId:cfg.propertyId,channel:'airbnb',start:day(20),end:day(23),guestName:'Calendar guest'})
  const gap=await h.send('/book/pine-ridge/quote',{start:day(24),end:day(27),guests:2});assert.equal(gap.status,400);assert.match(gap.value.error,/gap shorter than 2/)
  const stale=await h.send('/book/pine-ridge/checkout',{start:day(30),end:day(33),guests:2,homeRevision:'outdated'});assert.equal(stale.status,409);assert.match(stale.value.error,/terms changed/)
  const csrf=await h.send('/book/pine-ridge/checkout',{},'',{origin:'https://elsewhere.example'});assert.equal(csrf.status,403)
  assert.equal((await h.accessState()).direct.stays.length,0)
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

test('PAY-003 settles approved claims, rent refunds, saved cancellations and changes once with receipts and balanced tax/owner books',async()=>{
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

test('only the installation owner can replace the Stripe key or switch the payment mode',async()=>{
 const key=(mode,n)=>['sk',mode,`synthetic-cabin-${n}`.replaceAll('-','')].join('_'),used=[]
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:key('test',1),STRIPE_SECRET_KEY:key('live',2)},outbound:async request=>{
  const u=new URL(request.url);assert.equal(u.hostname,'api.stripe.com');used.push(request.headers.get('authorization'))
  if(u.pathname==='/v1/balance')return Response.json({object:'balance',available:[],pending:[]})
  assert.fail('Unexpected provider call '+u.pathname)
 }})
 try{
  const manager=await h.person('Morgan','manager')
  await h.cmd('direct.stripe.save',{mode:'test',key:key('test',3)},manager.cookie,403)
  await h.cmd('direct.stripe.save',{mode:'live',key:key('live',4),liveConsent:'yes'},manager.cookie,403)
  await h.cmd('direct.stripe.mode',{mode:'live',liveConsent:'yes'},manager.cookie,403)
  assert.deepEqual(used,[],'a refused change never reaches Stripe')
  assert.equal(await h.db.prepare('SELECT data FROM cb_direct_provider WHERE id=1').first(),null)
  await h.cmd('direct.stripe.save',{mode:'test',key:key('test',5)})
  assert.deepEqual(used,['Bearer '+key('test',5)])
  assert.equal((await h.state()).direct.provider.source,'page')
 }finally{await h.close()}
})

test('identity-check links stay out of ordinary staff responses and AI reply history',async()=>{
 const prompts=[]
 const h=await harness({outbound:async request=>{
  assert.equal(new URL(request.url).hostname,'api.anthropic.com');prompts.push(await request.text())
  return Response.json({content:[{type:'text',text:JSON.stringify({reply:'The host will confirm this.',grounds:[],needs_host:true,note:'Synthetic',confidence:0,topic:'other',instruction_id:null})}]})
 }})
 try{
  const manager=await h.person('Morgan','manager'),cfg=await home(h)
  await h.cmd('direct.configure',{...settings,identityMode:'all',identityReviewerId:(await h.state()).actor.id,identityBlockAccess:true,propertyId:cfg.propertyId,revision:cfg.revision})
  const staff=await h.cmd('member.save',{name:'Synthetic inbox staff',email:'synthetic-inbox@stay.example',pmsRole:'guest_service',propertyIds:[cfg.propertyId],actions:['inbox:read'],active:true});await h.cmd('member.invite',{id:staff.id});const inbox=await h.signIn('synthetic-inbox@stay.example')
  await h.cmd('reservation.request',{propertyId:cfg.propertyId,channel:'direct',guestName:'Alex Example',guestEmail:'alex@stay.example',start:day(3),end:day(6)})
  const mail=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox').all()).results.map(r=>JSON.parse(r.message)).find(m=>m.subject==='Complete your identity check')
  const link=mail?.text.match(/\/book\/verification\/[\w-]+/)?.[0];assert.ok(link,'the guest receives the identity-check link by email')
  for(const cookie of [h.owner,manager.cookie,inbox]){const s=await h.state(cookie);assert.ok(s.messages.some(m=>m.subject==='Complete your identity check'));assert.ok(!JSON.stringify(s).includes(link))}
  await h.cmd('inbox.address',{address:'guests@cabin.example',revision:''})
  await h.cmd('inbox.ai.save',{revision:(await h.accessState()).inbox.find(r=>r.id==='inbox').revision,key:'synthetic-cabin-1'})
  await h.cmd('provider.sharing',{id:'anthropic',operation:'grant',securityRevision:'',actions:['reply:draft'],propertyIds:[cfg.propertyId],confirm:'yes'})
  await h.cmd('inbox.try',{source:['From: alex@stay.example','To: guests@cabin.example','Subject: Identity check','Message-ID: <synthetic-cabin-2@stay.example>','MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','','Do I need to finish the identity check before arrival?'].join('\r\n')})
  assert.equal(prompts.length,1);assert.match(prompts[0],/requires an identity check/);assert.ok(!prompts[0].includes(link))
 }finally{await h.close()}
})

test('unpaid checkout holds are limited for each visitor and across the installation',async()=>{
 let sessions=0
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:['sk','test','synthetic-cabin-1'.replaceAll('-','')].join('_')},outbound:async request=>{
  const u=new URL(request.url);assert.equal(u.hostname,'api.stripe.com');assert.equal(u.pathname,'/v1/checkout/sessions')
  sessions++;return Response.json({id:'cs_test_hold_'+sessions,url:'https://checkout.stripe.com/c/pay/cs_test_hold_'+sessions})
 }})
 try{
  const cfg=await home(h)
  const hold=(n,visitor)=>h.send('/book/pine-ridge/checkout',{start:day(n),end:day(n+3),guests:2,homeRevision:cfg.revision,guestName:`Synthetic Guest ${n}`,email:`guest-${n}@synthetic.example`,signature:`Synthetic Guest ${n}`,consent:'yes',identityConsent:'yes'},'',{'cf-connecting-ip':visitor})
  for(const n of [10,20])assert.equal((await hold(n,'203.0.113.7')).status,200)
  const refused=await hold(30,'203.0.113.7');assert.equal(refused.status,429,refused.text)
  assert.equal((await h.send('/book/pine-ridge/quote',{start:day(30),end:day(33),guests:2})).status,200,'a refused checkout holds no nights')
  assert.equal((await hold(40,'198.51.100.4')).status,200,'another visitor can still check out')
  assert.equal((await hold(50,'192.0.2.9')).status,429,'unpaid holds across the installation stay bounded')
  assert.equal(sessions,3)
 }finally{await h.close()}
})
