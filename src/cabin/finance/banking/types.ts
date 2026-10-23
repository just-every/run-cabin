import type { Journal } from '../../ledger/types'
export interface BankRecord { id:string; revision:string; propertyId:string; createdAt:string; createdBy:string }
export interface TrustAccount extends BankRecord { label:string; institution:string; lastFour:string; purpose:'trust'|'operating'; legalEntity:string }
export interface BankTransaction { id:string; date:string; amountCents:number; reference:string }
export interface BankStatement extends BankRecord { accountId:string; reference:string; evidence:string; from:string; until:string; openingCents:number; closingCents:number; sourceDigest:string; transactions:BankTransaction[] }
export interface BankAssignment extends BankRecord { accountId:string; journalId:string; evidence:string }
export interface BankMatch extends BankRecord { accountId:string; statementId:string; transactionId:string; journalId:string }
export interface OwnerControl { ownerKey:string; payableCents:number; reservesCents:number; advancesCents:number; taxCents:number; vendorCents:number; cashCents:number; receivableCents:number; managerCents:number; guestCreditsCents:number; processorCents:number; clearingCents:number; otherDebitsCents:number; controlDifferenceCents:number }
export interface BankControl { openingLedgerCents:number; ledgerCashCents:number; bankClosingCents:number; outstandingCents:number; differenceCents:number; unmatchedTransactionIds:string[]; outstandingJournalIds:string[]; unassignedJournalIds:string[]; owners:OwnerControl[]; baseline:string; journals:Journal[] }
export interface BankReconciliation extends BankRecord { accountId:string; statementId:string; evidence:string; control:BankControl }
export interface DistributionPlan extends BankRecord { accountId:string; reconciliationId:string; ownerKey:string; amountCents:number; reserveCents:number; evidence:string; status:'approved_awaiting_partner'; baseline:string; restorePaused?:boolean }
export interface PlanCancellation extends BankRecord { planId:string; evidence:string }
export interface BankData { accounts:TrustAccount[]; statements:BankStatement[]; assignments:BankAssignment[]; matches:BankMatch[]; reconciliations:BankReconciliation[]; plans:DistributionPlan[]; cancellations:PlanCancellation[] }
export const bankKinds={accounts:'trustAccounts',statements:'bankStatements',assignments:'bankAssignments',matches:'bankMatches',reconciliations:'bankReconciliations',plans:'distributionPlans',cancellations:'distributionCancellations'} as const
