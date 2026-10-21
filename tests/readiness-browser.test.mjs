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
