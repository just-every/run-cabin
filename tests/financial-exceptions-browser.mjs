import assert from 'node:assert/strict'
import { chromium,expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { exceptionJourney } from './financial-exceptions-support.mjs'
const directory=process.env.CABIN_EXCEPTION_SHOTS??'./test-results/financial-exceptions';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});let page,origin
  const visit=async h=>{
   if(origin!==h.origin){origin=h.origin;const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:origin}]);page=await context.newPage()}
   await page.goto(origin+'/app/ledger');await expect(page.getByRole('heading',{name:'Financial exception cases',exact:true})).toBeVisible()
  }
  try{
   await exceptionJourney({act:async(h,name,input)=>{
    await visit(h)
    let form=page.locator(`form[action*="name=${name}"]`)
    for(const key of ['id','proposalId','requestId'])if(input[key])form=form.filter({has:page.locator(`input[type="hidden"][name="${key}"][value="${input[key]}"]`)})
    assert.equal(await form.count(),1,'One exact native case form for '+name)
    const details=form.locator('xpath=ancestor::details[1]')
    if(await details.count()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click()
    for(const [key,value] of Object.entries(input)){
     const control=form.locator(`[name="${key}"]`)
     if(!await control.count()||await control.getAttribute('type')==='hidden')continue
     const tag=await control.evaluate(el=>el.tagName),type=await control.getAttribute('type')
     if(type==='checkbox')await control.check()
     else if(tag==='SELECT')await control.selectOption(String(value))
     else await control.fill(String(value))
    }
    // Submit by keyboard, retaining ordinary native validation and focus.
    const button=form.getByRole('button');await button.focus();await button.press('Enter')
    await expect(page.locator('[role="status"]')).toContainText('Financial case updated')
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Case forms fit '+width)
    return (await h.state()).financialExceptions.find(r=>input.id?r.id===input.id:r.bookingId===input.bookingId)
   },screens:async(h,stage,scope)=>{
    await visit(h)
    const section=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Financial exception cases',exact:true})})
    await section.scrollIntoViewIfNeeded()
    for(const control of await page.locator('button,a').all()){
     if(!await control.isVisible())continue
     assert.ok((await control.innerText()).trim()||await control.getAttribute('data-tooltip'),'Every icon-only control requires a tooltip')
    }
    const axe=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    assert.deepEqual(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(v=>v.id),[])
    // Capture document coordinates from the top so the fixed phone menu does not cover the case heading.
    await page.evaluate(()=>scrollTo(0,0))
    await page.screenshot({path:join(directory,`${stage}-${width}.png`),fullPage:true,clip:await section.boundingBox()})
    if(stage==='source-moved'){
     await expect(section.getByRole('alert')).toContainText('Reservation moved to another home')
     await expect(section.getByRole('button',{name:'Approve exact correction',exact:true})).toHaveCount(0)
    }
    if(stage==='corrected-awaiting-distribution'){
     await expect(section.getByText('This case remains open:',{exact:false})).toBeVisible()
     await page.goto(origin+'/app/statements')
     await expect(page.locator('details.statement-month > summary').filter({hasText:'2 approved'})).toHaveText(/ · 2 approved · owner payouts \$875\.00$/)
     await page.screenshot({path:join(directory,`frozen-statements-${width}.png`),fullPage:true})
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Frozen statement forms fit '+width)
     for(const basis of ['cash','accrual']){
      await page.goto(origin+'/app/reports?'+new URLSearchParams({...scope,basis}))
      await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Corrected report fits '+width)
      for(const control of await page.locator('button,a').all())if(await control.isVisible())assert.ok((await control.innerText()).trim()||await control.getAttribute('data-tooltip'),'Report icon-only controls require tooltips')
      await page.screenshot({path:join(directory,`corrected-report-${basis}-${width}.png`),fullPage:true})
     }
    }
   }})
  }finally{await context.close()}
 }
}finally{await browser.close()}
console.log('Financial exception source pursuit, exact rejection and approval, open distribution boundary, keyboard, tooltip audit and accessibility PASS at 1440/390')
