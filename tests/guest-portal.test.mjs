import {test} from 'node:test'
import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {homeDay} from './home-calendar.mjs'
import {erase} from './privacy-flow.mjs'

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
  const alexCookie=await h.verifyGuest(alexCode.link),samCookie=await h.verifyGuest(samCode.link)
  let page=await h.send('/stay/'+alexCode.link,undefined,alexCookie)
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
  assert.equal((await h.send('/stay/'+alexCode.link+'/agreement',{version:document.id,sha256:document.sha256,name:'Alex Rivera',email:'alex@stay.example',consent:'yes'},alexCookie)).status,303)
  const verifyPath='/stay/'+alexCode.link+'/verification';assert.ok(verifyPath,'the identity task links to the guest’s own review')
  assert.equal((await h.mf.dispatchFetch(h.origin+verifyPath+'/manual',{method:'POST',headers:{origin:h.origin,cookie:alexCookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({consent:'yes'}),redirect:'manual'})).status,200)
  state=await h.accessState();const review=state.verifications.find(v=>v.bookingId===alex.bookingId)
  assert.ok(review,'the reservation has an identity review')
  await h.cmd('direct.verification.decide',{id:review.id,revision:review.revision,outcome:'approved',method:'In-person check',reference:'Front desk',reason:'Guest matched the reservation identity.'},manager.cookie)
  page=await h.send('/stay/'+alexCode.link,undefined,alexCookie)
  assert.doesNotMatch(page.text,/Sign the rental agreement[\s\S]*?To do/);assert.match(page.text,/Sign the rental agreement[\s\S]*?Done/);assert.match(page.text,/Complete the identity check[\s\S]*?Done/)

  // The guest reports an issue from the page.
  const report=await h.mf.dispatchFetch(h.origin+'/stay/'+alexCode.link,{method:'POST',headers:{origin:h.origin,cookie:alexCookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({reason:'The shed gate is stuck',category:'access'}),redirect:'manual'})
  assert.equal(report.status,200);assert.match(await report.text(),/Problem reported/)

  // Another reservation, another home and a guessed link see nothing of this stay.
  const samPage=await h.send('/stay/'+samCode.link,undefined,samCookie)
  assert.match(samPage.text,/Sam Okafor/);assert.match(samPage.text,/Lake Loft: lockbox/);assert.match(samPage.text,/Guide version 1/)
  for(const secret of ['Alex Rivera',alexCode.code,'Park by the red shed','No parties at Pine Ridge','shed gate is stuck'])assert.ok(!samPage.text.includes(secret),`another stay's page does not show ${secret}`)
  for(const guess of [alex.bookingId,'0'.repeat(48),alexCode.link.slice(0,-1)+(alexCode.link.endsWith('0')?'1':'0')])assert.equal((await h.send('/stay/'+guess)).status,404)

  // New guide text raises the version the guest reads; the private guide reaches no public page, cleaner view or agent view.
  assert.equal((await h.cmd('portal.guide',{...guide,version:1,arrival:guide.arrival+' Updated: use the side door.'},manager.cookie)).version,2)
  page=await h.send('/stay/'+alexCode.link,undefined,alexCookie);assert.match(page.text,/Guide version 2/);assert.match(page.text,/use the side door/)
  for(const path of ['/book','/book/pine-ridge','/book/pine-ridge/quote'])assert.ok(!(await h.send(path)).text.includes('Park by the red shed'),path+' stays public-safe')
  assert.ok(!JSON.stringify(await h.accessState(cleaner.cookie)).includes('Park by the red shed'),'cleaners do not receive guide text')
  assert.ok(JSON.stringify(await h.accessState(manager.cookie)).includes('Park by the red shed'),'managers do')

  // Replacing a link ends the old one at once and the new one opens the same stay.
  await h.cmd('portal.link.rotate',{bookingId:alex.bookingId},manager.cookie)
  const renewed=await pageOf(alex.bookingId);assert.notEqual(renewed.link,alexCode.link)
  assert.equal((await h.send('/stay/'+alexCode.link)).status,404);assert.doesNotMatch((await h.send('/stay/'+renewed.link,undefined,alexCookie)).text,/Alex Rivera/);assert.match((await h.send('/stay/'+renewed.link,undefined,await h.verifyGuest(renewed.link))).text,/Alex Rivera/)
  await h.cmd('portal.link.rotate',{bookingId:alex.bookingId},cleaner.cookie,403)

  // After check-out the page shows no code or instructions; a week later the link is gone.
  const shift=async(code,validFrom,validUntil)=>h.db.batch([
   h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.validFrom',?,'$.validUntil',?) WHERE kind='codes' AND id=?").bind(validFrom,validUntil,code.id),
   h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.start',?,'$.end',?) WHERE kind='bookings' AND id=?").bind(validFrom.slice(0,10),validUntil.slice(0,10),code.bookingId),
   h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.expiresAt',?) WHERE kind='guestPortalLinks' AND json_extract(data,'$.bookingId')=?").bind(new Date(Date.parse(validUntil+'Z')+7*86400000).toISOString(),code.bookingId),
  ])
  await shift(samCode,day(-3)+'T16:00',day(-1)+'T10:00')
  page=await h.send('/stay/'+samCode.link,undefined,samCookie);assert.equal(page.status,200);assert.match(page.text,/Your stay has ended/);assert.ok(!page.text.includes(samCode.code)&&!page.text.includes('lockbox'),'checked-out stays show no access secrets')
  await shift(samCode,day(-12)+'T16:00',day(-9)+'T10:00')
  assert.equal((await h.send('/stay/'+samCode.link)).status,404,'links expire a week after check-out')

  // A cancelled stay keeps no code or instructions on its page.
  // A phone booking shows its unpaid balance as a task; once cancelled, its page keeps no code, instructions or tasks.
  const phone=await h.cmd('reservation.create',{propertyId:pine.id,method:'phone',channel:'direct',sourceId:'CALL-7',guestName:'Jo Rivera',guestEmail:'jo@stay.example',start:day(10),end:day(12),rentCents:50000,policyName:'Flexible',retainedBps:0,noShowBps:0})
  const joCode=await pageOf(phone.id),joCookie=await h.verifyGuest(joCode.link);page=await h.send('/stay/'+joCode.link,undefined,joCookie)
  assert.match(page.text,/Pay your balance[\s\S]*?To do[\s\S]*?\$500\.00 still due/);assert.match(page.text,new RegExp(`<p class="code">${joCode.code}</p>`))
  await h.cmd('reservation.end',{id:phone.id,revision:phone.revision,outcome:'cancelled',reason:'Guest cancelled by phone'})
  page=await h.send('/stay/'+joCode.link,undefined,joCookie);assert.equal(page.status,404)
  for(const hidden of [joCode.code,'Park by the red shed','Before you arrive','Report a problem'])assert.ok(!page.text.includes(hidden),`a cancelled stay does not show ${hidden}`)
 }finally{await h.close()}
})

