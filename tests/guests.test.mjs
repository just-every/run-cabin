import {test} from 'node:test'
import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)
const guestFor=(state,bookingId)=>state.guests.find(g=>g.bookingId===bookingId)
async function profileCommand(h,name,bookingId,input){const g=guestFor(await h.state(),bookingId);return h.cmd(name,{id:g.id,revision:g.revision,...input})}
async function property(h,name='Pine Cabin'){return h.cmd('property.save',{name,ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000})}
async function priorStay(h,propertyId,channel='airbnb',start=-20,email='megan@stay.example'){
 return h.cmd('reservation.request',{propertyId,channel,start:day(start),end:day(start+3),guestName:'Megan Example',guestEmail:email,guestPhone:'+12025550123'})
}
async function setupOffer(h){
 const p=await property(h),home=await h.cmd('direct.configure',{propertyId:p.id,enabled:true,slug:'pine-cabin',description:'A quiet cabin.',nightlyCents:20000,cleaningCents:5000,extraGuestCents:1000,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:0,depositCents:0,releaseHours:24,taxLabel:'Lodging',taxBps:1000,countyTaxLabel:'',countyTaxBps:0,agreement:'Quiet hours after 10 pm.',requireIdentity:false})
 const prior=await priorStay(h,p.id)
 await h.cmd('guest.policy',{propertyId:p.id,allowPreferences:'yes',allowRepeatOffers:'yes'})
 let guest=guestFor(await h.state(),prior.bookingId),identity=guest.identities.find(i=>i.kind==='email')
 await h.cmd('guest.identity.verify',{id:guest.id,revision:guest.revision,identityId:identity.id,source:'Guest confirmed email ownership in person.',confirm:'yes'})
 await profileCommand(h,'guest.consent',prior.bookingId,{propertyId:p.id,purpose:'offers',allowed:'yes',source:'Guest requested future offers for Pine Cabin.'})
 const issue=()=>profileCommand(h,'guest.offer.issue',prior.bookingId,{propertyId:p.id,bookingId:prior.bookingId,expiresAt:day(10),confirm:'yes'})
 return {p,home,prior,issue}
}

test('GUEST-001: staff review identity matches, preserve provenance, restrict notes, opt out and undo a merge',async()=>{
 const h=await harness()
 try{
  const p=await property(h),a=await priorStay(h,p.id),b=await priorStay(h,p.id,'vrbo',-10)
  // Legacy installation fixture: reservations predate guest-profile records.
  await h.db.prepare("DELETE FROM cb_records WHERE kind='guests'").run()
  await h.db.prepare("UPDATE cb_records SET data=json_remove(data,'$.guestId') WHERE kind='bookings'").run()
  await h.cmd('guest.sync',{})
  let state=await h.state(),ga=guestFor(state,a.bookingId),gb=guestFor(state,b.bookingId)
  assert.notEqual(ga.id,gb.id);assert.equal(ga.mergedInto,undefined);assert.equal(gb.mergedInto,undefined)
  await h.cmd('guest.policy',{propertyId:p.id,allowPreferences:'yes'})
  await profileCommand(h,'guest.fact',a.bookingId,{propertyId:p.id,kind:'preference',value:'Feather-free pillows',source:'Guest asked during their Airbnb stay.'})
  await profileCommand(h,'guest.fact',a.bookingId,{propertyId:p.id,kind:'note',value:'Sensitive owner-only service detail',source:'Private owner conversation.'})
  await profileCommand(h,'guest.consent',a.bookingId,{propertyId:p.id,purpose:'preferences',allowed:'yes',source:'Guest asked us to remember pillows.'})
  await profileCommand(h,'guest.consent',b.bookingId,{propertyId:p.id,purpose:'preferences',allowed:'no',source:'Guest declined storing preferences on Vrbo.'})
  state=await h.state();ga=guestFor(state,a.bookingId);gb=guestFor(state,b.bookingId)
  const merged=await h.cmd('guest.merge',{id:ga.id,revision:ga.revision,intoId:gb.id,intoRevision:gb.revision,reason:'Guest confirmed both reservation references in person.',confirm:'yes'})
  state=await h.state();assert.equal(guestFor(state,a.bookingId).mergedInto,gb.id)
  const page=await h.send('/app/guests',undefined,h.owner);assert.equal(page.status,200);assert.match(page.text,/Guest asked during their Airbnb stay/);assert.doesNotMatch(page.text,/Permitted preferences at Pine Cabin/)
  const manager=await h.person('Robin','manager'),limited=await h.state(manager.cookie)
  assert.ok(limited.guests.length);assert.ok(limited.guests.every(g=>g.facts.every(f=>f.kind!=='note')))
  const cleaner=await h.person('Sam','cleaner');assert.deepEqual((await h.state(cleaner.cookie)).guests,[])
  const merge=state.guestMerges.find(m=>m.id===merged.id)
  await h.cmd('guest.merge.undo',{id:merge.id,revision:merge.revision,confirm:'yes'})
  state=await h.state();assert.equal(guestFor(state,a.bookingId).mergedInto,undefined);assert.equal(guestFor(state,a.bookingId).facts.find(f=>f.kind==='preference').value,'Feather-free pillows');assert.equal(guestFor(state,b.bookingId).consents.at(-1).allowed,false)
  await h.cmd('privacy.erase',{entity:'property',id:p.id,revision:p.revision})
  assert.ok((await h.state()).guests.every(g=>g.erasedAt&&g.identities.length===0&&g.facts.length===0&&g.consents.length===0),'property erasure clears its guest origins and private context')
 }finally{await h.close()}
})

