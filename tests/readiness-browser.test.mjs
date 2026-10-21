import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { harness } from './harness.mjs'
import { dayBoardRequests } from './day-board-support.mjs'

test('OPS-008: desktop and phone day board explain declined requests and open their retained sources',{timeout:120000},async()=>{
 const h=await harness({assets:true})
 let browser
 try {
  const {selected,requests}=await dayBoardRequests(h)
  const staff=await h.person('DayManager','manager')
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_DAY_BOARD_SHOTS??'test-results/day-board';await mkdir(evidence,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}})
   try {
    const [name,value]=staff.cookie.split('=');await context.addCookies([{name,value,url:h.origin}])
    const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/readiness')
    await page.getByLabel('Any day').fill(selected);await page.getByRole('button',{name:'Show',exact:true}).click()
    const panel=page.getByRole('region',{name:'Declined channel requests'})
    await expect(panel.getByRole('link',{name:'Request record',exact:true})).toHaveCount(2)
    for(const r of requests){
     const card=panel.locator('article').filter({has:page.locator(`a[href*="request=${r.id}"]`)})
     await expect(card.getByText(r.reason,{exact:true})).toBeVisible()
    }
    await expect(panel.getByText('Direct request excluded')).toHaveCount(0)
    await expect(panel.getByText(/channel-side decline or expiry is not confirmed/)).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'day board fits the viewport')
    await page.screenshot({path:join(evidence,`declined-requests-${width}.png`),fullPage:true})
    await panel.getByRole('link',{name:'Request record',exact:true}).first().click()
    const source=page.locator(`#request-${requests[0].id}`)
    await expect(source.getByText(requests[0].reason,{exact:true})).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'source record fits the viewport')
    await page.screenshot({path:join(evidence,`request-source-${width}.png`),fullPage:true})
    await page.goBack()
    await page.getByRole('region',{name:'Declined channel requests'}).getByRole('link',{name:'Overlapping reservation record'}).first().click()
    await expect(page.getByRole('heading',{name:/Existing guest/}).first()).toBeVisible()
   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})


test('REPORT-001: desktop and phone reports filter, explain denominators, drill to sources and download complete totals',{timeout:120000},async()=>{
 const {reportBooks,reportMonth}=await import('./reports-support.mjs'),h=await harness({assets:true});let browser
 try{
  const b=await reportBooks(h),manager=await h.person('ReportViewer','manager');browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_REPORT_SHOTS??'test-results/reports';await mkdir(evidence,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true})
   try{
    const [name,value]=manager.cookie.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/reports?'+reportMonth);await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible()
    await page.getByText('Occupancy denominator',{exact:true}).click();await expect(page.getByText(/Occupancy = distinct confirmed guest nights/)).toBeVisible()
    await page.getByText('Accounting basis',{exact:true}).click();await expect(page.getByText(/Financial rows use immutable journal effective dates/)).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'reports fit the viewport')
    await page.screenshot({path:join(evidence,`reports-all-${width}.png`),fullPage:true});await page.screenshot({path:join(evidence,`reports-overview-${width}.png`)})
    await page.getByLabel('Property',{exact:true}).selectOption(b.p.id);await page.getByLabel('Channel',{exact:true}).selectOption('vrbo');await page.getByRole('button',{name:'Apply report filters'}).click()
    await expect(page.locator('#reservations article')).toHaveCount(1);await expect(page.locator('#reservations')).toContainText(b.vrbo.id);await expect(page.locator('#reservations')).not.toContainText(b.air.id)
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download complete report (CSV)'}).click()]);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=Buffer.concat(chunks).toString();assert.ok(csv.includes(b.vrbo.id));assert.ok(!csv.includes(b.air.id));assert.ok(csv.includes('"grossCents","60000"'));assert.ok(csv.includes('"netCents","43000"'))
    await page.screenshot({path:join(evidence,`reports-filtered-${width}.png`),fullPage:true});await page.screenshot({path:join(evidence,`reports-filter-controls-${width}.png`)})
    await page.locator('#reservations a').first().click();await expect(page.getByRole('heading',{name:/Synthetic Cabin Guest/}).first()).toBeVisible();await page.goBack()
    await page.locator('#journals article').filter({hasText:'earn'}).getByRole('link').first().click();await expect(page.getByRole('heading',{name:'Trust ledger',exact:true})).toBeVisible();await page.goBack()
    await page.getByLabel('Accounting basis',{exact:true}).selectOption('cash');await page.getByRole('button',{name:'Apply report filters'}).click();await expect(page.getByText('Cash · recorded trust receipts and paid costs · journal effective dates 2026-10-01 to 2026-11-01 (exclusive).',{exact:true})).toBeVisible()
    await page.getByLabel('Reservation date basis',{exact:true}).selectOption('booking');await page.getByRole('button',{name:'Apply report filters'}).click();assert.ok(page.url().includes('dates=booking'))
    await page.getByLabel('Rental owner',{exact:true}).selectOption((await b.report()).owners.find(o=>o.name==='Casey Owner').id);await page.getByRole('button',{name:'Apply report filters'}).click();await expect(page.locator('#reservations article')).toHaveCount(0)
   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})


