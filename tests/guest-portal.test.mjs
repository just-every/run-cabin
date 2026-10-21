import {test} from 'node:test'
import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {homeDay} from './home-calendar.mjs'

const zone='America/New_York',day=n=>homeDay(n,zone)
const direct={enabled:true,slug:'pine-ridge',description:'A quiet cabin',nightlyCents:18000,cleaningCents:7500,extraGuestCents:2000,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'Lodging tax',taxBps:900,countyTaxLabel:'County',countyTaxBps:100,agreement:'Quiet hours after 10 pm',requireIdentity:false,policyName:'Flexible',retainedBps:0,noShowBps:10000}

test('GUEST-002: the stay page lists the guest’s tasks, shows the versioned guide and timed code to the holder only, and withdraws access on cancellation, checkout, expiry or replacement',async()=>{
 const h=await harness()
 try{
  const manager=await h.person('Riley','manager'),cleaner=await h.person('Dale')
  const homeFor=async(name,slug)=>{
   const p=await h.cmd('property.save',{name,ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
   const settings=await h.cmd('home.settings',{propertyId:p.id,address:'120 Lake Drive, Asheville, NC',timeZone:zone,checkInTime:'16:00',checkOutTime:'10:00',checklist:['Clean'],photosRequired:1})
   await h.cmd('property.profile',{propertyId:p.id,homeRevision:settings.revision,occupancyLimit:6,houseRules:`No parties at ${name}`})
   return p
  }
  const pine=await homeFor('Pine Ridge'),lake=await homeFor('Lake Loft')
  const idPolicy={identityMode:'risk',identityLeadDays:0,identityMinGuests:3,identityMinTotalDollars:0,identityReviewerId:manager.id,identityBlockAccess:false,identityBeforeConfirmation:false,identityRetentionDays:30}
  await h.cmd('direct.configure',{...direct,...idPolicy,propertyId:pine.id})
  await h.cmd('direct.configure',{...direct,slug:'lake-loft',propertyId:lake.id})
  await h.cmd('direct.agreement.template',{propertyId:pine.id,agreementTitle:'Maine rental terms',agreementState:'ME',agreement:'No smoking.',agreementRequired:true,agreementBlockAccess:false})

  // The guide is versioned: a stale form is refused, an identical save changes nothing, new text is the next version.
  const guide={propertyId:pine.id,version:0,arrival:'Park by the red shed. Gate code 7788 is printed on the keypad card.',guidebook:'Trash goes out Tuesday. Wi-Fi: PineRidge.'}
  await h.cmd('portal.guide',{...guide,arrival:''},manager.cookie,400)
  await h.cmd('portal.guide',guide,cleaner.cookie,403)
  assert.equal((await h.cmd('portal.guide',guide,manager.cookie)).version,1)
  await h.cmd('portal.guide',guide,manager.cookie,409)
  assert.equal((await h.cmd('portal.guide',{...guide,version:1},manager.cookie)).version,1)
  const lakeGuide=await h.cmd('portal.guide',{propertyId:lake.id,version:0,arrival:'Lake Loft: lockbox under the porch.',guidebook:''},manager.cookie)
  assert.equal(lakeGuide.version,1)

  const book=async(home,guestName,email,start,end,extra={})=>h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',kind:'stay',start,end,guestName,guestEmail:email,...extra})
  const pageOf=async bookingId=>{const state=await h.accessState(),code=state.codes.find(c=>c.bookingId===bookingId&&c.holder==='guest'&&c.status==='issued');return code}
  const alex=await book(pine,'Alex Rivera','alex@stay.example',day(3),day(6)),sam=await book(lake,'Sam Okafor','sam@stay.example',day(3),day(5))
  const alexCode=await pageOf(alex.bookingId),samCode=await pageOf(sam.bookingId)
  let page=await h.send('/stay/'+alexCode.link)
  assert.equal(page.status,200);assert.match(page.text,/width=device-width/)
  // Reservation, tasks, timed code, arrival instructions, house rules, guidebook and the guide's version.
  assert.match(page.text,/Alex Rivera/);assert.match(page.text,/Before you arrive/)
  assert.match(page.text,/Sign the rental agreement[\s\S]*?To do[\s\S]*?Review and sign/)
  assert.match(page.text,/Complete the identity check[\s\S]*?To do/)
  assert.match(page.text,new RegExp(`<p class="code">${alexCode.code}</p>`));assert.match(page.text,/Not active yet/);assert.match(page.text,/Works [^<]*4 pm/)
  assert.match(page.text,/Guide version 1/);assert.match(page.text,/Park by the red shed/);assert.match(page.text,/No parties at Pine Ridge/);assert.match(page.text,/Trash goes out Tuesday/)
  assert.match(page.text,/Report a problem/)

  // The guest finishes the signature and the manager-approved identity review; both tasks now read Done.
  let state=await h.accessState();const agreement=state.rentalAgreements.find(a=>a.bookingId===alex.bookingId),document=agreement.documents.at(-1)
  assert.equal((await h.send(`/book/stay/agreement/${agreement.token}`,{version:document.id,sha256:document.sha256,name:'Alex Rivera',email:'alex@stay.example',consent:'yes'})).status,303)
  const verifyPath=page.text.match(/\/book\/verification\/[a-f0-9-]{72}/)?.[0];assert.ok(verifyPath,'the identity task links to the guest’s own review')
  assert.equal((await h.mf.dispatchFetch(h.origin+verifyPath+'/manual',{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({consent:'yes'}),redirect:'manual'})).status,200)
  state=await h.accessState();const review=state.verifications.find(v=>v.bookingId===alex.bookingId)
  assert.ok(review,'the reservation has an identity review')
  await h.cmd('direct.verification.decide',{id:review.id,revision:review.revision,outcome:'approved',method:'In-person check',reference:'Front desk',reason:'Guest matched the reservation identity.'},manager.cookie)
  page=await h.send('/stay/'+alexCode.link)
  assert.doesNotMatch(page.text,/Sign the rental agreement[\s\S]*?To do/);assert.match(page.text,/Sign the rental agreement[\s\S]*?Done/);assert.match(page.text,/Complete the identity check[\s\S]*?Done/)

  // The guest reports an issue from the page.
  const report=await h.mf.dispatchFetch(h.origin+'/stay/'+alexCode.link,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({reason:'The shed gate is stuck',category:'access'}),redirect:'manual'})
  assert.equal(report.status,200);assert.match(await report.text(),/Problem reported/)

  // Another reservation, another home and a guessed link see nothing of this stay.
  const samPage=await h.send('/stay/'+samCode.link)
  assert.match(samPage.text,/Sam Okafor/);assert.match(samPage.text,/Lake Loft: lockbox/);assert.match(samPage.text,/Guide version 1/)
  for(const secret of ['Alex Rivera',alexCode.code,'Park by the red shed','No parties at Pine Ridge','shed gate is stuck'])assert.ok(!samPage.text.includes(secret),`another stay's page does not show ${secret}`)
  for(const guess of [alex.bookingId,'0'.repeat(48),alexCode.link.slice(0,-1)+(alexCode.link.endsWith('0')?'1':'0')])assert.equal((await h.send('/stay/'+guess)).status,404)

  // New guide text raises the version the guest reads; the private guide reaches no public page, cleaner view or agent view.
  assert.equal((await h.cmd('portal.guide',{...guide,version:1,arrival:guide.arrival+' Updated: use the side door.'},manager.cookie)).version,2)
  page=await h.send('/stay/'+alexCode.link);assert.match(page.text,/Guide version 2/);assert.match(page.text,/use the side door/)
  for(const path of ['/book','/book/pine-ridge','/book/pine-ridge/quote'])assert.ok(!(await h.send(path)).text.includes('Park by the red shed'),path+' stays public-safe')
  assert.ok(!JSON.stringify(await h.accessState(cleaner.cookie)).includes('Park by the red shed'),'cleaners do not receive guide text')
  assert.ok(JSON.stringify(await h.accessState(manager.cookie)).includes('Park by the red shed'),'managers do')

  // Replacing a link ends the old one at once and the new one opens the same stay.
  await h.cmd('portal.link.rotate',{bookingId:alex.bookingId},manager.cookie)
  const renewed=await pageOf(alex.bookingId);assert.notEqual(renewed.link,alexCode.link)
  assert.equal((await h.send('/stay/'+alexCode.link)).status,404);assert.match((await h.send('/stay/'+renewed.link)).text,/Alex Rivera/)
  await h.cmd('portal.link.rotate',{bookingId:alex.bookingId},cleaner.cookie,403)

  // After check-out the page shows no code or instructions; a week later the link is gone.
  const shift=async(code,validFrom,validUntil)=>h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.validFrom',?,'$.validUntil',?) WHERE kind='codes' AND id=?").bind(validFrom,validUntil,code.id).run()
  await shift(samCode,day(-3)+'T16:00',day(-1)+'T10:00')
  page=await h.send('/stay/'+samCode.link);assert.equal(page.status,200);assert.match(page.text,/Your stay has ended/);assert.ok(!page.text.includes(samCode.code)&&!page.text.includes('lockbox'),'checked-out stays show no access secrets')
  await shift(samCode,day(-12)+'T16:00',day(-9)+'T10:00')
  assert.equal((await h.send('/stay/'+samCode.link)).status,404,'links expire a week after check-out')

  // A cancelled stay keeps no code or instructions on its page.
  // A phone booking shows its unpaid balance as a task; once cancelled, its page keeps no code, instructions or tasks.
  const phone=await h.cmd('reservation.create',{propertyId:pine.id,method:'phone',channel:'direct',sourceId:'CALL-7',guestName:'Jo Rivera',guestEmail:'jo@stay.example',start:day(10),end:day(12),rentCents:50000,policyName:'Flexible',retainedBps:0,noShowBps:0})
  const joCode=await pageOf(phone.id);page=await h.send('/stay/'+joCode.link)
  assert.match(page.text,/Pay your balance[\s\S]*?To do[\s\S]*?\$500\.00 still due/);assert.match(page.text,new RegExp(`<p class="code">${joCode.code}</p>`))
  await h.cmd('reservation.end',{id:phone.id,revision:phone.revision,outcome:'cancelled',reason:'Guest cancelled by phone'})
  page=await h.send('/stay/'+joCode.link);assert.match(page.text,/This stay was cancelled/)
  for(const hidden of [joCode.code,'Park by the red shed','Before you arrive','Report a problem'])assert.ok(!page.text.includes(hidden),`a cancelled stay does not show ${hidden}`)
 }finally{await h.close()}
})
