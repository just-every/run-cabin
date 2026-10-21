import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { quoteHarness } from './quotes-support.mjs'

test('RES-006: staff issue and revise a quote, then a mobile or desktop guest signs and completes one checkout', {timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await quoteHarness({assets:true}),staff=await browser.newContext({viewport:{width,height:1000}}),guest=await browser.newContext({viewport:{width,height:1000}})
  try{
   const evidence=process.env.CABIN_QUOTE_SHOTS??'test-results/quotes';await mkdir(evidence,{recursive:true})
   const [name,value]=h.owner.split('=');await staff.addCookies([{name,value,url:h.origin}]);const page=await staff.newPage();page.setDefaultTimeout(12000)
   await page.goto(h.origin+'/app/reservations');await page.getByText('Issue an itemized quote',{exact:true}).click()
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Issue and email quote',exact:true})})
   await form.getByLabel('Quote home').selectOption(h.p.id);await form.getByLabel('Quote guest name').fill(h.input.guestName);await form.getByLabel('Quote guest email').fill(h.input.email)
   await form.getByLabel('Quote arrival').fill(h.input.start);await form.getByLabel('Quote checkout').fill(h.input.end);await form.getByLabel('Quote guest count').fill('3');await form.getByLabel('Hold these nights').check()
   await form.getByRole('button',{name:'Issue and email quote',exact:true}).click()
   await expect(page.getByRole('link',{name:'Open private guest quote'})).toBeVisible()
   await page.screenshot({path:join(evidence,'staff-issued-'+width+'.png'),fullPage:true})
   await page.getByText('Revise dates, guests or expiry',{exact:true}).click();const revise=page.locator('form').filter({has:page.getByRole('button',{name:'Revise and email quote',exact:true})});await revise.getByLabel('Quote guest count').fill('2');await revise.getByRole('button',{name:'Revise and email quote'}).click()
   await page.getByText('Retained quote versions (2)',{exact:true}).click();await expect(page.getByText('$550.00',{exact:true}).first()).toBeVisible()
   await page.screenshot({path:join(evidence,'staff-revised-'+width+'.png'),fullPage:true})
   const quote=(await h.state()).staffQuotes[0],path=await h.link(quote),g=await guest.newPage();g.setDefaultTimeout(12000)
   const cdp=await guest.newCDPSession(g);await cdp.send('Fetch.enable',{patterns:[{urlPattern:'https://checkout.stripe.com/*',requestStage:'Request'}]})
   cdp.on('Fetch.requestPaused',async event=>{const session=[...h.sessions.values()].at(-1);assert.ok(session);assert.ok(!JSON.stringify(event.request.headers).includes(path.split('/').at(-1)),'Stripe receives no private quote path in request headers');await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(`<!doctype html><html><body><h1>Stripe test checkout (synthetic network edge)</h1><a href="${session.success_url}">Complete test payment</a></body></html>`).toString('base64')})})
   await g.route(h.origin+'/book/stay/**',async route=>{if(new URL(route.request().url()).searchParams.has('paid'))h.pay();await route.continue()})
   await g.goto(h.origin+path);await expect(g.getByRole('heading',{name:'Review your stay'})).toBeVisible();await expect(g.getByText('$550.00',{exact:true})).toBeVisible();await expect(g.getByText(/Cancellation policy: 50% cancellation/)).toBeVisible()
   assert.ok(await g.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guest quote fits viewport')
   await g.screenshot({path:join(evidence,'guest-review-'+width+'.png'),fullPage:true})
   await g.getByLabel('Electronic signature (full name)',{exact:true}).fill(h.input.guestName);await g.getByLabel('I agree to this rental agreement').check();await g.getByRole('button',{name:'Sign and continue to Stripe'}).click();await g.getByRole('link',{name:'Complete test payment'}).click()
   await expect(g.getByRole('heading',{name:'Your stay is confirmed'})).toBeVisible();await g.screenshot({path:join(evidence,'guest-confirmed-'+width+'.png'),fullPage:true})
   await g.goto(h.origin+path);await expect(g.getByRole('heading',{name:'Your stay is confirmed'})).toBeVisible()
   const state=await h.state();assert.equal(h.creates,1);assert.equal(state.bookings.filter(b=>b.kind==='stay'&&b.status==='confirmed').length,1);assert.equal(state.staffQuotes[0].versions.length,2);assert.equal(state.direct.stays[0].quote.totalCents,55000)
   await page.goto(h.origin+'/app/reservations');await expect(page.getByRole('link',{name:'Open resulting reservation'})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'staff quotes fit viewport')
  }finally{await staff.close();await guest.close();await h.close()}
 }}finally{await browser.close()}
})
