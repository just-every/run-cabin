import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
export const inquiryClock='2026-10-28T12:00:00.000Z'
export const sourceInquiry={listingId:'synthetic-cabin-1',reservationId:'synthetic-cabin-2',guestName:'Synthetic guest',start:'2026-12-10',end:'2026-12-13',status:'inquiry',threadId:'synthetic-cabin-3',guests:'3',currency:'USD',quote:'583.25',deadline:'2026-10-28T13:00:00.000Z',message:'May we stay for these three nights?'}
/** Synthetic source transport only; all product work uses the authenticated runner and native commands. */
export async function inquirySource(h,options={}){
 const p=await h.cmd('property.save',{name:options.name??'Synthetic lakeside cabin',ownerName:'Synthetic owner',ownerEmail:h.auth.OWNER_EMAIL,commissionBps:1500})
 const manager=await h.person('InquiryManager','manager'),cleaner=options.cleaner===false?null:await h.person('InquiryCleaner')
 const key=await h.cmd('channelAgent.runner.create',{}),headers={authorization:'Bearer '+key.token}
 const runner=async(body,status=200)=>{const r=await h.send('/api/cabin/channel-agent/runner',body,'',headers);assert.equal(r.status,status,r.text);return r.value}
 async function connect(){
  await h.cmd('channelAgent.connect',{propertyId:p.id,channel:'airbnb',listingId:'synthetic-cabin-1',listingUrl:'https://www.airbnb.com/hosting/calendar/synthetic-cabin-1',confirm:'yes'})
  const {job}=await runner({op:'claim'});assert.equal(job.kind,'connect')
  await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'connected',storageState:{cookies:[],origins:[]}})
 }
 await connect()
 const profile=(await h.state()).channelAgent.profiles.find(row=>row.propertyId===p.id&&row.channel==='airbnb')
 const image=(await readFile('tests/fixtures/checklist.png')).toString('base64')
 async function read(records=[sourceInquiry],want='succeeded',observedAt=inquiryClock){
  await h.cmd('channelAgent.read',{id:profile.id,kind:'read-reservations',readUrl:'https://www.airbnb.com/hosting/synthetic-cabin-1/reservations',confirm:'yes'})
  const {job}=await runner({op:'claim'});assert.equal(job.kind,'read-reservations')
  await runner({op:'checkpoint',id:job.id,lease:job.lease,before:image})
  assert.equal((await h.send('/api/cabin/channel-agent/evidence?id='+encodeURIComponent(job.id)+'&side=before',undefined,h.owner)).status,404,'unreconciled read evidence cannot expose an erased source')
  const result=await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'read',before:image,after:image,read:{observedAt:observedAt??new Date().toISOString(),records}})
  assert.equal(result.status,want);return result
 }
 async function settings(){const row=(await h.state()).inbox[0];return h.cmd('inbox.team.set',{revision:row?.revision??'',section:'response',normalMinutes:240,urgentMinutes:30,repeatMinutes:30,escalationMemberId:manager.id})}
 async function review(q,cookie=h.owner,status=200,thread=sourceInquiry.threadId){return h.cmd('inquiry.review',{id:q.id,revision:q.revision,sourceThreadId:thread,confirm:'yes'},cookie,status)}
 return {p,manager,cleaner,runner,profile,connect,read,settings,review}
}
export async function inquiryDeadlineJourney(h,source){
 await source.settings();await source.read()
 let q=(await h.state()).inquiries[0];await source.review(q)
 const thread=(await h.state()).inquiries[0]
 assert.equal(q.deadlineStage,'pending')
 await h.restart({now:'2026-10-28T12:31:00.000Z'})
 await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 let state=await h.state(),row=state.threadCases.find(r=>r.id===thread.threadId)
 assert.equal(state.inquiries[0].deadlineStage,'approaching');assert.equal(row.assigneeId,source.manager.id);assert.equal(row.status,'open')
 const notices=state.notices.filter(n=>n.recordId===thread.threadId&&n.subject.startsWith('Inquiry deadline'))
 assert.equal(notices.length,1);assert.match(notices[0].text,/Source inquiry synthetic-cabin-2/);assert.match(notices[0].text,/Channel outcome remains unresolved/)
 await h.cmd('thread.accept',{thread:thread.threadId},source.manager.cookie)
 await h.restart({now:'2026-10-28T13:01:00.000Z'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 state=await h.state();q=state.inquiries[0];row=state.threadCases.find(r=>r.id===thread.threadId)
 assert.equal(q.status,'inquiry');assert.equal(q.deadline,sourceInquiry.deadline);assert.equal(state.inquiries[0].deadlineStage,'elapsed');assert.equal(row.status,'open');assert.equal(row.acceptedAt,null)
 assert.equal(state.notices.filter(n=>n.recordId===thread.threadId&&n.subject.startsWith('Inquiry deadline')).length,2)
 await h.restart({now:'2026-10-28T13:02:00.000Z'});await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 state=await h.state();assert.equal(state.notices.filter(n=>n.recordId===thread.threadId&&n.subject.startsWith('Inquiry deadline')).length,2,'restarting does not duplicate either deadline stage')
 assert.equal(state.bookings.length,0);assert.equal(state.requests.length,0);assert.equal(state.codes.length,0)
 const page=await h.send('/app/inbox?thread='+thread.threadId,undefined,h.owner)
 assert.match(page.text,/Deadline elapsed locally/);assert.match(page.text,/Channel outcome unresolved/);assert.doesNotMatch(page.text,/Accepted by Airbnb|Expired at Airbnb/)
 return thread.threadId
}

/** Erasure follows the exact source conversation, even when the selected inquiry is unreviewed. */
export async function inquiryErasureJourney(){
 const {harness}=await import('./harness.mjs')
 let holdText='',reached,release,sending,timer
 const h=await harness({now:inquiryClock,auth:{CABIN_TEST_MAIL_EDGE:'true'},outbound:async request=>{
  const message=await request.json()
  if(holdText&&message.text.includes(holdText)){
   holdText='';reached();await new Promise(resolve=>{release=resolve})
  }
  return Response.json({status:'accepted',provider:'synthetic',providerMessageId:'synthetic-cabin-'+message.deliveryId})
 }})
 const hold=async(thread,memberId,summary)=>{
  const started=new Promise(resolve=>{reached=resolve});holdText=summary
  sending=h.cmd('thread.handover',{thread,memberId,summary})
  try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Inquiry notice did not reach the mail edge')),15000)})])}finally{clearTimeout(timer)}
 }
 const finish=async()=>{release();release=null;await sending;sending=null}
 try{
  const source=await inquirySource(h);await source.settings();await source.read()
  let q=(await h.state()).inquiries[0];await source.review(q);q=(await h.state()).inquiries[0]
  await h.cmd('thread.note',{thread:q.threadId,text:'synthetic-cabin-private-promise',promise:true})
  await h.cmd('thread.claim',{thread:q.threadId})
  const secondSource={...sourceInquiry,reservationId:'synthetic-cabin-second-inquiry'}
  const otherSource={...sourceInquiry,reservationId:'synthetic-cabin-other-inquiry',threadId:'synthetic-cabin-other-thread'}
  const unreviewedSource={...sourceInquiry,reservationId:'synthetic-cabin-unreviewed-inquiry',threadId:'synthetic-cabin-unreviewed-thread'}
  await source.read([secondSource,otherSource,unreviewedSource])
  let s=await h.state();const second=s.inquiries.find(row=>row.sourceId===secondSource.reservationId),other=s.inquiries.find(row=>row.sourceId===otherSource.reservationId),unreviewed=s.inquiries.find(row=>row.sourceId===unreviewedSource.reservationId)
  assert.equal(second.threadId,null);assert.equal(second.status,'needs_review')
  await source.review(other,h.owner,200,otherSource.threadId)
  const otherThread=(await h.state()).inquiries.find(row=>row.id===other.id).threadId
  await h.cmd('thread.note',{thread:otherThread,text:'synthetic-cabin-unrelated-note',promise:true})
  await hold(q.threadId,source.manager.id,'synthetic-cabin-private-handover')
  const before=await h.state(),evidence=(await h.db.prepare("SELECT id,data FROM cb_records WHERE kind='channelAgentEvidence' ORDER BY id").all()).results
  assert.ok(before.notices.some(n=>n.recordId===q.threadId&&n.status==='sending'&&n.text.includes('synthetic-cabin-private-promise')))
  const refused=await h.cmd('inquiry.erase',{id:second.id,revision:second.revision,confirm:'yes'},h.owner,409)
  assert.match(JSON.stringify(refused),/notice is in flight/)
  s=await h.state()
  for(const key of ['inquiries','messages','threadCases','notices','privacy'])assert.deepEqual(s[key],before[key],'refused erasure leaves '+key+' unchanged')
  assert.deepEqual((await h.db.prepare("SELECT id,data FROM cb_records WHERE kind='channelAgentEvidence' ORDER BY id").all()).results,evidence,'refused erasure keeps source evidence')
  await finish()
  await h.cmd('thread.claim',{thread:q.threadId})
  await hold(otherThread,source.manager.id,'synthetic-cabin-unrelated-handover')
  const unrelated=(await h.state()).threadCases.find(row=>row.id===otherThread)
  await h.cmd('inquiry.erase',{id:unreviewed.id,revision:unreviewed.revision,confirm:'yes'})
  await h.cmd('inquiry.erase',{id:second.id,revision:second.revision,confirm:'yes'})
  s=await h.state();const row=s.threadCases.find(row=>row.id===q.threadId),notices=s.notices.filter(n=>n.recordId===q.threadId)
  assert.equal(row.guest,'Erased guest');assert.equal(row.status,'answered');assert.equal(row.waitingSince,null);assert.equal(row.dueAt,null);assert.equal(row.claim,null)
  assert.deepEqual(row.notes,[]);assert.deepEqual(row.handovers,[])
  assert.ok(notices.length>0);assert.ok(notices.every(n=>n.text===''&&n.subject==='Erased inquiry'&&n.status==='suppressed'))
  assert.ok(s.inquiries.filter(row=>row.threadRef===q.threadRef).every(row=>row.status==='erased'))
  assert.ok(s.messages.filter(row=>row.ref===q.threadRef).every(row=>row.status==='discarded'))
  assert.deepEqual(s.threadCases.find(row=>row.id===otherThread),unrelated,'same guest name and home do not merge distinct source conversations')
  assert.equal(s.inquiries.find(row=>row.id===other.id).status,'inquiry')
  assert.ok(s.notices.some(n=>n.recordId===otherThread&&n.status==='sending'&&n.text.includes('synthetic-cabin-unrelated-note')))
  assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM cb_records WHERE kind='channelAgentEvidence'").first()).n,0)
  await finish();await h.restart();await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
  s=await h.state();assert.deepEqual(s.threadCases.find(row=>row.id===q.threadId).notes,[]);assert.ok(s.notices.filter(n=>n.recordId===q.threadId).every(n=>n.status==='suppressed'&&!n.text))
  assert.doesNotMatch((await h.send('/app/inbox?thread='+q.threadId,undefined,h.owner)).text,/synthetic-cabin-private-promise|synthetic-cabin-private-handover/)
  assert.match((await h.send('/app/inbox?thread='+otherThread,undefined,h.owner)).text,/synthetic-cabin-unrelated-note/)
  await source.read([secondSource],'needs_you');await source.read([{...secondSource,reservationId:'synthetic-cabin-replayed-inquiry'}],'needs_you')
 }finally{clearTimeout(timer);release?.();if(sending)await sending.catch(()=>{});await h.close()}
}
