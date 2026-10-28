import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

export async function channelScreens(h){
 const browser=await chromium.launch({headless:true,...(process.env.CABIN_CHROMIUM?{executablePath:process.env.CABIN_CHROMIUM}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.CABIN_CHROMIUM?['--no-sandbox']:[])]})
 const context=await browser.newContext(),[name,value]=h.owner.split('=')
 await context.addCookies([{name,value,url:h.origin}])
 const page=await context.newPage();page.setDefaultTimeout(12000)
 const dir=process.env.CABIN_CHANNEL_SHOTS??'test-results/linked-channels';await mkdir(dir,{recursive:true})
 const agent=()=>page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Channel agent',exact:true})})
 async function capture(stage){
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(h.origin+'/app/channels')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'channel listings fit the viewport')
   const unnamed=await page.locator('button,a').evaluateAll(elements=>elements.filter(el=>!el.textContent.trim()&&!el.querySelector('img[alt]')).map(el=>el.outerHTML))
   assert.deepEqual(unnamed,[],'channel controls have visible text')
   if(stage==='account-identities'||stage==='account-revoked')await agent().locator('details').filter({has:page.getByText('Account settings',{exact:true})}).evaluate(el=>el.open=true)
   await agent().screenshot({path:join(dir,stage+'-'+width+'.png')})
   if(stage==='whole-home-closures')await page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Channel action log',exact:true})}).screenshot({path:join(dir,'closure-log-'+width+'.png')})
  }
 }
 async function connect(room,channel,width,accountId=''){
  await page.setViewportSize({width,height:1000});await page.goto(h.origin+'/app/channels')
  await agent().getByText('Connect a channel listing',{exact:true}).click()
  const form=agent().locator('form').filter({has:page.getByRole('button',{name:'Connect isolated profile',exact:true})})
  const listingId=room.name.toLowerCase().replaceAll(' ','-')
  await form.getByLabel('Home',{exact:true}).selectOption(room.id);await form.getByLabel('Channel',{exact:true}).selectOption(channel)
  if(accountId)await form.getByLabel('Owning account',{exact:true}).selectOption(accountId)
  await form.getByLabel('Channel listing ID',{exact:true}).fill(listingId)
  await form.getByLabel('Host listing page',{exact:true}).fill(`https://www.${channel==='booking.com'?channel:channel+'.com'}/hosting/calendar/${listingId}`)
  await form.locator('input[name=confirm]').check()
  if(channel==='airbnb')await form.screenshot({path:join(dir,'connect-room-'+width+'.png')})
  await form.getByRole('button',{name:'Connect isolated profile',exact:true}).click()
  const label={airbnb:'Airbnb',vrbo:'Vrbo','booking.com':'Booking.com'}[channel]
  await expect(agent().getByRole('heading',{name:label+' · '+room.name,exact:true})).toBeVisible()
 }
 async function accountSettings(operation,{id,channel,nickname}){
  await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+'/app/channels')
  await agent().getByText('Account settings',{exact:true}).click()
  if(operation==='create'){
   const form=agent().locator('form').filter({has:page.getByRole('button',{name:'Add account identity',exact:true})})
   await form.getByLabel('Account channel',{exact:true}).selectOption(channel)
   await form.getByLabel('Account nickname',{exact:true}).fill(nickname)
   await form.getByRole('button',{name:'Add account identity',exact:true}).click()
  }else{
   const record=agent().locator('[data-account]').filter({has:page.locator(`input[name=id][value="${id}"]`)})
   if(operation==='rename'){
    await record.getByLabel('Account nickname',{exact:true}).fill(nickname)
    await record.getByRole('button',{name:'Save account nickname',exact:true}).click()
   }else{
    await record.locator('input[name=confirm]').check()
    await record.getByRole('button',{name:'Revoke account',exact:true}).click()
   }
  }
  await page.waitForLoadState()
 }
 async function businessRecords(booking,accountName){
  await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+'/app/inbox')
  const href=await page.locator('a.thread-row').filter({hasText:'Second Loft'}).getAttribute('href')
  assert.ok(href,'the imported account has a native guest thread')
  const views=[
   ['reservation-account','/app/calendar?reservation='+booking.id,'[aria-label="Reservation record"]'],
   ['inbox-account',href,'.conversation'],
   ['payout-account','/app/statements','section.panel']
  ]
  for(const [name,path,selector] of views)for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(h.origin+path)
   const region=name==='payout-account'?page.locator(selector).filter({has:page.getByRole('heading',{name:'2. Matched stays and exceptions',exact:true})}):page.locator(selector)
   if(width===1440)assert.ok((await region.innerText()).includes(accountName),'the native source record names its owning account')
   await region.screenshot({path:join(dir,name+'-'+width+'.png')})
  }
 }
 return {connect,capture,accountSettings,businessRecords,close:()=>browser.close()}
}
