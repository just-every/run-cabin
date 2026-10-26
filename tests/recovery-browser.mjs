import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {mkdir} from 'node:fs/promises'
import {alternativeRecoveryJourney} from './recovery-alternative-support.mjs'
import {interruptedMessageJourney} from './message-interruption-support.mjs'
const directory=process.env.CABIN_RECOVERY_SHOTS??'./test-results/recovery';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),guestContext=await browser.newContext({viewport:{width,height:1000}})
  let page,guestPage,origin
  async function ownerPage(h,path='/app/recovery'){
   if(origin!==h.origin){await context.clearCookies();origin=h.origin;const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:origin}]);page=await context.newPage()}
   await page.goto(origin+path)
   if(path==='/app/inbox'&&await page.locator('.thread-row').count())await page.locator('.thread-row.current,.thread-row').first().click()
   return page
  }
  async function nativeAction(h,name,input){
   await ownerPage(h,name.startsWith('message.')?'/app/inbox':'/app/recovery')
   let form=page.locator(`form[action*="name=${name}"]`)
   if(input.id)form=form.filter({has:page.locator(`input[name="id"][value="${input.id}"]`)})
   assert.equal(await form.count(),1,'One exact native action form for '+name)
   await form.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;for(const d of el.querySelectorAll('details'))d.open=true})
   for(const [key,value]of Object.entries(input)){
    const field=key==='creditCents'?'creditDollars':key==='extraCleaningCents'?'extraCleaningDollars':key
    const control=form.locator(`[name="${field}"]`)
    if(!await control.count()||await control.getAttribute('type')==='hidden')continue
    const type=await control.getAttribute('type'),tag=await control.evaluate(el=>el.tagName)
    if(type==='checkbox')await control.check()
    else if(tag==='SELECT')await control.selectOption(String(value))
    else await control.fill(field===key?String(value):(Number(value)/100).toFixed(2))
   }
   const button=form.getByRole('button').last();await button.focus();await button.press('Enter')
   await expect(page.locator('[role="alert"]')).toHaveCount(0)
   return name.startsWith('message.')?(await h.state()).messages.find(r=>r.id===input.id):(await h.state()).recoveries.find(r=>r.id===input.id)
  }
  async function screenshot(target,name){
   await target.screenshot({path:`${directory}/${name}-${width}.png`,fullPage:true})
   const fit=await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)
   if(!fit){
    const overflowing=await target.locator('main *').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({tag:el.tagName,class:el.className,name:el.getAttribute('name'),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})))
    console.log(JSON.stringify(overflowing))
   }
   assert.ok(fit,'Screen fits '+width)
   for(const control of await target.locator('button,a').all())if(await control.isVisible())assert.ok((await control.innerText()).trim()||await control.getAttribute('data-tooltip'),'Icon-only controls need a tooltip')
   const tooltip=target.locator('[data-tooltip]:visible').first()
   if(await tooltip.count()){
    await tooltip.hover();await target.waitForTimeout(400)
    assert.equal(await tooltip.evaluate(el=>getComputedStyle(el,'::after').visibility),'visible')
    await target.mouse.move(0,0);await tooltip.focus()
    assert.equal(await tooltip.evaluate(el=>getComputedStyle(el,'::after').opacity),'1','Keyboard focus shows the tooltip immediately')
   }
   const axe=await new AxeBuilder({page:target}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
   assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[])
   await target.evaluate(()=>window.scrollTo(0,0))
   await target.screenshot({path:`${directory}/${name}-${width}.png`,fullPage:true})
  }
  try{
   await alternativeRecoveryJourney({act:nativeAction,guestAct:async(h,path,input,cookie)=>{
    await guestContext.clearCookies();await guestContext.addCookies(cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}));guestPage=await guestContext.newPage();await guestPage.goto(h.origin+path)
    const form=guestPage.locator('form').filter({has:guestPage.locator(`input[name="action"][value="${input.action}"]`)})
    await screenshot(guestPage,input.action==='settlement'?'guest-alternative':'guest-confirmation')
    const response=guestPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===path)
    await form.locator(`button[name="response"][value="${input.response}"]`).click()
    return {status:(await response).status(),text:''}
   },screens:async(h,stage,row)=>{
    await ownerPage(h);const card=page.locator('#recovery-'+row.id)
    for(const d of await card.locator('details').all())await d.evaluate(el=>el.open=true)
    if(stage==='closed'){await page.locator('details.panel').evaluateAll(rows=>rows.forEach(el=>el.open=true));if(guestPage){await guestPage.reload();await expect(guestPage.locator('[data-recovery-state="closed"]')).toBeVisible();await screenshot(guestPage,'guest-recovery-closed')}}
    await screenshot(page,'recovery-'+stage)
    if(stage==='active'){await ownerPage(h,'/app/turnovers');await screenshot(page,'arrival-preparation')}
    if(stage==='ready'){await ownerPage(h,'/app/readiness?from=2026-10-26');await screenshot(page,'verified-arrival')}
   }})
   origin=null
   await interruptedMessageJourney({act:nativeAction,screens:async(h,stage)=>{await ownerPage(h,'/app/inbox');await screenshot(page,'inbox-'+stage)}})
  }finally{await context.close();await guestContext.close()}
 }
}finally{await browser.close()}
console.log('Native alternative recovery, original owner scope, arrival preparation, verified guest confirmation and interrupted-send reconciliation PASS at 1440 and 390')
