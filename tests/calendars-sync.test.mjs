import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from './harness.mjs'
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const feed = (start, end) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:shared-id\r\nDTSTART;VALUE=DATE:${start.replaceAll('-', '')}\r\nDTEND;VALUE=DATE:${end.replaceAll('-', '')}\r\nSUMMARY:Reserved - Private guest\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

test('SYNC-009: independent external calendars retain blocks through failure, assign exceptions and recover on Cron', async () => {
 let mode = 'ok', body = feed(day(10), day(13))
 const h = await harness({outbound: request => new URL(request.url).pathname === '/other.ics' ? new Response(feed(day(20), day(22))) : mode === 'down' ? new Response('Unavailable', {status:503}) : new Response(mode === 'bad' ? 'not a calendar' : body)})
 try {
  const home = await h.cmd('property.save', {name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
  const input = {propertyId:home.id,channel:'ical',name:'Partner calendar',url:'https://calendar.stay.example/home.ics'}
  const first = await h.cmd('channel.connect', input), id = first.connection.id
  assert.equal(first.connection.status, 'ok')
  const other = await h.cmd('channel.connect', {...input,name:'Hipcamp',url:'https://calendar.stay.example/other.ics',intervalMinutes:30})
  assert.notEqual(other.connection.id,id)
  let state = await h.state()
  assert.equal(state.bookings.filter(b=>b.status==='confirmed').length,2)
  assert.ok(state.bookings.every(b=>b.kind==='block' && !b.guestName))
  assert.equal(state.turnovers.length,0); assert.equal(state.scheduled.length,0); assert.equal(state.codes.length,0)
  const conflict = await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',start:day(11),end:day(12)})
  assert.equal(conflict.status,'declined')
  const publish = await h.cmd('export.publish',{propertyId:home.id})
  const path = `/ical/${publish.token}/all.ics`
  assert.match((await h.send(path,undefined,'')).text,/SUMMARY:Not available/)
  mode='down'; await h.cmd('channel.sync',{id})
  state = await h.state(); let connection=state.connections.find(r=>r.id===id)
  assert.equal(connection.status,'stale');assert.ok(connection.exception.assignedTo);assert.equal(connection.exception.resolvedAt,null)
  const exceptionId=connection.exception.id
  const manager=await h.cmd('member.save',{name:'Ana Diaz',email:'ana@stay.example',role:'manager',active:true})
  await h.cmd('channel.assign',{id,assignedTo:manager.id})
  const page = await h.send('/app/channels',undefined,h.owner)
  assert.equal(page.status,200);assert.match(page.text,/Ana Diaz/);assert.match(page.text,/role="alert"/)
  mode='bad';await h.cmd('channel.sync',{id})
  state=await h.state();connection=state.connections.find(r=>r.id===id)
  assert.equal(connection.exception.id,exceptionId);assert.equal(connection.exception.assignedTo,manager.id)
  assert.equal(state.bookings.filter(b=>b.status==='confirmed').length,2)
  const revision=connection.revision
  const updated=await h.cmd('channel.update',{id,revision,propertyId:home.id,channel:'ical',name:'Repaired partner',url:input.url,intervalMinutes:45})
  assert.equal(updated.connection.exception.assignedTo,manager.id)
  await h.cmd('channel.update',{id,revision,propertyId:home.id,channel:'ical',name:'Stale edit',url:input.url,intervalMinutes:15},h.owner,409)
  mode='ok';body=feed(day(14),day(16))
  await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.nextPollAt','2000-01-01T00:00:00.000Z') WHERE kind='connections'").run()
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  state=await h.state();connection=state.connections.find(r=>r.id===id)
  assert.equal(connection.status,'ok');assert.ok(connection.exception.resolvedAt);assert.ok(connection.lastChangeAt);assert.ok(connection.nextPollAt>connection.lastSuccessAt)
  assert.equal(state.bookings.find(b=>b.connectionId===id).start,day(14))
  assert.equal(state.bookings.find(b=>b.connectionId===other.connection.id).start,day(20))
  body='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';await h.cmd('channel.sync',{id})
  assert.equal((await h.state()).bookings.find(b=>b.connectionId===id).status,'cancelled')
  await h.cmd('export.publish',{propertyId:home.id})
  assert.equal((await h.send(path,undefined,'')).status,404)
 } finally {await h.close()}
})
