import assert from 'node:assert/strict'
import { chromium,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { harness } from './harness.mjs'
import { pricingHome } from './pricing-support.mjs'
export async function pricingBrowserJourney(){
 const h=await harness({assets:true,now:'2030-01-01T17:00:00Z',outbound:()=>assert.fail('Pricing review has no provider effect')})
 const browser=await chromium.launch({headless:true,...(process.env.CABIN_CHROMIUM?{executablePath:process.env.CABIN_CHROMIUM}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.CABIN_CHROMIUM?['--no-sandbox']:[])]})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),directory=process.env.CABIN_PRICING_SHOTS??'./test-results/pricing'
 await mkdir(directory,{recursive:true})
 try{
  await pricingHome(h)
  const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(10000)
  const screenshots=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  const settings=async()=>{await page.getByText('Pricing settings',{exact:true}).click()}
  const limits=async floor=>{
   await settings();const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save floor and discounts',exact:true})})
   await form.getByLabel('Nightly floor (USD)').fill(floor);await form.getByLabel('Weekly discount (%)').fill('10.00');await form.getByLabel('Monthly discount (%)').fill('20.00')
   await form.getByRole('button',{name:'Save floor and discounts',exact:true}).click()
  }
  const adjustment=async(channel,kind,direction,value,fees,commission)=>{
   await settings();await page.getByText(channel+' pricing settings',{exact:true}).click()
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save '+channel+' adjustment',exact:true})})
   await form.getByLabel('Adjustment type').selectOption(kind);await form.getByLabel('Adjustment direction').selectOption(direction);await form.getByLabel('Adjustment amount').fill(value);if(fees)await form.getByLabel('Adjust cleaning fee',{exact:true}).check()
   await form.getByLabel('Expected channel commission (%)').fill(commission);await screenshots(channel.toLowerCase().replace('.','')+'-settings')
   await form.getByRole('button',{name:'Save '+channel+' adjustment',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0)
  }
  const preview=async channel=>{
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Preview saved channel price',exact:true})})
   await form.getByLabel('Preview channel').selectOption(channel);await form.getByLabel('Preview arrival').fill('2030-02-01');await form.getByLabel('Preview checkout').fill('2030-02-03');await form.getByLabel('Preview guests').fill('3');await form.getByRole('button',{name:'Preview saved channel price',exact:true}).click()
   await page.getByText('Saved price calculation',{exact:true}).click()
   return page.getByRole('article',{name:'Channel price result'})
  }
  await page.goto(h.origin+'/app/direct');await limits('0.00')
  await adjustment('Booking.com','percent','markup','15.00',true,'15.00')
  let result=await preview('booking-com');await expect(result).toContainText('Rent $414.02 · cleaning $86.26 · extra guests $40.02.');await expect(result).toContainText('Guest total $540.30');await expect(result).toContainText('expected payout before processor fees $459.25')
  await expect(page.getByText(/No channel has acknowledged these prices/)).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await screenshots('booking-preview')
  await adjustment('Vrbo','fixed','markdown','20.00',false,'8.00')
  result=await preview('vrbo');await expect(result).toContainText('Rent $320.02 · cleaning $75.01 · extra guests $40.02.');await expect(result).toContainText('Guest total $435.05');await expect(result).toContainText('expected payout before processor fees $400.25');await screenshots('vrbo-preview')
  await adjustment('Vrbo','fixed','markdown','200.00',false,'8.00')
  result=await preview('vrbo');await expect(result.getByRole('status')).toContainText('Floor conflict');await expect(result).toContainText('requested -$19.99, floor enforced');await expect(result).toContainText('Rent $0.00');await screenshots('zero-floor-preview')
  await limits('150.00');await settings();await expect(page.getByLabel('Nightly floor (USD)')).toHaveValue('150.00')
  await expect(page.getByText(/OTA publication and accepted rate readback are unavailable/)).toBeVisible()
  const icons=page.locator('button,a').filter({has:page.locator('svg')});for(const control of await icons.all()){if(!(await control.innerText()).trim()){await control.focus();assert.equal(await control.evaluate(el=>getComputedStyle(el,'::after').opacity),'1')}}
  await screenshots('floor-settings')
  const publicQuote=async end=>{
   await page.goto(h.origin+'/book/synthetic-cabin');await page.getByLabel('Arrival',{exact:true}).fill('2030-04-01');await page.getByLabel('Checkout',{exact:true}).fill(end);await page.getByLabel('Guests',{exact:true}).fill('2');await page.getByRole('button',{name:/Check price and availability/}).click();await expect(page.getByRole('heading',{name:'Review your stay',exact:true})).toBeVisible()
  }
  await publicQuote('2030-04-08');await expect(page.getByText('Weekly saving (10%)',{exact:true})).toBeVisible();await expect(page.getByText('$1,209.08',{exact:true})).toBeVisible();await screenshots('weekly-direct')
  await publicQuote('2030-04-29');await expect(page.getByText('Monthly saving (20%)',{exact:true})).toBeVisible();await expect(page.getByText('$4,275.01',{exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('Floor conflict');await page.getByText('Saved price calculation',{exact:true}).click();await expect(page.getByText(/requested \$144.01, floor enforced/).first()).toBeVisible()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshots('monthly-floor-direct')
 }finally{await context.close();await browser.close();await h.close()}
}
