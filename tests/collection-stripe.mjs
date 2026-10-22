import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { harness } from './harness.mjs'
import { collectionHome,collectionBooking,createCollection,guestCollection,collectionState,day } from './collection-support.mjs'

// Held-key sandbox journey, outside push Verify. Card entry stays on Stripe's hosted page.
// Stripe documents 0341 as attachable but declined on collection: https://docs.stripe.com/testing
assert.ok(process.env.STRIPE_TEST_SECRET_KEY?.startsWith('sk_test_'),'A held Stripe test key is required')
const payments=[],requests=[];let loseAccepted=true,step='start',browser,h
try{
 h=await harness({assets:true,auth:{STRIPE_TEST_SECRET_KEY:process.env.STRIPE_TEST_SECRET_KEY},outbound:async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://api.stripe.com')
  // Forward application headers, excluding workerd's transfer-encoding transport header.
  const headers=Object.fromEntries(['authorization','stripe-version','content-type','accept','idempotency-key'].map(k=>[k,request.headers.get(k)]).filter(([,v])=>v))
  const response=await fetch(url,{method:request.method,headers,body:request.method==='POST'?await request.text():undefined})
  if(url.pathname==='/v1/payment_intents'&&request.method==='POST'){
   const payload=await response.clone().json(),p=payload.error?.payment_intent??payload
   assert.equal(p.livemode,false);assert.ok(p.id&&p.metadata?.collectionAttemptId)
   assert.ok(!payments.some(v=>v.attempt===p.metadata.collectionAttemptId),'a started attempt is never posted twice')
   payments.push({id:p.id,status:p.status,amount:p.amount,received:p.amount_received,attempt:p.metadata.collectionAttemptId,request:response.headers.get('request-id')})
   requests.push(request.headers.get('idempotency-key'))
   if(loseAccepted&&p.status==='succeeded'){loseAccepted=false;return new Response('Accepted response interrupted at the network edge',{status:502})}
  }
  return response
 }})
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const tick=async()=>{await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})}
 const current=async id=>(await h.state()).bookings.find(b=>b.id===id)
 const edit=async(id,changes)=>{const b=await current(id);return h.cmd('reservation.amend',{id,revision:b.revision,propertyId:b.propertyId,start:b.start,end:b.end,guestName:b.guestName,guestEmail:b.guestEmail,reason:'Synthetic sandbox guest reviewed changed terms',...changes})}
 const due=async(id,index,field='dueAt')=>{const row=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(id).first()).data);row.jobs[index][field]=new Date(Date.now()-1000).toISOString();await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(row),id).run()}
 const authorize=async(b,g,p,card)=>{
  step='verified guest consent'
  const start=await h.send(g.path,{action:'consent',revision:p.revision,signature:b.guestName,consent:'yes'},g.cookie);assert.equal(start.status,303)
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  try{
   for(const part of g.cookie.split('; ')){const i=part.indexOf('=');await context.addCookies([{name:part.slice(0,i),value:part.slice(i+1),url:h.origin}])}
   const page=await context.newPage();page.setDefaultTimeout(60000);step='Stripe hosted card setup'
   await page.goto(start.headers.get('location'));await page.getByLabel('Card number',{exact:true}).fill(card)
   step='Stripe expiry';await page.getByLabel('Expiration',{exact:true}).fill('1230');step='Stripe CVC';await page.getByRole('textbox',{name:'Credit or debit card CVC/CVV',exact:true}).fill('123')
   step='Stripe billing name';await page.locator('#billingName').fill(b.guestName);step='Stripe billing country';await page.locator('#billingCountry').selectOption('AU');step='Stripe Link choice';await page.locator('#enableStripePass').uncheck()
   step='Stripe save';await page.locator('button[type="submit"]').click();step='Stripe return';await page.waitForURL(url=>url.origin===h.origin,{timeout:120000})
  }finally{await context.close()}
  step='read back Stripe setup and collect';assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303)
 }
 step='prepare deposit, installment and pre-arrival balance'
 const home=await collectionHome(h);await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic sandbox owner trust'})
 const b=await collectionBooking(h,home),p=await createCollection(h,b),g=await guestCollection(h,b)
 await authorize(b,g,p,'4242424242424242');assert.equal(payments.length,1);assert.equal((await collectionState(h,p.id)).jobs[0].status,'uncertain')
 step='reconcile an accepted charge after restart';await h.restart();await tick();assert.equal(payments.length,1);assert.equal((await collectionState(h,p.id)).jobs[0].status,'succeeded')
 for(const index of [1,2]){step='advance and collect the saved schedule';await due(p.id,index);await tick();assert.equal((await collectionState(h,p.id)).jobs[index].status,'succeeded')}
 assert.equal((await current(b.id)).reservationBalance.paidCents,13000);assert.equal((await h.state()).messages.filter(m=>m.subject==='Your payment receipt'&&m.bookingId===b.id).length,3)
 step='prepare a declined saved-card collection'
 const b2=await collectionBooking(h,home,30),p2=await createCollection(h,b2),g2=await guestCollection(h,b2)
 await authorize(b2,g2,p2,'4000000000000341');await tick();let state=await collectionState(h,p2.id);assert.equal(state.jobs[0].status,'failed');assert.equal(payments.length,4)
 const failed=structuredClone(state.jobs[0].attempts)
 step='continue overdue follow-up under invalid consent'
 await edit(b2.id,{policyName:'Revised sandbox cancellation policy',retainedBps:1000,noShowBps:1000});await due(p2.id,0,'deadline');await tick()
 state=await collectionState(h,p2.id);assert.equal(state.status,'consent_required');assert.equal(payments.length,4);assert.deepEqual(state.jobs[0].attempts,failed)
 assert.ok((await h.state()).tasks.some(t=>t.id===state.jobs[0].followupTaskId&&t.status==='open'&&t.assigneeId===state.assigneeId))
 const mail=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox').all()).results.map(r=>JSON.parse(r.message));assert.ok(mail.some(m=>m.subject==='Overdue reservation payment follow-up'))
 await h.cmd('direct.collection.retry',{id:p2.id,revision:state.revision,jobId:state.jobs[0].id,confirm:'yes',reference:'Renewed consent is still required'},h.owner,409)
 step='resolve the reminder with a reviewed replacement card and renewed verified consent'
 await h.cmd('direct.collection.revise',{id:p2.id,revision:state.revision,depositCents:3000,installmentCents:0,balanceDays:3,confirm:'yes'})
 await authorize(await current(b2.id),g2,await collectionState(h,p2.id),'4242424242424242');state=await collectionState(h,p2.id)
 assert.equal(payments.length,5);assert.equal((await current(b2.id)).reservationBalance.paidCents,3000);assert.deepEqual(state.jobs[0].attempts,failed)
 step='change arrival, renew consent and cancel before the next charge'
 await edit(b2.id,{start:day(25),end:day(27)});await tick();assert.equal((await collectionState(h,p2.id)).status,'consent_required');assert.equal(payments.length,5)
 await authorize(await current(b2.id),g2,await collectionState(h,p2.id),'4242424242424242');assert.equal(payments.length,5)
 const last=await current(b2.id);await h.cmd('reservation.end',{id:b2.id,revision:last.revision,outcome:'cancelled',reason:'Synthetic sandbox guest cancelled before the balance'})
 await h.restart();await tick();assert.equal(payments.length,5);state=await collectionState(h,p2.id);assert.equal(state.status,'cancelled');assert.ok(state.jobs.filter(j=>j.status!=='succeeded').every(j=>j.status==='suppressed'))
 const encoded=JSON.stringify(await h.state());assert.ok(!encoded.includes('4242424242424242')&&!encoded.includes('4000000000000341'))
 console.log('Real Stripe sandbox collection PASS: exact deposit/installment/balance, lost-response restart readback, failed collection, assigned overdue task/message during invalid consent, replacement mandate, changed arrival, cancellation, receipts and no duplicate POST.')
 console.log('Stripe test payment acknowledgments '+JSON.stringify(payments));console.log('Distinct durable attempt keys '+new Set(requests).size)
}catch(error){console.error('Real Stripe collection failed at '+step+' ('+error.name+'). Private checkout and credentials withheld.');console.error(String(error.message).replaceAll(process.env.STRIPE_TEST_SECRET_KEY,'[credential]').replace(/https?:\/\/[^\s<>"']+/g,'[address]').replace(/[A-Za-z0-9_-]{24,}/g,'[opaque]'));process.exitCode=1}
finally{if(browser)await browser.close();if(h)await h.close()}