async function challenge(h,path,browser){
 const initial=browser?null:await h.send(path),cookie=browser??initial.cookie
 const sent=await h.send(path+'/send-code',{},cookie,{accept:'application/json'})
 if(sent.status!==200)return {sent,cookie}
 const row=await h.db.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=? ORDER BY sequence DESC LIMIT 1").bind('guest-code:'+sent.value.challengeId).first()
 const mail=row?JSON.parse(row.message):null
 return {sent,cookie,id:sent.value.challengeId,code:mail?.text.match(/code is (\d{6})/)?.[1],mail}
}
async function portalHome(h,n=1){
 const home=await h.cmd('property.save',{name:'synthetic-cabin-'+n,ownerName:'Synthetic host',ownerEmail:'synthetic-cabin-host@stay.example',commissionBps:2000})
 await h.cmd('home.settings',{propertyId:home.id,address:'Private synthetic-cabin-'+n+' address',timeZone:zone,checkInTime:'16:00',checkOutTime:'10:00',checklist:['Ready']})
 return home
}
const portalLink=async(h,id)=>(await h.accessState()).guestPortalLinks.find(l=>l.bookingId===id)

test('GUEST-002: browser-bound one-use email proof fences HTML, JSON and writes, rate limits guessing and ends sessions on every reservation authority change',async()=>{
 const h=await harness()
 try{
  const home=await portalHome(h),other=await portalHome(h,2)
  const stay=await h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',start:day(3),end:day(6),guestName:'synthetic-cabin-1 guest',guestEmail:'  SYNTHETIC-CABIN-1@STAY.EXAMPLE  '})
  const otherStay=await h.cmd('reservation.request',{propertyId:other.id,channel:'vrbo',start:day(3),end:day(6),guestName:'synthetic-cabin-2 guest',guestEmail:'synthetic-cabin-2@stay.example'})
  const link=await portalLink(h,stay.bookingId),path='/stay/'+link.token,otherPath='/stay/'+(await portalLink(h,otherStay.bookingId)).token
  const code=(await h.accessState()).codes.find(c=>c.bookingId===stay.bookingId&&c.holder==='guest').code
  const secrets=['synthetic-cabin-1 guest','Private synthetic-cabin-1 address',stay.bookingId,day(3),day(6),code,'Report a problem']
  const fresh=await h.send(path);assert.equal(fresh.status,200);assert.match(fresh.text,/s\*\*\*@s\*\*\*/)
  for(const secret of secrets)assert.ok(!fresh.text.includes(secret),'fresh HTML withholds '+secret)
  for(const door of ['/api','/verification','/agreement','/files/guessed','/offers/guessed']){
   const r=await h.send(path+door,undefined,h.owner,{accept:'application/json'});assert.equal(r.status,401)
   for(const secret of secrets)assert.ok(!r.text.includes(secret),'fresh JSON withholds '+secret)
  }
  assert.equal((await h.send(path,{reason:'Unverified report'},fresh.cookie)).status,401)
  const multipart=new FormData();multipart.set('action','maintenance')
  assert.equal((await h.mf.dispatchFetch(h.origin+path,{method:'POST',headers:{origin:h.origin,cookie:fresh.cookie},body:multipart})).status,401)
  const first=await challenge(h,path,fresh.cookie);assert.equal(first.sent.status,200);assert.deepEqual(first.mail.to,['synthetic-cabin-1@stay.example'])
  const secondBrowser=(await h.send(path)).cookie
  assert.equal((await h.send(path+'/verify',{challengeId:first.id,code:first.code},secondBrowser)).status,401,'code stays in its requesting browser')
  const confirmed=await h.send(path+'/verify',{challengeId:first.id,code:first.code},first.cookie);assert.equal(confirmed.status,303)
  const session=first.cookie+'; '+confirmed.cookie,setCookie=confirmed.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Lax/);assert.doesNotMatch(setCookie,/Domain=/)
  assert.equal((await h.send(path+'/verify',{challengeId:first.id,code:first.code},first.cookie)).status,401,'one use')
  assert.match((await h.send(path,undefined,session)).text,/synthetic-cabin-1 guest/)
  assert.equal((await h.send(path+'/api',undefined,session)).value.reservation.id,stay.bookingId)
  assert.equal((await h.send(otherPath+'/api',undefined,session)).status,401,'reservation session cannot read another stay')
  assert.doesNotMatch((await h.send(path,undefined,secondBrowser)).text,/synthetic-cabin-1 guest/)
  assert.equal((await h.send('/api/cabin/state',undefined,session)).status,401)
  assert.equal((await h.send('/owners/api/state',undefined,session)).status,401)
  const guessed=await challenge(h,path,secondBrowser);const wrong=guessed.code==='000000'?'111111':'000000'
  for(let i=0;i<5;i++)assert.equal((await h.send(path+'/verify',{challengeId:guessed.id,code:wrong},guessed.cookie)).status,i===4?429:401)
  assert.equal((await h.send(path+'/verify',{challengeId:guessed.id,code:guessed.code},guessed.cookie)).status,429)
  assert.equal((await h.send(path+'/send-code',{},first.cookie)).status,429,'lock applies across browsers')
  await h.db.prepare('UPDATE cb_guest_limits SET locked_until=?,wrong_start=?,send_start=? WHERE booking_id=?').bind(Date.now()-1,Date.now()-16*60000,Date.now()-16*60000,stay.bookingId).run()
  const expired=await challenge(h,path,secondBrowser)
  await h.db.prepare('UPDATE cb_guest_challenges SET expires_at=? WHERE id=?').bind(Date.now()-1,expired.id).run()
  assert.equal((await h.send(path+'/verify',{challengeId:expired.id,code:expired.code},expired.cookie)).status,401)
  assert.equal((await challenge(h,path,secondBrowser)).sent.status,200)
  assert.equal((await challenge(h,path,secondBrowser)).sent.status,200)
  assert.equal((await challenge(h,path,secondBrowser)).sent.status,429,'three sends per reservation window')
  const rows=(await h.db.prepare('SELECT * FROM cb_guest_challenges').all()).results
  assert.ok(rows.every(row=>!Object.values(row).includes(first.code)&&!Object.values(row).includes(first.cookie.split('=')[1])),'only hashes persist at the application boundary')
  await h.cmd('portal.sessions.end',{bookingId:stay.bookingId})
  assert.doesNotMatch((await h.send(path,undefined,session)).text,/synthetic-cabin-1 guest/)
  await h.db.prepare('UPDATE cb_guest_limits SET send_start=? WHERE booking_id=?').bind(Date.now()-16*60000,stay.bookingId).run()
  let liveCookie=await h.verifyGuest(link.token)
  let booking=(await h.accessState()).bookings.find(b=>b.id===stay.bookingId)
  await h.cmd('booking.details',{id:booking.id,revision:booking.revision,guestName:booking.guestName,guestEmail:'synthetic-cabin-3@stay.example'})
  assert.equal((await h.send(path+'/api',undefined,liveCookie)).status,401,'email changes end the session')
  liveCookie=await h.verifyGuest(link.token)
  await h.cmd('portal.link.rotate',{bookingId:stay.bookingId})
  const rotated=await portalLink(h,stay.bookingId),newPath='/stay/'+rotated.token
  assert.equal((await h.send(path,undefined,liveCookie)).status,404)
  assert.equal((await h.send(newPath+'/api',undefined,liveCookie)).status,401,'replacement requires fresh email proof')
  liveCookie=await h.verifyGuest(rotated.token)
  booking=(await h.accessState()).bookings.find(b=>b.id===stay.bookingId)
  await h.cmd('reservation.cancel',{id:booking.id,revision:booking.revision})
  assert.equal((await h.send(newPath,undefined,liveCookie)).status,404)
  const otherCookie=await h.verifyGuest(otherPath),otherBooking=(await h.accessState()).bookings.find(b=>b.id===otherStay.bookingId)
  await erase(h,{entity:'guest',id:otherBooking.id,revision:otherBooking.revision})
  assert.equal((await h.send(otherPath,undefined,otherCookie)).status,404)
  for(const table of ['cb_guest_challenges','cb_guest_sessions','cb_guest_limits'])assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM '+table+' WHERE booking_id=?').bind(otherStay.bookingId).first()).n,0,'erasure removes '+table)
  const audit=await h.send('/api/cabin/activity.jsonl',undefined,h.owner)
  for(const action of ['guest.portal.code.send','guest.portal.code.verify','guest.portal.code.lockout','guest.portal.session.end'])assert.ok(audit.text.includes(action),action)
  for(const privateValue of [first.code,'synthetic-cabin-1@stay.example',session.split('; ')[1].split('=')[1]])assert.ok(!audit.text.includes(privateValue),'audit never carries credentials or full recipient')
 }finally{await h.close()}
})

