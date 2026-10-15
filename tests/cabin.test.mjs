import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { run } from './harness.mjs'

const property = (h, extra = {}) => h.cmd('property.save', { name: 'Banksia House', ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 1500, ...extra })
const ics = events => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Cabin documented fixture//EN\r\n' + events.map(e => `BEGIN:VEVENT\r\nUID:${e.uid}\r\nDTSTART;VALUE=DATE:${e.start}\r\nDTEND;VALUE=DATE:${e.end}\r\nSUMMARY:${e.summary ?? 'Reserved'}\r\n${e.cancelled ? 'STATUS:CANCELLED\r\n' : ''}END:VEVENT\r\n`).join('') + 'END:VCALENDAR\r\n'
const event = { uid: 'stay-1', start: '20261101', end: '20261105', summary: 'Coastal stay' }
async function booking(h, p) {
  const d = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([event]) })
  await h.cmd('calendar.approve', { id: d.id, revision: d.revision })
  return (await h.state()).bookings.find(b => b.uid === event.uid)
}
const photo = (await readFile('tests/fixtures/checklist.png')).toString('base64')
const csv = 'external_id,name,owner_name,owner_email,commission_bps\nhome-one,Banksia House,Morgan Lee,morgan@stay.example,1500\nhome-two,Ocean Loft,Alex Chen,alex@stay.example,1000\n'

test('native invitations, current roles, cleaner isolation, CSRF and revoked access', () => run(async h => {
  await h.state('', 401)
  const p = await property(h), cleaner = await h.person('Taylor'), other = await h.person('Casey'), manager = await h.person('Riley', 'manager')
  await h.cmd('property.save', { name: 'Bad' }, cleaner.cookie, 403)
  await h.cmd('member.save', { name: 'Bad' }, manager.cookie, 403)
  await h.cmd('statement.prepare', { propertyId: p.id }, cleaner.cookie, 403)
  const result = await h.send('/api/cabin/command', { name: 'property.save', input: {} }, h.owner, { origin: 'https://cross.example' })
  assert.equal(result.status, 403)
  const visible = await h.state(other.cookie)
  assert.equal(visible.bookings.length, 0); assert.equal(visible.statements.length, 0)
  await h.cmd('member.save', { id: cleaner.id, revision: cleaner.revision, name: cleaner.name, email: cleaner.email, role: 'cleaner', active: false })
  await h.state(cleaner.cookie, 403)
}))

test('two calendar snapshots flag clashes, retain freshness and require exact reconciled approval', () => run(async h => {
  const p = await property(h)
  const first = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([event]) })
  assert.equal((await h.state()).bookings.length, 0)
  await h.cmd('calendar.approve', { id: first.id, revision: 'outdated' }, h.owner, 409)
  await h.cmd('calendar.approve', { id: first.id, revision: first.revision })
  const second = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Booking.com', calendar: ics([{ uid: 'booking-2', start: '20261104', end: '20261107' }]) })
  assert.equal(second.clashes.length, 1)
  await h.cmd('calendar.approve', { id: second.id, revision: second.revision })
  let state = await h.state()
  assert.equal(state.feeds.length, 2); assert.ok(state.feeds.every(f => f.importedAt && f.approvedAt))
  const same = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([event]) })
  await h.cmd('calendar.approve', { id: same.id, revision: same.revision })
  assert.equal((await h.state()).bookings.length, 2)
  const changed = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([{ ...event, end: '20261106' }]) })
  assert.equal((await h.state()).bookings.find(b => b.uid === event.uid).end.slice(0,10), '2026-11-05')
  await h.cmd('calendar.approve', { id: changed.id, revision: changed.revision })
  const removed = await h.cmd('calendar.prepare', { propertyId: p.id, channel: 'Airbnb', calendar: ics([]) })
  assert.equal((await h.state()).bookings.find(b => b.uid === event.uid).status, 'confirmed')
  await h.cmd('calendar.approve', { id: removed.id, revision: removed.revision })
  state = await h.state(); assert.equal(state.bookings.find(b => b.uid === event.uid).status, 'cancelled')
  assert.ok(state.approvals.every(a => a.actorId && a.revision))
}))

test('end-exclusive dates, stale snapshots and malformed calendar files cannot silently alter bookings', () => run(async h => {
  const p = await property(h); await booking(h,p)
  const adjacent = await h.cmd('calendar.prepare', { propertyId:p.id,channel:'Booking.com',calendar:ics([{uid:'adjacent',start:'20261105',end:'20261108'}]) })
  assert.equal(adjacent.clashes.length,0)
  const rival = await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261106'}])})
  const fresh = await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261107'}])})
  await h.cmd('calendar.approve',{id:fresh.id,revision:fresh.revision})
  await h.cmd('calendar.approve',{id:rival.id,revision:rival.revision},h.owner,409)
  await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:'not a calendar'},h.owner,400)
  await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:ics([{...event,end:'20261031'}])},h.owner,400)
}))

