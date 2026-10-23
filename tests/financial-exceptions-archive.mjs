import assert from 'node:assert/strict'
import { homeDay } from './home-calendar.mjs'
export async function populateExceptionArchive(h,p){
 const state=await h.state(),payout=state.payouts.find(v=>v.propertyId===p.id&&v.reference==='archive-stay')
 let row=await h.cmd('financeCase.open',{bookingId:payout.bookingId,reason:'Retain source-linked fee correction and exact pending approval history.'})
 row=await h.cmd('financeCase.request',{id:row.id,revision:row.revision,kind:'fee',detail:'Installation owner: obtain original provider fee detail.'})
 const source=(await h.state()).financialExceptions.find(v=>v.id===row.id)
 row=await h.cmd('financeCase.propose',{id:row.id,revision:row.revision,payoutId:payout.id,baseline:source.evidence.digest,effectiveDate:homeDay(0,'America/New_York'),why:'Retained explicit fee record corrects the original provider fee.',evidence:'synthetic-cabin-archive-1',csv:'Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n2026-01-06,Reservation,archive-stay,2026-01-01,4,USD,1000.00,35.00,965.00,ARCHIVE-PAYOUT\n'})
 return row
}
export async function checkExceptionArchive(h,cookie,proof){
 const row=(await h.state(cookie)).financialExceptions.find(r=>r.id===proof.id)
 assert.equal(row.restorePaused,true);assert.deepEqual(row.proposals,proof.proposals);assert.deepEqual(row.requests,proof.requests)
 await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:row.proposals[0].id,confirm:'yes',reason:'Old approval must not resume'},cookie,409)
}
