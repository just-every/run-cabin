import { rooms, sourceRoom } from './capacity-support.mjs'
import { channelScreens } from './linked-channel-browser.mjs'
import { erase } from './privacy-flow.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from './harness.mjs'
import { channelEdge,provision } from './channel-agent-edge.mjs'
const dates={start:'2026-12-10',end:'2026-12-13'}

test('channel agent connects isolated profiles, closes other channels from an iCal booking, and safely reopens its own closures',async()=>{
 let feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:megan-stay\r\nDTSTART;VALUE=DATE:20261210\r\nDTEND;VALUE=DATE:20261213\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
 const h=await harness({assets:true,outbound:()=>new Response(feed)}),edge=await channelEdge(),screens=await channelScreens(h)
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
  const {a,b}=await rooms(h,home)
  for(const [room,width] of [[a,1440],[b,390]])for(const channel of ['airbnb','vrbo','booking.com']){
   await screens.connect(room,channel,width)
   const {job}=await runner({op:'claim'});assert.equal(job.kind,'connect');assert.equal(job.propertyId,room.id)
   const result=await edge.run(job,{human:true});assert.equal(result.outcome,'succeeded');await runner({op:'complete',id:job.id,lease:job.lease,...result})
  }
  await h.cmd('channelAgent.connect',{propertyId:b.id,channel:'airbnb',confirm:'yes',listingId:'room-a',listingUrl:'https://www.airbnb.com/hosting/calendar/room-b'},h.owner,409)
  await h.cmd('channelAgent.connect',{propertyId:b.id,channel:'airbnb',confirm:'yes',listingId:'another-room',listingUrl:'https://www.airbnb.com/hosting/calendar/room-a'},h.owner,409)
  await h.restart();assert.equal((await h.state()).channelAgent.profiles.filter(p=>p.status==='connected').length,9)
  await screens.capture('linked-profiles')
  await sourceRoom(h,a,dates.start,dates.end)
  const roomClosures=(await h.state()).channelAgent.actions.filter(a=>a.kind==='close'&&a.status==='queued')
  assert.deepEqual(roomClosures.filter(job=>job.propertyId===home.id).map(job=>job.channel).sort(),['airbnb','booking.com','vrbo'])
  assert.deepEqual(roomClosures.filter(job=>job.propertyId===a.id).map(job=>job.channel).sort(),['booking.com','vrbo'])
  assert.ok(roomClosures.every(job=>job.propertyId!==b.id),'independent room B has no closure')
  const sharedClosure=roomClosures.find(job=>job.propertyId===home.id&&job.channel==='airbnb')
  const roomB=await h.cmd('reservation.request',{propertyId:b.id,channel:'direct',guestName:'Independent room B',...dates});assert.equal(roomB.status,'accepted')
  for(let n=0;n<11;n++){const {job}=await runner({op:'claim'});assert.equal(job.kind,'close');const result=await edge.run(job);assert.equal(result.outcome,'succeeded');await runner({op:'complete',id:job.id,lease:job.lease,...result})}
  await sourceRoom(h,a,dates.start,dates.end,true)
  await h.cmd('channelAgent.undo',{id:sharedClosure.id},h.owner,409)
  const roomBStay=(await h.state()).bookings.find(row=>row.id===roomB.bookingId);await h.cmd('reservation.cancel',{id:roomBStay.id,revision:roomBStay.revision})
  await h.cmd('channelAgent.undo',{id:sharedClosure.id});const reopening=(await runner({op:'claim'})).job;assert.equal(reopening.kind,'open');const reopened=await edge.run(reopening);assert.equal(reopened.outcome,'succeeded');await runner({op:'complete',id:reopening.id,lease:reopening.lease,...reopened})
  // A direct booking enters the identical commit hook and closes all three OTAs.
  const direct=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',...dates})
  const wholeClosures=(await h.state()).channelAgent.actions.filter(a=>a.bookingId===direct.bookingId&&a.kind==='close')
  for(const listing of [home,a,b])assert.deepEqual(wholeClosures.filter(job=>job.propertyId===listing.id).map(job=>job.channel).sort(),['airbnb','booking.com','vrbo'])
  const original=await h.person('Original'),backup=await h.person('Backup')
  await h.cmd('home.settings',{propertyId:home.id,revision:(await h.state()).homeSettings.find(s=>s.propertyId===home.id).revision,address:'12 Lake Road',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:original.id,checklist:['Ready']})
  await h.cmd('recovery.settings',{propertyId:home.id,cleanerIds:[original.id,backup.id],auto:false,creditLimitCents:0,cleaningLimitCents:0})
  let recovery=await h.cmd('recovery.open',{bookingId:direct.bookingId,trigger:'cleaner_cancelled',reason:'Replacement preparation must not skip pending channel closure'})
  recovery=await h.cmd('recovery.propose',{id:recovery.id,revision:recovery.revision,cleanerId:backup.id,creditCents:0,extraCleaningCents:0,why:'Approved backup; channel acknowledgements remain outstanding'})
  await h.cmd('recovery.approve',{id:recovery.id,revision:recovery.revision});recovery=(await h.state()).recoveries.find(r=>r.id===recovery.id)
  const refused=await h.cmd('recovery.close',{id:recovery.id,revision:recovery.revision},h.owner,409)
  assert.match(refused.error,/has not confirmed the current closure/)
  for(let n=0;n<9;n++){const {job}=await runner({op:'claim'});assert.equal(job.kind,'close');const result=await edge.run(job);assert.equal(result.outcome,'succeeded');await runner({op:'complete',id:job.id,lease:job.lease,...result})}
  const accepted=(await h.state()).channelAgent.actions.filter(a=>a.bookingId===direct.bookingId&&a.kind==='close')
  assert.ok(accepted.every(job=>job.status==='succeeded'&&job.result==='closed'&&job.before&&job.after))
  const profiles=(await h.state()).channelAgent.profiles,roomProfile=profiles.find(p=>p.propertyId===a.id&&p.channel==='airbnb'),sibling=profiles.find(p=>p.propertyId===b.id&&p.channel==='airbnb')
  await h.cmd('channelAgent.disconnect',{id:roomProfile.id})
  assert.equal((await h.state()).channelAgent.profiles.filter(p=>p.status==='connected').length,8)
  await screens.connect(a,'airbnb',1440)
  const connecting=(await runner({op:'claim'})).job;assert.equal(connecting.kind,'connect');assert.equal(connecting.propertyId,a.id)
  assert.equal((await h.state()).channelAgent.profiles.find(p=>p.propertyId===a.id&&p.channel==='airbnb').id,roomProfile.id)
  const connected=await edge.run(connecting,{human:true});assert.equal(connected.outcome,'succeeded');await runner({op:'complete',id:connecting.id,lease:connecting.lease,...connected})
  const replacement=(await runner({op:'claim'})).job;assert.equal(replacement.kind,'close');assert.equal(replacement.propertyId,a.id)
  const replaced=await edge.run(replacement);assert.equal(replaced.outcome,'succeeded');await runner({op:'complete',id:replacement.id,lease:replacement.lease,...replaced})
  const unchanged=(await h.state()).channelAgent.profiles.find(p=>p.id===sibling.id);assert.equal(unchanged.generation,sibling.generation);assert.equal(unchanged.status,'connected')
  assert.equal((await runner({op:'claim'})).job,null)
  await screens.capture('whole-home-closures')

 }finally{await screens.close();await edge.close();await h.close()}
})