test('approved turnover reaches only its cleaner and needs all checks plus authenticated photo evidence', () => run(async h => {
  const p=await property(h),b=await booking(h,p),cleaner=await h.person('Taylor'),other=await h.person('Casey')
  const draft=await h.cmd('turnover.prepare',{bookingId:b.id,cleanerId:cleaner.id,checklist:['Linen changed','Keys checked']})
  assert.equal((await h.state(cleaner.cookie)).turnovers.length,0)
  await h.cmd('turnover.approve',{id:draft.id,revision:draft.revision},cleaner.cookie,403)
  await h.cmd('turnover.approve',{id:draft.id,revision:draft.revision})
  assert.equal((await h.state(cleaner.cookie)).turnovers.length,1)
  assert.equal((await h.state(other.cookie)).turnovers.length,0)
  const input={id:draft.id,revision:draft.revision,checks:draft.checklist,photo,mimeType:'image/png',caption:'Linen and keys ready'}
  await h.cmd('turnover.complete',input,other.cookie,404)
  await h.cmd('turnover.complete',{...input,checks:['Linen changed']},cleaner.cookie,400)
  await h.cmd('turnover.complete',{...input,photo:btoa('not an image')},cleaner.cookie,400)
  const done=await h.cmd('turnover.complete',input,cleaner.cookie)
  assert.equal(done.status,'completed')
  const path=`/api/cabin/turnovers/${draft.id}/photo`
  assert.equal((await h.send(path,undefined,'')).status,401)
  assert.equal((await h.send(path,undefined,other.cookie)).status,404)
  const response=await h.mf.dispatchFetch(h.origin+path,{headers:{cookie:cleaner.cookie}})
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(photo,'base64'))
  await h.cmd('turnover.complete',input,cleaner.cookie,409)
}))

test('owner statement amounts are integer cents, approved once per month and frozen with safe CSV cells', () => run(async h => {
  const p=await property(h,{name:'=HYPERLINK("https://formula.example")'}),cleaner=await h.person('Taylor')
  const input={propertyId:p.id,month:'2026-11',lines:[{description:'=Income',amountCents:125001},{description:'Cleaning',amountCents:-10000}]}
  await h.cmd('statement.prepare',{...input,lines:[{description:'Fractional',amountCents:0.1}]},h.owner,400)
  const d=await h.cmd('statement.prepare',input),rival=await h.cmd('statement.prepare',input)
  assert.equal(d.managementFeeCents,17250);assert.equal(d.netCents,97751)
  await h.cmd('statement.approve',{id:d.id,revision:'old'},h.owner,409)
  await h.cmd('statement.approve',{id:d.id,revision:d.revision})
  await h.cmd('statement.approve',{id:rival.id,revision:rival.revision},h.owner,409)
  const path=`/api/cabin/statements/${d.id}.csv`,a=await h.send(path,undefined,h.owner)
  assert.equal(a.status,200);assert.ok(a.text.includes("'=Income"));assert.ok(a.text.includes('97751'))
  assert.equal((await h.send(path,undefined,cleaner.cookie)).status,403)
  const fields=new URLSearchParams({propertyId:p.id,month:'2026-12'});fields.append('lineDescription','Room income');fields.append('lineAmount','12.75');fields.append('lineDescription','Cleaning');fields.append('lineAmount','-2.25')
  const form=await h.mf.dispatchFetch(h.origin+'/app/action?name=statement.prepare&returnTo=/app/statements',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:fields.toString()});assert.equal(form.status,200)
  const natural=(await h.state()).statements.find(s=>s.month==='2026-12');assert.deepEqual(natural.lines.map(l=>l.amountCents),[1275,-225]);assert.equal(natural.grossCents,1050)
  await h.cmd('property.save',{...p,ownerName:'Updated owner',commissionBps:2000})
  assert.equal((await h.send(path,undefined,h.owner)).text,a.text)
}))

test('bearer agents prepare all three jobs but no approval door, and revocation is immediate', () => run(async h => {
  const p=await property(h),b=await booking(h,p),cleaner=await h.person('Taylor'),key=await h.cmd('agent.create',{label:'Operations assistant'})
  const headers={authorization:`Bearer ${key.token}`}
  const send=(name,input)=>h.send('/api/cabin/agent/command',{name,input},'',headers)
  assert.equal((await h.send('/api/cabin/agent/context',undefined,'',headers)).status,200)
  for(const [name,input] of [['calendar.prepare',{propertyId:p.id,channel:'Booking.com',calendar:ics([{uid:'next',start:'20261108',end:'20261110'}])}],['turnover.prepare',{bookingId:b.id,cleanerId:cleaner.id,checklist:['Check keys']}],['statement.prepare',{propertyId:p.id,month:'2026-11',lines:[{description:'Income',amountCents:10000}]}]]){
    const prepared=await send(name,input);assert.equal(prepared.status,200,prepared.text)
    const d=prepared.value.result
    assert.equal((await send(name.replace('.prepare','.approve'),{id:d.id,revision:d.revision})).status,403)
  }
  assert.equal((await h.send('/api/cabin/command',{name:'statement.approve',input:{}},'',headers)).status,401)
  await h.cmd('agent.revoke',{id:key.id})
  assert.equal((await h.send('/api/cabin/agent/context',undefined,'',headers)).status,401)
}))

test('property-register move-in previews inertly, records the journal and guards undo against native edits', () => run(async h => {
  const preview=await h.cmd('import.preview',{csv})
  assert.equal((await h.state()).properties.length,0)
  await h.cmd('import.approve',{id:preview.id,fingerprint:'unreviewed'},h.owner,409)
  await h.cmd('import.approve',{id:preview.id,fingerprint:preview.fingerprint})
  assert.equal((await h.state()).properties.length,2)
  assert.ok((await h.state()).importJobs.some(j=>j.id===preview.id))
  await h.cmd('import.undo',{id:preview.id})
  assert.equal((await h.state()).properties.length,0)
  const again=await h.cmd('import.preview',{csv});await h.cmd('import.approve',{id:again.id,fingerprint:again.fingerprint})
  const p=(await h.state()).properties[0]
  await h.cmd('property.save',{...p,name:'Native correction'})
  const undo=await h.cmd('import.undo',{id:again.id}); assert.ok(undo.report.dispositions.some(d=>d.disposition==='retained' && d.reason==='edited'))
  assert.equal((await h.state()).properties.find(r=>r.id===p.id).name,'Native correction')
}))
