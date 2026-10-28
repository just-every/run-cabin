import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {harness} from './harness.mjs'
import {taxPeriods} from './tax-periods-support.mjs'

const directory=process.env.CABIN_TAX_SHOTS??'./test-results/tax-periods';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.CABIN_CHROMIUM,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
const h=await harness({assets:true,now:'2026-10-28T12:00:00Z'})
try{
 const f=await taxPeriods(h),[state,county]=f.jurisdictions
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
 try{
  const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}])
  const page=await context.newPage();await page.goto(h.origin+'/app/taxes')
  const prepare=page.locator('form[action*="tax.report.prepare"]')
  async function proof(stage){
   // The business assertions run at desktop width; the phone view is the seed's native review smoke.
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await prepare.scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Tax review fits its viewport')
    const iconOnly=await page.locator('button,a[href],summary').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!(e.textContent??'').trim()&&!e.hasAttribute('data-tooltip')).map(e=>e.outerHTML))
    assert.deepEqual(iconOnly,[],'Every tax-screen control has visible text or a tooltip')
    await page.screenshot({path:`${directory}/${stage}-${width}.png`,fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  await prepare.getByLabel('Property',{exact:true}).selectOption(f.home.id)
  await prepare.getByLabel('Review period',{exact:true}).selectOption('quarter')
  await prepare.getByLabel('Month within review period').fill('2026-03')
  await prepare.getByLabel('Jurisdiction',{exact:true}).selectOption(state.id)
  await proof('quarter-selection')
  await prepare.getByRole('button',{name:'Prepare tax review'}).click()
  const report=(await h.state()).taxes.reports.at(-1)
  let card=page.locator('details.tax-review').filter({has:page.locator(`input[name="id"][value="${report.id}"]`)}).filter({has:page.locator('form[action*="tax.report.approve"]')})
  await expect(card.locator(':scope > summary')).toContainText('2026-Q1 · Maine · draft')
  await expect(card).toContainText('Tax $30.00 · source-recorded channel $9.00 · host $21.00')
  await card.getByText(/source lines and ledger links/).click()
  await expect(card.getByRole('cell',{name:'9%',exact:true})).toHaveCount(3)
  await expect(card.getByRole('cell',{name:'1%',exact:true})).toHaveCount(3)
  await proof('quarter-sources')
  await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Approve and freeze review'}).click()
  card=page.locator('details.tax-review').filter({has:page.locator(`input[name="id"][value="${report.id}"]`)})
  await expect(card.locator(':scope > summary')).toContainText('2026-Q1 · Maine · approved')
  await expect(card).toContainText('The packet is frozen.')
  await expect(card.getByRole('button',{name:'Approve and freeze review'})).toHaveCount(0)
  await proof('quarter-approved')
  const download=page.waitForEvent('download');await card.getByRole('link',{name:'Download exact review and evidence'}).click()
  const exported=JSON.parse(await readFile(await (await download).path(),'utf8'))
  assert.equal(exported.period.key,'2026-Q1');assert.equal(exported.obligations.length,1)
  assert.equal(exported.obligations[0].hostCents,2100);assert.equal(exported.packets[0].period.end,'2026-04-01')
  assert.deepEqual(exported.deliveries,[]);assert.deepEqual(exported.evidence,[],'Approval creates no filing, mail or payment receipt')
  // Use the same native phone controls and export link, retaining a separate county obligation.
  await page.setViewportSize({width:390,height:1000})
  await prepare.getByLabel('Property',{exact:true}).selectOption(f.home.id);await prepare.getByLabel('Review period',{exact:true}).selectOption('quarter')
  await prepare.getByLabel('Month within review period').fill('2026-01');await prepare.getByLabel('Jurisdiction',{exact:true}).selectOption(county.id)
  await prepare.getByRole('button',{name:'Prepare tax review'}).click()
  const phoneReport=(await h.state()).taxes.reports.at(-1),phone=page.locator('details.tax-review').filter({has:page.locator(`input[name="id"][value="${phoneReport.id}"]`)})
  await phone.getByRole('checkbox').check();await phone.getByRole('button',{name:'Approve and freeze review'}).click()
  await phone.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/phone-county-approved-390.png`,fullPage:true})
  const phoneDownload=page.waitForEvent('download');await phone.getByRole('link',{name:'Download exact review and evidence'}).click();await (await phoneDownload).path()
 }finally{await context.close()}
}finally{await h.close();await browser.close()}
console.log('Quarterly tax native preparation, exact approval, separate levy export and phone smoke PASS')
