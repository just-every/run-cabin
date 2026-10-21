import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { quoteHarness } from './quotes-support.mjs'
import { harness } from './harness.mjs'
import { homeDay } from './home-calendar.mjs'

test('WEB-002: external and WordPress Custom HTML embeds search, sign, pay once and return on phone and desktop', {timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390])for(const surface of ['external','wordpress']){
  const bookingOrigin='https://booking.example',h=await quoteHarness({assets:true,siteOrigin:bookingOrigin}),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const evidence=process.env.CABIN_EMBED_SHOTS??'test-results/website';await mkdir(evidence,{recursive:true})
   const origin='https://'+surface+'.example',returnUrl=origin+'/booking',embedUrl=bookingOrigin+'/book?'+new URLSearchParams({embedReturn:returnUrl})
   await h.cmd('direct.site.save',{name:'Coastal stays',color:'#214d3d',embedOrigins:[origin],origin:bookingOrigin})
   await h.cmd('direct.site.verify',{})
   const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}])
   const staff=await context.newPage();staff.setDefaultTimeout(12000);await staff.goto(h.origin+'/app/direct')
   await staff.getByText('Edit website, pages and public photos',{exact:true}).click()
   await expect(staff.getByLabel('Allowed embedding origins (one HTTPS origin per line)')).toHaveValue(origin)
   await staff.screenshot({path:join(evidence,`${surface}-editor-${width}.png`),fullPage:true})
   await staff.getByRole('button',{name:'Publish website settings',exact:true}).click()
   await staff.getByText('Embed on your website or WordPress',{exact:true}).click()
   const markup=await staff.getByLabel(origin+' embed code').inputValue();assert.ok(markup.includes(bookingOrigin+'/book?'))
   await staff.screenshot({path:join(evidence,`${surface}-settings-${width}.png`),fullPage:true})
   const guest=await browser.newContext({viewport:{width,height:1000}}),g=await guest.newPage();g.setDefaultTimeout(12000)
   try{
    await g.route(origin+'/**',async route=>{
     let body=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Book your coastal stay</h1>${markup}</body></html>`
     if(surface==='wordpress'&&process.env.CABIN_WORDPRESS_URL){body=await (await fetch(process.env.CABIN_WORDPRESS_URL)).text();body=body.replace('CABIN_EMBED_URL',embedUrl.replaceAll('&','&amp;'))}
     await route.fulfill({contentType:'text/html',body})
    })
    const cdp=await guest.newCDPSession(g);await cdp.send('Fetch.enable',{patterns:[{urlPattern:'https://checkout.stripe.com/*',requestStage:'Request'}]})
    cdp.on('Fetch.requestPaused',async event=>{
     const session=[...h.sessions.values()].at(-1);assert.ok(session)
     assert.ok(!JSON.stringify(event.request.headers).includes('/book/stay/'),'private stay link stays out of Stripe request headers')
     await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(`<h1>Stripe test checkout (synthetic network edge)</h1><a href="${session.success_url}">Complete test payment</a>`).toString('base64')})
    })
    const routeFailures=[]
    // Serve the booking origin from the harness worker. A dropped connection to the local runtime is retried once for reads only (never a form post, so checkout cannot double-create); any other failure aborts the request and is asserted below with its cause instead of surfacing as an unhandled rejection.
    await g.route(bookingOrigin+'/**',async route=>{
     const request=route.request(),idempotent=['GET','HEAD'].includes(request.method())
     try{
      if(new URL(request.url()).searchParams.has('paid'))h.pay()
      const dispatch=()=>h.mf.dispatchFetch(request.url(),{method:request.method(),headers:request.headers(),...(request.postDataBuffer()?{body:request.postDataBuffer()}:{}),redirect:'manual'})
      let response;try{response=await dispatch()}catch(error){if(!idempotent||error.message!=='fetch failed')throw error;response=await dispatch()}
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})
     }catch(error){routeFailures.push(`${request.method()} ${request.url()}: ${error.message} ${error.cause?.code??error.cause?.message??''}`.trim());await route.abort().catch(()=>{})}
    })
    await g.goto(returnUrl)
    const frame=g.frameLocator('iframe[title="Search and book a vacation home"]')
    await expect(frame.getByRole('heading',{name:'Find an available home'})).toBeVisible()
    await frame.getByLabel('Arrival',{exact:true}).fill(h.input.start);await frame.getByLabel('Checkout',{exact:true}).fill(h.input.end);await frame.getByLabel('Guests',{exact:true}).fill('3')
    // The unfiltered catalog already lists Harbor House, so wait for the search navigation itself before choosing a result.
    const embedded=g.frames().find(f=>f!==g.mainFrame());assert.ok(embedded)
    await frame.getByRole('button',{name:'Search homes',exact:true}).focus()
    await Promise.all([embedded.waitForURL(url=>new URL(url).searchParams.get('start')===h.input.start),g.keyboard.press('Enter')])
    await expect(frame.getByRole('link',{name:'Harbor House',exact:true})).toBeVisible()
    await g.screenshot({path:join(evidence,`${surface}-search-${width}.png`),fullPage:true})
    await frame.getByRole('link',{name:'Harbor House',exact:true}).click()
    await expect(frame.getByRole('heading',{name:'Harbor House',exact:true,level:1})).toBeVisible()
    await expect(frame.getByLabel('Arrival',{exact:true})).toHaveValue(h.input.start)
    await expect(frame.getByLabel('Checkout',{exact:true})).toHaveValue(h.input.end)
    await g.screenshot({path:join(evidence,`${surface}-listing-${width}.png`),fullPage:true})
    await frame.getByRole('button',{name:'Check price and availability',exact:true}).click()
    await expect(frame.getByRole('heading',{name:'Review your stay'})).toBeVisible()
    const child=g.frames().find(f=>f.url().includes('/book/harbor-house/quote'));assert.ok(child)
    assert.ok(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'embedded quote fits viewport')
    await g.screenshot({path:join(evidence,`${surface}-quote-${width}.png`),fullPage:true})
    await frame.getByLabel('Full guest name',{exact:true}).fill(h.input.guestName);await frame.getByLabel('Email',{exact:true}).fill(h.input.email);await frame.getByLabel('Electronic signature (full name)',{exact:true}).fill(h.input.guestName);await frame.getByLabel('I agree to this rental agreement').check()
    await frame.getByRole('button',{name:'Sign and continue to Stripe'}).click()
    await expect(g.getByRole('heading',{name:'Stripe test checkout (synthetic network edge)'})).toBeVisible();assert.equal(g.frames().length,1)
    await g.getByRole('link',{name:'Complete test payment'}).click();await expect(g.getByRole('heading',{name:'Your stay is confirmed'})).toBeVisible()
    await g.screenshot({path:join(evidence,`${surface}-confirmed-${width}.png`),fullPage:true})
    const state=await h.state();assert.equal(h.creates,1);assert.equal(state.bookings.filter(b=>b.kind==='stay').length,1);assert.equal(state.direct.stays[0].quote.totalCents,58300)
    await g.getByRole('link',{name:'Return to host website',exact:true}).click();assert.equal(g.url(),returnUrl)
    await g.unrouteAll({behavior:'wait'});assert.deepEqual(routeFailures,[],'every booking-origin request reached the worker')
   }finally{await guest.close()}
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
})

test('GUEST-002: desktop and phone guests verify their own email, finish blocked tasks, read the released guide and report an issue', {timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({assets:true,hostname:'localhost'}),guest=await browser.newContext({viewport:{width,height:1000}}),g=await guest.newPage();g.setDefaultTimeout(12000)
  try{
   const evidence=process.env.CABIN_GUEST_SHOTS??'test-results/guest';await mkdir(evidence,{recursive:true})
   const home=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Karen Ortiz',ownerEmail:'synthetic-cabin-host@stay.example',commissionBps:2000})
   await h.cmd('home.settings',{propertyId:home.id,address:'120 Lake Drive, Asheville, NC',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',checklist:['Ready']})
   await h.cmd('direct.agreement.template',{propertyId:home.id,agreementTitle:'Synthetic cabin rental terms',agreementState:'ME',agreement:'Quiet hours after 10 pm. No smoking.',agreementRequired:true,agreementBlockAccess:true})
   await h.cmd('portal.guide',{propertyId:home.id,version:0,arrival:'Park beside the green shed. Use the front entrance.',guidebook:'Leave recycling in the blue bin. The walking map is attached.'})
   let guide
   const stay=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',start:homeDay(3,'America/New_York'),end:homeDay(6,'America/New_York'),guestName:'Megan Ortiz',guestEmail:'megan@stay.example'})
   let s=await h.accessState();const link=s.guestPortalLinks.find(l=>l.bookingId===stay.bookingId),path='/stay/'+link.token
   const staff=await browser.newContext({viewport:{width,height:1000}})
   try{const [name,value]=h.owner.split('=');await staff.addCookies([{name,value,url:h.origin}]);const page=await staff.newPage();await page.goto(h.origin+'/app/turnovers');const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Guest portal by home',exact:true})});await panel.locator('summary').click();const upload=panel.locator('form').filter({has:page.getByRole('button',{name:'Add guide file',exact:true})});await upload.locator('[name=guideFile]').setInputFiles({name:'Pine Ridge walking guide.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic cabin walking map\n')});await upload.getByRole('button',{name:'Add guide file',exact:true}).click();await panel.locator('summary').click();await expect(panel).toContainText('guide version 2');await expect(panel.getByRole('link',{name:'Open guest portal',exact:true})).toHaveAttribute('href',path);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guide editor fits viewport');await panel.screenshot({path:join(evidence,`guest-guide-editor-${width}.png`)});guide=(await h.accessState()).homeSettings.find(h=>h.propertyId===home.id).guide}finally{await staff.close()}
   assert.ok(!s.codes.some(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued'))
   await g.goto(h.origin+path)
   await expect(g.getByRole('button',{name:'Send code',exact:true})).toBeVisible()
   await expect(g.getByText('Megan Ortiz',{exact:true})).toHaveCount(0)
   assert.ok(!(await g.content()).includes('120 Lake Drive, Asheville, NC'))
   assert.equal((await guest.request.get(h.origin+path+'/api')).status(),401)
   await g.screenshot({path:join(evidence,`guest-verification-${width}.png`),fullPage:true})
   const sentResponse=g.waitForResponse(r=>new URL(r.url()).pathname===path+'/send-code');await g.getByRole('button',{name:'Send code',exact:true}).click();const sent=await sentResponse;assert.equal(sent.status(),200,await sent.text())
   await expect(g.getByRole('status')).toContainText('accepted by the mail provider');await g.screenshot({path:join(evidence,`guest-code-entry-${width}.png`),fullPage:true})
   const mail=JSON.parse((await h.db.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.subject')='Your Cabin reservation verification code' ORDER BY sequence DESC LIMIT 1").first()).message)
   await g.getByLabel('6-digit code',{exact:true}).fill(mail.text.match(/code is (\d{6})/)[1])
   await g.getByRole('button',{name:'Verify email',exact:true}).click()
   await expect(g.getByRole('heading',{name:'Before you arrive',exact:true})).toBeVisible()
   await expect(g.locator('.code-card')).toHaveCount(0)
   await expect(g.getByRole('link',{name:'Review and sign',exact:true})).toBeVisible()
   await g.screenshot({path:join(evidence,`guest-tasks-${width}.png`),fullPage:true})
   const other=await browser.newContext({viewport:{width,height:1000}})
   try{const second=await other.newPage();await second.goto(h.origin+path);await expect(second.getByRole('button',{name:'Send code',exact:true})).toBeVisible();await expect(second.getByRole('heading',{name:'Before you arrive',exact:true})).toHaveCount(0)}finally{await other.close()}
   await g.getByRole('link',{name:'Review and sign',exact:true}).click()
   await g.getByLabel('Electronic signature (full guest name)',{exact:true}).fill('Megan Ortiz')
   await g.getByLabel('Reservation email',{exact:true}).fill('megan@stay.example')
   await g.getByLabel('I reviewed this exact agreement and consent to electronic records and my electronic signature. I can download and retain my signed copy.',{exact:true}).check()
   await g.getByRole('button',{name:'Sign this agreement',exact:true}).click()
   await g.getByRole('link',{name:'Open your arrival details',exact:true}).click()
   await expect(g.locator('.code-card')).toBeVisible()
   await expect(g.getByText('Guide version 2',{exact:false})).toBeVisible()
   await expect(g.getByText('Park beside the green shed. Use the front entrance.',{exact:true})).toBeVisible()
   assert.ok(await g.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'portal fits viewport')
   const file=await guest.request.get(h.origin+path+'/files/'+guide.files[0].id);assert.equal(await file.text(),'Synthetic cabin walking map\n')
   await g.screenshot({path:join(evidence,`guest-guide-${width}.png`),fullPage:true})
   await g.getByLabel('What needs attention?',{exact:true}).fill('The porch light needs attention.')
   await g.getByRole('button',{name:'Report to your host',exact:true}).click()
   await expect(g.getByRole('status')).toContainText('Problem reported')
   await g.screenshot({path:join(evidence,`guest-reported-${width}.png`),fullPage:true})
   s=await h.accessState();const booking=s.bookings.find(b=>b.id===stay.bookingId)
   await h.cmd('reservation.cancel',{id:booking.id,revision:booking.revision})
   const cancelled=await g.goto(h.origin+path);assert.equal(cancelled.status(),404)
   assert.ok(!(await g.content()).includes('Megan Ortiz'));await g.screenshot({path:join(evidence,`guest-cancelled-${width}.png`),fullPage:true})
  }finally{await guest.close();await h.close()}
 }}finally{await browser.close()}
})
