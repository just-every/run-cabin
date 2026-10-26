import { sharesCapacity } from '../capacity'
import { type Context,type Booking,need,sha } from '../model'
import { homeSettings } from '../homes'
import { dispatch } from '../dispatch'
import { planAssignment } from '../dispatch/planner'
import { consent,consentBaseline,guestRoot,guestGroup,guestBookings } from '../guests/resolve'
import { instant } from '../clock'
import { overlaps } from '../inventory'
import { allocationTerms } from '../properties/terms'
import { modelFor,revenueParts,splitCents } from '../finance/allocation-calculation'
import { stays } from '../direct/store'
import { unsettled } from '../direct/refund-calculation'
import { offers,policy } from './store'
import type { PromotionOffer,PromotionBooking,PromotionPolicy } from './types'

export function guestEligibility(c:Context,b:Booking){
 const profile=c.data.guests.find(g=>g.bookingId===b.id),root=profile&&guestRoot(c.data,profile.id)
 need(root&&b.guestEmail&&!b.guestErasedAt,'A reviewed guest with a verified email is required',409)
 need(consent(c.data,root.id,b.propertyId,'offers'),'The guest has not consented to offers for this home',409)
 need(guestGroup(c.data,root.id).some(g=>g.identities.some(i=>i.kind==='email'&&i.value===b.guestEmail?.toLowerCase()&&i.verified)),'Verify the guest email before sending an offer',409)
 return {guestId:root.id,email:b.guestEmail.toLowerCase(),consentBaseline:consentBaseline(c.data,root.id,b.propertyId)}
}
export function couponPrice(c:Context,p:PromotionPolicy,b:Booking,code:string|undefined,base:number){
 if(!code)return 0
 const coupon=p.coupons.find(c=>c.code===code),nights=(Date.parse(b.end)-Date.parse(b.start))/86400000
 need(coupon&&coupon.from<=b.start&&coupon.until>=b.end&&coupon.channels.includes(b.channel)&&nights>=coupon.minNights,'This coupon is not eligible for these dates, channel or stay length',409)
 if(coupon.repeatOnly){const g=guestEligibility(c,b),s=homeSettings(c,b.propertyId);need(guestBookings(c.data,g.guestId).some(prior=>prior.id!==b.id&&prior.propertyId===b.propertyId&&prior.status==='confirmed'&&instant(`${prior.end.slice(0,10)}T${s.checkOutTime}`,s.timeZone)<Date.parse(c.now)),'This coupon requires a completed previous stay at this home',409)}
 return Math.round(base*coupon.bps/10000)
}
export function allocation(c:Context,b:Booking,base:number,tax:number,cost:number,p:PromotionPolicy){
 const terms=structuredClone(allocationTerms(c.data,b)),model=modelFor(terms)
 need(model.mapping.reviewedBy,'Approve an accountant-reviewed owner allocation before issuing paid offers',409)
 terms.allocation={...model,fixedFeeCents:0}
 const parts=revenueParts(terms,base+tax,0,base,0,tax)
 const net=parts.reduce((n,p)=>n+p.payableCents+p.reserveCents,0)-cost-p.providerFeeReserveCents
 need(net>=p.minimumNetCents,'This offer is below the home’s minimum net contribution',409)
 const costs=splitCents(cost,parts.map(part=>part.shareBps));for(const [i,part] of parts.entries()){part.expenseCents=costs[i];part.payableCents-=costs[i];need(part.payableCents>=0,'Incremental service cost exceeds an owner’s allocation',409)}
 return {parts,netCents:net,managementRevision:JSON.stringify(allocationTerms(c.data,b))}
}
export function applyTarget(b:PromotionBooking,o:PromotionOffer){Object.assign(b,o.target)}
/** Run the actual turnover planner against the proposed stay, without saving the preview. */
export function capacity(c:Context,b:Booking,o:PromotionOffer){
 const scratch={...c,data:structuredClone(c.data),queries:[]} as Context
 scratch.data.bookings=scratch.data.bookings.filter(row=>row.id!==o.holdId)
 applyTarget(scratch.data.bookings.find(row=>row.id===b.id)!,o)
 dispatch(scratch)
 const affected=scratch.data.turnovers.filter(t=>t.status!=='cancelled'&&(t.bookingId===b.id||t.nextBookingId===b.id))
 need(affected.length,'A reviewed turnover plan is required for paid offers',409)
 for(const t of affected){
  if(t.status==='completed')continue
  const old=c.data.turnovers.find(old=>old.id===t.id),cleaner=t.cleanerId??old?.cleanerId
  need(cleaner,'Assign a capacity-reviewed cleaner before offering this change',409)
  t.cleanerId=cleaner;t.status='approved'
  const plan=planAssignment(scratch,cleaner,t,false);need(plan.ok,`Offer conflicts with cleaning: ${plan.reason}`,409)
 }
}
export async function eligible(c:Context,o:PromotionOffer){
 need(!o.restorePaused,'Restored offer history cannot create new effects',409)
 const b=c.data.bookings.find(b=>b.id===o.bookingId) as PromotionBooking|undefined
 need(b&&b.status==='confirmed'&&b.kind!=='block'&&!b.guestErasedAt&&!b.restorePaused,'The original stay is unavailable',409)
 need(b.revision===o.bookingRevision&&b.propertyId===o.propertyId,'The original stay changed. Prepare a new offer.',409)
 need(!b.lifecycle?.sourceReview&&!b.lifecycle?.sourceConflict,'Reconcile the channel’s source terms before issuing an offer',409)
 need(Date.parse(o.expiresAt)>Date.parse(c.now),'This offer has expired',409)
 const p=await policy(c,o.propertyId);need(p.revision===o.policyRevision,'The promotions policy changed. Prepare a new offer.',409)
 const guest=guestEligibility(c,b);need(guest.guestId===o.guestId&&guest.email===o.email&&guest.consentBaseline===o.consentBaseline,'Guest identity or consent changed. Prepare a new offer.',409)
 const discount=couponPrice(c,p,b,o.coupon,o.baseCents);need(discount===o.discountCents,'Coupon terms changed',409)
 const calculated=allocation(c,b,o.baseCents-discount,o.taxCents,o.costCents,p)
 need(calculated.managementRevision===o.managementRevision&&JSON.stringify(calculated.parts)===JSON.stringify(o.parts),'Owner allocation changed. Prepare a new offer.',409)
 need(c.data.ledgerSettings.some(s=>s.propertyId===b.propertyId),'Configure the home’s ledger before charging',409)
 need(!await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(c.now.slice(0,7)).first(),'The accounting period is closed',409)
 need(!c.data.bookings.some(other=>other.id!==b.id&&other.id!==o.holdId&&sharesCapacity(c.data,other.propertyId,b.propertyId)&&other.status==='confirmed'&&overlaps(other,o.target)),'The extension overlaps another reservation or inventory hold',409)
 const rows=await offers(c)
 if(o.kind==='extra'){
  const used=rows.filter(other=>other.id!==o.id&&other.propertyId===o.propertyId&&other.kind==='extra'&&other.title===o.title&&['sent','checkout','applied'].includes(other.status)&&(other.status==='applied'||Date.parse(other.expiresAt)>Date.parse(c.now))&&overlaps(other.target,o.target)).reduce((n,other)=>n+other.quantity,0)
  need(used+o.quantity<=p.stock,'This extra has no remaining stock for these dates',409)
 }
 const direct=(await stays(c.db)).find(s=>s.bookingId===b.id)
 need(!direct||direct.phase==='confirmed'&&!unsettled(direct)&&!direct.restored,'Resolve the original stay’s checkout or refund before changing it',409)
 need(!c.data.messages.some(m=>m.bookingId===b.id&&m.status==='sending')&&!c.data.scheduled.some(m=>m.bookingId===b.id&&m.status==='sending'),'A guest delivery is in flight. Reconcile it before changing this stay.',409)
 capacity(c,b,o)
 return {b,p,direct}
}
export const offerFingerprint=(o:PromotionOffer)=>sha(JSON.stringify({id:o.id,target:o.target,amount:o.amountCents,terms:o.terms,booking:o.bookingRevision}))
