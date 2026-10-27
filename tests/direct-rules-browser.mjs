import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
export async function directRulesBrowser(h){
 const browser=await chromium.launch({headless:true,...(process.env.CABIN_CHROMIUM?{executablePath:process.env.CABIN_CHROMIUM}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.CABIN_CHROMIUM?['--no-sandbox']:[])]})
 const evidence=process.env.CABIN_DIRECT_SHOTS??'test-results/direct-rules';await mkdir(evidence,{recursive:true})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(10000)
   await page.goto(h.origin+'/app/direct');await page.getByText('Seasonal and weekday rates',{exact:true}).click()
   const rate=page.locator('form').filter({has:page.getByRole('button',{name:'Add dated rate',exact:true})})
   await rate.getByLabel('Rate start',{exact:true}).fill('2030-03-01');await rate.getByLabel('Rate end (excluded)',{exact:true}).fill('2030-03-08');await rate.getByLabel('Rate weekday',{exact:true}).selectOption('5');await rate.getByLabel('Dated nightly rate (USD)',{exact:true}).fill('210.00');await rate.getByRole('button',{name:'Add dated rate',exact:true}).click()
   await page.getByText('Seasonal and weekday rates',{exact:true}).click();await expect(page.getByText(/2030-03-01 to 2030-03-08.*Friday.*210/)).toBeVisible()
   await page.getByText('Edit booking settings',{exact:true}).click();await expect(page.getByLabel('Preparation nights before and after a stay')).toHaveValue('2')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'booking settings fit the viewport');await page.getByLabel('Preparation nights before and after a stay').scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`settings-${width}.png`)})
   await rate.getByLabel('Rate start',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`rates-${width}.png`)})
   // The shell uses text-labelled controls; inspect any icon-only control here.
   const icons=page.locator('button,a').filter({has:page.locator('svg')});for(const control of await icons.all()){const label=await control.getAttribute('aria-label');if(!(await control.innerText()).trim()&&label){await control.focus();assert.equal(await control.evaluate(el=>getComputedStyle(el,'::after').opacity),'1')}}
   await page.goto(h.origin+'/book/pine-ridge');await page.getByLabel('Arrival',{exact:true}).fill('2030-01-15');await page.getByLabel('Checkout',{exact:true}).fill('2030-01-18');await page.getByLabel('Guests',{exact:true}).fill('3');await page.getByRole('button',{name:/Check price and availability/}).click()
   await expect(page.getByRole('heading',{name:'Review your stay',exact:true})).toBeVisible();await expect(page.getByText('$819.50',{exact:true})).toBeVisible();await expect(page.getByText('3 nights at dated rates',{exact:true})).toBeVisible();await expect(page.locator('.price > div').nth(2)).toContainText('$250.00')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guest breakdown fits the viewport');await page.screenshot({path:join(evidence,`quote-${width}.png`),fullPage:true})
   await page.goto(h.origin+'/book/pine-ridge');await page.getByLabel('Arrival',{exact:true}).fill('2030-01-24');await page.getByLabel('Checkout',{exact:true}).fill('2030-01-26');await page.getByRole('button',{name:/Check price and availability/}).click();await expect(page.getByText(/preparation nights/)).toBeVisible();await page.screenshot({path:join(evidence,`refused-${width}.png`),fullPage:true})
   const cfg=(await h.accessState()).direct.homes[0],added=cfg.rates.find(r=>r.start==='2030-03-01');await h.cmd('direct.rate.remove',{propertyId:cfg.propertyId,revision:cfg.revision,rateId:added.id})
  }finally{await context.close()}
 }}finally{await browser.close()}
}

export async function datedRatesJourney(){
 const h=await harness({assets:true,now:'2030-01-01T17:00:00Z',outbound:()=>assert.fail('Reviewing a dated quote needs no provider request')})
 try{
  const p=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Morgan Example',ownerEmail:'morgan@stay.example',commissionBps:2000})
  let cfg=await h.cmd('direct.configure',{propertyId:p.id,enabled:true,slug:'pine-ridge',description:'A quiet Maine cabin near the lake.',nightlyCents:18000,cleaningCents:7500,extraGuestCents:2000,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:2,depositCents:25000,releaseHours:0,taxLabel:'Maine lodging tax',taxBps:900,countyTaxLabel:'County lodging tax',countyTaxBps:100,agreement:'Quiet hours after 10 pm.',requireIdentity:false,advanceNoticeDays:2,bookingWindowDays:90,preparationNights:2})
  cfg=await h.cmd('direct.rate.save',{propertyId:p.id,revision:cfg.revision,start:'2030-01-16',end:'2030-01-17',weekday:'all',nightlyCents:25000})
  await h.cmd('reservation.request',{propertyId:p.id,channel:'airbnb',start:'2030-01-21',end:'2030-01-24',guestName:'Calendar guest'})
  await directRulesBrowser(h)
 }finally{await h.close()}
}
