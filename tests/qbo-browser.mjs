import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {harness} from './harness.mjs'
import {qboEdge} from './qbo-edge.mjs'
import {qboBooks,qboAuth,syntheticGrant} from './qbo-support.mjs'
const dir=process.env.CABIN_QBO_SHOTS??'./test-results/qbo-browser';await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{for(const width of [1440,390]){
 const edge=qboEdge(),h=await harness({assets:true,auth:qboAuth,outbound:edge.outbound,now:'2026-10-26T12:00:00Z'}),context=await browser.newContext({viewport:{width,height:1000}})
 try{
  const data=await qboBooks(h),[name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();await page.goto(h.origin+'/app/books')
  const qbo=page.locator('section').filter({has:page.getByRole('heading',{name:'QuickBooks Online',exact:true})}),batches=page.locator('section').filter({has:page.getByRole('heading',{name:'QuickBooks sync batches',exact:true})})
  async function shot(state,panel=qbo){await panel.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Books fits viewport');const iconOnly=await page.locator('button,a[href],summary').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!(e.textContent??'').trim()&&!e.hasAttribute('data-tooltip')).map(e=>e.outerHTML));assert.deepEqual(iconOnly,[],'Books has no controls without visible text');await page.screenshot({path:`${dir}/${state}-${width}.png`});await panel.screenshot({path:`${dir}/${state}-full-${width}.png`})}
  await page.getByText('QuickBooks settings',{exact:true}).click();await shot('connect')
  await page.getByText('Use an existing OAuth grant',{exact:true}).click();const connect=page.locator('form[action*="qbo.connect"]')
  await connect.getByLabel('Grant environment').selectOption('sandbox');await connect.getByLabel('QuickBooks company ID').fill(syntheticGrant.realmId);await connect.getByLabel('OAuth access token',{exact:true}).fill(syntheticGrant.accessToken);await connect.getByLabel('OAuth refresh token',{exact:true}).fill(syntheticGrant.refreshToken);await connect.getByRole('checkbox').check();await connect.getByRole('button',{name:'Connect authorized company'}).click()
  await page.getByText('QuickBooks settings',{exact:true}).click();await page.getByRole('button',{name:'Refresh accounts and classes',exact:true}).click();await page.getByText('QuickBooks settings',{exact:true}).click();await page.getByText('Cedar Creek Cabin · accounting mapping',{exact:true}).click();await page.getByText('Ledger account mapping',{exact:true}).click()
  const mapping=page.locator('form[action*="qbo.mapping.approve"]');await mapping.getByLabel('Property class').selectOption(edge.classes[0].Id);await mapping.getByLabel('Property owner vendor').selectOption(edge.vendors[0].Id)
  for(const a of edge.accounts)await mapping.locator(`select[name="${a.Id}"]`).selectOption(a.Id)
  await shot('mapping');await mapping.getByRole('checkbox').check();await mapping.getByRole('button',{name:'Approve accounting mapping'}).click()
  const preview=page.locator('form[action*="qbo.preview"]');await preview.getByLabel('Property',{exact:true}).selectOption(data.home.id);await preview.getByLabel('Accounting month').fill('2026-10');await preview.getByRole('button',{name:'Preview month'}).click();await expect(batches).toContainText('needs review');await shot('preview',batches)
  const sync=batches.locator('form[action*="qbo.sync"]');await expect(sync.getByRole('checkbox')).not.toBeChecked();await sync.getByRole('checkbox').check();await sync.getByRole('button',{name:'Sync approved batch'}).click();await expect(batches).toContainText('reconciled');await shot('posted',batches)
  await batches.getByText('Journal identities and reconciliation',{exact:true}).click();await expect(batches).toContainText(edge.entries[0].Id);await shot('identities',batches)
  edge.entries[0].PrivateNote='Synthetic external accountant edit';edge.entries[0].SyncToken='1';await batches.getByRole('button',{name:'Reconcile QuickBooks',exact:true}).click();await batches.getByText('Journal identities and reconciliation',{exact:true}).click();await expect(batches).toContainText('externally edited');await shot('conflict',batches);assert.equal(edge.entries.length,data.source.length)
  await page.goto(h.origin+'/app/channels');const sharing=page.locator('section').filter({has:page.getByRole('heading',{name:'Your data & connected providers',exact:true})});await sharing.locator('summary').filter({hasText:'QuickBooks Online'}).click();await expect(sharing).toContainText('owner vendor references');await shot('connections',sharing)
  const saved=await h.send('/api/cabin/qbo/state',undefined,h.owner);assert.equal(saved.value.batches[0].reconciled,false)
 }finally{await context.close();await h.close()}
}}finally{await browser.close()}
console.log('QuickBooks native connection, mapping, preview, sync and conflict screens PASS at 1440 and 390')
