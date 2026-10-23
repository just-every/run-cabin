import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
import { homeDay } from './home-calendar.mjs'

export async function bankingJourney({act,screens}={}){
 const h=await harness({assets:true,outbound:()=>assert.fail('Bank reconciliation and unexecuted plans must never call a payment provider')})
 const action=async(name,input)=>{if(act)await act(h,name,input);return h.cmd(name,input)}
 try{
  const home=await h.cmd('property.save',{name:'Cedar Creek Trust',ownerName:'Alice Harper',ownerEmail:'alice@stay.example',commissionBps:0})
  await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Cedar Creek Rentals LLC'})
  const book=async(p,n,name)=>{const r=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',guestName:name,start:homeDay(n,'America/New_York'),end:homeDay(n+2,'America/New_York')});return r.bookingId}
  const alice=await book(home,10,'Megan Ortiz')
  await h.cmd('property.save',{...home,ownerName:'Bob Chen',ownerEmail:'bob@stay.example'})
  const bob=await book(home,20,'Sam Rivera')
  const other=await h.cmd('property.save',{name:'Lake Loft Trust',ownerName:'Carol Lee',ownerEmail:'carol@stay.example',commissionBps:0})
  await h.cmd('ledger.configure',{propertyId:other.id,legalEntity:'Lake Loft Rentals LLC'})
  const carol=await book(other,30,'Jamie Brooks')
  const posted=[]
  const post=async(propertyId,bookingId,operation,amountCents,n)=>{const row=await h.cmd('ledger.post',{propertyId,bookingId,operation,amountCents,sourceId:'synthetic-cabin-'+n,sourceRevision:'synthetic-cabin-1',effectiveDate:'2026-10-02'});posted.push(row);return row}
  const aliceEarn=await post(home.id,alice,'earn',50000,1),aliceCash=await post(home.id,alice,'payment',10000,2)
  await post(home.id,bob,'earn',60000,3);const bobCash=await post(home.id,bob,'payment',100000,4)
  await post(other.id,carol,'earn',30000,5);const carolCash=await post(other.id,carol,'payment',30000,6)
  const account=await action('bank.account.create',{propertyId:home.id,label:'Cedar guest trust',institution:'First Community Bank',lastFour:'4821',purpose:'trust',confirm:'yes'})
  const second=await action('bank.account.create',{propertyId:other.id,label:'Lake guest trust',institution:'First Community Bank',lastFour:'6793',purpose:'trust',confirm:'yes'})
  await h.cmd('bank.account.create',{propertyId:home.id,label:'Wrong bank details',institution:'Bank',lastFour:'123456789',purpose:'trust',confirm:'yes'},h.owner,400)
  await h.cmd('bank.assign',{id:second.id,journalId:aliceEarn.id,evidence:'wrong home'},h.owner,409)
  for(const journal of posted)await action('bank.assign',{id:journal.propertyId===home.id?account.id:second.id,journalId:journal.id,evidence:'Actual cash and owner ledger source attribution '+journal.sourceId})
  const statementInput={id:account.id,reference:'synthetic-cabin-7',from:'2026-10-01',until:'2026-10-31',opening:'0.00',closing:'1100.00',evidence:'October bank statement received and reviewed',confirm:'yes',csv:'Transaction ID,Date,Amount,Reference\nsynthetic-cabin-8,2026-10-03,100.00,Alice guest receipt\nsynthetic-cabin-9,2026-10-03,1000.00,Bob guest receipts\n'}
  const statement=await action('bank.statement.import',statementInput)
  assert.equal((await h.cmd('bank.statement.import',statementInput)).id,statement.id)
  await h.cmd('bank.statement.import',{...statementInput,evidence:'Changed original evidence'},h.owner,409)
  await h.cmd('bank.reconcile',{id:statement.id,confirm:'yes',evidence:'Not matched'},h.owner,409)
  await h.cmd('bank.match',{id:statement.id,transactionId:'synthetic-cabin-8',journalId:bobCash.id},h.owner,409)
  if(screens)await screens(h,'unmatched')
  await action('bank.match',{id:statement.id,transactionId:'synthetic-cabin-8',journalId:aliceCash.id})
  await action('bank.match',{id:statement.id,transactionId:'synthetic-cabin-9',journalId:bobCash.id})
  const otherStatement=await action('bank.statement.import',{...statementInput,id:second.id,reference:'synthetic-cabin-10',closing:'300.00',csv:'Transaction ID,Date,Amount,Reference\nsynthetic-cabin-11,2026-10-03,300.00,Carol guest receipt\n'})
  await action('bank.match',{id:otherStatement.id,transactionId:'synthetic-cabin-11',journalId:carolCash.id})
  const reconciliation=await action('bank.reconcile',{id:statement.id,confirm:'yes',evidence:'October bank to ledger to owner controls reviewed'})
  const otherReconciliation=await action('bank.reconcile',{id:otherStatement.id,confirm:'yes',evidence:'Lake October bank and owner controls reviewed'})
  assert.equal(reconciliation.control.differenceCents,0);assert.equal(reconciliation.control.ledgerCashCents,110000)
  assert.deepEqual(reconciliation.control.owners.map(o=>[o.cashCents,o.payableCents,o.receivableCents]).sort((a,b)=>a[0]-b[0]),[[10000,50000,40000],[100000,60000,-40000]])
  assert.equal(otherReconciliation.control.ledgerCashCents,30000)
  if(screens)await screens(h,'reconciled')
  const ownerKey=aliceEarn.ownerKey,planInput={id:reconciliation.id,ownerKey,amountCents:5000,reserveCents:2000,evidence:'Alice October distribution reviewed; keep additional reserve',confirm:'yes'}
  await h.cmd('bank.distribution.approve',{...planInput,amountCents:20000},h.owner,409)
  const plan=await action('bank.distribution.approve',planInput)
  assert.equal((await h.cmd('bank.distribution.approve',planInput)).id,plan.id)
  await h.cmd('bank.distribution.approve',{...planInput,amountCents:6000},h.owner,409)
  const ledgerBefore=(await h.state()).ledger.journals
  assert.equal(ledgerBefore.length,posted.length,'Matching, reconciliation and approval never invent cash or distribution postings')
  await h.restart();let state=await h.state()
  assert.equal(state.trustBank.reconciliations.length,2);assert.equal(state.trustBank.plans[0].status,'approved_awaiting_partner')
  assert.deepEqual(state.ledger.journals,ledgerBefore)
  if(screens)await screens(h,'planned')
  const staff=await h.cmd('member.save',{name:'Scoped Accountant',email:'accountant@stay.example',role:'accountant',active:true,propertyIds:[home.id],actions:['finance:read','bank.statement.import','bank.assign','bank.match','bank.reconcile']})
  await h.cmd('member.invite',{id:staff.id});const cookie=await h.signIn('accountant@stay.example')
  state=await h.state(cookie);assert.equal(state.trustBank.accounts.length,1);assert.equal(state.trustBank.accounts[0].id,account.id)
  assert.ok(!JSON.stringify(state.trustBank).includes(second.id));assert.equal((await h.send('/app/ledger',undefined,cookie)).status,200)
  assert.equal((await h.cmd('bank.reconcile',{id:statement.id,confirm:'yes',evidence:'Scoped accountant review'},cookie)).id,reconciliation.id)
  await h.cmd('bank.match',{id:otherStatement.id,transactionId:'synthetic-cabin-11',journalId:carolCash.id},cookie,404)
  await h.cmd('bank.distribution.approve',planInput,cookie,403)
  const cleaner=await h.person('Taylor');assert.deepEqual((await h.state(cleaner.cookie)).trustBank.accounts,[])
  await h.cmd('bank.statement.import',statementInput,cleaner.cookie,403)
  const late=await post(home.id,alice,'expense',1000,12)
  await h.cmd('bank.assign',{id:account.id,journalId:late.id,evidence:'Later bank withdrawal evidence'})
  await h.cmd('bank.distribution.approve',planInput,h.owner,409)
  assert.equal((await h.state()).trustBank.reconciliations[0].control.ledgerCashCents,110000,'Original reconciliation remains immutable after a later posting')
  await h.cmd('bank.distribution.cancel',{cancelPlanId:plan.id,confirm:'yes',evidence:'Cancel until later withdrawal reconciles'})
  return {account,second,statement,reconciliation,plan}
 }finally{await h.close()}
}
