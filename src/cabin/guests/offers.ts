import { need, text, newId, sha, type Context, type Data } from '../model'
import { homes } from '../direct/store'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import type { DirectHome } from '../direct/types'
import type { GuestData, GuestOffer } from './types'
import { consent, consentBaseline, guestRoot, guestGroup, guestBookings } from './resolve'
const dataOf=(data:Data)=>data as Data&GuestData
export function completedStay(data:Data,bookingId:string,now=Date.now()) {
 const b=data.bookings.find(b=>b.id===bookingId)
 if(!b||b.status!=='confirmed'||(b.kind??'stay')!=='stay'||b.guestErasedAt)return undefined
 const settings=homeSettings(data,b.propertyId)
 return instant(`${b.end.slice(0,10)}T${settings.checkOutTime}`,settings.timeZone)<=now?b:undefined
}
function eligible(data:Data&GuestData,offer:GuestOffer,home:DirectHome,now:number) {
 const root=guestRoot(data,offer.guestId),prior=completedStay(data,offer.priorBookingId,now)
 need(root&&root.id===offer.guestId&&prior&&prior.revision===offer.priorBookingRevision&&prior.propertyId===home.propertyId,'This returning-guest offer needs the host to review the previous stay.',409)
 need(prior.guestEmail?.toLowerCase()===offer.email&&prior.guestName===offer.guestName,'The prior guest contact changed. Ask the host to review this offer.',409)
 need(home.revision===offer.homeRevision,'The home’s terms changed. Ask the host for a new returning-guest offer.',409)
 need(JSON.stringify(guestGroup(data,root.id).map(g=>g.id).sort())===JSON.stringify(offer.profileIds),'The guest record changed. Ask the host for a new returning-guest offer.',409)
 need(guestBookings(data,root.id).some(b=>b.id===prior.id),'The prior stay no longer belongs to this guest.',409)
 need(data.guestPolicies.some(p=>p.propertyId===home.propertyId&&p.allowRepeatOffers)&&consent(data,root.id,home.propertyId,'offers')&&consentBaseline(data,root.id,home.propertyId)===offer.consentBaseline,'Returning-guest offers are no longer permitted for this guest and home.',409)
 need(guestGroup(data,root.id).some(g=>g.identities.some(i=>i.kind==='email'&&i.value===offer.email&&i.verified)),'The guest contact needs the host to review it.',409)
 return offer
}
export async function issueOffer(c:Context,input:Record<string,unknown>,origin:string) {
 const data=dataOf(c.data),guestId=text(input.id,'guest ID'),root=guestRoot(data,guestId);need(root,'Guest not found',404)
 const propertyId=text(input.propertyId,'property ID'),home=(await homes(c.db)).find(h=>h.propertyId===propertyId&&h.enabled);need(home,'Publish this home’s direct booking page first',409)
 const prior=completedStay(c.data,text(input.bookingId,'completed reservation ID'),Date.parse(c.now));need(prior&&prior.propertyId===propertyId&&guestBookings(data,root.id).some(b=>b.id===prior.id),'Choose this guest’s completed stay at this home',409)
 need(prior.guestEmail&&prior.guestName,'The completed reservation needs the guest’s name and email',409)
 const email=prior.guestEmail.toLowerCase(),verified=guestGroup(data,root.id).some(g=>g.identities.some(i=>i.kind==='email'&&i.value===email&&i.verified))
 need(verified,'Verify this guest’s email with its source before issuing an offer',409)
 need(input.confirm==='yes','Confirm that you reviewed the completed stay, verified contact and guest consent')
 const expiry=text(input.expiresAt,'expiry date'),expiryTime=Date.parse(expiry.length===10?expiry+'T23:59:59Z':expiry);need(Number.isFinite(expiryTime),'Enter a valid offer expiry date')
 const expiresAt=new Date(expiryTime).toISOString(),now=Date.parse(c.now)
 need(Date.parse(expiresAt)>now&&Date.parse(expiresAt)<=now+90*86400000,'Offer expiry must be within the next 90 days')
 const token=newId()+newId(),offer:GuestOffer={id:newId(),revision:newId(),guestId:root.id,propertyId,priorBookingId:prior.id,priorBookingRevision:prior.revision,profileIds:guestGroup(data,root.id).map(g=>g.id).sort(),email,guestName:prior.guestName,tokenHash:await sha(token),expiresAt,createdAt:c.now,createdBy:c.actor.id,status:'issued',consentBaseline:consentBaseline(data,root.id,propertyId),homeRevision:home.revision}
 eligible(data,offer,home,now);data.guestOffers.push(offer);c.entityId=offer.id
 return {id:offer.id,url:`${origin}/book/${home.slug}?offer=${token}`,expiresAt,discountBps:1000}
}
export async function offeredRate(data:Data,home:DirectHome,token:unknown,now=Date.now()):Promise<GuestOffer|undefined> {
 if(token===undefined||token===null||token==='')return undefined
 need(typeof token==='string'&&/^[a-f0-9-]{72}$/.test(token),'This returning-guest offer is not available',404)
 const hash=await sha(token),found=dataOf(data).guestOffers.find(o=>o.tokenHash===hash)
 need(found&&found.status==='issued'&&found.propertyId===home.propertyId&&Date.parse(found.expiresAt)>now,'This returning-guest offer has expired or is unavailable',409)
 return eligible(dataOf(data),found,home,now)
}
export function redeemOffer(c:Context,offer:GuestOffer,input:Record<string,unknown>,bookingId:string) {
 need(typeof input.email==='string'&&input.email.trim().toLowerCase()===offer.email&&typeof input.guestName==='string'&&input.guestName.trim()===offer.guestName,'Use the name and verified email for this private returning-guest offer.',409)
 need(input.returningConsent==='yes','Confirm that this is your returning-guest offer and link this booking to your reviewed guest record')
 need(offer.status==='issued','This returning-guest offer has already been used',409)
 offer.status='redeemed';offer.revision=newId();offer.redeemedAt=c.now;offer.redeemedBookingId=bookingId
}