test('REPORT-002: desktop and phone save current filters and explicitly approve visible scoped delivery',{timeout:120000},async()=>{
 let failMail=false;const {reportBooks,reportMonth}=await import('./reports-support.mjs'),h=await harness({assets:true,auth:{CABIN_TEST_MAIL_EDGE:'true'},outbound:async request=>{const m=await request.json();return failMail&&m.subject.startsWith('Cabin report')?new Response('Provider refused',{status:503}):Response.json({status:'accepted',provider:'test',providerMessageId:'synthetic-cabin-1'})}});let browser
 try{
  const b=await reportBooks(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_SHARING_SHOTS??'test-results/report-sharing';await mkdir(evidence,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true})
   try{
    const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}]);const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/reports?'+reportMonth+'&property='+b.p.id)
    const reportName='Owner sharing '+width;await page.getByLabel('Saved report name',{exact:true}).fill(reportName);await page.getByRole('button',{name:'Save current report filters',exact:true}).click()
    const saved=page.locator('[data-saved-report-id]').filter({has:page.getByRole('heading',{name:reportName,exact:true})});await expect(saved).toContainText('2026-10-01 to 2026-11-01 (exclusive)');await expect(saved).toContainText('accrual')
    await saved.getByText('Schedule rental-owner delivery',{exact:true}).click();const form=saved.locator('form').filter({has:page.locator('input[name="recipientKind"][value="owner"]')})
    await form.getByLabel('Rental-owner recipient',{exact:true}).selectOption(b.p.ownerEmail);await form.getByLabel('Reporting period',{exact:true}).selectOption('saved-window');await form.getByLabel('Delivery cadence',{exact:true}).selectOption('once');await form.getByLabel('File format',{exact:true}).selectOption('json');await form.getByLabel('Next run (UTC)',{exact:true}).fill(new Date(Date.now()+86400000).toISOString())
    const consent=form.getByRole('checkbox',{name:'I approve this period, recipient, format and delivery schedule.'});await expect(consent).not.toBeChecked();await consent.check()
    await saved.screenshot({path:join(evidence,`report-schedule-consent-${width}.png`)})
    await form.getByRole('button',{name:'Approve report schedule',exact:true}).click()
    const schedule=page.locator('[id^="report-schedule-"]').filter({has:page.getByRole('heading',{name:reportName,exact:true})});await expect(schedule).toContainText(b.p.ownerEmail);await expect(schedule).toContainText('JSON');await expect(schedule).toContainText('saved window');await expect(schedule).toContainText('once')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sharing controls fit the viewport')
    await schedule.screenshot({path:join(evidence,`report-schedule-approved-${width}.png`)})
    const savedId=await saved.getAttribute('data-saved-report-id'),state=(await h.send('/api/cabin/report-sharing.json',undefined,h.owner)).value,record=state.reportSchedules.find(s=>s.savedReportId===savedId),date=new Date(Date.now()-60000).toISOString()
    await h.db.prepare("UPDATE cb_report_schedules SET next_run_at=?,data=json_set(data,'$.nextRunAt',?) WHERE id=?").bind(date,date,record.id).run();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});await page.reload()
    const run=page.locator('[id^="report-run-"]').filter({has:page.getByRole('heading',{name:reportName,exact:true})});await expect(run).toContainText('sent');await expect(run).toContainText('Data cutoff');await run.getByText('Run and delivery history',{exact:true}).click();await expect(run).toContainText('Mail provider accepted')
    const [download]=await Promise.all([page.waitForEvent('download'),run.getByRole('link',{name:'Download frozen report (JSON)',exact:true}).click()]);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const report=JSON.parse(Buffer.concat(chunks).toString());assert.deepEqual(report.properties.map(p=>p.id),[b.p.id]);assert.ok(report.journals.every(j=>j.ownerKey===report.filters.owner))
    await run.screenshot({path:join(evidence,`report-run-history-${width}.png`)})
    const failure=await h.cmd('report.schedule',{savedReportId:savedId,savedReportRevision:state.savedReports.find(r=>r.id===savedId).revision,recipientKind:'owner',recipientEmail:b.p.ownerEmail,period:'saved-window',cadence:'once',format:'json',nextRunAt:new Date(Date.now()+86400000).toISOString(),consent:true})
    failMail=true;const failedAt=new Date(Date.now()-5000).toISOString();await h.db.prepare("UPDATE cb_report_schedules SET next_run_at=?,data=json_set(data,'$.nextRunAt',?) WHERE id=?").bind(failedAt,failedAt,failure.id).run();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});failMail=false;await page.reload()
    const follow=page.locator('[id^=report-followup-]').filter({has:page.getByRole('heading',{name:'Report follow-up needs review',exact:true})});await expect(follow).toContainText('Responsible:');await expect(follow).toContainText('Delivery failed');await follow.screenshot({path:join(evidence,`report-failure-assigned-${width}.png`)})
    await follow.getByLabel('Resolution and delivery check',{exact:true}).fill('The provider refused this request. No message was accepted; retain the paused schedule.');await follow.getByRole('button',{name:'Record report follow-up resolution',exact:true}).click();const resolved=page.locator('[id^=report-followup-]').filter({has:page.getByRole('heading',{name:'Resolved report follow-up',exact:true})}).last();await resolved.screenshot({path:join(evidence,`report-failure-resolved-${width}.png`)})

   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})


