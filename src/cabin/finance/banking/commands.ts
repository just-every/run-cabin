import { type Context,manager,need,text,property } from '../../model'
import { journals } from '../../ledger/store'
import { hasAction,requireProperty } from '../../permissions/policy'
import { accountIn,bankData,base,retain } from './store'
import { control,net } from './reconciliation'
import { importStatement } from './statements'
import { distributionPlan } from './distributions'
import type { TrustAccount } from './types'
export async function bankCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!name.startsWith('bank.'))return undefined
 manager(c.actor);need(!c.actor.isAgent&&hasAction(c.actor,name),'Current financial team authority is required',403)
 const data=await bankData(c.db)
 if(name==='bank.account.create'){
  const home=property(c,p.propertyId);requireProperty(c.actor,home.id)
  const setting=c.data.ledgerSettings.find(s=>s.propertyId===home.id);need(setting,'Configure this home’s ledger legal entity first',409)
  const label=text(p.label,'account label',100),institution=text(p.institution,'bank institution',100),lastFour=text(p.lastFour,'last four digits',4)
  need(/^\d{4}$/.test(lastFour),'Enter only the last four account digits, never a full bank account number')
  need(p.purpose==='trust'||p.purpose==='operating','Designate a trust or operating account')
  need(p.confirm==='yes','Confirm the bank’s designation and legal entity; Cabin does not custody funds')
  const existing=data.accounts.find(a=>a.institution===institution&&a.lastFour===lastFour&&a.legalEntity===setting.legalEntity)
  if(existing){need(existing.propertyId===home.id&&existing.label===label&&existing.purpose===p.purpose,'This masked account already has another designation; review its existing home assignment',409);return existing}
  const account:TrustAccount={...base(c,home.id),label,institution,lastFour,purpose:p.purpose,legalEntity:setting.legalEntity}
  return retain(c,data,'accounts',account)
 }
 if(name==='bank.distribution.approve'||name==='bank.distribution.cancel'){
  const target=name==='bank.distribution.cancel'?data.plans.find(r=>r.id===p.cancelPlanId):data.reconciliations.find(r=>r.id===p.id)
  need(target,'Distribution source not found',404);requireProperty(c.actor,target.propertyId)
  need(name==='bank.distribution.cancel'?!!p.cancelPlanId:!p.cancelPlanId,'Use the explicit distribution approval or cancellation command')
  return distributionPlan(c,data,p)
 }
 if(name==='bank.reconcile'||name==='bank.match'){
  const statement=data.statements.find(s=>s.id===p.id);need(statement,'Bank statement not found',404);requireProperty(c.actor,statement.propertyId)
  const all=await journals(c.db)
  if(name==='bank.match'){
   const transaction=statement.transactions.find(t=>t.id===p.transactionId);need(transaction,'Bank transaction not found',404)
   const assignment=data.assignments.find(a=>a.journalId===p.journalId&&a.accountId===statement.accountId),journal=all.find(j=>j.id===p.journalId)
   need(assignment&&journal,'Assign this journal to this exact bank account first',409)
   need(journal.effectiveDate<=statement.until&&net(journal,'cash')===transaction.amountCents,'The bank amount must exactly match this journal’s signed cash movement',409)
   const existing=data.matches.find(m=>m.statementId===statement.id&&m.transactionId===transaction.id)
   if(existing){need(existing.journalId===journal.id,'This bank transaction already has another immutable match',409);return existing}
   need(!data.matches.some(m=>m.journalId===journal.id),'This cash journal already matched a bank transaction',409)
   return retain(c,data,'matches',{...base(c,statement.propertyId),accountId:statement.accountId,statementId:statement.id,transactionId:transaction.id,journalId:journal.id})
  }
  need(p.confirm==='yes','Confirm you reviewed the bank, ledger and owner liability controls')
  const result=await control(data,statement,all)
  need(!result.unmatchedTransactionIds.length&&!result.unassignedJournalIds.length,'Unmatched bank rows or unassigned home journals remain; reconcile every source first',409)
  need(result.differenceCents===0&&result.owners.every(o=>o.controlDifferenceCents===0),'Bank, ledger and owner liability controls do not balance',409)
  const existing=data.reconciliations.find(r=>r.statementId===statement.id&&r.control.baseline===result.baseline);if(existing)return existing
  return retain(c,data,'reconciliations',{...base(c,statement.propertyId),accountId:statement.accountId,statementId:statement.id,evidence:text(p.evidence,'reconciliation review evidence',1000),control:result})
 }
 const account=accountIn(data,p.id);requireProperty(c.actor,account.propertyId)
 if(name==='bank.statement.import')return importStatement(c,data,account,p)
 need(name==='bank.assign','Unknown bank command',404)
 const journal=(await journals(c.db)).find(j=>j.id===p.journalId)
 need(journal&&journal.propertyId===account.propertyId&&journal.legalEntity===account.legalEntity,'The journal must belong to this bank account’s home and frozen legal entity',409)
 const existing=data.assignments.find(a=>a.journalId===journal.id)
 if(existing){need(existing.accountId===account.id,'This immutable journal already belongs to another bank account',409);return existing}
 return retain(c,data,'assignments',{...base(c,account.propertyId),accountId:account.id,journalId:journal.id,evidence:text(p.evidence,'bank attribution evidence',1000)})
}
