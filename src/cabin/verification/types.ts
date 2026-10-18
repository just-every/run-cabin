export interface VerificationPolicy {
 revision:string; mode:'none'|'all'|'risk'; shortLeadDays:number; minGuests:number; minTotalCents:number;
 reviewerId:string; reviewerEmail:string; blockAccess:boolean; requireBeforeConfirmation:boolean; retentionDays:number; origin:string;
}
export interface VerificationCase {
 restorePaused?:boolean;
 id:string; revision:string; propertyId:string; bookingId:string; policy:VerificationPolicy; reasons:string[];
 status:'not_required'|'pending'|'processing'|'requires_input'|'verified'|'manual_requested'|'approved'|'rejected'|'erased';
 token:string|null; createdAt:string; retainUntil:string; consentAt?:string; consentMethod?:'stripe'|'manual';
 provider?:{id:string;status:string;mode:'test'|'live'}; redaction?:'pending'|'processing'|'complete'; error?:string;
 decision?:{by:string;at:string;outcome:'approved'|'rejected';method:string;reference:string;reason:string};
 history:{at:string;by:string;action:string}[];
}
export interface VerificationData { verifications?:VerificationCase[] }
