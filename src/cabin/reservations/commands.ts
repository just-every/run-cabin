import { type Booking,type Context,need,text,newId,manager,property,exact,sha } from '../model'
import { channel,held,overlaps,describe } from '../inventory'
import { day } from '../direct/rules'
import { emailOf,phoneOf } from '../inbox/threads'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { managementFor } from '../properties/terms'
import { stays,saveStay } from '../direct/store'
import { unsettled } from '../direct/refund-calculation'
import { price,policy } from './finance'
import { lifecycle } from './history'
const commands=new Set(['reservation.create','reservation.amend','reservation.end','reservation.reconcile'])
const optional=(v:unknown,max:number)=>v===undefined||v===null||v===''?undefined:text(v,'reservation detail',max)
function details(p:Record<string,unknown>){
 const email=optional(p.guestEmail,254),phone=optional(p.guestPhone,40),arrivalTime=optional(p.arrivalTime,5)
 need(!email||emailOf(email),'Enter a valid guest email');need(!phone||phoneOf(phone),'Enter a valid guest phone')
 need(!arrivalTime||/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime),'Enter arrival time as HH:MM')
 return {guestName:text(p.guestName,'guest name',120),guestEmail:email?emailOf(email)!:undefined,guestPhone:phone?phoneOf(phone)!:undefined,arrivalTime}
}
function dates(p:Record<string,unknown>){const start=day(p.start),end=day(p.end);need(start<end&&Date.parse(end)-Date.parse(start)<=365*86400000,'Choose 1 to 365 nights');return {start,end}}
function availability(c:Context,b:Pick<Booking,'id'|'propertyId'|'start'|'end'>){const hit=held(c,b.propertyId).find(o=>o.id!==b.id&&overlaps(o,b));need(!hit,`Those nights overlap ${hit?describe(hit):''}`,409)}
function fence(c:Context,b:Booking){
 need(!b.guestErasedAt,'This guest identity was erased',409)
 need(!c.data.messages.some(m=>m.bookingId===b.id&&m.status==='sending')&&!c.data.scheduled.some(m=>m.bookingId===b.id&&m.status==='sending'),'A guest message is in flight. Wait for its result before changing this stay.',409)
 need(!c.data.codes.some(code=>code.bookingId===b.id&&['setting','revoking'].includes(code.lock.state)),'An access update is in flight. Wait for its result.',409)
}
export async function lifecycleCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!commands.has(name))return undefined
 manager(c.actor)
 if(name==='reservation.create'){
  const home=property(c,p.propertyId),method=String(p.method??'phone');need(['direct','phone','manual','channel'].includes(method),'Choose how this stay was booked')
  const ch=channel(p.channel??'direct'),sourceId=text(p.sourceId,'source reference',160)
  need(!c.data.bookings.some(b=>b.lifecycle?.sourceId===sourceId&&b.channel===ch),'That source reference already exists. Open its reservation.',409)
  const b:Booking={id:newId(),revision:newId(),uid:`manual-${newId()}`,propertyId:home.id,channel:ch,source:'request',status:'confirmed',cancelled:false,kind:'stay',approvedAt:c.now,summary:text(p.guestName,'guest name',120),...dates(p),...details(p),...(ch!=='direct'?{channelRef:sourceId}:{}),lifecycle:{method:method as 'phone',sourceId,policy:policy(p),price:price(p),history:[],events:[]}}
  availability(c,b);c.data.bookings.push(b);c.entityId=b.id;return b
 }
 const b=c.data.bookings.find(b=>b.id===text(p.id,'reservation'));need(b&&(b.kind??'stay')==='stay','Reservation not found',404);property(c,b.propertyId)
 const l=lifecycle(b),eventId=optional(p.eventId,160),fingerprint=await sha(JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k])=>k!=='revision').sort(([a],[b])=>a.localeCompare(b)))))
 const replay=eventId&&l.events.find(e=>e.id===eventId)
 if(replay){need(replay.fingerprint===fingerprint,'This source event already has different terms. Reconcile it explicitly.',409);return b}
 exact(b,p.revision);need(name==='reservation.reconcile'||b.status==='confirmed','This reservation has already ended',409);fence(c,b)
 if(name==='reservation.reconcile'){need(l.sourceConflict,'No source conflict to reconcile',409);need(p.resolution==='keep'||p.resolution==='source','Choose the reviewed source or the current revision');if(p.resolution==='source'){const incoming=l.sourceConflict;const next={...b,start:incoming.start,end:incoming.end};if(!incoming.cancelled)availability(c,next);Object.assign(b,next,{summary:incoming.summary,status:incoming.cancelled?'cancelled':'confirmed',cancelled:incoming.cancelled,revision:newId(),approvedAt:c.now});l.sourceReview=false}delete l.sourceConflict;c.entityId=b.id;return b}
 const direct=(await stays(c.db)).find(s=>s.bookingId===b.id)
 need(!direct||!unsettled(direct),'A refund is awaiting Stripe reconciliation. Resolve it before changing the stay.',409)
 need(!direct||!direct.deposit?.action||['succeeded','canceled'].includes(direct.deposit.status),'A damage settlement is awaiting Stripe reconciliation.',409)
 need(!direct||direct.phase==='confirmed','Finish or expire the checkout before amending the confirmed stay',409)
 if(direct&&!l.price){l.price={rentCents:direct.quote.rentCents,feesCents:direct.quote.cleaningCents+direct.quote.extraGuestCents,taxCents:direct.quote.taxes.reduce((n,t)=>n+t.amountCents,0),totalCents:direct.quote.totalCents}}
 if(b.source==='feed'){l.sourceReview=true;l.sourceOrigin??={propertyId:b.propertyId,channel:b.channel,uid:b.uid,connectionId:b.connectionId,snapshot:{start:b.start,end:b.end,summary:b.summary}}}
 if(l.policy.known===false&&p.policyName)l.policy=policy(p)
 if(name==='reservation.end'){
  need(l.policy.known!==false,'Record the source cancellation policy in an exact amendment before ending this reservation.',409)
  const outcome=p.outcome??'cancelled';need(outcome==='cancelled'||outcome==='no_show','Choose cancellation or no-show')
  if(outcome==='no_show'){const s=homeSettings(c,b.propertyId);need(Date.now()>=instant(`${b.start.slice(0,10)}T${b.arrivalTime??s.checkInTime}`,s.timeZone),'A no-show can be recorded only after check-in',409)}
  l.cancellationReason=text(p.reason,'reason and source evidence',2000);l.outcome=outcome
  const bps=outcome==='no_show'?l.policy.noShowBps:l.policy.freeUntil&&Date.now()<Date.parse(l.policy.freeUntil)?0:l.policy.retainedBps
  l.settledChargeCents=l.price?Math.round(l.price.totalCents*bps/10000):0
  Object.assign(b,{status:'cancelled',cancelled:true,revision:newId(),approvedAt:c.now})
  if(direct){direct.phase='cancelled';direct.error='Reservation ended. Review its refund and damage authorization; cancellation does not assert a processor refund.';saveStay(c,direct)}
 }else{
  const target=property(c,p.propertyId??b.propertyId),next={...b,...dates(p),propertyId:target.id};availability(c,next)
  const changedHome=target.id!==b.propertyId
  need(!direct||!changedHome,'A paid direct stay retains its original payment and owner scope. Settle it before creating a reservation for another home.',409)
  if(changedHome){
   for(const code of c.data.codes.filter(code=>code.bookingId===b.id&&code.status==='issued')){code.status='revoked';code.reason='Reservation moved to a different home';code.revision=newId()}
   for(const job of c.data.turnovers.filter(job=>job.bookingId===b.id&&job.status!=='cancelled')){job.status='cancelled';job.cancelReason='Reservation moved to a different home';job.revision=newId()}
   for(const message of c.data.scheduled.filter(m=>m.bookingId===b.id&&m.status==='scheduled')){message.status='cancelled';message.reason='Reservation moved to a different home';message.revision=newId()}
   next.managementTerms=structuredClone(managementFor(c.data,target.id,next.start))
   // Channel links identify inventory on the old listing; a native move retires that association.
   delete next.connectionId;next.source='request'
  }
  const oldTotal=l.price?.totalCents
  Object.assign(b,next,details(p),{summary:text(p.guestName,'guest name',120),revision:newId(),approvedAt:c.now})
  if(p.rentCents!==undefined||p.rentDollars!==undefined)l.price=price(p)
  need(oldTotal===l.price?.totalCents||!!text(p.reason,'price amendment reason',2000),'Explain a price change')
  if(direct){const s=homeSettings(c,b.propertyId);direct.propertyId=b.propertyId;direct.start=b.start;direct.end=b.end;direct.guestName=b.guestName!;direct.email=b.guestEmail??direct.email;direct.timeZone=s.timeZone;direct.arrivalAt=new Date(instant(`${b.start}T${b.arrivalTime??s.checkInTime}`,s.timeZone)).toISOString();direct.departureAt=new Date(instant(`${b.end}T${b.departureTime??s.checkOutTime}`,s.timeZone)).toISOString();saveStay(c,direct)}
  l.cancellationReason=undefined
 }
 if(eventId)l.events.push({id:eventId,fingerprint,revision:b.revision})
 c.entityId=b.id;return b
}
