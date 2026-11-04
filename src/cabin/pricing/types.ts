export const pricingChannels = ['direct','airbnb','vrbo','booking-com'] as const
export type PricingChannel = typeof pricingChannels[number]
export interface NativeNight {
 date:string; amountCents:number; source:'default'|'dated'|'manual'; rateId:string|null; revision:string
}
export interface NativeOverride {
 revision:string; date:string; action:'override'|'clear'; amountCents:number; reason:string;
 at:string; actorId:string; homeRevision:string; limitsRevision:string; before:NativeNight; underlying:NativeNight
}
export interface NativePlanner {
 revision:string; savedAt:string; floorCents:number; ceilingCents:number; history:NativeOverride[]
}
export interface NativePlan {
 source:'host-saved-rates'; homeRevision:string; limitsRevision:string; floorCents:number; ceilingCents:number; nights:NativeNight[]
}
export interface ChannelAdjustment {
 kind:'percent'|'fixed'; value:number; includeCleaning:boolean; includeExtraGuests:boolean; commissionBps:number
}
export interface PricingPolicy {
 revision:string; savedAt:string; floorCents:number; weeklyBps:number; monthlyBps:number;
 channels:Partial<Record<PricingChannel,ChannelAdjustment>>
}
export interface PriceNight {
 native?:NativeNight;
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
