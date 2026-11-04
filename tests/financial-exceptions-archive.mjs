import assert from 'node:assert/strict'
import { allocatedExceptionFixture } from './allocated-exceptions-support.mjs'
import { homeDay } from './home-calendar.mjs'
export async function populateExceptionArchive(h,p){
 const state=await h.state(),payout=state.payouts.find(v=>v.propertyId===p.id&&v.reference==='archive-stay')
 let row=await h.cmd('financeCase.open',{bookingId:payout.bookingId,reason:'Retain source-linked fee correction and exact pending approval history.'})
 row=await h.cmd('financeCase.request',{id:row.id,revision:row.revision,kind:'fee',detail:'Installation owner: obtain original provider fee detail.'})
 const source=(await h.state()).financialExceptions.find(v=>v.id===row.id)
 row=await h.cmd('financeCase.propose',{id:row.id,revision:row.revision,payoutId:payout.id,baseline:source.evidence.digest,effectiveDate:homeDay(0,'America/New_York'),why:'Retained explicit fee record corrects the original provider fee.',evidence:'synthetic-cabin-archive-1',csv:'Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n2026-01-06,Reservation,archive-stay,2026-01-01,4,USD,1000.00,35.00,965.00,ARCHIVE-PAYOUT\n'})
 const allocated=await allocatedExceptionFixture(h)
 const pending=await h.cmd('financeCase.propose',await allocated.input())
 return {...row,allocated:{row:pending,allocation:allocated.allocation}}
}
export async function checkExceptionArchive(h,cookie,proof){
 const row=(await h.state(cookie)).financialExceptions.find(r=>r.id===proof.id)
 assert.equal(row.restorePaused,true);assert.deepEqual(row.proposals,proof.proposals);assert.deepEqual(row.requests,proof.requests)
 const before=(await h.state(cookie)).ledger.journals
 await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:row.proposals[0].id,confirm:'yes',reason:'Old approval must not resume'},cookie,409)
 const allocated=(await h.state(cookie)).financialExceptions.find(r=>r.id===proof.allocated.row.id)
 assert.equal(allocated.restorePaused,true);assert.deepEqual(allocated.proposals,proof.allocated.row.proposals)
 assert.equal(allocated.proposals[0].journalGroup.length,5)
 await h.cmd('financeCase.approve',{id:allocated.id,revision:allocated.revision,proposalId:allocated.proposals[0].id,confirm:'yes',reason:'Restored group cannot post'},cookie,409)
 assert.deepEqual((await h.state(cookie)).financialAllocations.find(a=>a.id===proof.allocated.allocation.id),proof.allocated.allocation)
 assert.deepEqual((await h.state(cookie)).ledger.journals,before,'Restored proposals and review never post money')
 console.log('PROBE AGENT-002 archive: public CLI restore -> full allocated proposal retained inactive; approval refused without posting')
}

export async function reviewExceptionArchive(h,cookie,proof){
 const before=(await h.state(cookie)).ledger.journals
 const allocated=(await h.state(cookie)).financialExceptions.find(r=>r.id===proof.allocated.row.id)
 const reviewed=await h.cmd('financeCase.review',{id:allocated.id,revision:allocated.revision},cookie)
 assert.equal(reviewed.proposals[0].status,'rejected')
 await h.cmd('financeCase.approve',{id:reviewed.id,revision:reviewed.revision,proposalId:reviewed.proposals[0].id,confirm:'yes',reason:'Fresh review cannot reactivate restored proposal'},cookie,409)
 assert.deepEqual((await h.state(cookie)).ledger.journals,before,'Fresh review retires restored proposals without posting')
 console.log('PROBE AGENT-002 archive review: current-source review -> old allocated proposal rejected; old approval refused without posting')
}
