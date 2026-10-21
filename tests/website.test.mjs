import { homeDay } from './home-calendar.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {harness} from './harness.mjs'
const day=n=>homeDay(n, 'America/New_York')
test('WEB-001: host website publishes only chosen media, searches current inventory, remembers analytics consent and verifies/revokes its portable domain',async()=>{
 let domainProof='',reaches=false
 const h=await harness({outbound:async request=>{assert.equal(new URL(request.url).hostname,'stays.example.com');return new Response(reaches?domainProof:'unrelated site')}})
 try{
  const properties=[]
  for(const [i,name] of ['Lake Loft','Pine Ridge'].entries()){
   const p=await h.cmd('property.save',{name,ownerName:'Morgan Owner',ownerEmail:'morgan@stay.example',commissionBps:2000});properties.push(p)
   await h.cmd('direct.configure',{propertyId:p.id,enabled:true,slug:['lake-loft','pine-ridge'][i],description:'Private Maine home',nightlyCents:15000,cleaningCents:5000,extraGuestCents:0,includedGuests:2,maxGuests:4,minNights:2,maxNights:28,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'Maine',taxBps:900,countyTaxLabel:'',countyTaxBps:0,agreement:'No smoking',requireIdentity:false})
  }
  const profile=await h.cmd('property.profile',{propertyId:properties[0].id,address:'18 Lake Road, Portland, Maine',timeZone:'America/New_York',occupancyLimit:4,amenities:['Lake access','Wi-Fi'],houseRules:'Quiet after 10 pm',photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}]})
  const photo=profile.photos[0].id
  assert.equal((await h.send('/book/photos/'+photo)).status,404)
  const input={name:'Maine Rest',intro:'Two peaceful homes',color:'#214d3d',origin:'https://stays.example.com',seoDescription:'Book your Maine break',privacy:'Counts are optional',analytics:true,pages:[{slug:'about',title:'Meet your hosts',body:'Family run since 2010.'}],listings:[{propertyId:properties[0].id,photoIds:[photo],guide:'Walk to the public lake trail.'}]}
  let site=await h.cmd('direct.site.save',input);domainProof=site.domainChallenge
  const editor=await h.send('/app/direct',undefined,h.owner);assert.match(editor.text,/Maine Rest/)
  const form=new FormData();for(const [key,value]of Object.entries({revision:site.revision,name:input.name,color:input.color,origin:input.origin,seoDescription:input.seoDescription,analytics:'yes',['guide_'+properties[0].id]:'Walk to the public lake trail.'}))form.append(key,value)
  for(const row of [{slug:'about',title:'Meet your hosts',body:'Family run since 2010.'},{slug:'local-guide',title:'Local guide',body:'Enjoy the lake.'}]){form.append('pageSlug',row.slug);form.append('pageTitle',row.title);form.append('pageBody',row.body);form.append('pageDescription','')}
  form.append('photos_'+properties[0].id,photo)
  const upload=new Request(h.origin+'/app/action?name=direct.site.save&returnTo=/app/direct',{method:'POST',headers:{cookie:h.owner,origin:h.origin},body:form});const saved=await h.mf.dispatchFetch(upload.url,{method:'POST',headers:upload.headers,body:await upload.arrayBuffer()});assert.equal(saved.status,200);site=(await h.state()).direct.site;assert.equal(site.pages.length,2,(await saved.text()).match(/.{0,80}(?:role="alert"|class="notice error").{0,300}/g)?.join(' '));assert.equal(site.pages[0].body,'Family run since 2010.')
  const published=await h.mf.dispatchFetch(h.origin+'/book/photos/'+photo);assert.equal(published.status,200);assert.deepEqual(new Uint8Array(await published.arrayBuffer()),new Uint8Array(await readFile('tests/fixtures/checklist.png')))
  const home=await h.send('/book/lake-loft');assert.match(home.text,/Lake access/);assert.match(home.text,/Quiet after 10 pm/);assert.match(home.text,/public lake trail/);assert.match(home.text,new RegExp('/book/photos/'+photo));assert.equal(home.headers.get('x-robots-tag'),'index, follow')
  const search=await h.send(`/book?start=${day(20)}&end=${day(23)}&guests=2`);assert.match(search.text,/Lake Loft/);assert.match(search.text,/Pine Ridge/)
  await h.cmd('reservation.request',{propertyId:properties[0].id,channel:'airbnb',start:day(20),end:day(23),guestName:'Existing visitor'})
  const blocked=await h.send(`/book?start=${day(20)}&end=${day(23)}&guests=2`);assert.doesNotMatch(blocked.text,/>Lake Loft<\/a>/);assert.match(blocked.text,/>Pine Ridge<\/a>/)
  assert.match((await h.send('/book/pages/about')).text,/Family run/)
  const db=await h.mf.getD1Database('DB');assert.equal((await db.prepare('SELECT count(*) n FROM cb_booking_views').first()).n,0)
  await h.send('/book',undefined,'cabin_booking_analytics=allow');assert.equal((await db.prepare('SELECT sum(views) n FROM cb_booking_views').first()).n,1)
  await h.cmd('direct.site.verify',{},h.owner,409);reaches=true;site=await h.cmd('direct.site.verify',{})
  const custom=await h.mf.dispatchFetch('https://stays.example.com/book');assert.equal(custom.status,200);assert.match(await custom.text(),/https:\/\/stays.example.com\/book/)
  assert.equal((await h.mf.dispatchFetch('https://wrong.example.com/book')).status,403)
  assert.equal((await h.mf.dispatchFetch('https://stays.example.com/book/consent',{method:'POST',headers:{origin:'https://attacker.example'},body:'choice=allow'})).status,403)
  const consent=await h.mf.dispatchFetch('https://stays.example.com/book/consent',{method:'POST',headers:{origin:'https://stays.example.com'},body:'choice=deny',redirect:'manual'});assert.equal(consent.status,303);assert.match(consent.headers.get('set-cookie'),/analytics=deny/)
  const cleaner=await h.person('WebsiteCleaner');await h.cmd('direct.site.save',{...input,revision:site.revision},cleaner.cookie,403)
  site=await h.cmd('direct.site.save',{...input,revision:site.revision,origin:'',listings:[]});assert.equal((await h.mf.dispatchFetch('https://stays.example.com/book')).status,403);assert.equal((await h.send('/book/photos/'+photo)).status,404)
  assert.match((await h.send('/book/sitemap.xml')).text,/pine-ridge/)
 }finally{await h.close()}
})

