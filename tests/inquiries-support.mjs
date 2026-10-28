import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
export const inquiryClock='2026-10-28T12:00:00.000Z'
export const sourceInquiry={listingId:'synthetic-cabin-1',reservationId:'synthetic-cabin-2',guestName:'Synthetic guest',start:'2026-12-10',end:'2026-12-13',status:'inquiry',threadId:'synthetic-cabin-3',guests:'3',currency:'USD',quote:'583.25',deadline:'2026-10-28T13:00:00.000Z',message:'May we stay for these three nights?'}
/** Synthetic source transport only; all product work uses the authenticated runner and native commands. */
export async function inquirySource(h){
 const p=await h.cmd('property.save',{name:'Synthetic lakeside cabin',ownerName:'Synthetic owner',ownerEmail:h.auth.OWNER_EMAIL,commissionBps:1500})
 const manager=await h.person('InquiryManager','manager'),cleaner=await h.person('InquiryCleaner')
 const key=await h.cmd('channelAgent.runner.create',{}),headers={authorization:'Bearer '+key.token}
 const runner=async(body,status=200)=>{const r=await h.send('/api/cabin/channel-agent/runner',body,'',headers);assert.equal(r.status,status,r.text);return r.value}
 async function connect(){
  await h.cmd('channelAgent.connect',{propertyId:p.id,channel:'airbnb',listingId:'synthetic-cabin-1',listingUrl:'https://www.airbnb.com/hosting/calendar/synthetic-cabin-1',confirm:'yes'})
  const {job}=await runner({op:'claim'});assert.equal(job.kind,'connect')
  await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'connected',storageState:{cookies:[],origins:[]}})
 }
 await connect()
 const profile=(await h.state()).channelAgent.profiles[0]
 const image=(await readFile('tests/fixtures/checklist.png')).toString('base64')
 async function read(records=[sourceInquiry],want='succeeded',observedAt=inquiryClock){
  await h.cmd('channelAgent.read',{id:profile.id,kind:'read-reservations',readUrl:'https://www.airbnb.com/hosting/synthetic-cabin-1/reservations',confirm:'yes'})
  const {job}=await runner({op:'claim'});assert.equal(job.kind,'read-reservations')
  const result=await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'read',before:image,after:image,read:{observedAt,records}})
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
