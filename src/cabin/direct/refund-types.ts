export interface RefundAmounts {
 rentCents:number; feesCents:number; depositCents:number;
 taxes:{jurisdiction:string;label:string;amountCents:number}[]; totalCents:number;
}
export interface Refund {
 id:string; revision:string; kind:'rent'|'full'|'settlement'|'deposit';
 status:'draft'|'requested'|'pending'|'uncertain'|'succeeded'|'failed'|'cancelled';
 paymentId:string; amounts:RefundAmounts; reason:string; evidence:string;
 basis:string; terms:string; bookingRevision:string; createdAt:string;
 approvedBy?:string; approvedAt?:string; requestedAt?:string;
 providerId?:string; providerStatus?:string; completedAt?:string; messageId?:string; error?:string;
}
