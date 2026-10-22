import assert from 'node:assert/strict'
import { chromium,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { collectionProviderJourney,collectionBooking } from './collection-support.mjs'
const evidence=process.env.CABIN_COLLECTION_SHOTS??'test-results/collections';await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await collectionProviderJourney({screens:async(h,g,state)=>{
 for(const [index,width] of [1440,390].entries()){
  const manualBooking=state==='consent'?await collectionBooking(h,(await h.state()).properties[0],50+index*5):null
  const scheduleBooking=state==='consent'?await collectionBooking(h,(await h.state()).properties[0],85+index*5):null
  const owner=await browser.newContext({viewport:{width,height:1000}}),guest=await browser.newContext({viewport:{width,height:1000}})
  try{
   const [name,value]=h.owner.split('=');await owner.addCookies([{name,value,url:h.origin}])
   const page=await owner.newPage();await page.goto(h.origin+'/app/direct')
   await expect(page.getByRole('heading',{name:'Payments · scheduled collection',exact:true})).toBeVisible()
   const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Payments · scheduled collection',exact:true})}).last()
   if(scheduleBooking){
    // Configure a deposit and pre-arrival balance through the Payments form itself at this width.
    const create=panel.locator('form[action*="direct.collection.create"]')
    await create.locator('select[name="bookingId"]').selectOption(scheduleBooking.id)
    await create.getByLabel('Reservation deposit (USD)',{exact:true}).fill('30.00');await create.getByLabel('Balance days before arrival',{exact:true}).fill('7')
    await create.getByRole('button',{name:'Save schedule for guest approval',exact:true}).click()
    const saved=panel.locator('article').filter({has:page.getByRole('heading',{name:scheduleBooking.guestName,exact:true})})
    await expect(saved).toContainText('consent_required');await expect(saved).toContainText('Reservation deposit · $30.00');await expect(saved).toContainText('Pre-arrival balance · $100.00')
    const configured=(await h.state()).direct.collections.find(p=>p.bookingId===scheduleBooking.id)
    assert.deepEqual(configured.jobs.map(j=>[j.label,j.amountCents,j.status]),[['Reservation deposit',3000,'scheduled'],['Pre-arrival balance',10000,'scheduled']]);assert.equal(configured.status,'consent_required')
   }
   if(state==='revision')await panel.locator('article').filter({has:page.getByRole('heading',{name:'Synthetic Cabin Guest 10',exact:true})}).getByText('Revise unpaid schedule or replace saved card',{exact:true}).click()
   if(state==='failure'){await expect(panel).toContainText('failed');await expect(panel).toContainText('Follow up by');const consent=panel.getByRole('checkbox',{name:'I reviewed the confirmed failure and approve one new attempt.'});await expect(consent).not.toBeChecked()}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Payments fits viewport')
   const manualPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Payments · manual receipts',exact:true})}).last();if(manualBooking){const entry=manualPanel.locator('details').filter({has:page.locator('input[name="bookingId"][value="'+manualBooking.id+'"]')});await entry.locator('summary').click();await entry.getByLabel('Received amount (USD)',{exact:true}).fill('10.00');await entry.getByLabel('Receipt or cleared-check reference',{exact:true}).fill('synthetic-cabin-receipt-'+width);await entry.getByLabel('Source evidence and custody record',{exact:true}).fill('Counted cash received in trust custody');const confirmation=entry.getByRole('checkbox');await expect(confirmation).not.toBeChecked();await confirmation.check();await entry.getByRole('button',{name:'Record actual manual receipt',exact:true}).click();await expect(manualPanel.locator('article').filter({hasText:'synthetic-cabin-receipt-'+width})).toContainText('$10.00')}
   await manualPanel.screenshot({path:join(evidence,`manual-receipts-full-${state}-${width}.png`)})
   await manualPanel.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`manual-receipts-${state}-${width}.png`)})
   await panel.screenshot({path:join(evidence,`payments-full-${state}-${width}.png`)})
   await panel.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`payments-${state}-${width}.png`)})
   if(state==='failure'){
    await page.goto(h.origin+'/app/maintenance')
    await expect(page.getByText('Reservation payment needs review',{exact:true}).first()).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Assigned payment task fits viewport')
    await page.screenshot({path:join(evidence,`payment-followup-task-${width}.png`),fullPage:true})
   }
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
