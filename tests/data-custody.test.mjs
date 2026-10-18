import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0,10)
const feed = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:CUSTODY123\r\nDTSTART;VALUE=DATE:${day(-10).replaceAll('-','')}\r\nDTEND;VALUE=DATE:${day(-7).replaceAll('-','')}\r\nSUMMARY:Reserved - Megan Ortiz\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

test('DATA-003: populated product records stay in installation storage and disconnected providers receive no further requests', async () => {
 const requests = []
 const h = await harness({ outbound: request => { requests.push(new URL(request.url).origin); return new Response(feed) } })
 try {
  const p = await h.cmd('property.save',{ name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000 })
  const cleaner = await h.person('Luis')
  await h.cmd('home.settings',{propertyId:p.id,address:'14 Lake View Drive, Asheville, NC',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Linen changed'],photosRequired:1})
  const connected = await h.cmd('channel.connect',{propertyId:p.id,channel:'airbnb',url:'https://calendar.stay.example/lake.ics'})
  assert.equal(connected.connection.status,'ok',connected.connection.error)
  let s = await h.state(), b = s.bookings.find(b=>b.uid==='CUSTODY123')
  await h.cmd('booking.details',{id:b.id,revision:b.revision,guestName:'Megan Ortiz',guestEmail:'megan@stay.example'})
  await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
  await h.cmd('inbox.try',{source:'From: Megan Ortiz <megan@stay.example>\r\nTo: guests@stay.example\r\nSubject: Arrival\r\nMessage-ID: <custody@stay.example>\r\nContent-Type: text/plain\r\n\r\nWhere do I park?'})
  await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:`Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n${day(-6)},Reservation,CUSTODY123,${day(-10)},3,USD,1000.00,30.00,970.00,CUSTODY-PAYOUT\n`})
  const t = await h.cmd('turnover.prepare',{bookingId:b.id,cleanerId:cleaner.id,checklist:['Linen changed']})
  await h.cmd('turnover.approve',{id:t.id,revision:t.revision})
  await h.cmd('turnover.complete',{id:t.id,revision:t.revision,checks:t.checklist,photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png',caption:'Lake Loft linen'},cleaner.cookie)
  s = await h.state()
  assert.ok(s.guests.some(g=>g.identities.some(i=>i.kind==='email' && i.value==='megan@stay.example')))
  assert.ok(s.messages.some(m=>m.text==='Where do I park?'))
  assert.equal(s.payouts.find(p=>p.payoutId==='CUSTODY-PAYOUT').netCents,97000)
  assert.ok((await h.db.prepare('SELECT COUNT(*) AS n FROM cb_photos').first()).n > 0)
  const count = (await h.db.prepare("SELECT COUNT(*) AS n FROM cb_records WHERE kind IN ('bookings','guests','messages','payouts')").first()).n
  assert.ok(count >= 4)
  assert.deepEqual([...new Set(requests)],['https://calendar.stay.example'])
  const published = await h.cmd('export.publish',{propertyId:p.id})
  const exportUrl = `/ical/${published.token}/all.ics`
  assert.equal((await h.send(exportUrl)).status,200)
  let control = s.sharing.find(p=>p.id==='calendars')
  await h.cmd('provider.sharing',{id:control.id,revision:control.revision,enabled:false},cleaner.cookie,403)
  await h.cmd('provider.sharing',{id:control.id,revision:control.revision,enabled:false})
  const before = requests.length
  await h.cmd('channel.sync',{id:connected.connection.id})
  await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.nextPollAt','2000-01-01T00:00:00.000Z') WHERE kind='connections'").run()
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  assert.equal(requests.length,before)
  assert.equal((await h.send(exportUrl)).status,503)
  assert.ok((await h.state()).bookings.some(r=>r.id===b.id && r.status==='confirmed'))
  control = (await h.state()).sharing.find(p=>p.id==='calendars')
  await h.cmd('provider.sharing',{id:control.id,revision:control.revision,enabled:true},h.owner,400)
  await h.cmd('provider.sharing',{id:control.id,revision:control.revision,enabled:true,confirm:'yes'})
  await h.cmd('channel.sync',{id:connected.connection.id})
  assert.ok(requests.length > before)
  const mail = (await h.state()).sharing.find(p=>p.id==='mail')
  await h.cmd('provider.sharing',{id:'mail',revision:mail.revision,enabled:false})
  const deliveries = (await h.db.prepare('SELECT COUNT(*) AS n FROM rer_mail_development_outbox').first()).n
  const m = await h.cmd('member.save',{name:'Ana',email:'ana@stay.example',role:'cleaner',active:true})
  await h.cmd('member.invite',{id:m.id},h.owner,409)
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM rer_mail_development_outbox').first()).n,deliveries)
 } finally { await h.close() }
})
