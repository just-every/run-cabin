export interface OwnerShare { name:string; email:string; bps:number }
export interface AllocationModel {
 commissionBase:'rent'|'netRent'|'receipts'; fixedFeeCents:number; reserveBps:number;
 ownerUseCleaningCents:number; passThrough:'owner'|'manager'; taxExpense:'owner'|'manager';
 owners:OwnerShare[]; mapping:{owner:string; manager:string; reserve:string; tax:string; vendor:string; reviewedBy:string}
}
export interface AllocationPart {
 ownerName:string; ownerEmail:string; shareBps:number; grossCents:number; channelFeeCents:number;
 managementFeeCents:number; taxCents:number; expenseCents:number; reserveCents:number; payableCents:number
}
export interface FinancialAllocation {
 id:string; revision:string; propertyId:string; bookingId:string; period:string; agreementId:string;
 terms:import('../properties/terms').ManagementTerms; kind:'revenue'|'cost'|'ownerUse'; sourceIds:string[];
 baseline:string; description:string; evidence:string; totalCents:number; rentCents:number; passThroughCents:number;
 taxCents:number; taxReceivableCents?:number; managerCostCents:number; parts:AllocationPart[]; status:'draft'|'approved';
 preparedAt:string; preparedBy:string; approval?:import('../model').Approval
}
export interface SharedCost {
 id:string; revision:string; propertyId:string; date:string; description:string; invoice:string; evidence:string;
 agreementIds:string[]; category:'repair'|'passThrough'|'tax'; shares:{propertyId:string; bps:number}[]; amountCents:number;
 status:'draft'|'approved'; preparedAt:string; preparedBy:string; approval?:import('../model').Approval
}
