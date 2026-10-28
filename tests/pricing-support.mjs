import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
export async function pricingHome(h){
 const property=await h.cmd('property.save',{name:'Synthetic Cabin',ownerName:'Synthetic owner',ownerEmail:['synthetic-cabin-1','example.invalid'].join('@'),commissionBps:2000})
 const input={propertyId:property.id,enabled:true,slug:'synthetic-cabin',description:'Native pricing journey home.',nightlyCents:18001,cleaningCents:7501,extraGuestCents:2001,includedGuests:2,maxGuests:4,minNights:1,maxNights:60,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'',taxBps:0,countyTaxLabel:'',countyTaxBps:0,agreement:'Guest-approved native stay terms.',requireIdentity:false}
 let home=await h.cmd('direct.configure',input)
 const save=async data=>{home=await h.cmd('direct.pricing.save',{propertyId:property.id,revision:home.revision,...data});return home}
 const limits=async(floor='0.00',weekly='10.00',monthly='20.00')=>save({floorDollars:floor,weeklyPercent:weekly,monthlyPercent:monthly})
 const channel=async(name,kind,value,extra={})=>save({channel:name,adjustmentKind:kind,adjustmentDirection:'markup',adjustmentValue:value,channelCommissionPercent:'0.00',...extra})
 const preview=async(channel,start='2030-02-01',end='2030-02-03',guests=3)=>h.cmd('direct.pricing.preview',{propertyId:property.id,revision:home.revision,channel,start,end,guests})
 const refresh=async()=>{home=(await h.state()).direct.homes.find(v=>v.propertyId===property.id);return home}
 return {property,input,save,limits,channel,preview,refresh,get home(){return home}}
}
export async function pricingJourney(){
 let charged=0,creates=0,session
 const h=await harness({now:'2030-01-01T17:00:00Z',auth:{STRIPE_TEST_SECRET_KEY:['sk','test','syntheticcabin1'].join('_')},outbound:async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com')
  if(request.method==='POST'&&url.pathname==='/v1/checkout/sessions'){
   const f=new URLSearchParams(await request.text());creates++;charged=[...f].filter(([k])=>/line_items\[\d+\]\[price_data\]\[unit_amount\]/.test(k)).reduce((n,[,v])=>n+Number(v),0)
   session={id:'synthetic_cabin_1',url:'https://checkout.stripe.com/synthetic-cabin-1',metadata:{stayId:f.get('metadata[stayId]')},amount_total:charged};return Response.json(session)
  }
  if(url.pathname==='/v1/checkout/sessions/synthetic_cabin_1')return Response.json({...session,status:'complete',payment_status:'paid',payment_intent:{id:'synthetic_cabin_2',status:'succeeded',amount_received:charged,currency:'usd',payment_method:'synthetic_cabin_3'}})
  assert.fail('Unexpected pricing provider request '+url.pathname)
 }})
 try{
  const p=await pricingHome(h);await p.limits()
  await p.channel('booking-com','percent','15.00',{includeCleaning:true,channelCommissionPercent:'15.00'})
  await p.channel('vrbo','fixed','20.00',{adjustmentDirection:'markdown',channelCommissionPercent:'8.00'})
  await p.channel('booking-com','percent','15.00',{includeCleaning:true,includeExtraGuests:true,channelCommissionPercent:'15.00'})
  let allFees=(await p.preview('booking-com')).quote;assert.equal(allFees.extraGuestCents,4602);assert.equal(allFees.totalCents,54630)
  await p.channel('booking-com','percent','15.00',{includeCleaning:true,channelCommissionPercent:'15.00'})
  await p.channel('airbnb','percent','10.00',{adjustmentDirection:'markdown',includeCleaning:true,includeExtraGuests:true})
  const markdown=(await p.preview('airbnb')).quote;assert.equal(markdown.rentCents,32402);assert.equal(markdown.cleaningCents,6751);assert.equal(markdown.extraGuestCents,3602);assert.equal(markdown.totalCents,42755)

  let q=(await p.preview('booking-com')).quote
  assert.equal(q.rentCents,41402);assert.equal(q.cleaningCents,8626);assert.equal(q.extraGuestCents,4002);assert.equal(q.totalCents,54030);assert.equal(q.pricing.commissionCents,8105);assert.equal(q.pricing.expectedPayoutCents,45925)
  q=(await p.preview('vrbo')).quote;assert.equal(q.rentCents,32002);assert.equal(q.cleaningCents,7501);assert.equal(q.extraGuestCents,4002);assert.equal(q.totalCents,43505);assert.equal(q.pricing.expectedPayoutCents,40025)
  await h.cmd('direct.rate.save',{propertyId:p.property.id,revision:p.home.revision,start:'2030-02-02',end:'2030-02-03',weekday:'all',nightlyCents:18010});await p.refresh()
  q=(await p.preview('booking-com')).quote;assert.equal(q.rentCents,41413);assert.equal(q.totalCents,54041);assert.deepEqual(q.pricing.nights.map(n=>n.amountCents),[20701,20712]);assert.ok(q.pricing.nights[1].rateId)
  await p.channel('booking-com','percent','15.00',{includeExtraGuests:true})
  const selectedFees=(await p.preview('booking-com')).quote;assert.equal(selectedFees.cleaningCents,7501);assert.equal(selectedFees.extraGuestCents,4602);assert.equal(selectedFees.totalCents,53516)
  assert.equal(selectedFees.pricing.adjustment.includeCleaning,false);assert.equal(selectedFees.pricing.adjustment.includeExtraGuests,true)
  await p.channel('booking-com','percent','15.00',{includeCleaning:true,channelCommissionPercent:'15.00'})
  await p.channel('vrbo','fixed','200.00',{adjustmentDirection:'markdown'})
  q=(await p.preview('vrbo')).quote;assert.equal(q.rentCents,0);assert.equal(q.totalCents,11503)
  assert.deepEqual(q.pricing.nights.map(n=>n.requestedCents),[-1999,-1990]);assert.ok(q.pricing.nights.every(n=>n.amountCents===0&&n.floorApplied&&n.adjustmentCents===-20000))
  await p.channel('vrbo','fixed','20.00',{adjustmentDirection:'markdown',channelCommissionPercent:'8.00'})
  const before=structuredClone(p.home)
  const cleaner=await h.person('SyntheticPricingCleaner'),manager=await h.person('SyntheticPricingManager','manager')
  const invalid={propertyId:p.property.id,revision:p.home.revision,channel:'vrbo',adjustmentKind:'fixed',adjustmentDirection:'markdown',adjustmentValue:'20.00',includeCleaning:true,channelCommissionPercent:'8.00'}
  await h.cmd('direct.pricing.save',invalid,h.owner,400);await h.cmd('direct.pricing.save',{...invalid,includeCleaning:false},cleaner.cookie,403)
  await h.cmd('direct.pricing.save',{propertyId:p.property.id,revision:p.home.revision,floorDollars:'-1',weeklyPercent:'10',monthlyPercent:'20'},h.owner,400)
  await h.cmd('direct.pricing.save',{...invalid,includeCleaning:false,revision:'synthetic-cabin-stale'},h.owner,409)
  assert.deepEqual(await p.refresh(),before);assert.equal(creates,0)
  const managerVersion=await h.cmd('direct.pricing.save',{propertyId:p.property.id,revision:p.home.revision,floorDollars:'0',weeklyPercent:'10',monthlyPercent:'20'},manager.cookie);await p.refresh();assert.equal(p.home.revision,managerVersion.revision)
  await h.cmd('member.save',{...manager,active:false});await h.cmd('direct.pricing.save',{propertyId:p.property.id,revision:p.home.revision,floorDollars:'0',weeklyPercent:'0',monthlyPercent:'0'},manager.cookie,403)
  const boundaries=[[6,'2030-04-07',108006,115507,null],[7,'2030-04-08',113407,120908,'weekly'],[27,'2030-04-28',437427,444928,'weekly'],[28,'2030-04-29',403228,410729,'monthly']]
  for(const [nights,end,rent,total,kind]of boundaries){const r=await h.send('/book/synthetic-cabin/quote',{start:'2030-04-01',end,guests:2,channel:'booking-com',rentCents:1});assert.equal(r.status,200,r.text);assert.equal(r.value.quote.nights,nights);assert.equal(r.value.quote.rentCents,rent);assert.equal(r.value.quote.totalCents,total);assert.equal(r.value.quote.pricing.discountKind,kind);assert.equal(r.value.quote.pricing.channel,'direct')}
  await h.cmd('direct.rate.save',{propertyId:p.property.id,revision:p.home.revision,start:'2030-03-01',end:'2030-03-02',weekday:'all',nightlyCents:18005});await p.refresh()
  const halfCent=(await p.preview('direct','2030-03-01','2030-03-08',2)).quote;assert.equal(halfCent.rentCents,113410);assert.equal(halfCent.pricing.nights[0].lengthDiscountCents,1801);assert.equal(halfCent.pricing.nights[0].amountCents,16204)
  const ownerEmail=['synthetic-cabin-1','example.invalid'].join('@')
  await h.cmd('property.terms',{propertyId:p.property.id,propertyRevision:p.property.revision,effectiveFrom:'2030-01-01',ownerName:'Synthetic owner',ownerEmail,commissionBps:2000,terms:'Reviewed native allocation',allocation:{commissionBase:'rent',fixedFeeCents:0,reserveBps:0,ownerUseCleaningCents:0,passThrough:'owner',taxExpense:'owner',owners:[{name:'Synthetic owner',email:ownerEmail,bps:10000}],mapping:{owner:'Owner payable',manager:'Management revenue',reserve:'Owner reserve',tax:'Tax payable',vendor:'Vendor payable',reviewedBy:'Synthetic accountant'}}})
  await h.cmd('promotion.configure',{propertyId:p.property.id,enabled:'yes',minimumNetCents:0,providerFeeReserveCents:0,stock:1,refundRetainedBps:0,refundDeadlineHours:24,taxBps:0,coupons:[{code:'SYNTHETIC',bps:1000,from:'2030-01-01',until:'2031-01-01',minNights:1,channels:['direct']}],confirm:'yes'})
  const couponInput={start:'2030-04-01',end:'2030-04-08',guests:2,couponCode:'SYNTHETIC'}
  const coupon=await h.send('/book/synthetic-cabin/quote',couponInput);assert.equal(coupon.status,200,coupon.text);assert.equal(coupon.value.quote.rentCents,102067);assert.equal(coupon.value.quote.totalCents,109568);assert.equal(coupon.value.quote.pricing.rentCents,102067);assert.ok(coupon.value.quote.pricing.nights.every(n=>n.amountCents===14581))
  await p.limits('150.00')
  for(const door of ['quote','checkout']){
   const refused=await h.send('/book/synthetic-cabin/'+door,{...couponInput,homeRevision:p.home.revision,guestName:'Synthetic guest',email:['synthetic-cabin-4','example.invalid'].join('@'),signature:'Synthetic guest',consent:'yes'});assert.equal(refused.status,409,refused.text);assert.match(refused.value.error,/nightly floor/);assert.equal(creates,0);assert.equal((await h.state()).direct.stays.length,0)
  }

  q=(await p.preview('direct','2030-04-01','2030-04-29',2)).quote;assert.equal(q.rentCents,420000);assert.equal(q.totalCents,427501);assert.ok(q.pricing.nights.every(n=>n.amountCents===15000&&n.floorApplied&&n.requestedCents===14401))
  const priorEmail=['synthetic-cabin-5','example.invalid'].join('@'),prior=await h.cmd('reservation.request',{propertyId:p.property.id,channel:'airbnb',start:'2029-12-01',end:'2029-12-04',guestName:'Synthetic returning guest',guestEmail:priorEmail})
  await h.cmd('guest.policy',{propertyId:p.property.id,allowPreferences:'yes',allowRepeatOffers:'yes'})
  const profile=async()=>((await h.state()).guests.find(g=>g.bookingId===prior.bookingId))
  let guest=await profile();await h.cmd('guest.identity.verify',{id:guest.id,revision:guest.revision,identityId:guest.identities.find(i=>i.kind==='email').id,source:'Guest confirmed address ownership.',confirm:'yes'})
  guest=await profile();await h.cmd('guest.consent',{id:guest.id,revision:guest.revision,propertyId:p.property.id,purpose:'offers',allowed:'yes',source:'Guest requested a private returning offer.'})
  guest=await profile();const offer=await h.cmd('guest.offer.issue',{id:guest.id,revision:guest.revision,propertyId:p.property.id,bookingId:prior.bookingId,expiresAt:'2030-01-10',confirm:'yes'}),offerToken=new URL(offer.url,h.origin).searchParams.get('offer')
  const returning=await h.send('/book/synthetic-cabin/quote',{start:'2030-04-01',end:'2030-04-08',guests:2,offerToken});assert.equal(returning.status,200,returning.text)
  assert.equal(returning.value.quote.rentCents,105000);assert.equal(returning.value.quote.discountCents,8407);assert.ok(returning.value.quote.pricing.nights.every(n=>n.amountCents===15000&&n.floorApplied&&n.requestedCents===14581))
  await p.channel('direct','fixed','20.00',{adjustmentDirection:'markdown'})
  const staleOffer=await h.send('/book/synthetic-cabin/quote',{start:'2030-04-01',end:'2030-04-08',guests:2,offerToken});assert.equal(staleOffer.status,409);assert.equal(creates,0)

  q=(await p.preview('direct','2030-04-01','2030-04-08',2)).quote;assert.equal(q.rentCents,105000);assert.equal(q.totalCents,112501)
  const staff=await h.cmd('quote.issue',{propertyId:p.property.id,guestName:'Synthetic guest',email:['synthetic-cabin-2','example.invalid'].join('@'),start:'2030-05-01',end:'2030-05-08',guests:2,expiresAt:'2030-01-03T17:00:00Z',hold:'no'})
  assert.equal(staff.versions[0].price.totalCents,112501);assert.deepEqual(staff.versions[0].price.pricing,(await p.preview('direct','2030-05-01','2030-05-08',2)).quote.pricing)
  const signed={start:'2030-06-01',end:'2030-06-08',guests:2,homeRevision:p.home.revision,guestName:'Synthetic guest',email:['synthetic-cabin-3','example.invalid'].join('@'),signature:'Synthetic guest',consent:'yes'}
  const accepted=await h.send('/book/synthetic-cabin/checkout',signed);assert.equal(accepted.status,200,accepted.text);assert.equal(charged,112501);assert.equal(creates,1)
  const refreshed=await h.send('/book/stay/'+accepted.value.token+'/refresh',{});assert.equal(refreshed.status,200,refreshed.text)
  const snapshot=structuredClone((await h.state()).direct.stays[0].quote),version=structuredClone(staff.versions[0])
  await p.limits('175.00','30','40')
  await h.cmd('direct.configure',{...p.input,revision:p.home.revision,nightlyCents:25000});await p.refresh()
  assert.equal(p.home.pricing.floorCents,17500,'booking settings retain pricing policy')
  await h.restart()
  assert.deepEqual((await h.state()).direct.stays[0].quote,snapshot);assert.deepEqual((await h.state()).staffQuotes[0].versions[0],version)
  const link=await h.send('/api/cabin/quotes/'+staff.id+'/link',undefined,h.owner);assert.equal(link.status,303)
  const staleQuote=await h.send(link.headers.get('location'));assert.equal(staleQuote.status,409)
  const staleCheckout=await h.send('/book/synthetic-cabin/checkout',signed);assert.equal(staleCheckout.status,409);assert.equal(creates,1,'stale terms have no payment effect')
  const staffPage=await h.send('/app/direct',undefined,h.owner);assert.match(staffPage.text,/Rent: 7 nights at saved rates = \$1,050\.00/);assert.doesNotMatch(staffPage.text,/7 nights × \$180\.01 = \$1,050\.00/)
  const retained=await h.send('/book/stay/'+accepted.value.token);assert.equal(retained.status,200);assert.match(retained.text,/Floor conflict/);assert.match(retained.text,/1,125\.01/)
 }finally{await h.close()}
}