test('WEB-002: authorized embed shares inventory and exact checkout, rejects unapproved origins and private reads, and revokes its return link',async()=>{
 const {quoteHarness}=await import('./quotes-support.mjs'),h=await quoteHarness()
 try{
  let site=await h.cmd('direct.site.save',{name:'Coastal stays',color:'#214d3d',embedOrigins:['https://host.example','https://wordpress.example']})
  const target='https://host.example/bookings?source=website',embed='?'+new URLSearchParams({embedReturn:target})
  const search=await h.send('/book'+embed+'&start='+h.input.start+'&end='+h.input.end+'&guests=3');assert.equal(search.status,200);assert.match(search.text,/Harbor House/)
  const listing=await h.send('/book/harbor-house'+embed);assert.match(listing.headers.get('content-security-policy'),/frame-ancestors https:\/\/host.example/)
  assert.match(listing.text,/embedReturn=/);assert.doesNotMatch(listing.text,/sk_test_|SESSION_SECRET/)
  const before=await h.send('/book/harbor-house/quote',{start:h.input.start,end:h.input.end,guests:3})
  const price=await h.send('/book/harbor-house/quote'+embed,{start:h.input.start,end:h.input.end,guests:3});assert.deepEqual(price.value.quote,before.value.quote)
  for(const target of ['https://evil.example/booking','javascript:alert(1)','https://host.example.evil.example/booking','https://user@host.example/booking'])assert.equal((await h.send('/book?'+new URLSearchParams({embedReturn:target}))).status,403)
  assert.equal((await h.send('/api/cabin/state',undefined,'',{origin:'https://host.example'})).status,401)
  assert.equal((await h.send('/api/cabin/command',{name:'reservation.request',input:{}},'',{origin:'https://host.example'})).status,403)
  const checkout=await h.send('/book/harbor-house/checkout'+embed,{...h.input,homeRevision:h.home.revision,signature:h.input.guestName,consent:'yes'});assert.equal(checkout.status,200,checkout.text)
  h.pay();assert.match((await h.send(checkout.value.bookingUrl.replace(h.origin,''))).text,/Your stay is confirmed/)
  const confirmed=await h.send(checkout.value.bookingUrl.replace(h.origin,''));assert.match(confirmed.text,/https:\/\/host.example\/bookings\?source=website/);assert.match(confirmed.headers.get('content-security-policy'),/frame-ancestors 'none'/)
  assert.equal((await h.send(checkout.value.bookingUrl.replace(h.origin,'')+embed)).status,403)
  assert.equal((await h.state()).bookings.filter(b=>b.kind==='stay').length,1)
  assert.equal((await h.send('/book/harbor-house/quote'+embed,{start:h.input.start,end:h.input.end,guests:3})).status,409)
  site=await h.cmd('direct.site.save',{...site,embedOrigins:[]})
  assert.equal((await h.send('/book'+embed)).status,403)
  assert.doesNotMatch((await h.send(checkout.value.bookingUrl.replace(h.origin,''))).text,/Return to host website/)
 }finally{await h.close()}
})
