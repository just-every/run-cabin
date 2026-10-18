import { promotionInput } from './input'
import type { Bindings } from '../../auth.server'
import { type Actor,type Context,manager,owner,need,text,integer,newId,sha,exact } from '../model'
import { mutate,assertLive } from '../storage'
import { seal,unseal } from '../seal'
import { day } from '../direct/rules'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { allocationTerms } from '../properties/terms'
import { offers,offer,policy,promotionRows,savePromotion,publicOffer } from './store'
import { guestEligibility,couponPrice,allocation,eligible } from './eligibility'
import { holdNights,releaseHold,refundDue } from './inventory'
import { reconcilePromotion,refundPromotion } from './payments'
import { restoreOriginal,contractRefundBridge } from './settlement'
import type { PromotionPolicy,PromotionOffer,PromotionBooking } from './types'

const money=(v:unknown,label:string)=>integer(Number(v??0),label,0,100_000_000)
const time=(v:unknown)=>{const t=text(v,'access time',5);need(/^([01]\d|2[0-3]):[0-5]\d$/.test(t),'Use an HH:MM access time');return t}
async function configure(c:Context,p:Record<string,unknown>){
 owner(c.actor);const propertyId=text(p.propertyId,'home');need(c.data.properties.some(home=>home.id===propertyId),'Home not found',404)
 const old=(await promotionRows<PromotionPolicy>(c.db,'promotionPolicies')).find(p=>p.propertyId===propertyId);if(old)exact(old,p.revision)
 need(p.confirm==='yes','Approve the promotions, inventory, tax and cancellation policy')
 let coupons=p.coupons??[];if(typeof coupons==='string'){try{coupons=JSON.parse(coupons)}catch{need(false,'Enter coupons as a JSON array')}}
 need(Array.isArray(coupons)&&coupons.length<=50,'Provide up to 50 scoped coupons')
 const row:PromotionPolicy={id:old?.id??newId(),revision:newId(),propertyId,enabled:p.enabled===true||p.enabled==='yes',minimumNetCents:money(p.minimumNetCents,'minimum net'),providerFeeReserveCents:money(p.providerFeeReserveCents,'provider fee budget'),stock:integer(Number(p.stock??1),'extra stock',0,1000),refundRetainedBps:integer(Number(p.refundRetainedBps??0),'retained basis points',0,10000),refundDeadlineHours:integer(Number(p.refundDeadlineHours??24),'refund deadline hours',0,2160),taxBps:integer(Number(p.taxBps??0),'supplement tax basis points',0,10000),approvedBy:c.actor.id,approvedAt:c.now,
  coupons:coupons.map((coupon:any)=>{const code=text(coupon.code,'coupon code',40).toUpperCase();need(/^[A-Z0-9-]+$/.test(code),'Use letters, digits and hyphens for coupons');need(Array.isArray(coupon.channels)&&coupon.channels.length&&coupon.channels.every((ch:unknown)=>['direct','airbnb','vrbo','booking.com','ical'].includes(String(ch))),'Scope the coupon to booking channels');return {code,bps:integer(Number(coupon.bps),'coupon discount basis points',1,9999),from:day(coupon.from),until:day(coupon.until),minNights:integer(Number(coupon.minNights??1),'coupon minimum nights',1,365),repeatOnly:coupon.repeatOnly===true,channels:coupon.channels}})}
 need(new Set(row.coupons.map(c=>c.code)).size===row.coupons.length&&row.coupons.every(c=>c.from<c.until),'Coupon codes must be unique with an ordered date range')
 savePromotion(c,'promotionPolicies',row);return row
}
async function create(c:Context,p:Record<string,unknown>,env:Bindings){
 const b=c.data.bookings.find(b=>b.id===p.bookingId) as PromotionBooking|undefined;need(b,'Original stay not found',404);exact(b,p.bookingRevision)
 need(b.lifecycle?.price,'Review and price the original reservation before issuing a supplement',409)
 const policyRow=await policy(c,b.propertyId),guest=guestEligibility(c,b),kind=text(p.kind,'offer type') as PromotionOffer['kind'];need(['gap','early','late','extra'].includes(kind),'Choose gap, early, late or extra')
 const s=homeSettings(c,b.propertyId),original={start:b.start,end:b.end,arrivalTime:b.arrivalTime,departureTime:b.departureTime},target={...original}
 if(kind==='gap'){target.end=day(p.end);need(target.end>b.end&&(Date.parse(target.end)-Date.parse(b.end))/86400000<=14,'Extend the existing checkout by 1 to 14 nights')}
 if(kind==='early'){target.arrivalTime=time(p.time);need(target.arrivalTime<(b.arrivalTime??s.checkInTime),'Early arrival must precede the current arrival')}
 if(kind==='late'){target.departureTime=time(p.time);need(target.departureTime>(b.departureTime??s.checkOutTime),'Late checkout must follow the current checkout')}
 const serviceAt=instant(`${kind==='early'?b.start:b.end}T${kind==='early'?target.arrivalTime:b.departureTime??s.checkOutTime}`,s.timeZone)
 need(serviceAt>Date.parse(c.now),'The offered service must be in the future',409)
 const expiresAt=new Date(String(p.expiresAt)).toISOString();need(Date.parse(expiresAt)>Date.parse(c.now)+31*60000&&Date.parse(expiresAt)<=Math.min(serviceAt,Date.parse(c.now)+14*86400000),'Expire the offer before service starts, within 14 days and at least 31 minutes from now')
 const baseCents=money(p.baseCents,'supplement price'),costCents=money(p.costCents,'incremental service cost'),coupon=p.coupon?text(p.coupon,'coupon',40).toUpperCase():undefined,discountCents=couponPrice(c,policyRow,b,coupon,baseCents),taxCents=Math.round((baseCents-discountCents)*policyRow.taxBps/10000),amountCents=baseCents-discountCents+taxCents
 need(amountCents>=50,'The paid supplement must total at least USD 0.50')
 const split=allocation(c,b,baseCents-discountCents,taxCents,costCents,policyRow),token=newId()+newId(),title=text(p.title,'offer title',160)
 const quantity=integer(Number(p.quantity??1),'extra quantity',1,1000)
 const terms=`${title}. ${kind==='gap'?`Stay extended to ${target.end}`:kind==='early'?`Check in ${target.start} at ${target.arrivalTime}`:kind==='late'?`Check out ${target.end} at ${target.departureTime}`:`Extra for your existing stay; quantity ${quantity}`}. USD ${(amountCents/100).toFixed(2)} including USD ${(taxCents/100).toFixed(2)} tax${discountCents?` and USD ${(discountCents/100).toFixed(2)} coupon discount`:''}. Cancel before ${new Date(serviceAt-policyRow.refundDeadlineHours*3600000).toISOString()} for a full refund; after that ${policyRow.refundRetainedBps/100}% is retained. ${text(p.description,'service terms',2000)}`
 const o:PromotionOffer={id:newId(),revision:newId(),propertyId:b.propertyId,bookingId:b.id,bookingRevision:b.revision,policyRevision:policyRow.revision,kind,title,status:'draft',createdAt:c.now,createdBy:c.actor.id,expiresAt,tokenHash:await sha(token),tokenSealed:await seal(env.SESSION_SECRET,'promotion-offer',token),...guest,managementRevision:JSON.stringify(allocationTerms(c.data,b)),original,target,baseCents,discountCents,taxCents,amountCents,costCents,parts:split.parts,netCents:split.netCents,terms,coupon,quantity,refundRetainedBps:policyRow.refundRetainedBps,refundDeadlineAt:new Date(serviceAt-policyRow.refundDeadlineHours*3600000).toISOString()}
 await eligible(c,o);(await offers(c)).push(o);savePromotion(c,'promotionOffers',o);return {...publicOffer(o),url:env.AUTH_ORIGIN+'/offers/'+token}
}
export async function promotionCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 if(!name.startsWith('promotion.'))return undefined
 p=promotionInput(p)
 manager(actor);need(!actor.isAgent,'A human manager must approve promotions',403)
 await assertLive(env.DB,actor)
 if(name==='promotion.reconcile'){await reconcilePromotion(env,text(p.id,'offer'));return {message:'Provider outcome reconciled. Review the saved offer.'}}
 if(name==='promotion.refund')return refundPromotion(env,actor,p)
 return mutate(env.DB,actor,name,async c=>{
  if(name==='promotion.configure')return configure(c,p)
  if(name==='promotion.create')return create(c,p,env)
  const o=await offer(c,p.id);exact(o,p.revision)
  if(name==='promotion.send'){
   need(o.status==='draft'&&p.confirm==='yes','Review and approve this exact offer before sending',409);await eligible(c,o);holdNights(c,o)
   const token=await unseal(env.SESSION_SECRET,'promotion-offer',o.tokenSealed);need(token,'The private link cannot be opened; revoke and prepare a new offer',409)
   const id=newId();c.data.messages.push({promotionOfferId:o.id,id,revision:newId(),propertyId:o.propertyId,bookingId:o.bookingId,email:o.email,phone:null,ref:null,channel:'email',direction:'out',source:'host',status:'pending',subject:o.title,text:o.terms+'\n\nReview and accept your private offer: '+env.AUTH_ORIGIN+'/offers/'+token,detail:null,replyTo:null,headerId:null,sentBy:actor.id,approvalId:null,scheduledId:null,providerId:null,grounds:['Exact promotion approval '+o.id],createdAt:c.now,sentAt:null})
   o.status='sent';o.sentAt=c.now;o.messageId=id;savePromotion(c,'promotionOffers',o);return publicOffer(o)
  }
  need(name==='promotion.cancel','Unknown promotion command',404);need(p.confirm==='yes','Confirm cancellation and the saved refund policy')
  if(o.status==='applied'){
   await restoreOriginal(c,o);refundDue(c,o,text(p.reason,'cancellation reason',1000))
   await contractRefundBridge(c,o)
   const b=c.data.bookings.find(b=>b.id===o.bookingId)!,price=b.lifecycle!.price!,retained=o.refund!.retainedCents,tax=Math.round(o.taxCents*retained/o.amountCents)
   price.feesCents+=retained-tax;price.taxCents+=tax;price.totalCents+=retained
  }
  else if(o.status==='checkout'){o.cancelReason=text(p.reason,'cancellation reason',1000)}
  else {need(['draft','sent'].includes(o.status),'This offer has already ended',409);o.status='cancelled';releaseHold(c,o);const message=c.data.messages.find(m=>m.id===o.messageId);if(message&&['pending','draft'].includes(message.status)){message.status='discarded';message.revision=newId()}}
  savePromotion(c,'promotionOffers',o);return publicOffer(o)
 })
}
