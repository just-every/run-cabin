import assert from 'node:assert/strict'
import { homeDay } from './home-calendar.mjs'
export async function populateBankArchive(h){
 const home=await h.cmd('property.save',{name:'Zinnia Bank Archive',ownerName:'Bank Archive Owner',ownerEmail:'bank-owner@stay.example',commissionBps:0})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Zinnia Owner Trust'})
 const reservation=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Archive Bank Guest',start:homeDay(80,'America/New_York'),end:homeDay(82,'America/New_York')})
 const entries=[]
 for(const [n,operation] of ['earn','payment'].entries())entries.push(await h.cmd('ledger.post',{propertyId:home.id,bookingId:reservation.bookingId,operation,amountCents:10000,sourceId:'synthetic-cabin-bank-'+n,sourceRevision:'synthetic-cabin-1',effectiveDate:'2026-10-02'}))
 const account=await h.cmd('bank.account.create',{propertyId:home.id,label:'Archive owner trust',institution:'Community Bank',lastFour:'7392',purpose:'trust',confirm:'yes'})
 for(const j of entries)await h.cmd('bank.assign',{id:account.id,journalId:j.id,evidence:'Original archived bank attribution'})
 const statement=await h.cmd('bank.statement.import',{id:account.id,reference:'synthetic-cabin-20',from:'2026-10-01',until:'2026-10-31',opening:'0.00',closing:'100.00',evidence:'Original bank statement custody evidence',confirm:'yes',csv:'Transaction ID,Date,Amount,Reference\nsynthetic-cabin-21,2026-10-03,100.00,Original bank receipt\n'})
 await h.cmd('bank.match',{id:statement.id,transactionId:'synthetic-cabin-21',journalId:entries[1].id})
 const reconciliation=await h.cmd('bank.reconcile',{id:statement.id,confirm:'yes',evidence:'Original bank-ledger-owner review'})
 const plan=await h.cmd('bank.distribution.approve',{id:reconciliation.id,ownerKey:entries[0].ownerKey,amountCents:5000,reserveCents:1000,confirm:'yes',evidence:'Original unexecuted owner plan'})
 return {account,statement,reconciliation,plan}
}
export async function checkBankArchive(h,cookie,proof){
 const bank=(await h.state(cookie)).trustBank
 assert.deepEqual(bank.accounts.find(a=>a.id===proof.account.id),proof.account)
 assert.deepEqual(bank.statements.find(s=>s.id===proof.statement.id),proof.statement)
 assert.deepEqual(bank.reconciliations.find(r=>r.id===proof.reconciliation.id),proof.reconciliation)
 assert.deepEqual(bank.plans.find(p=>p.id===proof.plan.id),{...proof.plan,restorePaused:true})
}
