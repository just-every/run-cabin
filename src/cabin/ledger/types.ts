export const accounts = {
 processorFunds:'Funds held by payment processor',
 allocationClearing:'Agreement allocation clearing', ownerReserves:'Owner reserve payable', managerExpenses:'Manager expenses',
 cash:'Trust cash', receivable:'Guest receivables', advances:'Advance deposits',
 damageAuthorization:'Damage authorizations (non-cash)', damageHolds:'Damage holds (non-cash)',
 ownerLiability:'Owner funds payable', managerRevenue:'Manager revenue', channelFees:'Channel / processor fees clearing',
 expenses:'Owner expenses clearing', taxes:'Tax payable', guestCredits:'Guest credits payable', vendorPayable:'Vendor payable',
} as const
export type Account = keyof typeof accounts
export interface LedgerSetting { id:string; revision:string; propertyId:string; legalEntity:string }
export interface Leg { account:Account; debitCents:number; creditCents:number }
export interface Journal {
 manualReceipt?:{method:'cash'|'check';reference:string;note:string;receivedAt:string};
 id:string; sourceKey:string; propertyId:string; bookingId:string; ownerKey:string; legalEntity:string;
 effectiveDate:string; postedAt:string; actorId:string; sourceType:string; sourceId:string; sourceRevision:string;
 reversalOf?:string; correctionOf?:string; lines:Leg[];
}
export const debit = (account:Account, amount:number):Leg => ({account,debitCents:amount,creditCents:0})
export const credit = (account:Account, amount:number):Leg => ({account,debitCents:0,creditCents:amount})
