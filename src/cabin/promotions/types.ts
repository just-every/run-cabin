import type { Booking } from '../model'
import type { AllocationPart } from '../finance/allocation-types'

export type PromotionKind = 'gap' | 'early' | 'late' | 'extra'
export interface PromotionCoupon {
 code:string; bps:number; from:string; until:string; minNights:number; repeatOnly:boolean; channels:string[]
}
export interface PromotionPolicy {
 id:string; revision:string; propertyId:string; enabled:boolean; minimumNetCents:number;
 providerFeeReserveCents:number; stock:number; refundRetainedBps:number; refundDeadlineHours:number;
 taxBps:number; coupons:PromotionCoupon[]; approvedBy:string; approvedAt:string
}
export interface PromotionBooking extends Booking { departureTime?:string; promotionIds?:string[] }
export interface PromotionOffer {
 restorePaused?:boolean;
 id:string; revision:string; propertyId:string; bookingId:string; bookingRevision:string; policyRevision:string;
 kind:PromotionKind; title:string; status:'draft'|'sent'|'checkout'|'applied'|'expired'|'cancelled'|'refund_due'|'refunded';
 createdAt:string; createdBy:string; expiresAt:string; tokenHash:string; tokenSealed:string; email:string;
 consentBaseline:string; guestId:string; managementRevision:string; terms:string;
 original:{start:string;end:string;arrivalTime?:string;departureTime?:string};
 target:{start:string;end:string;arrivalTime?:string;departureTime?:string};
 baseCents:number; discountCents:number; netCents:number; amountCents:number; taxCents:number; costCents:number;
 refundRetainedBps:number; refundDeadlineAt:string; cancelReason?:string;
 parts:AllocationPart[]; coupon?:string; quantity:number; holdId?:string; sentAt?:string; messageId?:string;
 paymentMode?:'test'|'live'; checkoutId?:string; checkoutUrl?:string; checkoutRequestedAt?:string;
 signature?:{name:string;at:string;terms:string}; paymentId?:string; paidAt?:string;
 appliedAt?:string; appliedBookingRevision?:string; revertedAt?:string; error?:string;
 refund?:{amountCents:number;retainedCents:number;reason:string;requestedAt?:string;providerId?:string;
 status:'due'|'requested'|'uncertain'|'pending'|'succeeded'|'failed';completedAt?:string};
}
