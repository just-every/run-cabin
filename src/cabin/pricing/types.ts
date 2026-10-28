export const pricingChannels = ['direct','airbnb','vrbo','booking-com'] as const
export type PricingChannel = typeof pricingChannels[number]
export interface ChannelAdjustment {
 kind:'percent'|'fixed'; value:number; includeCleaning:boolean; includeExtraGuests:boolean; commissionBps:number
}
export interface PricingPolicy {
 revision:string; savedAt:string; floorCents:number; weeklyBps:number; monthlyBps:number;
 channels:Partial<Record<PricingChannel,ChannelAdjustment>>
}
export interface PriceNight {
 couponDiscountCents?:number; date:string; rateId:string|null; baseCents:number; adjustmentCents:number; lengthDiscountCents:number;
 returningDiscountCents:number; requestedCents:number; amountCents:number; floorCents:number; floorApplied:boolean
}
export interface PriceSnapshot {
 source:'native-saved-rates'; homeRevision:string; policyRevision:string; savedAt:string; channel:PricingChannel;
 adjustment:ChannelAdjustment; weeklyBps:number; monthlyBps:number; discountKind:'weekly'|'monthly'|null;
 discountBps:number; nights:PriceNight[]; baseCleaningCents:number; baseExtraGuestCents:number;
 cleaningCents:number; extraGuestCents:number; lengthDiscountCents:number; returningDiscountCents:number;
 rentBeforeReturningCents:number; rentCents:number; subtotalCents:number; commissionCents:number; expectedPayoutCents:number
}
