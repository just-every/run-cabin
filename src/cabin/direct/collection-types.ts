import type { Actor } from '../model'
export interface CollectionAttempt { id:string; at:string; outcome:'uncertain'|'succeeded'|'failed'|'pending'; providerId?:string; detail?:string }
export interface CollectionJob { id:string; label:string; amountCents:number; leadDays:number|null; dueAt:string; status:'scheduled'|'uncertain'|'pending'|'succeeded'|'failed'|'suppressed'; attempts:CollectionAttempt[]; receiptId?:string; followupNoticeId?:string; followupTaskId?:string; overdueNoticeId?:string; deadline?:string; detail?:string; resolvedAt?:string }
export interface CollectionPlan {
 id:string; revision:string; propertyId:string; bookingId:string; createdAt:string; authority:Actor; policy:string;
 basis:{start:string;end:string;email:string;totalCents:number;propertyId:string;policy:string;arrivalTime:string};
 status:'consent_required'|'active'|'paused'|'cancelled'; restored?:boolean; mode:'test'|'live';
 jobs:CollectionJob[]; assigneeId:string; customerId?:string; paymentMethod?:string;
 setup?:{id?:string;url?:string;attempt:string;at:string}; consent?:{at:string;digest:string;signature:string};
 history:{at:string;detail:string}[];
}
