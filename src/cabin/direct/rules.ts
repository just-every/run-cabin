import { calculatePricing } from '../pricing/calculate'
import type { PricingChannel } from '../pricing/types'
import { capacityBookings, type Capacity } from '../capacity'
import { policy as cancellationPolicy } from '../reservations/finance'
import { need, text, integer, newId, type Booking } from '../model'
import { overlaps, addDays } from '../inventory'
import type { DirectHome, Quote } from './types'
import type { GuestOffer } from '../guests/types'
import { decimalUnits } from './presentation'
export function configure(p:Record<string,unknown>, propertyId:string):DirectHome {
 const n=(key:string,min=0,max=100_000_000)=>{const human=key.endsWith('Cents')?key.replace('Cents','Dollars'):key.endsWith('Bps')?key.replace('Bps','Percent'):null;return integer(human&&human in p?decimalUnits(p[human],human):Number(p[key]),human??key,min,max)}
 const slug=text(p.slug,'booking page address',80).toLowerCase();need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug!=='stay','Use a booking address with lowercase letters, numbers and hyphens')
 const home:DirectHome={advanceNoticeDays:integer(Number(p.advanceNoticeDays??0),'Advance notice',0,730),bookingWindowDays:integer(Number(p.bookingWindowDays??730),'Booking window',1,730),preparationNights:integer(Number(p.preparationNights??0),'Preparation nights',0,30),cancellationPolicy:cancellationPolicy({...p,policyName:p.policyName??'No cancellation or no-show charge. Refunds are reviewed by the host.'}),propertyId,revision:newId(),enabled:p.enabled===true||p.enabled==='true'||p.enabled==='on',slug,description:text(p.description,'property description',3000),nightlyCents:n('nightlyCents',1),cleaningCents:n('cleaningCents'),extraGuestCents:n('extraGuestCents'),includedGuests:n('includedGuests',1,100),maxGuests:n('maxGuests',1,100),minNights:n('minNights',1,365),maxNights:n('maxNights',1,365),minGapNights:n('minGapNights',0,30),depositCents:n('depositCents'),releaseHours:n('releaseHours',0,168),taxLabel:String(p.taxLabel??'').trim().slice(0,120),taxBps:n('taxBps',0,10000),countyTaxLabel:String(p.countyTaxLabel??'').trim().slice(0,120),countyTaxBps:n('countyTaxBps',0,10000),agreement:text(p.agreement,'rental agreement',20_000),requireIdentity:p.requireIdentity===true||p.requireIdentity==='true'||p.requireIdentity==='on'}
 need(home.advanceNoticeDays!<=home.bookingWindowDays!,'Advance notice cannot exceed the booking window');need(home.minNights<=home.maxNights,'Maximum nights must be at least minimum nights');need(home.includedGuests<=home.maxGuests,'Included guests cannot exceed occupancy');need(!home.taxBps||home.taxLabel,'Name the state tax jurisdiction');need(!home.countyTaxBps||home.countyTaxLabel,'Name the county tax jurisdiction');return home
}
export function day(value:unknown):string {
 const v=text(value,'date',10);need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Use a valid date as YYYY-MM-DD');return v
}
export function quote(home:DirectHome,bookings:Booking[],input:Record<string,unknown>,today:string,offer?:GuestOffer,capacity:Capacity={},channel:PricingChannel='direct'):Quote {
 need(home.cancellationPolicy,'The host must review and save the cancellation policy before accepting new reservations.',409)
 const start=day(input.start),end=day(input.end),guests=integer(Number(input.guests),'Guest count',1,home.maxGuests),nights=(Date.parse(end)-Date.parse(start))/86_400_000
 need(start>=today,'Arrival cannot be in the past');need(start>=addDays(today,home.advanceNoticeDays??0),`This home requires ${home.advanceNoticeDays??0} days of advance notice`);need(start<=addDays(today,home.bookingWindowDays??730),`Choose an arrival within ${home.bookingWindowDays??730} days`);need(end>start,'Checkout must follow arrival');need(nights>=home.minNights,`This home requires at least ${home.minNights} nights`);need(nights<=home.maxNights,`This home allows at most ${home.maxNights} nights`)
 const held=capacityBookings({...capacity,bookings},home.propertyId);need(!held.some(b=>overlaps(b,{start,end})),'These nights are no longer available. Choose other dates.',409)
 if(home.preparationNights)need(!held.some(b=>overlaps({start:addDays(b.start.slice(0,10),-home.preparationNights!),end:addDays(b.end.slice(0,10),home.preparationNights!)},{start,end})),`Leave ${home.preparationNights} preparation nights before and after an existing stay.`,409)
 if(home.minGapNights)for(const b of held){const before=(Date.parse(start)-Date.parse(b.end.slice(0,10)))/86_400_000,after=(Date.parse(b.start.slice(0,10))-Date.parse(end))/86_400_000;need(!(before>0&&before<home.minGapNights)&&!(after>0&&after<home.minGapNights),`These dates leave a gap shorter than ${home.minGapNights} nights. Choose dates next to an existing stay or leave a longer gap.`)}
 const nightlyRates=Array.from({length:nights},(_,i)=>{const date=addDays(start,i),weekday=new Date(date+'T00:00:00Z').getUTCDay(),rate=home.rates?.find(r=>r.start<=date&&date<r.end&&(r.weekday===null||r.weekday===weekday));return {date,amountCents:rate?.nightlyCents??home.nightlyCents}})
 const rawExtraGuestCents=Math.max(0,guests-home.includedGuests)*home.extraGuestCents*nights
 const pricing=home.pricing?calculatePricing(home,nightlyRates,rawExtraGuestCents,channel,offer?1000:0):undefined
 const baseRentCents=pricing?.rentBeforeReturningCents??nightlyRates.reduce((sum,r)=>sum+r.amountCents,0),discountCents=pricing?.returningDiscountCents??(offer?Math.floor((baseRentCents*1000+5000)/10000):0),rentCents=pricing?.rentCents??baseRentCents-discountCents,extraGuestCents=pricing?.extraGuestCents??rawExtraGuestCents,cleaningCents=pricing?.cleaningCents??home.cleaningCents,base=rentCents+extraGuestCents+cleaningCents
 const taxes:Quote['taxes']=[];for(const [label,bps,jurisdiction]of [[home.taxLabel,home.taxBps,'state'],[home.countyTaxLabel,home.countyTaxBps,'county']] as const)if(bps)taxes.push({label,bps,jurisdiction,amountCents:Math.floor((base*bps+5000)/10000)})
 const totalCents=base+taxes.reduce((s,t)=>s+t.amountCents,0);need(Number.isSafeInteger(totalCents)&&totalCents<=99_999_999,'This quote exceeds the payment limit')
 const inventoryRevision=capacity.propertyProfiles?.find(p=>p.propertyId===home.propertyId)?.revision
 return {...(pricing?{pricing}:{}),...(home.rates?.length?{nightlyRates}:{}),...(inventoryRevision?{inventoryRevision}:{}),cancellationPolicy:structuredClone(home.cancellationPolicy),start,end,guests,nights,nightlyCents:home.nightlyCents,rentCents,...(offer?{baseRentCents,discountCents,returningGuest:{offerId:offer.id,guestId:offer.guestId,name:offer.guestName,discountBps:1000}}:{}),cleaningCents,extraGuestCents,taxes,totalCents,depositCents:home.depositCents}
}
