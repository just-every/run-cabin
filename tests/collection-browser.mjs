import assert from 'node:assert/strict'
import { chromium,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { collectionProviderJourney } from './collection-support.mjs'
const evidence=process.env.CABIN_COLLECTION_SHOTS??'test-results/collections';await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await collectionProviderJourney({screens:async(h,g,state)=>{
 for(const width of [1440,390]){
  const owner=await browser.newContext({viewport:{width,height:1000}}),guest=await browser.newContext({viewport:{width,height:1000}})
  try{
   const [name,value]=h.owner.split('=');await owner.addCookies([{name,value,url:h.origin}])
   const page=await owner.newPage();await page.goto(h.origin+'/app/direct')
   await expect(page.getByRole('heading',{name:'Payments · scheduled collection',exact:true})).toBeVisible()
   const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Payments · scheduled collection',exact:true})}).last()
   if(state==='revision')await panel.getByText('Revise unpaid schedule or replace saved card',{exact:true}).click()
   if(state==='failure'){await expect(panel).toContainText('failed');await expect(panel).toContainText('Follow up by');const consent=panel.getByRole('checkbox',{name:'I reviewed the confirmed failure and approve one new attempt.'});await expect(consent).not.toBeChecked()}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Payments fits viewport')
   const manualPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Payments · manual receipts',exact:true})}).last();await manualPanel.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`manual-receipts-${state}-${width}.png`)})
   await panel.screenshot({path:join(evidence,`payments-full-${state}-${width}.png`)})
   await panel.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`payments-${state}-${width}.png`)})
   for(const part of g.cookie.split('; ')){const i=part.indexOf('=');await guest.addCookies([{name:part.slice(0,i),value:part.slice(i+1),url:h.origin}])}
   const gp=await guest.newPage();await gp.goto(h.origin+g.path)
   await expect(gp.getByRole('heading',{name:'Your payment schedule',exact:true})).toBeVisible()
   if(state==='consent'){await expect(gp.getByRole('checkbox')).not.toBeChecked();await gp.getByLabel('Full guest signature').fill('Synthetic Cabin Guest 10')}
   else if(state==='failure')await expect(gp.getByText(/Stripe confirmed no funds received/)).toBeVisible()
   else await expect(gp.getByText(/Revised reservation deposit/)).toBeVisible()
   assert.ok(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guest Payments fits viewport')
   await gp.screenshot({path:join(evidence,`guest-payments-${state}-${width}.png`),fullPage:true})
   if(state==='consent'){await gp.getByRole('link',{name:'Return to your stay'}).click();await expect(gp.getByRole('link',{name:'Open payments',exact:true})).toBeVisible();await gp.screenshot({path:join(evidence,`guest-stay-payments-${width}.png`),fullPage:true})}
  }finally{await owner.close();await guest.close()}
 }
}})}finally{await browser.close()}
console.log('Payments and guest portal browser proof PASS at 1440 and 390')
