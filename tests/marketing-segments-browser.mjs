import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {harness} from './harness.mjs'
import {marketingContact} from './marketing-support.mjs'

const directory=process.env.CABIN_MARKETING_SHOTS??'./test-results/marketing-segments'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.CABIN_CHROMIUM,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
const h=await harness({assets:true,now:'2026-11-04T12:00:00Z'})
try{
 const home=await h.cmd('property.save',{name:'Synthetic repeat-stay home',ownerName:'Synthetic host',ownerEmail:marketingContact('host'),commissionBps:1500})
 const stay=await h.cmd('reservation.create',{propertyId:home.id,method:'phone',channel:'direct',sourceId:'synthetic-cabin-1',start:'2026-09-01',end:'2026-09-04',guestName:'Synthetic returning guest',guestEmail:marketingContact(1),rentCents:78000,feesCents:15000,taxCents:7440,policyName:'Saved phone reservation policy',retainedBps:5000,noShowBps:10000})
 const origin=(await h.state()).guests.find(g=>g.bookingId===stay.id)
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 try{
  const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}])
  const page=await context.newPage();await page.goto(h.origin+'/app/guests')
  const prepare=page.locator('form[action*="guest.marketing.prepare"]'),card=page.locator('#guest-'+origin.id)
  await prepare.getByLabel('Segment home').selectOption(home.id);await prepare.getByLabel('Segment name').fill('Returning in winter')
  await prepare.getByRole('button',{name:'Prepare local segment'}).click()
  await expect(page.getByText(/No eligible guests:/)).toBeVisible()
  await card.getByText('Source identities, consent and facts',{exact:true}).click()
  const verify=card.locator('form[action*="guest.identity.verify"]')
  await verify.locator('[name="source"]').fill('Guest confirmed current email ownership in person.')
  await verify.getByRole('checkbox').check();await verify.getByRole('button',{name:'Record contact verification'}).click()
  await card.getByText('Source identities, consent and facts',{exact:true}).click()
  await card.getByText('Record separate marketing consent',{exact:true}).click()
  const consent=card.locator('.marketing-consent form')
  await consent.getByLabel('Marketing decision').selectOption('yes')
  const guest=(await h.state()).guests.find(g=>g.id===origin.id)
  await consent.getByLabel('Current email').selectOption(guest.identities.find(i=>i.kind==='email').id)
  await consent.getByLabel('Separate marketing evidence').fill('Guest separately requested winter repeat-stay marketing for this home in writing.')
  await consent.getByRole('checkbox').check()
  async function proof(stage,element){
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await element.scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guest marketing fits its viewport')
    const iconOnly=await page.locator('button,a[href],summary').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!(e.textContent??'').trim()&&!e.hasAttribute('data-tooltip')).map(e=>e.outerHTML))
    assert.deepEqual(iconOnly,[],'Every guest-screen control has visible text or a tooltip')
    const small=await page.locator('#marketing, #marketing *, .marketing-consent, .marketing-consent *').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<13).map(e=>({tag:e.tagName,size:getComputedStyle(e).fontSize})))
    assert.deepEqual(small,[],'Marketing text remains at least 13px')
    await page.screenshot({path:`${directory}/${stage}-${width}.png`,fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  await proof('separate-consent',consent)
  await consent.getByRole('button',{name:'Record marketing decision'}).click()
  await prepare.getByLabel('Segment home').selectOption(home.id);await prepare.getByLabel('Segment name').fill('Returning in winter')
  await prepare.getByRole('button',{name:'Prepare local segment'}).click()
  const segment=page.locator('.marketing-segment')
  const prepared=(await h.state()).guestSegments[0];assert.equal(prepared.status,'prepared');assert.equal(prepared.members[0]?.email,marketingContact(1))
  await expect(segment).toContainText('1 eligible guest');await expect(segment).toContainText(marketingContact(1));await expect(segment).toContainText('Local preview only')
  await segment.getByRole('button',{name:'Recheck local preparation'}).click();await expect(segment).toContainText('prepared')
  await proof('local-preview',segment)
  await card.getByText('Source identities, consent and facts',{exact:true}).click();await card.getByText('Record separate marketing consent',{exact:true}).click()
  await consent.getByLabel('Marketing decision').selectOption('no');await consent.getByLabel('Separate marketing evidence').fill('Guest withdrew marketing permission for this home.')
  await consent.getByRole('button',{name:'Record marketing decision'}).click()
  await expect(segment).toContainText('This preparation is inactive');await expect(segment).not.toContainText(marketingContact(1));await expect(segment.getByRole('button')).toHaveCount(0)
  await proof('withdrawn-preview',segment)
  const stored=(await h.state()).guestSegments[0];assert.equal(stored.status,'inactive');assert.deepEqual(stored.members,[])
 }finally{await context.close()}
}finally{await h.close();await browser.close()}
console.log('Native guest marketing consent, local preview, withdrawal and native screens passed at 1440 and 390.')
