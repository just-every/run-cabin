import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { harness } from './harness.mjs'
import { dayBoardRequests } from './day-board-support.mjs'

test('OPS-008: desktop and phone day board explain declined requests and open their retained sources',{timeout:120000},async()=>{
 const h=await harness({assets:true})
 let browser
 try {
  const {selected,requests}=await dayBoardRequests(h)
  const staff=await h.person('DayManager','manager')
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_DAY_BOARD_SHOTS??'test-results/day-board';await mkdir(evidence,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}})
   try {
    const [name,value]=staff.cookie.split('=');await context.addCookies([{name,value,url:h.origin}])
    const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/readiness')
    await page.getByLabel('Any day').fill(selected);await page.getByRole('button',{name:'Show',exact:true}).click()
    const panel=page.getByRole('region',{name:'Declined channel requests'})
    await expect(panel.getByRole('link',{name:'Request record',exact:true})).toHaveCount(2)
    for(const r of requests){
     const card=panel.locator('article').filter({has:page.locator(`a[href*="request=${r.id}"]`)})
     await expect(card.getByText(r.reason,{exact:true})).toBeVisible()
    }
    await expect(panel.getByText('Direct request excluded')).toHaveCount(0)
    await expect(panel.getByText(/channel-side decline or expiry is not confirmed/)).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'day board fits the viewport')
    await page.screenshot({path:join(evidence,`declined-requests-${width}.png`),fullPage:true})
    await panel.getByRole('link',{name:'Request record',exact:true}).first().click()
    const source=page.locator(`#request-${requests[0].id}`)
    await expect(source.getByText(requests[0].reason,{exact:true})).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'source record fits the viewport')
    await page.screenshot({path:join(evidence,`request-source-${width}.png`),fullPage:true})
    await page.goBack()
    await page.getByRole('region',{name:'Declined channel requests'}).getByRole('link',{name:'Overlapping reservation record'}).first().click()
    await expect(page.getByRole('heading',{name:/Existing guest/}).first()).toBeVisible()
   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})


test('REPORT-001: desktop and phone reports filter, explain denominators, drill to sources and download complete totals',{timeout:120000},async()=>{
 const {reportBooks,reportMonth}=await import('./reports-support.mjs'),h=await harness({assets:true});let browser
 try{
  const b=await reportBooks(h),manager=await h.person('ReportViewer','manager');browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_REPORT_SHOTS??'test-results/reports';await mkdir(evidence,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true})
   try{
    const [name,value]=manager.cookie.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/reports?'+reportMonth);await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible()
    await page.getByText('Occupancy denominator',{exact:true}).click();await expect(page.getByText(/Occupancy = distinct confirmed guest nights/)).toBeVisible()
    await page.getByText('Accounting basis',{exact:true}).click();await expect(page.getByText(/Financial rows use immutable journal effective dates/)).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'reports fit the viewport')
    await page.screenshot({path:join(evidence,`reports-all-${width}.png`),fullPage:true})
    await page.getByLabel('Property',{exact:true}).selectOption(b.p.id);await page.getByLabel('Channel',{exact:true}).selectOption('vrbo');await page.getByRole('button',{name:'Apply report filters'}).click()
    await expect(page.locator('#reservations article')).toHaveCount(1);await expect(page.locator('#reservations')).toContainText(b.vrbo.id);await expect(page.locator('#reservations')).not.toContainText(b.air.id)
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download complete report (CSV)'}).click()]);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=Buffer.concat(chunks).toString();assert.ok(csv.includes(b.vrbo.id));assert.ok(!csv.includes(b.air.id));assert.ok(csv.includes('"grossCents","60000"'));assert.ok(csv.includes('"netCents","43000"'))
    await page.screenshot({path:join(evidence,`reports-filtered-${width}.png`),fullPage:true})
    await page.locator('#reservations a').first().click();await expect(page.getByRole('heading',{name:/Synthetic Cabin Guest/}).first()).toBeVisible();await page.goBack()
    await page.locator('#journals article').filter({hasText:'earn'}).getByRole('link').first().click();await expect(page.getByRole('heading',{name:'Trust ledger',exact:true})).toBeVisible();await page.goBack()
    await page.getByLabel('Accounting basis',{exact:true}).selectOption('cash');await page.getByRole('button',{name:'Apply report filters'}).click();await expect(page.getByText('Cash · recorded trust receipts and paid costs · journal effective dates 2026-10-01 to 2026-11-01 (exclusive).',{exact:true})).toBeVisible()
    await page.getByLabel('Reservation date basis',{exact:true}).selectOption('booking');await page.getByRole('button',{name:'Apply report filters'}).click();assert.ok(page.url().includes('dates=booking'))
    await page.getByLabel('Rental owner',{exact:true}).selectOption((await b.report()).owners.find(o=>o.name==='Casey Owner').id);await page.getByRole('button',{name:'Apply report filters'}).click();await expect(page.locator('#reservations article')).toHaveCount(0)
   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})
