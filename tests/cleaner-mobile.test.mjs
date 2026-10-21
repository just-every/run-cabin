import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { harness } from './harness.mjs'

test('OPS-002: offline cleaner photos and issue survive a changed job and require current review', async () => {
  const h = await harness({assets:true})
  const browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  try {
    const cleaner = await h.person('Ana'), other = await h.person('Luis')
    const home = await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
    let settings = await h.cmd('home.settings',{propertyId:home.id,address:'20 Lake Street, Ithaca, NY',timeZone:'America/New_York',checkOutTime:'00:00',checkInTime:'16:00',cleanerId:cleaner.id,checklist:['Beds made','Kitchen clean'],photosRequired:2})
    // Days count from the home's own calendar, so today's 00:00 check-out has always passed there.
    const date = n => { const d = new Date(new Intl.DateTimeFormat('en-CA',{timeZone:settings.timeZone}).format(new Date())+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10) }
    const reservation = await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Megan Ortiz',start:date(-3),end:date(0)})
    const job = (await h.state()).turnovers.find(t=>t.bookingId===reservation.bookingId)
    const context = await browser.newContext({viewport:{width:390,height:844}})
    const [name,value] = cleaner.cookie.split('='); await context.addCookies([{name,value,url:h.origin}])
    const page = await context.newPage(); page.setDefaultTimeout(8000); const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(h.origin+'/app/turnovers')
    const ready = page.locator('form[data-job]').filter({has:page.getByRole('button',{name:'Mark ready',exact:true})})
    await mkdir('test-results/cleaner-mobile',{recursive:true})
    await page.screenshot({path:'test-results/cleaner-mobile/initial.png',fullPage:true})
    assert.equal(await ready.count(),1, 'approved cleaner job form exists')
    assert.equal((await page.request.get(h.origin+'/cabin.js')).status(),200, 'workspace script served')
    await ready.locator('.local-draft').waitFor({timeout:5000}).catch(e=>{throw Error(e.message+'; script errors: '+errors.join('; '))})
    await context.setOffline(true)
    for (const checkbox of await ready.getByRole('checkbox').all()) await checkbox.check()
    await ready.getByLabel('Note for the owner').fill('Fresh linen and all rooms checked')
    const photo = await readFile('tests/fixtures/checklist.png')
    await ready.locator('[name=photoFiles]').setInputFiles([1,2].map(n=>({name:`room-${n}.png`,mimeType:'image/png',buffer:photo})))
    await ready.locator('.local-draft img').nth(1).waitFor()
    const issue = page.locator('form[data-job]').filter({has:page.getByRole('button',{name:'Report it',exact:true})})
    await page.getByText('Report something broken',{exact:true}).click()
    await issue.getByLabel('What is wrong').fill('Patio light out')
    await issue.getByLabel('Details (optional)').fill('Switch works, bulb needs replacing')
    await issue.locator('[name=photoFiles]').setInputFiles({name:'light.png',mimeType:'image/png',buffer:photo})
    await issue.locator('.local-draft img').waitFor()
    // A manager changes requirements while the cleaner has no connectivity.
    await h.cmd('reservation.move',{id:reservation.bookingId,revision:(await h.state()).bookings.find(row=>row.id===reservation.bookingId).revision,start:date(-4),end:date(0)})
    settings = await h.cmd('home.settings',{...settings,checklist:['Beds made','Kitchen clean','Fresh towels']})
    await context.setOffline(false)
    await ready.getByRole('button',{name:'Mark ready',exact:true}).click()
    await ready.getByRole('link',{name:'Review current job',exact:true}).waitFor()
    assert.equal((await h.state()).turnovers.find(t=>t.id===job.id).status,'approved')
    assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_photos').first()).n,0)
    await ready.getByRole('link',{name:'Review current job',exact:true}).click()
    await ready.locator('.local-draft img').nth(1).waitFor()
    assert.equal(await ready.getByLabel('Note for the owner').inputValue(),'Fresh linen and all rooms checked')
    assert.equal(await ready.getByRole('checkbox',{name:'Fresh towels'}).isChecked(),false)
    await ready.getByRole('checkbox',{name:'Fresh towels'}).check()
    await ready.getByRole('button',{name:'Mark ready',exact:true}).click()
    await expect(ready.locator('[data-upload-status]')).toContainText('Review the changed job')
    await mkdir('test-results/cleaner-mobile',{recursive:true})
    for (const width of [1440,390]) {await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0)); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'phone layout fits viewport'); assert.ok(await ready.locator('.local-draft img').first().evaluate(img=>img.complete&&img.naturalWidth>0), 'retained photo preview loads'); await page.screenshot({path:`test-results/cleaner-mobile/review-${width}.png`,fullPage:true})}
    await ready.getByRole('button',{name:'Use draft for current job'}).click()
    await ready.getByRole('button',{name:'Mark ready',exact:true}).click()
    await page.getByText(/Marked ready with 2 photos/).waitFor()
    assert.equal((await h.state()).turnovers.find(t=>t.id===job.id).status,'completed')
    await page.getByText('Report something broken',{exact:true}).click()
    assert.equal(await issue.getByLabel('What is wrong').inputValue(),'Patio light out')
    await issue.getByRole('button',{name:'Use draft for current job'}).click()
    await issue.getByRole('button',{name:'Report it',exact:true}).click()
    await page.getByText('Patio light out',{exact:false}).last().waitFor()
    assert.equal((await h.state()).tasks.length,1)
    for (const width of [1440,390]) {await page.setViewportSize({width,height:1000});await page.screenshot({path:`test-results/cleaner-mobile/done-${width}.png`,fullPage:true})}
    // The same phone accepts a capacity-checked offer before it gets work/access.
    await h.cmd('cleaner.capacity',{memberId:cleaner.id,homeBase:settings.address,timeZone:settings.timeZone,availableFrom:'06:00',dailyJobs:4,dailyMinutes:600})
    settings = await h.cmd('home.settings',{...settings,dispatch:{templateName:'Clean and inspect',instructions:'Use the side entrance and check the patio light.',durationMinutes:120,rateCents:14500,startOffsetMinutes:0,finishBeforeMinutes:0,approvedCleanerIds:[cleaner.id],offerCount:1,responseMinutes:120,reminderMinutes:30,escalationMinutes:60}})
    settings = await h.cmd('home.drive',{propertyId:home.id,revision:settings.revision,from:`base:${cleaner.id}`,minutes:0})
    const next = await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Lena Wu',start:date(2),end:date(4)})
    await page.goto(h.origin+'/app/turnovers')
    await page.getByRole('button',{name:'Accept turnover',exact:true}).click()
    await page.getByText('Accepted. Your current window, instructions and door code are shown below.',{exact:true}).waitFor()
    assert.equal((await h.state()).turnovers.find(t=>t.bookingId===next.bookingId).dispatch.acceptedBy,cleaner.id)
    // Switching people cannot recover the previous cleaner's local notes/photos.
    await context.clearCookies(); const [on,ov]=other.cookie.split('=');await context.addCookies([{name:on,value:ov,url:h.origin}])
    await page.goto(h.origin+'/app/turnovers');assert.equal(await page.locator('form[data-job]').count(),0)
    assert.deepEqual(errors,[])
    await context.close()
  } finally {await browser.close();await h.close()}
})

