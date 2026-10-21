import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { quoteHarness } from './quotes-support.mjs'

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
