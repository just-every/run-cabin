import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium,expect} from '@playwright/test'
import {harness} from './harness.mjs'
import {seamEdge} from './seam-edge.mjs'

export async function lockStatusBrowser(){
 const edge=seamEdge({intercept:({phase,action,codes,result})=>{
  if(phase==='after'&&action==='create'){const row=codes.get(result.access_code.access_code_id);row.status='unset';row.is_scheduled_on_device=false}
  if(phase==='after'&&action==='update')codes.get(result.access_code.access_code_id).errors=[{type:'synthetic-cabin-7'}]
 }})
 const h=await harness({now:'2026-10-31T18:00:00Z',assets:true,outbound:edge.outbound,auth:{SEAM_API_KEY:'synthetic-cabin-1'}})
 let browser
 try{
  const cleaner=await h.person('Luis'),home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Morgan Carter',ownerEmail:'morgan@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:home.id,address:'18 Lake Road, Asheville, NC',timeZone:'America/New_York',checkInTime:'12:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Kitchen ready'],photosRequired:1,lockDeviceId:'synthetic-cabin-2'})
  await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Lake Loft Trust'})
  const booking=await h.cmd('reservation.create',{propertyId:home.id,method:'channel',channel:'airbnb',sourceId:'synthetic-cabin-3',guestName:'Ana Diaz',guestEmail:'ana@stay.example',start:'2026-10-31',end:'2026-11-02',rentCents:50000,policyName:'Flexible',retainedBps:0,noShowBps:0}),request={bookingId:booking.id}
  let state=await h.accessState(),code=state.codes.find(c=>c.bookingId===request.bookingId&&c.holder==='guest')
  const guestCookie=await h.verifyGuest(code.link),shots=process.env.CABIN_LOCK_SHOTS??'test-results/lock-status';await mkdir(shots,{recursive:true})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const contexts=[]
  try{
   for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000}})
    const add=async(cookie)=>{await context.clearCookies();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))}
    contexts.push({context,page:await context.newPage(),add,width})
   }
   for(const status of ['pending','unpaid','active','failed']){
    if(status==='unpaid'){for(const remote of edge.codes.values()){remote.status='set';remote.is_scheduled_on_device=true}await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})}
    if(status==='active')await h.cmd('ledger.post',{operation:'payment',propertyId:home.id,bookingId:request.bookingId,amountCents:50000,sourceId:'synthetic-cabin-4',sourceRevision:'1',effectiveDate:'2026-10-31'})
    if(status==='failed'){
     state=await h.state();const booking=state.bookings.find(b=>b.id===request.bookingId)
     await h.cmd('reservation.amend',{id:booking.id,revision:booking.revision,guestName:'Ana Diaz',guestEmail:'ana@stay.example',start:'2026-10-31',end:'2026-11-03',reason:'Guest accepted one extra night at the saved price'})
    }
    for(const {page,add,width}of contexts){
     await add(h.owner);await page.goto(h.origin+'/app/readiness?from=2026-10-31')
     const card=page.locator('article.home-ready').filter({has:page.getByRole('heading',{name:'Lake Loft',exact:true})})
     await expect(card.locator('.door .chip')).toHaveText(status==='unpaid'?'active':status)
     await expect(card).toContainText('Ana Diaz');await expect(card).toContainText('Airbnb')
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Board fits '+width)
     await page.screenshot({path:join(shots,'board-'+status+'-'+width+'.png'),fullPage:true})
     await page.goto(h.origin+'/app/turnovers')
     const guestLine=page.locator('.door').filter({has:page.getByText('Guest code',{exact:true})}).first()
     await expect(guestLine.locator('.chip')).toHaveText(status==='unpaid'?'active':status)
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Turnovers fit '+width)
     await page.screenshot({path:join(shots,'turnovers-'+status+'-'+width+'.png'),fullPage:true})
     await add(guestCookie);await page.goto(h.origin+'/stay/'+code.link)
     await expect(page.locator('.code-card .code')).toHaveCount(status==='active'?1:0)
     if(status==='active')await expect(page.locator('.code-card .code')).toHaveText(code.code)
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guest page fits '+width)
     await page.screenshot({path:join(shots,'guest-'+status+'-'+width+'.png'),fullPage:true})
     await add(cleaner.cookie);await page.goto(h.origin+'/app/turnovers')
     await expect(page.locator('.door-code').filter({hasText:code.code})).toHaveCount(0)
     await expect(page.getByText('Ana Diaz',{exact:true})).toHaveCount(0)
     for(const control of await page.locator('button,a').all())if(await control.isVisible())assert.ok((await control.innerText()).trim()||await control.getAttribute('data-tooltip'),'Icon-only controls need tooltips')
     await page.screenshot({path:join(shots,'cleaner-'+status+'-'+width+'.png'),fullPage:true})
    }
   }
  }finally{for(const {context}of contexts)await context.close()}
 }finally{await browser?.close();await h.close()}
}
