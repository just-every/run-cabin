import { currentQuote, quoteByToken, validateQuote, acceptQuote, acceptedQuote } from '../reservations/quotes'
import { applyBookingCoupon } from '../promotions/booking-coupons'
import { managementFor } from '../properties/terms'
import { bookingAgreement } from './agreement-text'
import { recordCheckout,templateVersion } from '../agreements/records'
import type { Bindings } from '../../auth.server'
import { need,text,newId,sha,query } from '../model'
import { mutate } from '../storage'
import { managedInstall } from '../channels'
import { homes,stay,saveStay,DIRECT_SYSTEM } from './store'
import { quote } from './rules'
import { offeredRate,redeemOffer } from '../guests/offers'
import { createCheckout,stripeCredentials,MANAGED_STRIPE_LINE } from './stripe'
import { seal } from '../seal'
import { homeSettings } from '../homes'
import { instant,localDay } from '../clock'
import type { DirectStay } from './types'
import { policyFor,riskReasons } from '../verification/policy'
import { createVerification,saveVerification } from '../verification/records'
const currentStaff=(row:Parameters<typeof currentQuote>[0])=>currentQuote(row).price
export async function checkout(env:Bindings,slug:string,input:Record<string,unknown>) {
 if(input.staffQuoteToken){const accepted=await acceptedQuote(env,input.staffQuoteToken);if(accepted)return accepted}
 need(!managedInstall(env),MANAGED_STRIPE_LINE,409)
 const credentials=await stripeCredentials(env)
 const token=newId()+newId(),tokenHash=await sha(token),id=newId(),bookingId=newId()
 const row=await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout',async c=>{
  const home=(await homes(env.DB)).find(h=>h.enabled&&h.slug===slug);need(home,'Booking page not found',404);need(input.homeRevision===home.revision,'The home’s terms changed. Review a fresh quote before signing.',409)
  const staff=input.staffQuoteToken?await quoteByToken(c.data,input.staffQuoteToken):undefined
  if(staff){need(staff.propertyId===home.propertyId,'Quote home changed',409);await validateQuote(c,staff,input.staffQuoteRevision);need(String(input.guestName).trim()===staff.guestName&&String(input.email).trim().toLowerCase()===staff.email,'Use the quote recipient name and email',409);need(input.start===currentStaff(staff).start&&input.end===currentStaff(staff).end&&Number(input.guests)===currentStaff(staff).guests&&!input.offerToken&&!input.couponCode,'Review the quoted dates, guests and price',409);acceptQuote(c,staff,input.staffQuoteRevision,bookingId,id)}
  const offer=await offeredRate(c.data,home,input.offerToken,Date.parse(c.now))
  const price=quote(home,c.data.bookings,input,localDay(Date.now(),homeSettings(c,home.propertyId).timeZone),offer),guestName=text(input.guestName,'guest name',120),email=text(input.email,'email',254).toLowerCase(),signed=text(input.signature,'signature',120)
  await applyBookingCoupon(c.db,c.data,home,price,input)
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email');need(signed===guestName,'Sign using the guest’s full name');need(input.consent==='yes','Agree to the rental agreement and payment mandate')
  const owner=await c.db.prepare("SELECT id,email FROM oa_operators WHERE status='active' AND role='owner' LIMIT 1").first<{id:string;email:string}>();need(owner,'Installation owner unavailable',409)
  const identityPolicy=policyFor(home,owner,env.AUTH_ORIGIN),identityReasons=riskReasons(identityPolicy,{start:price.start,createdAt:c.now},price.totalCents,price.guests,Date.parse(c.now)),requiresIdentity=identityReasons.length>0
  need(!requiresIdentity||input.identityConsent==='yes','Consent to the identity requirement before continuing')
  if(offer)redeemOffer(c,offer,input,bookingId)
  const managementTerms=managementFor(c.data,home.propertyId,price.start);need(!input.managementVersion||input.managementVersion===managementTerms.id,'The management agreement changed. Review a fresh quote.',409);price.managementVersion=managementTerms.id
  const profile=c.data.propertyProfiles.find(p=>p.propertyId===home.propertyId);need(!profile||price.guests<=profile.occupancyLimit,'Guest count exceeds the property occupancy limit')
  const settings=homeSettings(c,home.propertyId),arrivalAt=new Date(instant(price.start+'T'+settings.checkInTime,settings.timeZone)).toISOString(),departureAt=new Date(instant(price.end+'T'+settings.checkOutTime,settings.timeZone)).toISOString()
  const rentalTemplate=c.data.rentalTemplates.find(t=>t.propertyId===home.propertyId),version=rentalTemplate?templateVersion(rentalTemplate):undefined
  const agreement=bookingAgreement(home,price,version)
  const row:DirectStay={id,propertyId:home.propertyId,bookingId,revision:newId(),homeRevision:home.revision,phase:'held',start:price.start,end:price.end,guestName,email,quote:price,createdAt:c.now,holdUntil:new Date(Date.parse(c.now)+31*60_000).toISOString(),signature:{name:signed,at:c.now,version:version?.id??home.revision,text:agreement,sha256:await sha(agreement),consent:'Guest accepted the exact rental agreement, payment and separate damage authorization; '+(requiresIdentity?'consented to identity verification with a manual-review alternative.':'identity not required.')},requireIdentity:home.requireIdentity,releaseHours:home.releaseHours,paymentMode:credentials.mode,bookingLinkSealed:await seal(env.SESSION_SECRET,'direct-booking-link',token),timeZone:settings.timeZone,arrivalAt,departureAt,depositDueAt:new Date(Date.parse(arrivalAt)-48*3_600_000).toISOString()}
  c.data.bookings.push({id:bookingId,revision:newId(),uid:`cabin-direct-${id}`,propertyId:home.propertyId,channel:'direct',managementTerms:structuredClone(managementTerms),kind:'block',start:price.start,end:price.end,summary:'Direct checkout hold',status:'confirmed',cancelled:false,approvedAt:c.now,source:'request'})
  row.requireIdentity=requiresIdentity
  const verification=createVerification(c,bookingId,home.propertyId,identityPolicy,identityReasons,price.end);if(requiresIdentity){verification.consentAt=c.now;verification.consentMethod='stripe';saveVerification(c,verification)}
  await recordCheckout(c,row)
  c.queries.push(query('INSERT INTO cb_direct_stays(id,property_id,token_hash,data) VALUES(?,?,?,?)',id,home.propertyId,tokenHash,JSON.stringify(row)));c.entityId=id;return row
 })
 return {token,id,url:await startPayment(env,row,token),bookingUrl:env.AUTH_ORIGIN+'/book/stay/'+token}
}
/** Creates the Stripe Checkout for a held stay; a failure is stored for the host and the guest returns to their stay page. */
async function startPayment(env:Bindings,row:DirectStay,token:string,attempt?:string){
 try{
  const q=row.quote,lines=[{name:`${q.nights} nights${q.returningGuest?' · returning guest 10% rate':q.coupon?' · coupon '+q.coupon.code:''}`,amountCents:q.rentCents},...(q.cleaningCents?[{name:'Cleaning fee',amountCents:q.cleaningCents}]:[]),...(q.extraGuestCents?[{name:'Extra guest fee',amountCents:q.extraGuestCents}]:[]),...q.taxes.map(t=>({name:`${t.label} (${t.bps/100}%)`,amountCents:t.amountCents}))]
  const session=await createCheckout({...env,DIRECT_STRIPE_MODE:row.paymentMode},{id:row.id,attempt,token,origin:env.AUTH_ORIGIN,email:row.email,amountCents:q.totalCents,description:'Cabin direct stay',lines})
  await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout.ready',async c=>{const current=await stay(env.DB,row.id);current.checkoutId=session.id;current.checkoutUrl=session.url;delete current.error;saveStay(c,current)})
  return session.url as string
 }catch(error){await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout.error',async c=>{const current=await stay(env.DB,row.id);current.error=(error as Error).message;saveStay(c,current)});throw Object.assign(error as Error,{stayToken:token})}
}
/** The guest's Try payment again after Stripe refused the checkout: a fresh attempt, with the dates held for another checkout window. */
export async function retryCheckout(env:Bindings,id:string,token:string){
 const row=await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout.retry',async c=>{
  const current=await stay(env.DB,id);need(current.phase==='held'&&!current.paymentId,'This stay is no longer waiting for payment',409)
  need(Date.now()<Date.parse(current.holdUntil),'The hold on your dates has ended. Choose your dates again.',409)
  if(!current.error&&current.checkoutUrl)return current
  current.holdUntil=new Date(Date.parse(c.now)+31*60_000).toISOString();saveStay(c,current);return current
 })
 return row.checkoutUrl&&!row.error?row.checkoutUrl:startPayment(env,row,token,newId())
}