test('a private returning rate is revalidated once and reaches Stripe, the agreement and receipt at its discounted amount',async()=>{
 let session,lines=[],paid=false
 const h=await harness({auth:{STRIPE_TEST_SECRET_KEY:'sk_test_fixture'},outbound:async request=>{
  const path=new URL(request.url).pathname
  if(path==='/v1/checkout/sessions'&&request.method==='POST'){
   const form=new URLSearchParams(await request.text());lines=[...form].filter(([key])=>key.endsWith('[unit_amount]')).map(([,value])=>Number(value))
   session={id:'cs_return_fixture',url:'https://checkout.stripe.com/c/pay/cs_return_fixture',metadata:{stayId:form.get('metadata[stayId]')},amount_total:lines.reduce((a,b)=>a+b,0),customer:'cus_return_fixture'};return Response.json(session)
  }
  if(path==='/v1/checkout/sessions/cs_return_fixture')return Response.json({...session,status:paid?'complete':'open',payment_status:paid?'paid':'unpaid',payment_intent:paid?{id:'pi_return_fixture',status:'succeeded',amount_received:session.amount_total,currency:'usd',payment_method:'pm_return_fixture'}:null})
  assert.fail('Unexpected network request '+path)
 }})
 try{
  const {p,home,prior,issue}=await setupOffer(h),offer=await issue(),offerToken=new URL(offer.url,h.origin).searchParams.get('offer'),input={start:day(20),end:day(23),guests:3,offerToken}
  const page=await h.send(offer.url);assert.equal(page.status,200);assert.match(page.text,/Welcome back, Megan Example/)
  const plain=await h.send('/book/pine-cabin/quote',{start:day(20),end:day(23),guests:3,email:'megan@stay.example'});assert.equal(plain.value.quote.discountCents,undefined)
  const priced=await h.send('/book/pine-cabin/quote',input),q=priced.value.quote
  assert.equal(q.baseRentCents,60000);assert.equal(q.rentCents,54000);assert.equal(q.discountCents,6000);assert.equal(q.cleaningCents,5000);assert.equal(q.extraGuestCents,3000);assert.equal(q.taxes[0].amountCents,6200);assert.equal(q.totalCents,68200)
  const checkout={...input,homeRevision:home.revision,guestName:'Megan Example',email:'megan@stay.example',signature:'Megan Example',consent:'yes',returningConsent:'yes'}
  assert.equal((await h.send('/book/pine-cabin/checkout',{...checkout,email:'someoneelse@stay.example'})).status,409)
  const book=await h.send('/book/pine-cabin/checkout',checkout);assert.equal(book.status,200,book.text);assert.equal(session.amount_total,q.totalCents);assert.deepEqual(lines,[54000,5000,3000,6200])
  assert.equal((await h.send('/book/pine-cabin/checkout',{...checkout,start:day(30),end:day(33)})).status,409)
  paid=true;const ready=await h.send(`/book/stay/${book.value.token}/refresh`,{});assert.equal(ready.value.stay.phase,'confirmed')
  const state=await h.state(),newBooking=state.bookings.find(b=>b.id===state.direct.stays[0].bookingId),newGuest=guestFor(state,newBooking.id),oldGuest=guestFor(state,prior.bookingId)
  assert.equal(newGuest.mergedInto,oldGuest.id);assert.equal(state.direct.stays[0].quote.totalCents,q.totalCents)
  assert.ok(state.messages.some(m=>m.text.includes('rent after discount $540.00')&&m.text.includes('Paid: $682.00')))
  const agreement=await h.send(`/book/stay/${book.value.token}/agreement`);assert.match(agreement.text,/USD 682.00/)
  await profileCommand(h,'guest.fact',prior.bookingId,{propertyId:p.id,kind:'preference',value:'Feather-free pillows',source:'Guest requested it.'})
  await profileCommand(h,'guest.consent',prior.bookingId,{propertyId:p.id,purpose:'preferences',allowed:'yes',source:'Guest asked to reuse it at Pine Cabin.'})
  assert.match((await h.send('/app/guests',undefined,h.owner)).text,/Permitted preferences at Pine Cabin/)
  const linkMerge=(await h.state()).guestMerges.find(m=>m.fromId===newGuest.id);await h.cmd('guest.merge.undo',{id:linkMerge.id,revision:linkMerge.revision,confirm:'yes'})
  await h.cmd('guest.policy',{propertyId:p.id,revision:(await h.state()).guestPolicies[0].revision,allowPreferences:'yes',allowRepeatOffers:'yes'})
  assert.equal(guestFor(await h.state(),newBooking.id).mergedInto,undefined,'later commits do not reapply an undone offer identity link')
 }finally{await h.close()}
})

