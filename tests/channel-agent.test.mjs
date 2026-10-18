import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from './harness.mjs'
import { channelEdge,provision } from './channel-agent-edge.mjs'
const dates={start:'2026-12-10',end:'2026-12-13'}

test('channel agent connects isolated profiles, closes other channels from an iCal booking, and safely reopens its own closures',async()=>{
 let feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:megan-stay\r\nDTSTART;VALUE=DATE:20261210\r\nDTEND;VALUE=DATE:20261213\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
 const h=await harness({outbound:()=>new Response(feed)}),edge=await channelEdge()
 try{
  const {home,runner}=await provision(h,edge)
  let state=await h.state();assert.equal(state.channelAgent.profiles.filter(p=>p.status==='connected').length,3)
  const stored=JSON.stringify((await h.db.prepare("SELECT data FROM cb_records WHERE kind='channelAgentProfiles'").all()).results)
  assert.ok(!stored.includes('recorded-channel-session'));assert.ok(!JSON.stringify(state).includes('stateSealed'))
  await h.cmd('channel.connect',{propertyId:home.id,channel:'airbnb',url:'https://calendar.stay.example/airbnb.ics'})
  state=await h.state();const booking=state.bookings.find(b=>b.uid==='megan-stay')
  assert.ok(booking)
  const closes=state.channelAgent.actions.filter(a=>a.kind==='close');assert.deepEqual(closes.map(a=>a.channel).sort(),['booking.com','vrbo'])
  for(let n=0;n<2;n++){
   const {job}=await runner({op:'claim'});assert.equal(job.kind,'close');assert.equal(job.bookingId,booking.id)
   const result=await edge.run(job);assert.equal(result.outcome,'succeeded');assert.equal(result.canUndo,true)
   await runner({op:'complete',id:job.id,lease:job.lease,...result})
  }
  const closed=(await h.state()).channelAgent.actions.find(a=>a.kind==='close')
  assert.ok(closed.before&&closed.after)
  const image=await h.send(`/api/cabin/channel-agent/evidence?id=${encodeURIComponent(closed.id)}&side=after`,undefined,h.owner)
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png')
  await h.cmd('channelAgent.undo',{id:closed.id},h.owner,409)
  feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';await h.cmd('channel.sync',{id:home.id+':airbnb'})
  await h.cmd('channelAgent.undo',{id:closed.id})
  const {job}=await runner({op:'claim'});assert.equal(job.kind,'open')
  const result=await edge.run(job);assert.equal(result.outcome,'succeeded');assert.equal(result.result,'open')
  await runner({op:'complete',id:job.id,lease:job.lease,...result})
  assert.equal((await h.state()).channelAgent.actions.find(a=>a.id===job.id).status,'succeeded')
  const page=await h.send('/app/channels',undefined,h.owner);assert.equal(page.status,200);assert.ok(page.text.includes('side=before'));assert.ok(page.text.includes('side=after'))
  // A direct booking enters the identical commit hook and closes all three OTAs.
  const direct=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',...dates})
  assert.equal((await h.state()).channelAgent.actions.filter(a=>a.bookingId===direct.bookingId&&a.kind==='close').length,3)
 }finally{await edge.close();await h.close()}
})

test('a two-factor or CAPTCHA channel page stops before any write, retains no security evidence and asks the host',async()=>{
 const h=await harness(),edge=await channelEdge()
 try{
  const {home,runner}=await provision(h,edge,['vrbo'])
  for(const mode of ['2fa','captcha']){
   edge.mode=mode
   const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',...dates})
   const {job}=await runner({op:'claim'});assert.equal(job.kind,'close')
   const writes=edge.writes,result=await edge.run(job)
   assert.equal(result.outcome,'needs_you');assert.equal(result.challenge,mode);assert.equal(edge.writes,writes)
   assert.equal(result.before,undefined);assert.equal(result.after,undefined)
   await runner({op:'complete',id:job.id,lease:job.lease,...result})
   const state=await h.state(),profile=state.channelAgent.profiles[0],action=state.channelAgent.actions.find(a=>a.id===job.id)
   assert.equal(profile.status,'needs_you');assert.equal(profile.challenge,mode);assert.equal(action.status,'needs_you');assert.equal(action.before,false);assert.equal(action.after,false)
   assert.ok(state.notices.some(n=>n.recordId===job.id&&n.kind==='inbox'))
   assert.equal((await runner({op:'claim'})).job,null)
   await h.cmd('channelAgent.undo',{id:job.id},h.owner,409)
   assert.equal((await h.send('/app/channels',undefined,h.owner)).status,200)
   // Host releases the test booking and completes sign-in in the same encrypted profile.
   const booking=state.bookings.find(b=>b.id===request.bookingId)
   await h.cmd('reservation.cancel',{id:booking.id,revision:booking.revision})
   edge.mode=''
   await h.cmd('channelAgent.connect',{propertyId:home.id,channel:'vrbo',listingUrl:profile.listingUrl})
   const connect=(await runner({op:'claim'})).job,result2=await edge.run(connect,{human:true})
   assert.equal(result2.outcome,'succeeded');await runner({op:'complete',id:connect.id,lease:connect.lease,...result2})
  }
 }finally{await edge.close();await h.close()}
})

test('runner and evidence doors enforce owner authority, reject stale completions, and leave ambiguous writes for a human',async()=>{
 const h=await harness(),edge=await channelEdge()
 try{
  const {home,runner,key}=await provision(h,edge,['vrbo'])
  const cleaner=await h.person('Ana'),manager=await h.person('Alex','manager')
  await h.cmd('channelAgent.runner.create',{},cleaner.cookie,403)
  await h.cmd('channelAgent.runner.create',{},manager.cookie,403)
  assert.equal((await h.send('/api/cabin/channel-agent/runner',{op:'claim'},h.owner)).status,401)
  assert.equal((await h.send('/api/cabin/channel-agent/evidence?id=anything&side=before',undefined,cleaner.cookie)).status,403)
  await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',...dates})
  const {job}=await runner({op:'claim'})
  assert.equal((await runner({op:'authorize',id:job.id,lease:job.lease})).allowed,true)
  const sharing=(await h.state()).sharing.find(p=>p.id==='calendars')
  const off=await h.cmd('provider.sharing',{id:'calendars',enabled:false,revision:sharing.revision})
  await runner({op:'authorize',id:job.id,lease:job.lease},409)
  await h.cmd('provider.sharing',{id:'calendars',enabled:true,revision:off.revision,confirm:'yes'})
  const bad=await runner({op:'complete',id:job.id,lease:'wrong',outcome:'succeeded',result:'closed'},409)
  assert.ok(bad.error)
  await runner({op:'complete',id:job.id,lease:job.lease,outcome:'uncertain'})
  assert.equal((await runner({op:'claim'})).job,null)
  const state=await h.state();assert.equal(state.channelAgent.profiles[0].status,'needs_you')
  assert.equal(state.channelAgent.actions.find(a=>a.id===job.id).status,'uncertain')
  await h.cmd('channelAgent.retry',{id:job.id},h.owner,409)
  await h.cmd('channelAgent.runner.create',{})
  assert.equal((await h.send('/api/cabin/channel-agent/runner',{op:'claim'},'',{authorization:'Bearer '+key.token})).status,403)
 }finally{await edge.close();await h.close()}
})
