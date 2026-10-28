import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { harness } from './harness.mjs'
import { channelEdge, provision } from './channel-agent-edge.mjs'
import { inquiryClock } from './inquiries-support.mjs'

export async function inquiriesBrowserJourney(){
 const h=await harness({now:inquiryClock,assets:true}),edge=await channelEdge()
 const browser=await chromium.launch({headless:true,...(process.env.CABIN_CHROMIUM?{executablePath:process.env.CABIN_CHROMIUM}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.CABIN_CHROMIUM?['--no-sandbox']:[])]})
 try{
  const {home,runner}=await provision(h,edge,['airbnb']),manager=await h.person('InquiryManager','manager')
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),[name,value]=h.owner.split('=')
  await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(12000)
  await page.goto(h.origin+'/app/inbox');await page.getByText('Team routing, shifts and response deadlines',{exact:true}).click()
  const settings=page.locator('form').filter({has:page.getByRole('button',{name:'Save deadlines',exact:true})})
  await settings.getByLabel(/Escalation manager/).selectOption(manager.id);await settings.getByRole('button',{name:'Save deadlines',exact:true}).click()
  const profile=(await h.state()).channelAgent.profiles.find(p=>p.propertyId===home.id)
  edge.sourceEdits={inquiry:true,reservationId:'synthetic-cabin-2',guestName:'Synthetic inquiry guest'}
  await h.cmd('channelAgent.read',{id:profile.id,kind:'read-reservations',readUrl:'https://www.airbnb.com/hosting/lake-loft/reservations',confirm:'yes'})
  const {job}=await runner({op:'claim'}),result=await edge.run(job)
  assert.equal(result.outcome,'succeeded');result.read.observedAt=inquiryClock
  const completed=await runner({op:'complete',id:job.id,lease:job.lease,...result});assert.equal(completed.status,'succeeded')
  await page.goto(h.origin+'/app/reservations')
  const panel=()=>page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Source inquiries',exact:true})})
  await expect(panel().getByText('Awaiting source identity review',{exact:true})).toBeVisible()
  await panel().getByLabel('Source thread identity',{exact:true}).fill('synthetic-cabin-wrong-thread');await panel().getByRole('checkbox',{name:'I reviewed this exact source thread and guest identity',exact:true}).check();await panel().getByRole('button',{name:'Review inquiry identity',exact:true}).click()
  await expect(page.getByText(/Confirm the exact source thread identity/)).toBeVisible();assert.equal((await h.state()).messages.length,0)
  await panel().getByLabel('Source thread identity',{exact:true}).fill('synthetic-cabin-3');await panel().getByRole('checkbox',{name:'I reviewed this exact source thread and guest identity',exact:true}).check();await panel().getByRole('button',{name:'Review inquiry identity',exact:true}).click()
  await expect(panel().getByText('Inquiry',{exact:true})).toBeVisible();await expect(panel().getByText(/3 guests · USD 583.25/)).toBeVisible()
  let state=await h.state();assert.equal(state.bookings.length,0);assert.equal(state.turnovers.length,0);assert.equal(state.codes.length,0)
  const q=state.inquiries[0]
  await h.restart({now:'2026-10-28T13:01:00.000Z'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  await page.goto(h.origin+'/app/inbox?thread='+q.threadId)
  await expect(page.getByText(/Deadline elapsed locally/)).toBeVisible();await expect(page.getByText(/Channel outcome unresolved/)).toBeVisible();await expect(page.getByRole('region',{name:'Conversation',exact:true}).getByText('May we stay for these three nights?',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Accept this thread',exact:true}).click();await expect(page.getByText(/Accepted by/).first()).toBeVisible();await expect(page.getByText(/Channel outcome unresolved/)).toBeVisible()
  state=await h.state();assert.equal(state.inquiries[0].status,'inquiry');assert.equal(state.inquiries[0].deadline,'2026-10-28T13:00:00.000Z');assert.equal(state.bookings.length,0)
  const dir=process.env.CABIN_INQUIRY_SHOTS??'test-results/inquiries';await mkdir(dir,{recursive:true})
  for(const path of ['/app/reservations','/app/inbox?thread='+q.threadId]){
   await page.setViewportSize({width:1440,height:1000});await page.goto(h.origin+path)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'source inquiry screen fits desktop')
   const icons=page.locator('a,button').filter({hasText:/^$/})
   for(const el of await icons.all()){const tip=await el.getAttribute('data-tooltip')??await el.getAttribute('title');assert.ok(tip,'icon-only controls explain their action')}
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(dir,(path.includes('inbox')?'inquiry-thread-':'inquiry-record-')+width+'.png'),fullPage:true})}
  }
  await context.close()
 }finally{await browser.close();await edge.close();await h.close()}
}
