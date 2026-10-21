import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { quoteHarness } from './quotes-support.mjs'

test('WEB-002: external and WordPress Custom HTML embeds search, sign, pay once and return on phone and desktop', {timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390])for(const surface of ['external','wordpress']){
  const h=await quoteHarness({assets:true}),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const evidence=process.env.CABIN_EMBED_SHOTS??'test-results/website';await mkdir(evidence,{recursive:true})
   const origin='https://'+surface+'.example',returnUrl=origin+'/booking',embedUrl=h.origin+'/book?'+new URLSearchParams({embedReturn:returnUrl})
   await h.cmd('direct.site.save',{name:'Coastal stays',color:'#214d3d',embedOrigins:[origin]})
   const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}])
   const staff=await context.newPage();staff.setDefaultTimeout(12000);await staff.goto(h.origin+'/app/direct')
   await staff.getByText('Edit website, pages and public photos',{exact:true}).click()
   await expect(staff.getByLabel('Allowed embedding origins (one HTTPS origin per line)')).toHaveValue(origin)
   await staff.getByRole('button',{name:'Publish website settings',exact:true}).click()
   await staff.getByText('Embed on your website or WordPress',{exact:true}).click()
   const markup=await staff.getByLabel(origin+' embed code').inputValue();assert.ok(markup.includes(h.origin+'/book?'))
   await staff.screenshot({path:join(evidence,`${surface}-settings-${width}.png`),fullPage:true})
   const guest=await browser.newContext({viewport:{width,height:1000}}),g=await guest.newPage();g.setDefaultTimeout(12000)
   try{
    await g.route(origin+'/**',async route=>{
     let body=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Book your coastal stay</h1>${markup}</body></html>`
     if(surface==='wordpress'&&process.env.CABIN_WORDPRESS_URL){body=await (await fetch(process.env.CABIN_WORDPRESS_URL)).text();body=body.replace('CABIN_EMBED_URL',embedUrl.replaceAll('&','&amp;'))}
     await route.fulfill({contentType:'text/html',body})
    })
    await g.route('https://checkout.stripe.com/**',async route=>{
     const session=[...h.sessions.values()].at(-1);assert.ok(session)
     assert.ok(!JSON.stringify(route.request().headers()).includes('/book/stay/'),'private stay link stays out of Stripe request headers')
     await route.fulfill({contentType:'text/html',body:`<h1>Stripe test checkout (synthetic network edge)</h1><a href="${session.success_url}">Complete test payment</a>`})
    })
    await g.route(h.origin+'/book/stay/**',async route=>{if(new URL(route.request().url()).searchParams.has('paid'))h.pay();await route.continue()})
    await g.goto(returnUrl)
    const frame=g.frameLocator('iframe[title="Search and book a vacation home"]')
    await expect(frame.getByRole('heading',{name:'Find an available home'})).toBeVisible()
    await frame.getByLabel('Arrival',{exact:true}).fill(h.input.start);await frame.getByLabel('Checkout',{exact:true}).fill(h.input.end);await frame.getByLabel('Guests',{exact:true}).fill('3')
    await frame.getByRole('button',{name:'Search homes',exact:true}).focus();await g.keyboard.press('Enter')
    await expect(frame.getByRole('link',{name:'Harbor House',exact:true})).toBeVisible()
    await g.screenshot({path:join(evidence,`${surface}-search-${width}.png`),fullPage:true})
    await frame.getByRole('link',{name:'Harbor House',exact:true}).click()
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
   }finally{await guest.close()}
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
})
