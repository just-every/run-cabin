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
 await h.cmd('thread.note',{thread:thread.threadId,text:'Synthetic private arrival instructions',promise:true})
 await h.cmd('thread.handover',{thread:thread.threadId,memberId:source.manager.id,summary:'Synthetic private handover details'})
 await source.read([{...sourceInquiry,reservationId:'synthetic-cabin-related-inquiry'}],'succeeded','2026-10-28T13:02:00.000Z')
 state=await h.state()
 const unreviewed=state.inquiries.find(q=>q.id!==thread.id),before=state.threadCases.find(r=>r.id===thread.threadId)
 assert.equal(unreviewed.status,'needs_review');assert.equal(unreviewed.threadId,null)
 assert.ok(before.notes.some(n=>n.text==='Synthetic private arrival instructions'))
 assert.ok(before.handovers.some(r=>r.summary==='Synthetic private handover details'))
 assert.ok(state.notices.some(n=>n.recordId===thread.threadId&&n.text.includes('Synthetic private arrival instructions')),'handover notices contain the private conversation context')
 await h.cmd('inquiry.erase',{id:unreviewed.id,revision:unreviewed.revision,confirm:'yes'},source.manager.cookie,403)
 assert.deepEqual((await h.state()).threadCases.find(r=>r.id===thread.threadId),before,'a non-owner cannot erase the conversation')
 await h.cmd('inquiry.erase',{id:unreviewed.id,revision:unreviewed.revision,confirm:'yes'})
 await h.restart();state=await h.state();row=state.threadCases.find(r=>r.id===thread.threadId)
 assert.deepEqual(row.notes,[],'erasing an unreviewed inquiry removes the reviewed conversation notes')
 assert.deepEqual(row.handovers,[],'erasing an unreviewed inquiry removes the reviewed conversation handovers')
 assert.equal(row.status,'answered');assert.equal(row.guest,'Erased guest');assert.equal(row.dueAt,null)
 const erasedNotices=state.notices.filter(n=>n.recordId===thread.threadId)
 assert.ok(erasedNotices.length>0);assert.ok(erasedNotices.every(n=>n.text===''&&n.subject==='Erased inquiry'&&n.status==='suppressed'),'retained conversation notices are scrubbed and cannot be delivered')
 assert.ok(state.inquiries.every(q=>q.status==='erased'));assert.ok(state.messages.every(m=>m.status==='discarded'))
 assert.doesNotMatch((await h.send('/app/inbox',undefined,h.owner)).text,/Synthetic private arrival instructions|Synthetic private handover details/)
 return thread.threadId
}