test('native calendar and inbox preserve a keyboard-submitted failed reply and complete the booking conversation at desktop and phone sizes',{timeout:180000},async()=>{
 const h=await harness({assets:true});let browser
 try{
  const {homeDay}=await import('./home-calendar.mjs'),day=n=>homeDay(n,'America/New_York')
  const home=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:1500})
  await h.cmd('home.settings',{propertyId:home.id,address:'41 Pine Ridge Road, Asheville, NC',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',checklist:['Kitchen ready'],photosRequired:1})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const evidence=process.env.CABIN_INTERFACE_SHOTS??'test-results/interface';await mkdir(evidence,{recursive:true})
  for(const [n,width] of [1440,390].entries()){
   const context=await browser.newContext({viewport:{width,height:1000}})
   try{
    const [name,value]=h.owner.split('=');await context.addCookies([{name,value,url:h.origin}])
    const page=await context.newPage();page.setDefaultTimeout(12000)
    await page.goto(h.origin+'/app/calendar');const next=page.getByRole('link',{name:'New reservation',exact:true});await next.focus();await page.keyboard.press('Enter')
    const request=page.locator('#request form');await request.getByLabel('Guest name',{exact:true}).fill('Megan Ortiz '+width);await request.getByLabel('Guest email (optional)').fill('megan-'+width+'@stay.example');await request.getByLabel('Arrival',{exact:true}).fill(day(3+n*5));await request.getByLabel('Checkout',{exact:true}).fill(day(6+n*5));await request.getByRole('button',{name:'Check and hold these nights',exact:true}).focus();await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('Accepted');const booking=(await h.state()).bookings.find(b=>b.guestName==='Megan Ortiz '+width)
    await page.goto(h.origin+'/app/calendar?reservation='+booking.id);await expect(page.getByRole('complementary',{name:'Reservation record'})).toContainText('Megan Ortiz '+width);await expect(page.getByRole('complementary',{name:'Reservation record'})).toContainText('Source freshness')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'calendar fits viewport');await page.screenshot({path:join(evidence,'calendar-record-'+width+'.png'),fullPage:true})
    await page.goto(h.origin+'/app/inbox');const search=page.getByRole('searchbox',{name:'Search guests and messages'});await search.fill('Megan Ortiz '+width);await page.keyboard.press('Enter');await expect(page.locator('.threads')).toContainText('of 1 guests');await page.locator('.thread-row').click()
    const compose=page.locator('details.compose');await compose.locator('summary').focus();await page.keyboard.press('Enter');const text=compose.locator('textarea[name=text]');await text.fill('Could we arrive early and keep the luggage on the covered porch?');const send=compose.getByRole('button',{name:'Send',exact:true})
    // A genuine server business refusal, not a transport stub: an overlong
    // subject is posted after disabling only this browser's input maxlength.
    await compose.locator('[name=subject]').evaluate(input=>input.removeAttribute('maxlength'));await compose.locator('[name=subject]').fill('Synthetic travel question '.repeat(12));await send.focus();await page.keyboard.press('Enter')
    const alert=page.getByRole('alert').first();await expect(alert).toBeVisible();await expect(alert).toBeFocused();await expect(page.locator('details.compose')).toHaveAttribute('open','');await expect(page.locator('details.compose textarea[name=text]')).toHaveValue('Could we arrive early and keep the luggage on the covered porch?');assert.equal(await page.evaluate(()=>sessionStorage.getItem('cabin:submitted-form')),null)
    await page.screenshot({path:join(evidence,'inbox-error-'+width+'.png'),fullPage:true})
    await page.locator('details.compose [name=subject]').fill('Early arrival question');await page.locator('details.compose button[type=submit]').focus();await page.keyboard.press('Enter');await expect(page.getByRole('status')).toContainText(/sent|draft|queued|development/i);await expect(page.locator('.messages')).toContainText('Could we arrive early');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'inbox fits viewport');await page.screenshot({path:join(evidence,'inbox-completed-'+width+'.png'),fullPage:true})
   }finally{await context.close()}
  }
 }finally{if(browser)await browser.close();await h.close()}
})
