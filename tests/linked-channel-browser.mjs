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
   await agent().screenshot({path:join(dir,stage+'-'+width+'.png')})
   if(stage==='whole-home-closures')await page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Channel action log',exact:true})}).screenshot({path:join(dir,'closure-log-'+width+'.png')})
  }
 }
 async function connect(room,channel,width){
  await page.setViewportSize({width,height:1000});await page.goto(h.origin+'/app/channels')
  await agent().getByText('Connect a channel listing',{exact:true}).click()
  const form=agent().locator('form').filter({has:page.getByRole('button',{name:'Connect isolated profile',exact:true})})
  const listingId=room.name.toLowerCase().replaceAll(' ','-')
  await form.getByLabel('Home',{exact:true}).selectOption(room.id);await form.getByLabel('Channel',{exact:true}).selectOption(channel)
  await form.getByLabel('Channel listing ID',{exact:true}).fill(listingId)
  await form.getByLabel('Host listing page',{exact:true}).fill(`https://www.${channel==='booking.com'?channel:channel+'.com'}/hosting/calendar/${listingId}`)
  await form.locator('input[name=confirm]').check()
  if(channel==='airbnb')await form.screenshot({path:join(dir,'connect-room-'+width+'.png')})
  await form.getByRole('button',{name:'Connect isolated profile',exact:true}).click()
  await expect(agent().getByRole('heading',{name:new RegExp(room.name+'$')})).toBeVisible()
 }
 return {connect,capture,close:()=>browser.close()}
}
