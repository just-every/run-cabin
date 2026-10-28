import { integer,need } from '../model'
import { decimalUnits } from '../direct/presentation'
import type { DirectHome } from '../direct/types'
import { pricingChannels,type PricingChannel,type PricingPolicy,type PriceSnapshot,type ChannelAdjustment } from './types'
export const unchangedAdjustment = ():ChannelAdjustment=>({kind:'percent',value:0,includeCleaning:false,includeExtraGuests:false,commissionBps:0})
const rounded=(amount:number,bps:number)=>Math.floor((amount*bps+5000)/10000)
export function pricingChannel(value:unknown):PricingChannel {
 need(pricingChannels.includes(value as PricingChannel),'Choose a supported pricing channel');return value as PricingChannel
}
export function configurePricing(p:Record<string,unknown>,old:PricingPolicy|undefined,revision:string,at:string):PricingPolicy {
 const units=(key:string,max:number)=>integer(decimalUnits(p[key],key),key,0,max)
 if(!p.channel)return {revision,savedAt:at,floorCents:units('floorDollars',100_000_000),weeklyBps:units('weeklyPercent',10000),monthlyBps:units('monthlyPercent',10000),channels:{...old?.channels}}
 need(old,'Save the listing floor and discounts before channel adjustments',409)
 const channel=pricingChannel(p.channel),kind=p.adjustmentKind;need(kind==='percent'||kind==='fixed','Choose a percentage or fixed nightly adjustment')
 need(p.adjustmentDirection==='markup'||p.adjustmentDirection==='markdown','Choose markup or markdown')
 const value=units('adjustmentValue',kind==='percent'?100_000:100_000_000)*(p.adjustmentDirection==='markdown'?-1:1)
 need(kind!=='percent'||value>=-10000,'A percentage markdown cannot exceed 100%')
 const yes=(key:string)=>p[key]===true||p[key]==='true'||p[key]==='on'
 const includeCleaning=yes('includeCleaning'),includeExtraGuests=yes('includeExtraGuests')
 need(kind!=='fixed'||!includeCleaning&&!includeExtraGuests,'Fixed nightly adjustments exclude fees. Use a percentage adjustment to adjust cleaning or extra-guest fees.')
 const commissionBps=units('channelCommissionPercent',10000)
 need(channel!=='direct'||commissionBps===0,'Direct bookings have no channel commission. Processor fees are reconciled separately.')
 return {revision,savedAt:at,floorCents:old.floorCents,weeklyBps:old.weeklyBps,monthlyBps:old.monthlyBps,channels:{...old.channels,[channel]:{kind,value,includeCleaning,includeExtraGuests,commissionBps}}}
}
/** Integer cents, per-night rounding, then floors. Monthly replaces weekly; returning savings follow it. */
export function calculatePricing(home:DirectHome,rates:{date:string;amountCents:number}[],extraGuestCents:number,channel:PricingChannel='direct',returningBps=0):PriceSnapshot {
 const p=home.pricing!,a=p.channels[channel]??unchangedAdjustment(),count=rates.length
 const discountKind=count>=28?'monthly':count>=7?'weekly':null,discountBps=discountKind==='monthly'?p.monthlyBps:discountKind==='weekly'?p.weeklyBps:0
 const nights=rates.map(r=>{
  const adjusted=a.kind==='percent'?rounded(r.amountCents,10000+a.value):r.amountCents+a.value
  const afterLength=adjusted-rounded(Math.max(0,adjusted),discountBps),beforeReturning=Math.max(p.floorCents,afterLength)
  const requestedCents=afterLength-rounded(Math.max(0,afterLength),returningBps),amountCents=Math.max(p.floorCents,requestedCents)
  const weekday=new Date(r.date+'T00:00:00Z').getUTCDay(),rule=home.rates?.find(v=>v.start<=r.date&&r.date<v.end&&(v.weekday===null||v.weekday===weekday))
  return {date:r.date,rateId:rule?.id??null,baseCents:r.amountCents,adjustmentCents:adjusted-r.amountCents,lengthDiscountCents:Math.max(0,adjusted-beforeReturning),returningDiscountCents:beforeReturning-amountCents,requestedCents,amountCents,floorCents:p.floorCents,floorApplied:requestedCents<p.floorCents}
 })
 const cleaningCents=a.kind==='percent'&&a.includeCleaning?rounded(home.cleaningCents,10000+a.value):home.cleaningCents
 const adjustedExtra=a.kind==='percent'&&a.includeExtraGuests?rounded(extraGuestCents,10000+a.value):extraGuestCents
 const rentCents=nights.reduce((n,r)=>n+r.amountCents,0),subtotalCents=rentCents+cleaningCents+adjustedExtra,commissionCents=rounded(subtotalCents,a.commissionBps)
 need(Number.isSafeInteger(subtotalCents)&&subtotalCents<=99_999_999,'This quote exceeds the payment limit')
 return {source:'native-saved-rates',homeRevision:home.revision,policyRevision:p.revision,savedAt:p.savedAt,channel,adjustment:structuredClone(a),weeklyBps:p.weeklyBps,monthlyBps:p.monthlyBps,discountKind,discountBps,nights,baseCleaningCents:home.cleaningCents,baseExtraGuestCents:extraGuestCents,cleaningCents,extraGuestCents:adjustedExtra,lengthDiscountCents:nights.reduce((n,r)=>n+r.lengthDiscountCents,0),returningDiscountCents:nights.reduce((n,r)=>n+r.returningDiscountCents,0),rentBeforeReturningCents:rentCents+nights.reduce((n,r)=>n+r.returningDiscountCents,0),rentCents,subtotalCents,commissionCents,expectedPayoutCents:subtotalCents-commissionCents}
}
