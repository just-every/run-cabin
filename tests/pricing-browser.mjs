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
  const screenshots=async(name,target)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await (target??page).screenshot({path:join(directory,name+'-'+width+'.png'),...(target?{}:{fullPage:true})})}await page.setViewportSize({width:1440,height:1000})}
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
  await nativePlannerBrowser(h,page,screenshots)
 }finally{await context.close();await browser.close();await h.close()}
}


async function nativePlannerBrowser(h,page,screenshots){
 const home=() => h.state().then(s=>s.direct.homes[0])
 let cfg=await home()
 await h.cmd('direct.rate.save',{propertyId:cfg.propertyId,revision:cfg.revision,start:'2030-02-01',end:'2030-02-03',weekday:'all',nightlyCents:21000})
 await page.goto(h.origin+'/app/direct');await page.getByText('Native rate settings',{exact:true}).click()
 const limits=page.locator('form').filter({has:page.getByRole('button',{name:'Save native limits',exact:true})})
 await limits.getByLabel('Native base floor (USD)').fill('100.00');await limits.getByLabel('Native base ceiling (USD)').fill('250.00');await screenshots('native-limits',limits)
 await limits.getByRole('button',{name:'Save native limits',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0)
 const planner=page.getByRole('article',{name:'Native planner for Synthetic Cabin',exact:true})
 const range=planner.locator('form').filter({has:page.getByRole('button',{name:'View nightly range',exact:true})})
 await range.getByLabel('Planner first night').fill('2030-01-31');await range.getByLabel('Planner end (excluded)').fill('2030-02-04');await range.getByRole('button',{name:'View nightly range',exact:true}).click()
 await expect(planner.getByRole('list',{name:'Native nightly rates'}).getByRole('listitem')).toHaveCount(4)
 await expect(planner).toContainText('2030-02-01 · $210.00 · Dated rule');await expect(planner).toContainText('2030-02-03 · $180.01 · Default rate')
 await planner.getByText('Change one night',{exact:true}).click()
 const override=planner.locator('form').filter({has:page.getByRole('button',{name:'Preview nightly change',exact:true})})
 const prepare=async amount=>{
  await override.getByLabel('Override night').fill('2030-02-01');await override.getByLabel('Manual base rate (USD)').fill(amount);await override.getByLabel('Rate change reason').fill('Synthetic peak-night correction');await override.getByRole('button',{name:'Preview nightly change',exact:true}).click()
 }
 await prepare('99.99');await expect(page.getByRole('alert')).toContainText('within the saved floor and ceiling')
 await planner.getByText('Change one night',{exact:true}).click();await prepare('240.00')
 const preview=page.getByRole('article',{name:'Native rate change preview',exact:true})
 await expect(preview).toContainText('$210.00 (Dated rule) → $240.00 (Manual override)');await expect(preview).toContainText('Channel adjustments and discounts apply afterward')
 assert.equal((await home()).nativePlanner.history.length,0,'preview has not applied the new rate')
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'native planner fits the desktop')
 await screenshots('native-preview',planner)
 const stale=await preview.locator('form').getAttribute('action'),body=await preview.locator('form').evaluate(f=>Object.fromEntries(new FormData(f)))
 await preview.getByRole('button',{name:'Apply exact nightly change',exact:true}).click()
 assert.equal((await home()).nativePlanner.history.length,1)
 await page.getByText('Native rate history (1)',{exact:true}).click();await expect(planner).toContainText('Synthetic peak-night correction');await screenshots('native-applied-history',planner)
 await page.goto(h.origin+'/app/direct');await page.evaluate(async({path,fields})=>{const response=await fetch(path,{method:'POST',body:new URLSearchParams(fields)});document.open();document.write(await response.text());document.close()},{path:stale,fields:body})
 await expect(page.getByRole('alert')).toContainText('changed');assert.equal((await home()).nativePlanner.history.length,1);await screenshots('native-stale-refusal',page.locator('main'))
 await page.goto(h.origin+'/book/synthetic-cabin');await page.getByLabel('Arrival',{exact:true}).fill('2030-02-01');await page.getByLabel('Checkout',{exact:true}).fill('2030-02-04');await page.getByLabel('Guests',{exact:true}).fill('2');await page.getByRole('button',{name:/Check price and availability/}).click()
 await page.getByText('Native base-rate source',{exact:true}).click();await expect(page.getByText(/2030-02-01 · Manual override · \$240.00/)).toBeVisible();await expect(page.getByText(/2030-02-02 · Dated rule · \$210.00/)).toBeVisible();await expect(page.getByText('$705.02',{exact:true})).toBeVisible();await screenshots('native-public-quote',page.locator('main'))
}
