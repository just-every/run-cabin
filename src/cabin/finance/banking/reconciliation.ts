import { need,sha } from '../../model'
import type { Journal } from '../../ledger/types'
import { sumCents } from '../csv'
import type { BankData,BankStatement,BankControl,OwnerControl } from './types'
export const net=(j:Journal,account:string)=>sumCents(j.lines.filter(l=>l.account===account).map(l=>l.debitCents-l.creditCents))
export async function control(data:BankData,statement:BankStatement,all:Journal[]):Promise<BankControl>{
 const account=data.accounts.find(a=>a.id===statement.accountId)!
 const assigned=data.assignments.filter(a=>a.accountId===account.id)
 const journals=assigned.map(a=>all.find(j=>j.id===a.journalId)!).filter(j=>j.effectiveDate<=statement.until)
 need(journals.every(j=>j.legalEntity===account.legalEntity&&j.propertyId===account.propertyId),'An assigned journal has a different legal entity or home',409)
 const matches=data.matches.filter(m=>m.accountId===account.id),matched=new Set(matches.map(m=>m.journalId))
 const unmatchedTransactionIds=statement.transactions.filter(t=>!matches.some(m=>m.statementId===statement.id&&m.transactionId===t.id)).map(t=>t.id)
 const outstanding=journals.filter(j=>net(j,'cash')!==0&&!matched.has(j.id))
 const unassignedJournalIds=all.filter(j=>j.propertyId===account.propertyId&&j.legalEntity===account.legalEntity&&j.effectiveDate<=statement.until&&!data.assignments.some(a=>a.journalId===j.id)).map(j=>j.id)
 const owners=new Map<string,OwnerControl>()
 for(const j of journals){
  let o=owners.get(j.ownerKey)
  if(!o){o={ownerKey:j.ownerKey,payableCents:0,reservesCents:0,advancesCents:0,taxCents:0,vendorCents:0,cashCents:0,receivableCents:0,managerCents:0,guestCreditsCents:0,processorCents:0,clearingCents:0,otherDebitsCents:0,controlDifferenceCents:0};owners.set(j.ownerKey,o)}
  for(const [field,accountName,sign] of [['payableCents','ownerLiability',-1],['reservesCents','ownerReserves',-1],['advancesCents','advances',-1],['taxCents','taxes',-1],['vendorCents','vendorPayable',-1],['cashCents','cash',1],['receivableCents','receivable',1],['managerCents','managerRevenue',-1],['guestCreditsCents','guestCredits',-1],['processorCents','processorFunds',1],['clearingCents','allocationClearing',1]] as const)o[field]=sumCents([o[field],sign*net(j,accountName)])
  o.otherDebitsCents=sumCents([o.otherDebitsCents,...j.lines.filter(l=>['expenses','channelFees','managerExpenses','damageAuthorization','damageHolds'].includes(l.account)).map(l=>l.debitCents-l.creditCents)])
 }
 for(const o of owners.values())o.controlDifferenceCents=sumCents([o.cashCents,o.receivableCents,o.processorCents,o.clearingCents,o.otherDebitsCents,-o.payableCents,-o.reservesCents,-o.advancesCents,-o.taxCents,-o.vendorCents,-o.managerCents,-o.guestCreditsCents])
 const ledgerCashCents=sumCents(journals.map(j=>net(j,'cash'))),outstandingCents=sumCents(outstanding.map(j=>net(j,'cash')))
 // Freeze immutable identities as well as amounts. Later assignments/matches/journals invalidate an approval.
 const baseline=await sha(JSON.stringify({statement,assigned,matches,journals,unassignedJournalIds}))
 return {openingLedgerCents:sumCents(journals.filter(j=>j.effectiveDate<statement.from).map(j=>net(j,'cash'))),ledgerCashCents,bankClosingCents:statement.closingCents,outstandingCents,differenceCents:sumCents([ledgerCashCents,-statement.closingCents,-outstandingCents]),unmatchedTransactionIds,outstandingJournalIds:outstanding.map(j=>j.id),unassignedJournalIds,owners:[...owners.values()],baseline,journals}
}