test('an unused offer stops working after consent withdrawal, identity separation or expiry',async()=>{
 const h=await harness()
 try{
  const {p,prior,issue}=await setupOffer(h),first=await issue()
  await profileCommand(h,'guest.consent',prior.bookingId,{propertyId:p.id,purpose:'offers',allowed:'no',source:'Guest unsubscribed.'})
  assert.equal((await h.send(first.url)).status,409)
  await profileCommand(h,'guest.consent',prior.bookingId,{propertyId:p.id,purpose:'offers',allowed:'yes',source:'Guest requested a new offer.'})
  const second=await issue(),other=await priorStay(h,p.id,'vrbo',-10,'other@stay.example');let state=await h.state(),a=guestFor(state,prior.bookingId),b=guestFor(state,other.bookingId)
  const merged=await h.cmd('guest.merge',{id:b.id,revision:b.revision,intoId:a.id,intoRevision:a.revision,reason:'Reviewed the guest’s two channel references.',confirm:'yes'})
  assert.equal((await h.send(second.url)).status,409)
  const third=await issue(),merge=(await h.state()).guestMerges.find(m=>m.id===merged.id)
  await h.cmd('guest.merge.undo',{id:merge.id,revision:merge.revision,confirm:'yes'});assert.equal((await h.send(third.url)).status,409)
  const expiring=await issue();await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.expiresAt',?) WHERE kind='guestOffers' AND id=?").bind(new Date(Date.now()-1000).toISOString(),expiring.id).run()
  assert.equal((await h.send(expiring.url)).status,409)
  const corrected=await issue()
  await h.cmd('booking.details',{id:prior.bookingId,guestName:'Corrected guest',guestEmail:'corrected@stay.example'})
  assert.equal((await h.send(corrected.url)).status,409,'correcting the prior guest contact invalidates an issued offer')
  const beforeErasure=await h.state(),booking=beforeErasure.bookings.find(b=>b.id===prior.bookingId)
  await h.cmd('privacy.erase',{entity:'guest',id:booking.id,revision:booking.revision})
  const erased=guestFor(await h.state(),prior.bookingId);assert.ok(erased.erasedAt);assert.deepEqual(erased.identities,[]);assert.deepEqual(erased.facts,[]);assert.deepEqual(erased.consents,[])
  assert.equal((await h.send(first.url)).status,409)
  assert.ok(guestFor(await h.state(),other.bookingId).identities.length,'an unmerged contact sharing a phone retains its separate identity')
 }finally{await h.close()}
})
