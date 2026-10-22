import assert from 'node:assert/strict'
import { collectionHome,collectionBooking,createCollection,guestCollection,collectionState,day } from './collection-support.mjs'

// Public command, verified-guest and scheduler doors; only the processor transport is faked by the caller.
export async function collectionConsentFlow(h,{writes,tick}){
 const home=await collectionHome(h),b=await collectionBooking(h,home,60),p=await createCollection(h,b)
 let g=await guestCollection(h,b)
 const current=async()=>(await h.state()).bookings.find(v=>v.id===b.id)
 const amend=async changes=>{const v=await current();return h.cmd('reservation.amend',{id:v.id,revision:v.revision,propertyId:v.propertyId,start:v.start,end:v.end,guestName:v.guestName,guestEmail:v.guestEmail,guestPhone:v.guestPhone,arrivalTime:v.arrivalTime,reason:'Synthetic host amendment under ct payment consent ruling',...changes})}
 const authorize=async()=>{const v=await current(),s=await collectionState(h,p.id);assert.equal((await h.send(g.path,{action:'consent',revision:s.revision,signature:v.guestName,consent:'yes'},g.cookie)).status,303);assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303)}
 await authorize();let saved=await collectionState(h,p.id),consent=saved.consent
 const paid=saved.jobs.filter(j=>j.status==='succeeded'),attempts=saved.jobs.map(j=>j.attempts)
 await amend({guestPhone:'+18285550199',guestName:'Synthetic Updated Contact',guestEmail:b.guestEmail.toUpperCase()})
 saved=await collectionState(h,p.id);assert.equal(saved.status,'active');assert.deepEqual(saved.consent,consent,'phone/name/case-only email changes retain the verified email mandate')
 await amend({rentCents:9000,feesCents:2000,taxCents:1000})
 saved=await collectionState(h,p.id);assert.equal(saved.status,'active');assert.deepEqual(saved.consent,consent,'a host price reduction needs no renewed consent');assert.equal(saved.jobs.filter(j=>j.status==='scheduled').reduce((n,j)=>n+j.amountCents,0),9000)
 assert.deepEqual(saved.jobs.filter(j=>j.status==='succeeded'),paid);assert.deepEqual(saved.jobs.map(j=>j.attempts),attempts)
 const dues=saved.jobs.map(j=>j.dueAt)
 await amend({start:day(70),end:day(72)})
 saved=await collectionState(h,p.id);assert.equal(saved.status,'active');assert.deepEqual(saved.consent,consent,'a host deferral needs no renewed consent');assert.ok(saved.jobs.every((j,i)=>j.dueAt>=dues[i]));assert.ok(saved.jobs[1].dueAt>dues[1])
 // Even with a lower price, an earlier due date cannot use the favourable-change exception.
 for(const changes of [{start:day(65),end:day(67),rentCents:8000,feesCents:2000,taxCents:1000},{rentCents:10000,feesCents:2000,taxCents:1000},{policyName:'New cancellation policy',retainedBps:2000,noShowBps:3000},{propertyId:(await collectionHome(h)).id},{guestEmail:'updated-guest@stay.example'}]){
  const before=await collectionState(h,p.id),count=writes.length
  await amend(changes);saved=await collectionState(h,p.id)
  assert.equal(saved.status,'consent_required');assert.equal(saved.consent,undefined);assert.deepEqual(saved.jobs.filter(j=>j.status==='succeeded'),paid);assert.deepEqual(saved.jobs.map(j=>({id:j.id,attempts:j.attempts})),before.jobs.map(j=>({id:j.id,attempts:j.attempts})))
  await h.restart();await tick();assert.equal(writes.length,count,'adverse date/price/policy/property or verified email changes cannot collect without renewed consent')
  const v=await current()
  if(changes.guestEmail||changes.propertyId){assert.equal((await h.send(g.path,undefined,g.cookie,{accept:'application/json'})).status,401);g=await guestCollection(h,v)}
  await h.cmd('direct.collection.revise',{id:p.id,revision:saved.revision,depositCents:100,installmentCents:0,balanceDays:3,confirm:'yes'})
  saved=await collectionState(h,p.id)
  assert.equal((await h.send(g.path,{action:'consent',revision:saved.revision,signature:v.guestName,consent:'yes'},'')).status,401,'a link holder alone cannot renew payment consent')
  // Keep the same successful payment evidence while obtaining a fresh, verified mandate.
  assert.equal((await h.send(g.path,{action:'consent',revision:saved.revision,signature:v.guestName,consent:'yes'},g.cookie)).status,303)
  // Do not start more payments in this matrix; subsequent amendments invalidate this pending setup.
 }
 const count=writes.length
 const channelHome=await collectionHome(h),channel=await h.cmd('reservation.create',{propertyId:channelHome.id,channel:'booking.com',method:'channel',sourceId:'synthetic-cabin-channel-mandate',guestName:'Synthetic Channel Guest',guestEmail:'channel@stay.example',start:day(80),end:day(82),rentCents:10000,policyName:'Channel policy',retainedBps:0,noShowBps:0})
 await h.cmd('direct.collection.create',{bookingId:channel.id,depositCents:1000,assigneeId:(await h.state()).actor.id},h.owner,409)
 await tick();assert.equal(writes.length,count,'guest consent never substitutes for PAY-005 VCC limits or PAY-006 channel card intake')
 assert.ok(!(await h.state()).direct.collections.some(p=>p.bookingId===channel.id),'unimplemented channel mandates remain unavailable')
}
