import { need, text, integer, newId, type Booking } from '../model'
import { overlaps, addDays } from '../inventory'
import type { DirectHome, Quote } from './types'
import type { GuestOffer } from '../guests/types'
import { decimalUnits } from './presentation'
export function configure(p:Record<string,unknown>, propertyId:string):DirectHome {
 const n=(key:string,min=0,max=100_000_000)=>{const human=key.endsWith('Cents')?key.replace('Cents','Dollars'):key.endsWith('Bps')?key.replace('Bps','Percent'):null;return integer(human&&human in p?decimalUnits(p[human],human):Number(p[key]),human??key,min,max)}
 const slug=text(p.slug,'booking page address',80).toLowerCase();need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug!=='stay','Use a booking address with lowercase letters, numbers and hyphens')
 const home:DirectHome={propertyId,revision:newId(),enabled:p.enabled===true||p.enabled==='true'||p.enabled==='on',slug,description:text(p.description,'property description',3000),nightlyCents:n('nightlyCents',1),cleaningCents:n('cleaningCents'),extraGuestCents:n('extraGuestCents'),includedGuests:n('includedGuests',1,100),maxGuests:n('maxGuests',1,100),minNights:n('minNights',1,365),maxNights:n('maxNights',1,365),minGapNights:n('minGapNights',0,30),depositCents:n('depositCents'),releaseHours:n('releaseHours',0,168),taxLabel:String(p.taxLabel??'').trim().slice(0,120),taxBps:n('taxBps',0,10000),countyTaxLabel:String(p.countyTaxLabel??'').trim().slice(0,120),countyTaxBps:n('countyTaxBps',0,10000),agreement:text(p.agreement,'rental agreement',20_000),requireIdentity:p.requireIdentity===true||p.requireIdentity==='true'||p.requireIdentity==='on'}
 need(home.minNights<=home.maxNights,'Maximum nights must be at least minimum nights');need(home.includedGuests<=home.maxGuests,'Included guests cannot exceed occupancy');need(!home.taxBps||home.taxLabel,'Name the state tax jurisdiction');need(!home.countyTaxBps||home.countyTaxLabel,'Name the county tax jurisdiction');return home
}
export function day(value:unknown):string {
 const v=text(value,'date',10);need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Use a valid date as YYYY-MM-DD');return v
}
export function quote(home:DirectHome,bookings:Booking[],input:Record<string,unknown>,today=new Date().toISOString().slice(0,10),offer?:GuestOffer):Quote {
 const start=day(input.start),end=day(input.end),guests=integer(Number(input.guests),'Guest count',1,home.maxGuests),nights=(Date.parse(end)-Date.parse(start))/86_400_000
 need(start>=today,'Arrival cannot be in the past');need(start<=addDays(today,730),'Choose an arrival within two years');need(end>start,'Checkout must follow arrival');need(nights>=home.minNights,`This home requires at least ${home.minNights} nights`);need(nights<=home.maxNights,`This home allows at most ${home.maxNights} nights`)
 const held=bookings.filter(b=>b.propertyId===home.propertyId&&b.status==='confirmed');need(!held.some(b=>overlaps(b,{start,end})),'These nights are no longer available. Choose other dates.',409)
 if(home.minGapNights)for(const b of held){const before=(Date.parse(start)-Date.parse(b.end.slice(0,10)))/86_400_000,after=(Date.parse(b.start.slice(0,10))-Date.parse(end))/86_400_000;need(!(before>0&&before<home.minGapNights)&&!(after>0&&after<home.minGapNights),`These dates leave a gap shorter than ${home.minGapNights} nights. Choose dates next to an existing stay or leave a longer gap.`)}
 const baseRentCents=home.nightlyCents*nights,discountCents=offer?Math.floor((baseRentCents*1000+5000)/10000):0,rentCents=baseRentCents-discountCents,extraGuestCents=Math.max(0,guests-home.includedGuests)*home.extraGuestCents*nights,base=rentCents+extraGuestCents+home.cleaningCents
 const taxes:Quote['taxes']=[];for(const [label,bps,jurisdiction]of [[home.taxLabel,home.taxBps,'state'],[home.countyTaxLabel,home.countyTaxBps,'county']] as const)if(bps)taxes.push({label,bps,jurisdiction,amountCents:Math.floor((base*bps+5000)/10000)})
 const totalCents=base+taxes.reduce((s,t)=>s+t.amountCents,0);need(Number.isSafeInteger(totalCents)&&totalCents<=99_999_999,'This quote exceeds the payment limit')
 return {start,end,guests,nights,nightlyCents:home.nightlyCents,rentCents,...(offer?{baseRentCents,discountCents,returningGuest:{offerId:offer.id,guestId:offer.guestId,name:offer.guestName,discountBps:1000}}:{}),cleaningCents:home.cleaningCents,extraGuestCents,taxes,totalCents,depositCents:home.depositCents}
}
