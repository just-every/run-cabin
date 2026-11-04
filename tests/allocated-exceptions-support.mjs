import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
const address=n=>['synthetic-cabin-'+n,'stay.example'].join('@')
export const allocatedCorrectionDate='2026-11-04'
const csv=(id,gross,fee,net)=>`Date,Type,Confirmation code,Currency,Gross earnings,Host service fee,Amount,Payout ID,Transaction ID\n2026-10-06,Reservation,synthetic-cabin-101,USD,${gross},${fee},${net},synthetic-cabin-102,${id}\n`
export async function allocatedExceptionFixture(h,{rounding=false}={}){
 const home=await h.cmd('property.save',{name:'Allocated Cedar Review',ownerName:'Cedar Owner',ownerEmail:address(101),commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Cedar Allocated Trust'})
 const terms=await h.cmd('property.terms',{propertyId:home.id,propertyRevision:home.revision,effectiveFrom:'2026-01-01',ownerName:home.ownerName,ownerEmail:home.ownerEmail,commissionBps:rounding?0:2000,terms:'Frozen signed allocation agreement',allocation:{commissionBase:'netRent',fixedFeeCents:rounding?0:1000,reserveBps:rounding?0:1000,ownerUseCleaningCents:0,passThrough:'owner',taxExpense:'owner',owners:rounding?Array.from({length:10},(_,i)=>({name:'Synthetic owner '+(i+1),email:address(101+i),bps:i===0?1:1111})):[{name:'Cedar Owner',email:address(101),bps:6000},{name:'Pine Owner',email:address(102),bps:4000}],mapping:{owner:'Owner payable',manager:'Manager income',reserve:'Owner reserves',tax:'Tax payable',vendor:'Vendor payable',reviewedBy:'Synthetic accountant'}}})
 const draft=await h.cmd('calendar.prepare',{propertyId:home.id,channel:'airbnb',calendar:'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-cabin-101\r\nDTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261005\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'})
 await h.cmd('calendar.approve',{id:draft.id,revision:draft.revision})
 const booking=(await h.state()).bookings.find(b=>b.propertyId===home.id)
 const payout=(await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv:rounding?csv('synthetic-cabin-103','100.00','0.00','100.00'):csv('synthetic-cabin-103','600.01','0.00','600.01')})).imported[0]
 if(!rounding)await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv:csv('synthetic-cabin-104','600.00','30.00','570.00')})
 const allocation=await h.cmd('allocation.prepare',{bookingId:booking.id,rentCents:rounding?10000:100001,passThroughCents:rounding?0:10000,taxCents:rounding?0:10000,evidence:'synthetic-cabin-105: retained gross and tax basis'})
 await h.cmd('allocation.approve',{id:allocation.id,revision:allocation.revision})
 const frozenAllocation=(await h.state()).financialAllocations.find(a=>a.id===allocation.id)
 let row=await h.cmd('financeCase.open',{bookingId:booking.id,reason:'Explicit missing fee on an unchanged allocated native settlement'})
 const input=async(extra={})=>({id:row.id,revision:(await h.state()).financialExceptions.find(r=>r.id===row.id).revision,payoutId:payout.id,baseline:(await h.state()).financialExceptions.find(r=>r.id===row.id).evidence.digest,csv:rounding?csv('synthetic-cabin-103','100.00','10.00','90.00'):csv('synthetic-cabin-103','600.01','15.01','585.00'),effectiveDate:allocatedCorrectionDate,evidence:'synthetic-cabin-106: explicit provider fee record',why:rounding?'Add the missing 1000-cent fee under the original terms; preserve gross and tax basis.':'Add the missing 1501-cent fee under the original terms; preserve gross and tax basis.',...extra})
 return {home,terms,booking,payout,allocation:frozenAllocation,row,input,csv}
}
const net=(journals,account)=>journals.flatMap(j=>j.lines).filter(l=>l.account===account).reduce((n,l)=>n+l.creditCents-l.debitCents,0)
export async function allocatedExceptionJourney({act,screens}={}){
 const h=await harness({assets:true,now:'2026-10-15T12:00:00Z',outbound:()=>assert.fail('Allocated correction must perform no outbound action')})
 const command=h.cmd,readState=h.state
 h.cmd=(name,input,cookie=h.owner,...args)=>command(name,input,cookie,...args)
 h.state=(cookie=h.owner,...args)=>readState(cookie,...args)
 try{
  const f=await allocatedExceptionFixture(h),{home,booking,payout,allocation}=f
  let row=f.row
  const state=()=>h.state(),current=async()=>(await state()).financialExceptions.find(r=>r.id===row.id)
  const action=async(name,input)=>act?act(h,name,input):h.cmd(name,input)
  const propose=async(extra={})=>{row=await action('financeCase.propose',await f.input(extra));return row.proposals.at(-1)}
  const decide=async(name,proposal,reason)=>{row=await action(name,{id:row.id,revision:(await current()).revision,proposalId:proposal.id,confirm:'yes',reason});return row}
  const originalStatement=await h.cmd('statement.prepare',{propertyId:home.id,month:'2026-10'})
  const obsolete=await h.cmd('statement.prepare',{propertyId:home.id,month:'2026-10'})
  await h.cmd('statement.approve',{id:originalStatement.id,revision:originalStatement.revision})
  const frozen=await h.send('/api/cabin/statements/'+originalStatement.id+'.csv',undefined,h.owner)
  const pdf=async()=>{const response=await h.mf.dispatchFetch(h.origin+'/api/cabin/statements/'+originalStatement.id+'.pdf',{headers:{cookie:h.owner}});assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer())}
  const frozenPdf=await pdf()
  assert.equal(originalStatement.netCents,77941)
  await h.cmd('ledger.close',{month:'2026-10'})
  const staff=await h.person('AllocatedStaff','manager')
  await h.restart({now:allocatedCorrectionDate+'T12:00:00Z'})
  h.owner=await h.signIn(h.auth.OWNER_EMAIL);staff.cookie=await h.signIn(staff.email)
  const journalsBefore=(await state()).ledger.journals
  const unchanged=async()=>assert.deepEqual((await state()).ledger.journals,journalsBefore,'Unsafe or rejected correction changes no journal')
  await h.cmd('financeCase.propose',await f.input({csv:csv('synthetic-cabin-103','601.01','15.01','586.00')}),h.owner,409)
  await h.cmd('financeCase.propose',await f.input({csv:csv('synthetic-cabin-104','600.00','31.00','569.00'),payoutId:(await state()).payouts.find(p=>p.id!==payout.id).id}),h.owner,409)
  await unchanged()
  let proposal=await propose({effectiveDate:'2026-10-06'})
  assert.equal(proposal.journalGroup.length,5,'Two payout journals and the entire three-journal allocation are bound')
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:proposal.id,confirm:'yes',reason:'Closed period must refuse the entire group'},h.owner,409)
  await decide('financeCase.reject',proposal,'Retain original statement and use an open period')
  await unchanged()
  proposal=await propose()
  if(screens)await screens(h,'allocated-proposal',f)
  // A changed reservation invalidates the exact group; no partial reversals may escape.
  await h.cmd('booking.details',{id:booking.id,revision:(await state()).bookings.find(b=>b.id===booking.id).revision,guestName:'Reviewed source revision'})
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:proposal.id,confirm:'yes',reason:'Stale evidence'},h.owner,409)
  await decide('financeCase.reject',proposal,'Re-review the changed reservation')
  await unchanged()
  proposal=await propose()
  assert.deepEqual((await h.state(staff.cookie)).financialExceptions,[])
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:proposal.id,confirm:'yes',reason:'Insufficient authority'},staff.cookie,403)
  await unchanged()
  await h.restart()
  assert.deepEqual((await current()).proposals.at(-1),proposal,'Exact proposed journal group survives restart')
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:proposal.id,reason:'Missing consent'},h.owner,400)
  await unchanged()
  await decide('financeCase.approve',proposal,'Reviewed exact missing fee, complete group and unchanged frozen agreement')
  const approved=await state(),corrected=approved.financialAllocations.find(a=>a.correctionOf===allocation.id),journals=approved.ledger.journals
  assert.deepEqual(approved.financialAllocations.find(a=>a.id===allocation.id),allocation,'Original allocation is immutable')
  assert.deepEqual(corrected.terms,allocation.terms);assert.equal(corrected.rentCents,100001);assert.equal(corrected.taxCents,10000)
  assert.deepEqual(corrected.parts.map(p=>[p.grossCents,p.channelFeeCents,p.managementFeeCents,p.taxCents,p.reserveCents,p.payableCents]),[[72001,2701,12060,6000,5124,46116],[48000,1800,8040,4000,3416,30744]])
  assert.equal(net(journals,'ownerLiability'),76860);assert.equal(net(journals,'managerRevenue'),20100);assert.equal(net(journals,'ownerReserves'),8540);assert.equal(net(journals,'taxes'),10000)
  assert.equal(net(journals,'cash'),-115500);assert.equal(net(journals,'allocationClearing'),0)
  assert.equal(journals.length-journalsBefore.length,10)
  for(const item of proposal.journalGroup){
   const original=journals.find(j=>j.id===item.originalJournalId),reversal=journals.find(j=>j.reversalOf===original.id),replacement=journals.find(j=>j.correctionOf===original.id)
   assert.deepEqual(reversal.lines,original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents})))
   assert.deepEqual(replacement.lines,item.replacement.lines.filter(l=>l.debitCents||l.creditCents))
   for(const j of [reversal,replacement]){assert.equal(j.legalEntity,original.legalEntity);assert.equal(j.ownerKey,original.ownerKey);assert.equal(j.propertyId,original.propertyId);assert.equal(j.effectiveDate,allocatedCorrectionDate)}
  }
  for(const j of journals)assert.equal(j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0),0)
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:proposal.id,confirm:'yes',reason:'Duplicate'},h.owner,409)
  await h.cmd('financeCase.propose',await f.input(),h.owner,409)
  await h.cmd('statement.approve',{id:obsolete.id,revision:obsolete.revision},h.owner,409)
  const replay=await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv:csv('synthetic-cabin-103','600.01','0.00','600.01')})
  assert.equal(replay.imported.length,0)
  assert.deepEqual((await state()).ledger.journals,journals,'Duplicate approval and replay cannot restore the old allocation')
  assert.equal((await h.send('/api/cabin/statements/'+originalStatement.id+'.csv',undefined,h.owner)).text,frozen.text)
  assert.deepEqual(await pdf(),frozenPdf,'The original PDF bytes stay immutable')
  for(const [email,payable,movement] of [[address(101),46116,-649],[address(102),30744,-432]]){
   const adjustment=await h.cmd('statement.close.prepare',{propertyId:home.id,month:'2026-11',statementOwnerEmail:email})
   assert.equal(adjustment.netCents,payable);assert.equal(adjustment.close.movementCents,movement);assert.deepEqual(adjustment.close.adjustsStatementIds,[originalStatement.id])
   await h.cmd('statement.approve',{id:adjustment.id,revision:adjustment.revision})
  }
  const report=(await h.send('/api/cabin/reports.json?'+new URLSearchParams({property:home.id,from:'2026-10-01',until:'2026-12-01',basis:'accrual'}),undefined,h.owner)).value
  assert.equal(report.totals.grossCents,120001);assert.equal(report.totals.feesCents,4501);assert.equal(report.totals.commissionCents,20100);assert.equal(report.totals.taxCents,10000);assert.equal(report.totals.netCents,85400)
  const final=await current();assert.equal(final.evidence.recordedDistributionCents,0);assert.equal(final.evidence.bankMatchedDistributionCents,0)
  if(screens)await screens(h,'allocated-corrected',f)
  console.log('PROBE AGENT-002 allocated missing fee: command door -> exact 5-journal group replaced; payable 76860, commission 20100, reserves 8540; original CSV and PDF unchanged; owner adjustments -649 and -432; unsafe, stale, closed and duplicate attempts changed nothing')
 }finally{await h.close()}
}

