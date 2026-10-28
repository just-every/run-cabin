import type { ManagementTerms } from '../properties/terms'
export interface ReservationPrice { rentCents:number; feesCents:number; taxCents:number; totalCents:number }
export interface CancellationPolicy { selection?:{basis:'arrival';date:string;revision:string;start:string|null;end:string|null}; known?:boolean; name:string; freeUntil:string|null; retainedBps:number; noShowBps:number }
export interface ReservationVersion {
 revision:string; at:string; by:string; reason:string; propertyId:string; start:string; end:string;
 guestName:string; guestEmail?:string; guestPhone?:string; arrivalTime?:string; departureTime?:string; status:string;
 channel:string; sourceId:string; price?:ReservationPrice; policy:CancellationPolicy;
 managementTerms?:ManagementTerms;
}
export interface ReservationLifecycle {
 sourceOrigin?:{propertyId:string;channel:string;uid:string;connectionId?:string;snapshot:{start:string;end:string;summary:string}}; sourceReview?:boolean; sourceConflict?:{start:string;end:string;summary:string;cancelled:boolean;at:string};
 method:'direct'|'phone'|'manual'|'channel'; sourceId:string; policy:CancellationPolicy; price?:ReservationPrice;
 outcome?:'cancelled'|'no_show'; cancellationReason?:string; settledChargeCents?:number;
 history:ReservationVersion[]; events:{id:string; fingerprint:string; revision:string}[];
 allocation?:{reserveCents?:number;owners?:{name:string;amountCents:number}[];agreementId:string; grossCents:number; commissionCents:number; ownerCents:number};
}