test('AUTH-002: desktop and phone team invitations enforce a single home and offboarding on the next request', {timeout:120000}, async () => {
  const h = await harness({assets:true})
  let browser
  try {
    const date = n => new Date(Date.now()+n*86400000).toISOString().slice(0,10)
    const home = await h.cmd('property.save',{name:'Silver Pine Cabin',ownerName:'Morgan Lee',ownerEmail:'morgan@stay.example',commissionBps:1500})
    const otherHome = await h.cmd('property.save',{name:'Harbor House',ownerName:'Casey Chen',ownerEmail:'casey@stay.example',commissionBps:1800})
    for (const [property,address,timeZone] of [[home,'24 Pine Lane, Asheville, NC','America/New_York'],[otherHome,'8 Harbor Avenue, Seattle, WA','America/Los_Angeles']]) {
      await h.cmd('home.settings',{propertyId:property.id,address,timeZone,checkInTime:'16:00',checkOutTime:'10:00',checklist:['Rooms prepared'],photosRequired:1})
    }
    const stay = await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Mira Bennett',guestEmail:'mira@stay.example',start:date(2),end:date(5),arrivalTime:'16:00'})
    const otherStay = await h.cmd('reservation.request',{propertyId:otherHome.id,channel:'direct',kind:'stay',guestName:'Daniel Ortiz',guestEmail:'daniel@stay.example',start:date(2),end:date(5),arrivalTime:'16:00'})
    const evidence = process.env.CABIN_AUTH_SHOTS ?? 'test-results/auth'
    await mkdir(evidence,{recursive:true})
    const rental=await h.cmd('member.save',{name:'Morgan Lee',email:home.ownerEmail,pmsRole:'rental_owner',propertyIds:[home.id],actions:['owners:read'],active:true});await h.cmd('member.invite',{id:rental.id});const rentalCookie=await h.signIn(home.ownerEmail)
    browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
    for (const width of [1440,390]) {
      const ownerContext = await browser.newContext({viewport:{width,height:1000}})
      let staffContext
      try {
        const rentalContext=await browser.newContext({viewport:{width,height:1000}});try{const [name,value]=rentalCookie.split('=');await rentalContext.addCookies([{name,value,url:h.origin}]);const page=await rentalContext.newPage();const opened=await page.goto(h.origin+'/app');assert.equal(opened.status(),200);await expect(page.locator('body')).toContainText(home.name);await expect(page.locator('body')).not.toContainText(otherHome.name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'rental-owner portal fits viewport');await page.screenshot({path:`${evidence}/rental-owner-${width}.png`,fullPage:true})}finally{await rentalContext.close()}
        const [ownerName,ownerValue] = h.owner.split('=')
        await ownerContext.addCookies([{name:ownerName,value:ownerValue,url:h.origin}])
        const ownerPage = await ownerContext.newPage(); ownerPage.setDefaultTimeout(12000)
        await ownerPage.goto(h.origin+'/app/people')
        const add = ownerPage.locator('form').filter({has:ownerPage.getByRole('button',{name:'Save team member',exact:true})})
        const memberName = `Jamie Reservations ${width}`, email = `jamie-${width}@stay.example`
        await add.getByLabel('Name',{exact:true}).fill(memberName)
        await add.getByLabel('Email',{exact:true}).fill(email)
        await add.getByLabel('PMS role',{exact:true}).selectOption('reservation')
        await add.getByRole('checkbox',{name:home.name,exact:true}).check()
        await expect(add.getByRole('checkbox',{name:otherHome.name,exact:true})).not.toBeChecked()
        await add.getByText('Action scope',{exact:true}).click()
        for (const action of ['calendar:read','reservations:read','booking.details']) await add.getByRole('checkbox',{name:action,exact:true}).check()
        assert.ok(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'team form fits the viewport')
        await add.screenshot({path:`${evidence}/team-form-${width}.png`})
        await add.getByRole('button',{name:'Save team member',exact:true}).click()
        const member = ownerPage.locator('article.record').filter({has:ownerPage.getByRole('heading',{name:memberName,exact:true})})
        await expect(member).toContainText('Reservation staff')
        await expect(member).toContainText(home.name)
        await expect(member).not.toContainText(otherHome.name)
        await member.screenshot({path:`${evidence}/saved-member-${width}.png`})
        await member.getByRole('button',{name:'Send sign-in invitation',exact:true}).click()
        await expect(member.getByRole('button',{name:'Deactivate access',exact:true})).toBeVisible()

        // The invitation is delivered at the mail edge; confirmation uses the real auth door.
        const cookie = await h.signIn(email)
        staffContext = await browser.newContext({viewport:{width,height:1000}})
        const [staffName,staffValue] = cookie.split('=')
        await staffContext.addCookies([{name:staffName,value:staffValue,url:h.origin}])
        const staffPage = await staffContext.newPage(); staffPage.setDefaultTimeout(12000)
        const calendar = await staffPage.goto(h.origin+'/app/calendar?from='+date(2)+'&days=7')
        assert.equal(calendar.status(),200)
        await expect(staffPage.getByLabel('Property',{exact:true})).toContainText(home.name)
        await expect(staffPage.locator('body')).not.toContainText(otherHome.name)
        await expect(staffPage.locator('body')).not.toContainText('Daniel Ortiz')
        const visible = await staffPage.request.get(h.origin+'/api/cabin/state')
        assert.equal(visible.status(),200)
        const state = await visible.json()
        assert.deepEqual(state.properties.map(p=>p.id),[home.id])
        assert.deepEqual(state.bookings.map(b=>b.id),[stay.bookingId])

        await staffPage.goto(h.origin+'/app/reservations')
        const arrival = staffPage.locator(`#stay-${stay.bookingId}`)
        await arrival.getByText('Guest, contact and arrival time',{exact:true}).click()
        const updatedName = `Mira Bennett · arrival checked ${width}`
        await arrival.getByLabel('Guest name',{exact:true}).fill(updatedName)
        await arrival.getByRole('button',{name:'Save guest details',exact:true}).click()
        await expect(staffPage.locator(`#stay-${stay.bookingId}`).getByLabel('Guest name',{exact:true})).toHaveValue(updatedName)
        await expect(staffPage.locator('body')).not.toContainText(otherHome.name)
        assert.ok(await staffPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'scoped reservations fit the viewport')
        await staffPage.screenshot({path:`${evidence}/scoped-staff-${width}.png`,fullPage:true})

        const foreign = (await h.state()).bookings.find(b=>b.id===otherStay.bookingId)
        const denied = await staffPage.request.post(h.origin+'/api/cabin/command',{headers:{origin:h.origin},data:{name:'booking.details',input:{id:foreign.id,revision:foreign.revision,propertyId:home.id,guestName:'Changed outside grant'}}})
        assert.equal(denied.status(),404,'an allowed action cannot target another home, even with a permitted property ID')
        const credential = await staffPage.request.post(h.origin+'/api/cabin/command',{headers:{origin:h.origin},data:{name:'agent.create',input:{label:'synthetic-cabin-1'}}})
        assert.equal(credential.status(),403,'reservation staff cannot issue credentials')
        const access = await staffPage.request.get(h.origin+'/api/cabin/access')
        assert.equal(access.status(),403,'reservation staff cannot read access credentials')
        assert.equal((await h.state()).bookings.find(b=>b.id===foreign.id).guestName,'Daniel Ortiz')

        await member.getByRole('button',{name:'Deactivate access',exact:true}).click()
        await expect(member).toContainText('Inactive')
        const revoked = await staffPage.goto(h.origin+'/app/calendar')
        assert.equal(revoked.status(),403,'the existing staff session is refused immediately after offboarding')
        await expect(staffPage.locator('body')).not.toContainText(home.name)
        await staffPage.screenshot({path:`${evidence}/revoked-access-${width}.png`,fullPage:true})
      } finally {
        if (staffContext) await staffContext.close()
        await ownerContext.close()
      }
    }
  } finally { if (browser) await browser.close(); await h.close() }
})
