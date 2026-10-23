import assert from 'node:assert/strict'
import { chromium,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { bankingJourney } from './banking-support.mjs'
const directory=process.env.CABIN_BANK_SHOTS??'test-results/banking';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});let page,origin
  const visit=async h=>{
   if(origin!==h.origin){origin=h.origin;const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:origin}]);page=await context.newPage()}
   await page.goto(origin+'/app/ledger');await expect(page.getByRole('heading',{name:'Trust-bank reconciliation',exact:true})).toBeVisible()
  }
  try{
   await bankingJourney({act:async(h,name,input)=>{
    await visit(h)
    let form=page.locator(`form[action*="name=${name}"]`)
    for(const key of ['id','ownerKey','propertyId'])if(input[key]&&await form.locator(`input[type="hidden"][name="${key}"]`).count())form=form.filter({has:page.locator(`input[type="hidden"][name="${key}"][value="${input[key]}"]`)})
    assert.equal(await form.count(),1,'One exact native form for '+name)
    const details=form.locator('xpath=ancestor::details[1]')
    if(await details.count()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click()
    for(const [key,value] of Object.entries(input)){
     const control=form.locator(`[name="${key}"]`)
     if(!await control.count()||await control.getAttribute('type')==='hidden')continue
     const tag=await control.evaluate(el=>el.tagName),type=await control.getAttribute('type')
     if(type==='checkbox'){await expect(control).not.toBeChecked();await control.check()}
     else if(tag==='SELECT')await control.selectOption(String(value))
     else await control.fill(String(value))
    }
    await form.getByRole('button').click();await expect(page.locator('[role="alert"]')).toHaveCount(0)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Bank forms fit '+width)
   },screens:async(h,stage)=>{
    await visit(h)
    if(stage==='planned')await expect(page.getByText('Approved plan — awaiting banking partner',{exact:false})).toBeVisible()
    // Native forms and the shared shell use visible words beside every icon.
    const icons=page.locator('button:has(svg),a:has(svg)')
    for(const control of await icons.all())assert.ok((await control.innerText()).trim()||await control.getAttribute('data-tooltip'),'Icon-only controls require a tooltip')
    const sections=page.locator('section.panel').filter({has:page.locator('h2')})
    for(const section of await sections.all()){
     const title=await section.locator('h2').first().innerText()
     if(!['Trust-bank reconciliation','Cedar guest trust','Lake guest trust','Owner distribution plans'].includes(title))continue
     await section.scrollIntoViewIfNeeded();await section.screenshot({path:join(directory,`${stage}-${width}-${title.replaceAll(' ','-')}.png`)})
    }
    await page.screenshot({path:join(directory,`banking-${stage}-${width}.png`),fullPage:true})
   }})
  }finally{await context.close()}
 }
}finally{await browser.close()}
console.log('Trust-bank account, CSV import, journal assignment/matching, reconciliation and approved unexecuted-plan browser journey PASS at 1440 and 390')
