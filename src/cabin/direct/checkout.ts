import type { Bindings } from '../../auth.server'
import { need,text,newId,sha,query } from '../model'
import { mutate } from '../storage'
import { managedInstall } from '../channels'
import { homes,stay,saveStay,DIRECT_SYSTEM } from './store'
import { quote } from './rules'
import { createCheckout,stripeCredentials,MANAGED_STRIPE_LINE } from './stripe'
import { seal } from '../seal'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { dateLabel } from './presentation'
import type { DirectStay } from './types'
export async function checkout(env:Bindings,slug:string,input:Record<string,unknown>) {
 need(!managedInstall(env),MANAGED_STRIPE_LINE,409)
 const credentials=await stripeCredentials(env)
 const token=newId()+newId(),tokenHash=await sha(token),id=newId(),bookingId=newId()
 const row=await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout',async c=>{
  const home=(await homes(env.DB)).find(h=>h.enabled&&h.slug===slug);need(home,'Booking page not found',404);need(input.homeRevision===home.revision,'The home’s terms changed. Review a fresh quote before signing.',409)
  const price=quote(home,c.data.bookings,input),guestName=text(input.guestName,'guest name',120),email=text(input.email,'email',254).toLowerCase(),signed=text(input.signature,'signature',120)
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email');need(signed===guestName,'Sign using the guest’s full name');need(input.consent==='yes','Agree to the rental agreement and payment mandate');need(!home.requireIdentity||input.identityConsent==='yes','Consent to the ID check before continuing')
  const settings=homeSettings(c,home.propertyId),arrivalAt=new Date(instant(price.start+'T'+settings.checkInTime,settings.timeZone)).toISOString(),departureAt=new Date(instant(price.end+'T'+settings.checkOutTime,settings.timeZone)).toISOString()
  const agreement=`${home.agreement}\n\nStay: ${dateLabel(price.start)} to ${dateLabel(price.end)}; ${price.guests} guests.\nRent, fees and taxes: USD ${(price.totalCents/100).toFixed(2)}. Damage authorization: USD ${(price.depositCents/100).toFixed(2)}.\nThe separate damage hold is requested within 48 hours of arrival, not when an advance booking is paid. Card authorizations expire; another authorization may be required during a longer stay. An expired hold provides no damage protection.`
  const row:DirectStay={id,propertyId:home.propertyId,bookingId,revision:newId(),homeRevision:home.revision,phase:'held',start:price.start,end:price.end,guestName,email,quote:price,createdAt:c.now,holdUntil:new Date(Date.parse(c.now)+31*60_000).toISOString(),signature:{name:signed,at:c.now,version:home.revision,text:agreement,sha256:await sha(agreement),consent:'Guest accepted the exact rental agreement, payment and separate damage authorization; '+(home.requireIdentity?'consented to Stripe Identity.':'identity not required.')},requireIdentity:home.requireIdentity,releaseHours:home.releaseHours,paymentMode:credentials.mode,bookingLinkSealed:await seal(env.SESSION_SECRET,'direct-booking-link',token),timeZone:settings.timeZone,arrivalAt,departureAt,depositDueAt:new Date(Date.parse(arrivalAt)-48*3_600_000).toISOString()}
  c.data.bookings.push({id:bookingId,revision:newId(),uid:`cabin-direct-${id}`,propertyId:home.propertyId,channel:'direct',kind:'block',start:price.start,end:price.end,summary:'Direct checkout hold',status:'confirmed',cancelled:false,approvedAt:c.now,source:'request'})
  c.queries.push(query('INSERT INTO cb_direct_stays(id,property_id,token_hash,data) VALUES(?,?,?,?)',id,home.propertyId,tokenHash,JSON.stringify(row)));c.entityId=id;return row
 })
 try{
  const q=row.quote,lines=[{name:`${q.nights} nights`,amountCents:q.rentCents},...(q.cleaningCents?[{name:'Cleaning fee',amountCents:q.cleaningCents}]:[]),...(q.extraGuestCents?[{name:'Extra guest fee',amountCents:q.extraGuestCents}]:[]),...q.taxes.map(t=>({name:`${t.label} (${t.bps/100}%)`,amountCents:t.amountCents}))]
  const session=await createCheckout({...env,DIRECT_STRIPE_MODE:credentials.mode},{id,token,origin:env.AUTH_ORIGIN,email:row.email,amountCents:q.totalCents,description:'Cabin direct stay',lines})
  await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout.ready',async c=>{const current=await stay(env.DB,id);current.checkoutId=session.id;current.checkoutUrl=session.url;saveStay(c,current)})
  return {token,url:session.url,id,bookingUrl:env.AUTH_ORIGIN+'/book/stay/'+token}
 }catch(error){await mutate(env.DB,DIRECT_SYSTEM,'direct.checkout.error',async c=>{const current=await stay(env.DB,id);current.error=(error as Error).message;saveStay(c,current)});throw Object.assign(error as Error,{stayToken:token})}
}