test('GUEST-002: blocked stays have a verified portal before a code, guide originals are versioned private downloads and channel receipts settle payment tasks',async()=>{
 let failCodeMail=false
 const h=await harness({auth:{CABIN_TEST_MAIL_EDGE:'true'},outbound:async request=>{
  assert.equal(new URL(request.url).hostname,'mail.cabin.test');const message=await request.json()
  return message.deliveryId?.startsWith('guest-code:')&&failCodeMail?new Response('Refused',{status:503}):Response.json({status:'accepted',provider:'synthetic',providerMessageId:'synthetic-cabin-1'})
 }})
 try{
  const home=await portalHome(h),manager=await h.person('SyntheticManager','manager'),cleaner=await h.person('SyntheticCleaner')
  await h.cmd('direct.configure',{...direct,propertyId:home.id,identityMode:'all',identityReviewerId:manager.id,identityBlockAccess:true,identityBeforeConfirmation:false,identityRetentionDays:30})
  await h.cmd('direct.agreement.template',{propertyId:home.id,agreementTitle:'Synthetic rental terms',agreementState:'ME',agreement:'Synthetic private terms.',agreementRequired:true,agreementBlockAccess:true})
  await h.cmd('portal.guide',{propertyId:home.id,version:0,arrival:'Private synthetic-cabin-1 arrival',guidebook:'Private synthetic-cabin-1 guide'})
  const file={name:'synthetic-cabin-1.txt',mimeType:'text/plain',base64:Buffer.from('Original synthetic-cabin-1 guide bytes\n').toString('base64')}
  const saved=await h.cmd('portal.guide.file.add',{propertyId:home.id,version:1,guideFile:file})
  await h.cmd('portal.guide.file.add',{propertyId:home.id,version:2,guideFile:file},cleaner.cookie,403)
  await h.cmd('portal.guide.file.remove',{propertyId:home.id,version:1,fileId:saved.files[0].id},manager.cookie,409)
  const stay=await h.cmd('reservation.create',{propertyId:home.id,method:'channel',channel:'airbnb',sourceId:'synthetic-cabin-1',guestName:'synthetic-cabin-1 guest',start:day(8),end:day(10),rentCents:50000,policyName:'Synthetic saved policy',retainedBps:0,noShowBps:0})
  const link=await portalLink(h,stay.id),path='/stay/'+link.token
  assert.equal((await h.accessState()).codes.filter(c=>c.bookingId===stay.id&&c.holder==='guest').length,0)
  assert.match((await h.send(path)).text,/Ask your host to add your email/)
  assert.equal((await h.send(path+'/send-code',{},(await h.send(path)).cookie)).status,409)
  let booking=(await h.accessState()).bookings.find(b=>b.id===stay.id)
  await h.cmd('booking.details',{id:stay.id,revision:booking.revision,guestName:booking.guestName,guestEmail:'synthetic-cabin-1@stay.example'})
  failCodeMail=true;const failed=await challenge(h,path);assert.equal(failed.sent.value.message,'failed');assert.equal(failed.mail,null)
  failCodeMail=false;const guest=await h.verifyGuest(link.token)
  let page=await h.send(path,undefined,guest);assert.match(page.text,/Before you arrive/);assert.match(page.text,/Review and sign/);assert.doesNotMatch(page.text,/Private synthetic-cabin-1 arrival|Private synthetic-cabin-1 guide|class="code"/)
  assert.equal((await h.send(path+'/files/'+saved.files[0].id,undefined,guest)).status,404)
  assert.equal((await h.send(path+'/verification/manual',{consent:'yes'})).status,401)
  const state=await h.accessState(),agreement=state.rentalAgreements.find(a=>a.bookingId===stay.id),document=agreement.documents.at(-1)
  assert.equal((await h.send(path+'/agreement',{version:document.id,sha256:document.sha256,name:booking.guestName,email:'synthetic-cabin-1@stay.example',consent:'yes'},guest)).status,303)
  assert.equal((await h.mf.dispatchFetch(h.origin+path+'/verification/manual',{method:'POST',headers:{origin:h.origin,cookie:guest,'content-type':'application/x-www-form-urlencoded'},body:'consent=yes',redirect:'manual'})).status,200)
  let review=(await h.accessState()).verifications.find(v=>v.bookingId===stay.id)
  await h.cmd('direct.verification.decide',{id:review.id,revision:review.revision,outcome:'approved',method:'Synthetic human review',reference:'synthetic-cabin-1',reason:'Guest matched saved booking identity'},manager.cookie)
  page=await h.send(path,undefined,guest);assert.match(page.text,/Private synthetic-cabin-1 arrival/);assert.match(page.text,/Guide version 2/)
  const download=await h.send(path+'/files/'+saved.files[0].id,undefined,guest);assert.equal(download.text,Buffer.from(file.base64,'base64').toString());assert.match(download.headers.get('content-disposition'),/attachment/)
  assert.equal((await h.send(path+'/files/'+saved.files[0].id)).status,401)
  assert.equal((await h.send(path+'/agreement/document/'+document.id,undefined,guest)).status,200)
  await h.cmd('payout.import',{source:'airbnb',propertyId:home.id,csv:'Type,Confirmation code,Date,Currency,Gross earnings,Host service fee,Amount\nReservation,synthetic-cabin-1,'+day(9)+',USD,500.00,15.00,485.00\n'})
  page=await h.send(path,undefined,guest);assert.match(page.text,/Pay your balance[\s\S]*?Done[\s\S]*?Paid \$500\.00/)
  const api=await h.send(path+'/api',undefined,guest);assert.equal(api.value.tasks.payment.balanceCents,0);assert.equal(api.value.tasks.payment.channelPaidCents,50000)
  await h.cmd('portal.guide.file.remove',{propertyId:home.id,version:2,fileId:saved.files[0].id})
  assert.equal((await h.send(path+'/files/'+saved.files[0].id,undefined,guest)).status,404)
  assert.match((await h.send(path,undefined,guest)).text,/Guide version 3/)
 }finally{await h.close()}
})