test('a two-factor or CAPTCHA channel page stops before any write, retains no security evidence and asks the host',async()=>{
 const h=await harness(),edge=await channelEdge()
 try{
  const {home,runner}=await provision(h,edge,['vrbo'])
  for(const mode of ['2fa','captcha','terms']){
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
   await h.cmd('channelAgent.connect',{propertyId:home.id,channel:'vrbo',confirm:'yes',listingId:'lake-loft',listingUrl:profile.listingUrl})
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

test('SYNC-011 RES-002 MESSAGE-001 FIN-002: browser reads all channels into native stays, one guest thread and matched settlements exactly once',async()=>{
 const h=await harness({assets:true}),edge=await channelEdge(),screens=await channelScreens(h)
 try{
  const {home,runner}=await provision(h,edge)
  const read=async(channel,kind)=>{
   const profile=(await h.state()).channelAgent.profiles.find(p=>p.channel===channel)
   await h.cmd('channelAgent.read',{id:profile.id,kind:'read-'+kind,readUrl:`https://www.${channel==='booking.com'?'booking.com':channel+'.com'}/hosting/lake-loft/${kind}`,confirm:'yes'})
   // Native reservation commits also queue closure work; complete those first.
   for(;;){const {job}=await runner({op:'claim'});assert.ok(job);const result=await edge.run(job);assert.equal(result.outcome,'succeeded');const receipt=await runner({op:'complete',id:job.id,lease:job.lease,...result});assert.equal(receipt.status,'succeeded');if(job.kind==='read-'+kind)return job}
  }
  for(const channel of ['airbnb','vrbo','booking.com']){
   await read(channel,'reservations');await read(channel,'reservations')
   await read(channel,'messages');await read(channel,'messages')
   await read(channel,'payouts');await read(channel,'payouts')
  }
  const nativeReplay=await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv:'Transaction ID,Payout ID,Confirmation code,Date,Currency,Gross earnings,Host service fee,Amount,Type,Guest name\nTX-100,PAID-100,STAY-100,2026-10-01,USD,1000.00,30.00,970.00,reservation,Megan Ortiz\n'});assert.equal(nativeReplay.imported.length,0);assert.equal(nativeReplay.duplicates.length,1)
  const s=await h.accessState(),bookings=s.bookings.filter(b=>b.guestName==='Megan Ortiz'),incoming=s.messages.filter(m=>m.direction==='in')
  assert.equal(bookings.length,3);assert.equal(incoming.length,3);assert.equal(s.payouts.length,3)
  for(const b of bookings){assert.equal(incoming.filter(m=>m.bookingId===b.id).length,1);assert.equal(s.payouts.filter(p=>p.bookingId===b.id&&p.match==='matched'&&p.netCents===97000).length,1)}
  assert.ok(s.messages.filter(m=>m.direction==='out').every(m=>m.status==='draft'||m.status==='unavailable'),'reads never send a reply')
  assert.ok(incoming.every(m=>m.sentAt==='2026-10-01T16:00:00.000Z'))
  // Equal contact text alone does not collapse identities; the operator reviews
  // the real source reservation references before joining their guest history.
  let guests=(await h.state()).guests.filter(g=>bookings.some(b=>b.id===g.bookingId));const root=guests[0].id
  for(const from of guests.slice(1)){const state=await h.state(),a=state.guests.find(g=>g.id===from.id),b=state.guests.find(g=>g.id===root);await h.cmd('guest.merge',{id:a.id,revision:a.revision,intoId:b.id,intoRevision:b.revision,reason:'Guest confirmed all three source reservation references',confirm:'yes'})}

  const inbox=await h.send('/app/inbox',undefined,h.owner);assert.equal(inbox.status,200);assert.ok(inbox.text.includes('kitchen available'));assert.equal((inbox.text.match(/class="thread-row/g)||[]).length,1)
  const thread=/href="\/app\/inbox\?thread=([^"]+)/.exec(inbox.text)[1],reply=await h.cmd('message.compose',{thread,text:'Please see the kitchen guide.'});assert.equal((await h.state()).messages.find(m=>m.id===reply.id).status,'unavailable')
  await h.restart();assert.equal((await h.state()).payouts.length,3)
  const observations=(await h.db.prepare("SELECT data FROM cb_records WHERE kind='channelAgentReadObservations'").all()).results
  assert.equal(observations.length,18);assert.ok(!JSON.stringify(observations).includes('kitchen available'));assert.ok(!JSON.stringify(observations).includes('megan@'))
  // Emulate the previous edition's profile metadata; sessions and imported
  // business history already exist and must keep their original identities.
  const legacy=(await h.state()).channelAgent.profiles.find(p=>p.channel==='airbnb')
  const legacyHistory=await h.state()
  const sourceIds=(await h.db.prepare("SELECT id FROM cb_records WHERE kind='channelAgentReadSources' ORDER BY id").all()).results.map(r=>r.id)
  await h.db.batch([
   h.db.prepare("UPDATE cb_records SET data=json_remove(data,'$.channelAccountId','$.channelAccountName') WHERE kind IN ('bookings','messages','payouts') AND (json_extract(data,'$.channel')='airbnb' OR json_extract(data,'$.source')='airbnb')"),
   h.db.prepare("UPDATE cb_records SET data=json_remove(data,'$.accountId') WHERE kind='channelAgentProfiles' AND id=?").bind(legacy.id),
   h.db.prepare("DELETE FROM cb_records WHERE kind='channelAgentAccounts' AND id=?").bind(legacy.accountId)
  ])
  const initial=(await h.state()).channelAgent,profileA=initial.profiles.find(p=>p.channel==='airbnb'),accountA=profileA.accountId
  const oldProfileId=profileA.id,oldGeneration=profileA.generation
  const manager=await h.person('AccountManager','manager')
  await h.cmd('channelAgent.account.create',{channel:'airbnb',nickname:'Denied'},manager.cookie,403)
  await h.cmd('channelAgent.account.revoke',{id:accountA,confirm:'yes'},manager.cookie,403)
  await screens.accountSettings('rename',{id:accountA,nickname:'Mountain hosts'})
  assert.equal((await h.state()).channelAgent.profiles.find(p=>p.id===legacy.id).generation,legacy.generation)
  for(const kind of ['reservations','messages','payouts'])await read('airbnb',kind)
  const upgraded=await h.state(),legacyBooking=upgraded.bookings.find(b=>b.channel==='airbnb')
  const legacyMessage=upgraded.messages.find(m=>m.direction==='in'&&m.bookingId===legacyBooking.id)
  const legacyPayout=upgraded.payouts.find(p=>p.bookingId===legacyBooking.id)
  assert.equal(legacyMessage.channelAccountId,accountA,'replayed legacy message has its owning account')
  assert.equal(legacyPayout.channelAccountId,accountA,'replayed legacy payout has its owning account')
  for(const kind of ['bookings','messages','payouts']){
   const withoutAttribution=rows=>rows.map(({channelAccountId,channelAccountName,...row})=>row)
   assert.deepEqual(withoutAttribution(upgraded[kind]),withoutAttribution(legacyHistory[kind]),'upgrade preserves existing '+kind+' and their identities')
  }
  await screens.businessRecords(legacyBooking,'Mountain hosts','Lake Loft','legacy-')
  await h.restart()
  assert.equal((await h.state()).payouts.find(p=>p.id===legacyPayout.id).channelAccountId,accountA,'legacy attribution survives restart')
  assert.equal((await h.state()).bookings.length,3,'migration and replay retain the three original stays')
  assert.deepEqual((await h.db.prepare("SELECT id FROM cb_records WHERE kind='channelAgentReadSources' ORDER BY id").all()).results.map(r=>r.id),sourceIds)
  await screens.accountSettings('create',{channel:'airbnb',nickname:'Coastal hosts'})
  let accounts=(await h.state()).channelAgent.accounts
  const accountB=accounts.find(a=>a.nickname==='Coastal hosts').id
  const extra=await h.cmd('property.save',{name:'Second Loft',ownerName:home.ownerName,ownerEmail:home.ownerEmail,commissionBps:2000})
  const sibling=await h.cmd('property.save',{name:'Third Loft',ownerName:home.ownerName,ownerEmail:home.ownerEmail,commissionBps:2000})
  const finishConnect=async()=>{
   const {job}=await runner({op:'claim'});assert.equal(job.kind,'connect')
   const result=await edge.run(job,{human:true});assert.equal(result.outcome,'succeeded')
   await runner({op:'complete',id:job.id,lease:job.lease,...result})
  }
  await screens.connect(extra,'airbnb',1440,accountB);await finishConnect()
  await screens.connect(sibling,'airbnb',1440,accountA);await finishConnect()
  const mapped=(await h.state()).channelAgent.profiles,profileB=mapped.find(p=>p.propertyId===extra.id),profileSibling=mapped.find(p=>p.propertyId===sibling.id)
  assert.equal(mapped.find(p=>p.id===oldProfileId).generation,oldGeneration,'account migration retains the existing session identity')
  await h.cmd('channelAgent.connect',{propertyId:extra.id,channel:'airbnb',accountId:accountB,listingId:profileA.listingId,listingUrl:profileB.listingUrl,confirm:'yes'},h.owner,409)
  await h.cmd('channelAgent.connect',{propertyId:home.id,channel:'airbnb',accountId:accountB,listingId:profileA.listingId,listingUrl:profileA.listingUrl,confirm:'yes'},h.owner,409)
  const queueRead=async(profile,kind)=>{
   await h.cmd('channelAgent.read',{id:profile.id,kind:'read-'+kind,readUrl:'https://www.airbnb.com/hosting/'+profile.listingId+'/'+kind,confirm:'yes'})
  }
  const nextRead=async(profile,kind)=>{
   await queueRead(profile,kind)
   for(;;){
    const {job}=await runner({op:'claim'});assert.ok(job)
    const result=await edge.run(job);assert.equal(result.outcome,'succeeded')
    const receipt=await runner({op:'complete',id:job.id,lease:job.lease,...result});assert.equal(receipt.status,'succeeded')
    if(job.kind==='read-'+kind)return {job,result}
   }
  }
  for(const kind of ['reservations','messages','payouts']){await nextRead(profileB,kind);await nextRead(profileB,kind)}
  let current=await h.state(),airbnb=current.bookings.filter(b=>b.channel==='airbnb')
  assert.equal(airbnb.length,2);assert.equal(new Set(airbnb.map(b=>b.id)).size,2)
  assert.ok(airbnb.every(b=>b.channelRef==='STAY-100'))
  for(const accountId of [accountA,accountB]){
   const booking=airbnb.find(b=>b.channelAccountId===accountId);assert.ok(booking)
   assert.equal(current.messages.filter(m=>m.bookingId===booking.id&&m.direction==='in'&&m.channelAccountId===accountId).length,1)
   const payouts=current.payouts.filter(p=>p.bookingId===booking.id&&p.channelAccountId===accountId)
   assert.equal(payouts.length,1);assert.equal(payouts[0].match,'matched');assert.equal(payouts[0].netCents,97000)
   const record=await h.send('/app/calendar?reservation='+booking.id,undefined,h.owner);assert.ok(record.text.includes('Channel account'));assert.ok(record.text.includes(accountId))
  }
  const payoutPage=await h.send('/app/statements',undefined,h.owner);assert.ok(payoutPage.text.includes('Coastal hosts'))
  const inboxPage=await h.send('/app/inbox',undefined,h.owner);assert.ok(inboxPage.text.includes('Coastal hosts'))
  await screens.capture('account-identities')
  await screens.businessRecords(airbnb.find(b=>b.channelAccountId===accountB),'Coastal hosts')
  await queueRead(profileA,'reservations')
  const pending=(await runner({op:'claim'})).job;assert.equal(pending.kind,'read-reservations')
  const stale=await edge.run(pending);assert.equal(stale.outcome,'succeeded')
  await queueRead(profileSibling,'messages')
  await queueRead(profileA,'payouts')
  const beforeRevoke=await h.state(),bProfile=beforeRevoke.channelAgent.profiles.find(p=>p.id===profileB.id)
  await screens.accountSettings('revoke',{id:accountA})
  await runner({op:'authorize',id:pending.id,lease:pending.lease},409)
  await runner({op:'complete',id:pending.id,lease:pending.lease,...stale},409)
  await h.cmd('channelAgent.read',{id:profileA.id,kind:'read-reservations',readUrl:'https://www.airbnb.com/hosting/lake-loft/reservations',confirm:'yes'},h.owner,409)
  current=await h.state()
  assert.equal(current.channelAgent.accounts.find(a=>a.id===accountA).status,'revoked')
  assert.ok(current.channelAgent.profiles.filter(p=>p.accountId===accountA).every(p=>p.status==='disconnected'))
  assert.ok(current.channelAgent.actions.filter(a=>[profileA.id,profileSibling.id].includes(a.profileId)).every(a=>!['queued','running'].includes(a.status)))
  assert.deepEqual(current.bookings,beforeRevoke.bookings);assert.deepEqual(current.payouts,beforeRevoke.payouts)
  assert.equal(current.channelAgent.profiles.find(p=>p.id===profileB.id).generation,bProfile.generation)
  assert.equal(current.channelAgent.profiles.find(p=>p.id===profileB.id).status,'connected')
  const sealed=(await h.db.prepare("SELECT data FROM cb_records WHERE kind='channelAgentProfiles'").all()).results.map(r=>JSON.parse(r.data))
  assert.ok(sealed.filter(p=>p.accountId===accountA).every(p=>!p.stateSealed&&!p.grantedAt))
  assert.ok(sealed.find(p=>p.id===profileB.id).stateSealed)
  await nextRead(profileB,'reservations');await nextRead(profileB,'messages');await nextRead(profileB,'payouts')
  await h.restart()
  current=await h.state();assert.equal(current.bookings.length,4);assert.equal(current.payouts.length,4)
  assert.equal(current.channelAgent.profiles.find(p=>p.id===profileB.id).status,'connected')
  await screens.capture('account-revoked')
 }finally{await screens.close();await edge.close();await h.close()}
})

test('SYNC-011 SYNC-007: changed source identity, future payouts, unavailable pages, terms and stale local revisions stop imports with an assigned exception',async()=>{
 const h=await harness(),edge=await channelEdge()
 try{
  const {home,runner}=await provision(h,edge,['airbnb'])
  const profileId=(await h.state()).channelAgent.profiles.find(p=>p.propertyId===home.id&&p.channel==='airbnb').id
  const read=async(kind,want='succeeded')=>{
   await h.cmd('channelAgent.read',{id:profileId,kind:'read-'+kind,readUrl:`https://www.airbnb.com/hosting/lake-loft/${kind}`,confirm:'yes'})
   const {job}=await runner({op:'claim'});assert.equal(job.kind,'read-'+kind)
   const result=await edge.run(job),receipt=await runner({op:'complete',id:job.id,lease:job.lease,...result});assert.equal(receipt.status,want)
   return {job,result}
  }
  const reconnect=async()=>{
   edge.mode='';await h.cmd('channelAgent.connect',{propertyId:home.id,channel:'airbnb',listingId:'lake-loft',listingUrl:'https://www.airbnb.com/hosting/calendar/lake-loft',confirm:'yes'})
   const {job}=await runner({op:'claim'}),result=await edge.run(job,{human:true});assert.equal(result.outcome,'succeeded');await runner({op:'complete',id:job.id,lease:job.lease,...result})
  }
  await h.cmd('channelAgent.connect',{propertyId:home.id,channel:'airbnb',listingUrl:'https://www.airbnb.com/hosting/calendar/lake-loft'},h.owner,409)
  await read('reservations');await read('messages');await read('payouts')
  edge.sourceEdits={direction:'host',messageId:'HOST-100'};await read('messages');assert.equal((await h.state()).messages.filter(m=>m.direction==='in').length,1)
  edge.sourceEdits={listingId:'another-listing'};await read('reservations','needs_you');assert.equal((await h.state()).bookings.length,1);await reconnect()
  edge.sourceEdits={start:'2026-12-11',end:'2026-12-14'};await read('reservations')
  let s=await h.state(),b=s.bookings[0];assert.equal(b.start,'2026-12-11');assert.equal(b.end,'2026-12-14');assert.equal(s.bookings.length,1)
  edge.sourceEdits={text:'Different words under the same source message ID'};const changed=await read('messages','needs_you')
  s=await h.state();assert.equal(s.messages.filter(m=>m.direction==='in').length,1);assert.ok(s.notices.some(n=>n.recordId===changed.job.id&&n.memberId===s.actor.id))
  await reconnect();edge.sourceEdits={payoutStatus:'upcoming'};await read('payouts','needs_you');assert.equal((await h.state()).payouts.length,1)
  await reconnect();edge.sourceEdits={};edge.mode='broken';await read('reservations','needs_you');assert.equal((await h.state()).bookings.length,1)
  await reconnect();edge.mode='terms';const terms=await read('messages','needs_you');assert.equal(terms.result.challenge,'terms');assert.equal(terms.result.before,undefined);assert.equal(terms.result.after,undefined)
  await reconnect();edge.sourceEdits={start:'2026-12-11',end:'2026-12-14',status:'cancelled'};await read('reservations');assert.equal((await h.state()).bookings[0].status,'cancelled')
  const latest=(await h.state()).bookings[0];await erase(h,{entity:'guest',id:latest.id,revision:latest.revision});
  assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM cb_records WHERE kind='channelAgentEvidence'").first()).n,0)
  // An ended source cannot be resurrected by a later page snapshot.
  edge.sourceEdits={};await read('reservations','needs_you');assert.equal((await h.state()).bookings[0].status,'cancelled')
  edge.sourceEdits={reservationId:'STAY-200',guestName:'Taylor Wilson',email:'taylor@stay.example',start:'2026-12-20',end:'2026-12-23'};await read('reservations');const later=(await h.state()).bookings.find(b=>b.channelRef==='STAY-200');await h.cmd('booking.details',{id:later.id,revision:later.revision,guestName:'Taylor Wilson corrected by host'});await read('reservations','needs_you');assert.equal((await h.state()).bookings.find(b=>b.id===later.id).guestName,'Taylor Wilson corrected by host')
 }finally{await edge.close();await h.close()}
})

test('interrupted browser work before or after channel acceptance expires into assigned uncertainty and never repeats the action',async()=>{
 for(const phase of ['before','after']){
  const h=await harness({now:'2026-10-26T14:00:00Z'}),edge=await channelEdge()
  try{
   const {home,runner}=await provision(h,edge,['vrbo'])
   await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',...dates})
   const {job}=await runner({op:'claim'}),before=edge.writes
   if(phase==='before')edge.authorize=async()=>{throw Error('Runner interrupted before the channel action')}
   const result=await edge.run(job)
   assert.equal(result.outcome,phase==='after'?'succeeded':'failed')
   assert.equal(edge.writes>before,phase==='after')
   // Drop the runner completion response at the process boundary; only the provider retains any accepted effect.
   await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.leaseUntil',?) WHERE id=?").bind('2026-10-26T13:59:00Z',job.id).run()
   await h.restart();const attempts=edge.writes
   assert.equal((await runner({op:'claim'})).job,null);assert.equal((await runner({op:'claim'})).job,null)
   assert.equal(edge.writes,attempts)
   const state=await h.state(),current=state.channelAgent.actions.find(a=>a.id===job.id)
   assert.equal(current.status,'uncertain');assert.ok(state.notices.some(n=>n.recordId===job.id&&n.email===h.auth.OWNER_EMAIL))
   await runner({op:'complete',id:job.id,lease:job.lease,...result},409)
   await h.cmd('channelAgent.retry',{id:job.id},h.owner,409)
  }finally{await edge.close();await h.close()}
 }
})
