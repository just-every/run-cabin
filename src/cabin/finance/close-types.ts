import type { Actor } from '../model'
import type { Journal } from '../ledger/types'
export interface CloseReceipt { id:string; source:string; reference:string; payoutId:string; bookingId:string; grossCents:number; feeCents:number; netCents:number; evidence:string }
export interface MonthClose {
 openingCents:number; movementCents:number; closingCents:number; reservesCents:number; refundsCents:number; distributionsCents:number;
 basis:'effective-date'; cutoff:string; journals:Journal[]; receipts:CloseReceipt[]; adjustmentOf?:string; adjustsStatementIds:string[];
}
export interface StatementSchedule {
 id:string; revision:string; propertyId:string; ownerEmail:string; nextMonth:string; day:number; time:string;
 policy:'review'|'release'; actor:Actor; enabled:boolean; lastStatementId?:string; error?:string; attemptedAt?:string;
}
