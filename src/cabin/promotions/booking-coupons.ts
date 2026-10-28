import type { Data } from '../model'
import { need } from '../model'
import { managementFor } from '../properties/terms'
import { modelFor,revenueParts } from '../finance/allocation-calculation'
import { homeSettings } from '../homes'
import { promotionRows } from './store'
import type { PromotionPolicy } from './types'
import type { DirectHome,Quote } from '../direct/types'
/** Quote and checkout use the same current policy; no client-provided discount or amount is trusted. */
export async function applyBookingCoupon(db:D1Database,data:Data,home:DirectHome,q:Quote,input:Record<string,unknown>){
 if(!input.couponCode)return
 need(!q.returningGuest,'Choose either the private returning rate or a coupon, not both',409)
 const code=String(input.couponCode).trim().toUpperCase(),p=(await promotionRows<PromotionPolicy>(db,'promotionPolicies')).find(p=>p.propertyId===home.propertyId),coupon=p?.coupons.find(c=>c.code===code)
 need(p?.enabled&&coupon&&!coupon.repeatOnly&&coupon.channels.includes('direct')&&coupon.from<=q.start&&coupon.until>=q.end&&q.nights>=coupon.minNights,'This coupon is not eligible for this home, dates, channel or guest. Returning-only rates require a private verified guest offer.',409)
 const nightDiscounts=q.pricing?.nights.map(n=>Math.round(n.amountCents*coupon.bps/10000))
 if(q.pricing)need(q.pricing.nights.every((n,i)=>n.amountCents-nightDiscounts![i]>=n.floorCents),'This coupon would cross the saved nightly floor',409)
 const discount=nightDiscounts?.reduce((n,d)=>n+d,0)??Math.round(q.rentCents*coupon.bps/10000),rent=q.rentCents-discount,base=rent+q.cleaningCents+q.extraGuestCents,taxes=q.taxes.map(t=>({...t,amountCents:Math.round(base*t.bps/10000)})),tax=taxes.reduce((n,t)=>n+t.amountCents,0),total=base+tax
 const terms=managementFor(data,home.propertyId,q.start),model=modelFor(terms);need(model.mapping.reviewedBy,'The host must review owner allocations before offering this coupon',409)
 const parts=revenueParts(terms,total,0,rent,q.cleaningCents+q.extraGuestCents,tax),cost=homeSettings(data,home.propertyId).dispatch?.rateCents??0,net=parts.reduce((n,p)=>n+p.payableCents+p.reserveCents,0)-cost-p.providerFeeReserveCents
 need(net>=p.minimumNetCents,'This coupon would fall below the home’s minimum owner contribution',409)
 if(q.pricing){const s=q.pricing;s.nights.forEach((n,i)=>{n.couponDiscountCents=nightDiscounts![i];n.amountCents-=nightDiscounts![i]});s.rentCents=rent;s.subtotalCents=base;s.commissionCents=Math.round(base*s.adjustment.commissionBps/10000);s.expectedPayoutCents=base-s.commissionCents}
 Object.assign(q,{baseRentCents:q.rentCents,rentCents:rent,discountCents:discount,taxes,totalCents:total,coupon:{code,discountCents:discount,policyRevision:p.revision}})
}
