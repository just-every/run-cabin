import { type Context,need,owner,text,integer } from '../../model'
import { journals } from '../../ledger/store'
import { control } from './reconciliation'
import { accountIn,base,retain } from './store'
import type { BankData,DistributionPlan } from './types'
export async function distributionPlan(c:Context,data:BankData,p:Record<string,unknown>){
 owner(c.actor)
 if(p.cancelPlanId){
  const plan=data.plans.find(d=>d.id===p.cancelPlanId);need(plan,'Distribution plan not found',404)
  const existing=data.cancellations.find(d=>d.planId===plan.id);if(existing)return existing
  need(p.confirm==='yes','Confirm cancellation of this unexecuted distribution plan')
  return retain(c,data,'cancellations',{...base(c,plan.propertyId),planId:plan.id,evidence:text(p.evidence,'cancellation reason',1000)})
 }
 need(p.confirm==='yes','Explicit owner approval is required for this exact distribution plan')
 const reconciliation=data.reconciliations.find(r=>r.id===p.id);need(reconciliation,'Bank reconciliation not found',404)
 const account=accountIn(data,reconciliation.accountId);need(account.purpose==='trust','Owner distributions require a designated trust account',409)
 const statement=data.statements.find(s=>s.id===reconciliation.statementId)!,all=await journals(c.db)
 const current=await control(data,statement,all)
 need(current.baseline===reconciliation.control.baseline,'Bank or ledger evidence changed. Reconcile the current account before approving a distribution',409)
 need(!data.assignments.some(a=>a.accountId===account.id&&all.find(j=>j.id===a.journalId)!.effectiveDate>statement.until),'Later ledger activity needs a newer bank reconciliation',409)
 need(current.outstandingJournalIds.length===0,'Outstanding bank items must clear before a distribution plan can reserve funds',409)
 const ownerKey=text(p.ownerKey,'owner ledger reference',64),amountCents=integer(Number(p.amountCents),'distribution USD cents',1),reserveCents=integer(Number(p.reserveCents),'additional retained reserve USD cents',0)
 const evidence=text(p.evidence,'distribution approval evidence',1000)
 const existing=data.plans.find(d=>d.reconciliationId===reconciliation.id&&d.ownerKey===ownerKey&&!data.cancellations.some(x=>x.planId===d.id))
 if(existing){need(existing.amountCents===amountCents&&existing.reserveCents===reserveCents&&existing.evidence===evidence,'This exact approval already has another amount or evidence; cancel the unexecuted plan before replacing it',409);return existing}
 const row=current.owners.find(o=>o.ownerKey===ownerKey);need(row,'Owner funds not found in this bank account',409)
 const held=data.plans.filter(d=>d.accountId===account.id&&!data.cancellations.some(c=>c.planId===d.id)),ownHeld=held.filter(d=>d.ownerKey===ownerKey).reduce((n,d)=>n+d.amountCents,0)
 const retainedReserve=Math.max(reserveCents,...held.filter(d=>d.ownerKey===ownerKey).map(d=>d.reserveCents))
 // Cash belonging to another owner, taxes, advances, reserves and vendors cannot fund this plan.
 const cashAvailable=row.cashCents-Math.max(0,row.advancesCents)-Math.max(0,row.taxCents)-Math.max(0,row.vendorCents)-Math.max(0,row.reservesCents)-Math.max(0,row.guestCreditsCents)-Math.max(0,row.managerCents)
 need(amountCents+retainedReserve+ownHeld<=Math.min(row.payableCents,cashAvailable),'This owner has insufficient reconciled, unreserved funds; another owner’s money cannot be used',409)
 need(amountCents+held.reduce((n,d)=>n+d.amountCents,0)<=current.bankClosingCents,'The bank account lacks unreserved reconciled funds',409)
 const plan:DistributionPlan={...base(c,account.propertyId),accountId:account.id,reconciliationId:reconciliation.id,ownerKey,amountCents,reserveCents,evidence,status:'approved_awaiting_partner',baseline:current.baseline}
 return retain(c,data,'plans',plan)
}