export async function allocatedRoundingJourney({act,screens}={}){
 const h=await harness({assets:true,now:'2026-10-15T12:00:00Z',outbound:()=>assert.fail('Fee correction must perform no outbound action')})
 try{
  const f=await allocatedExceptionFixture(h,{rounding:true})
  const action=(name,input)=>act?act(h,name,input):h.cmd(name,input)
  const before=(await h.state()).ledger.journals
  assert.equal(net(before,'ownerLiability'),10000)
  let row=await action('financeCase.propose',await f.input())
  const proposal=row.proposals.at(-1)
  row=await action('financeCase.reject',{id:row.id,revision:row.revision,proposalId:proposal.id,reason:'Review the complete group before approval'})
  assert.deepEqual((await h.state()).ledger.journals,before)
  row=await action('financeCase.propose',await f.input())
  const exact=row.proposals.at(-1)
  if(screens)await screens(h,'rounding-proposal')
  await action('financeCase.approve',{id:row.id,revision:row.revision,proposalId:exact.id,confirm:'yes',reason:'Approve ten frozen owner shares and the explicit ten-dollar missing fee'})
  const state=await h.state(),journals=state.ledger.journals
  assert.equal(net(journals,'ownerLiability'),9000,'The corrected owner liability is exactly $90.00')
  assert.equal(net(journals,'cash'),-9000)
  assert.equal(net(journals,'allocationClearing'),0)
  const corrected=state.financialAllocations.find(a=>a.correctionOf===f.allocation.id)
  assert.deepEqual(corrected.parts.map(p=>p.payableCents),[0,1000,1000,1000,1000,1000,1000,1000,1000,1000])
  for(const original of before){
   const reversals=journals.filter(j=>j.reversalOf===original.id)
   assert.equal(reversals.length,1,'Every original journal is reversed exactly once')
   assert.deepEqual(reversals[0].lines,original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents})))
  }
  for(const [i,p] of corrected.parts.entries()){
   const original=before.find(j=>j.sourceKey==='allocation:'+f.allocation.id+':'+i)
   assert.ok(original)
   assert.equal(net(journals.filter(j=>j.ownerKey===original.ownerKey),'ownerLiability'),p.payableCents,'Each owner liability matches the frozen corrected allocation')
   const replacements=journals.filter(j=>j.correctionOf===original.id)
   assert.equal(replacements.length,i===0?0:1,'Only nonzero owner amounts have replacement journals')
   if(replacements.length)assert.equal(replacements[0].ownerKey,original.ownerKey,'Replacement links retain the same owner')
  }
  for(const j of journals)assert.equal(j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0),0)
  await h.cmd('financeCase.approve',{id:row.id,revision:row.revision,proposalId:exact.id,confirm:'yes',reason:'Duplicate approval'},h.owner,409)
  await h.restart()
  assert.deepEqual((await h.state()).ledger.journals,journals)
  if(screens)await screens(h,'rounding-corrected')
  console.log('PROBE AGENT-002 B: command door, $100 settlement, $10 missing fee, shares [1, 1111 x 9] -> every original reversed once; owner liabilities [0, 1000 x 9], total 9000 cents; clearing zero; rejected and duplicate approvals post nothing; restart preserves journals')
 }finally{await h.close()}
}
