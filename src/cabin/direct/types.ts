import type { VerificationPolicy } from '../verification/types'
export interface DirectHome {
 cancellationPolicy?:import('../reservations/types').CancellationPolicy;
 verificationPolicy?:VerificationPolicy;
 propertyId:string; revision:string; enabled:boolean; slug:string; description:string;
 nightlyCents:number; cleaningCents:number; extraGuestCents:number; includedGuests:number; maxGuests:number;
 minNights:number; maxNights:number; minGapNights:number; depositCents:number; releaseHours:number;
 taxLabel:string; taxBps:number; countyTaxLabel:string; countyTaxBps:number; agreement:string; requireIdentity:boolean;
}
export interface Quote {
 cancellationPolicy?:import('../reservations/types').CancellationPolicy;
 managementVersion?:string;
 start:string; end:string; guests:number; nights:number; nightlyCents:number; rentCents:number;
 cleaningCents:number; extraGuestCents:number; taxes:{label:string; bps:number; amountCents:number; jurisdiction:'state'|'county'}[];
 totalCents:number; depositCents:number; baseRentCents?:number; discountCents?:number;
 returningGuest?:{offerId:string; guestId:string; name:string; discountBps:number};
}
export interface DirectStay {
 depositReconciliations?:{id:string;at:string;actorId:string;reference:string;prior:NonNullable<DirectStay['deposit']>;provider:{id:string;status:string;amount:number;amount_received:number;amount_capturable:number;currency:string}}[];
 refunds?:import('./refund-types').Refund[];
 depositReceipts?:{key:string;messageId:string}[];
 restored?:boolean;
 id:string; propertyId:string; bookingId:string; revision:string; homeRevision:string; phase:'held'|'paid'|'confirmed'|'expired'|'cancelled';
 start:string; end:string; guestName:string; email:string; quote:Quote; createdAt:string; holdUntil:string;
 signature:{name:string; at:string; version:string; text:string; sha256:string; consent:string};
 requireIdentity:boolean; identity?:{id:string; status:string}; checkoutId?:string; checkoutUrl?:string;
 paymentId?:string; customerId?:string; paymentMethod?:string; paymentMode?:'test'|'live';
 bookingLinkSealed?:string; timeZone?:string; arrivalAt?:string; departureAt?:string; depositDueAt?:string; depositAttempt?:string;
 depositCheckout?:{id:string;url:string;attempt:string;status:'open'|'complete'|'expired'};
 depositRequestedAt?:string; depositUncertain?:boolean; depositCheckoutPending?:{attempt:string;at:string};
 previousDeposit?:NonNullable<DirectStay['deposit']>;
 paymentMessageId?:string; confirmationMessageId?:string;
 deposit?:{id:string; status:string; amountCents:number; capturedCents?:number; claimCents?:number; expiresAt:string|null; reason?:string; evidence?:string; approvedBy?:string; approvedAt?:string; action?:'capture'|'release'; requestedAt?:string; reviewRequired?:boolean; actionAttempt?:string};
 releaseHours:number; checkedOutAt?:string; error?:string; taxFilings?:{jurisdiction:string; reference:string; actorId:string; at:string}[];
}
