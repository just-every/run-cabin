import type { Bindings } from '../../auth.server'
import { record, type AuditActor } from '../audit/write'
import { need,newId } from '../model'
import { load,mutate } from '../storage'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { stay,saveStay,DIRECT_SYSTEM } from './store'
import { createDeposit,readPayment,readCheckout,releaseDeposit,createDepositCheckout } from './stripe'
import type { DirectStay } from './types'
import { depositLedger } from './settlement-ledger'
export const paymentEnv=(env:Bindings,s:DirectStay)=>({...env,CABIN_PROVIDER_PROPERTY_ID:s.propertyId,DIRECT_STRIPE_MODE:s.paymentMode??'test' as 'test'|'live'})
export const departure=(s:DirectStay)=>Date.parse(s.checkedOutAt??s.departureAt??s.end+'T23:59:59.999Z')
const change=(env:Bindings,id:string,name:string,fn:(s:DirectStay)=>void)=>mutate(env.DB,DIRECT_SYSTEM,name,async c=>{const row=await stay(env.DB,id);fn(row);saveStay(c,row);return row})
export async function depositSchedule(env:Bindings,s:DirectStay){
 if(s.depositDueAt)return s
 const settings=homeSettings(await load(env.DB),s.propertyId)
 return change(env,s.id,'direct.deposit.scheduled',r=>{
  r.timeZone=settings.timeZone;r.arrivalAt=new Date(instant(r.start+'T'+settings.checkInTime,settings.timeZone)).toISOString();r.departureAt=new Date(instant(r.end+'T'+settings.checkOutTime,settings.timeZone)).toISOString();r.depositDueAt=new Date(Date.parse(r.arrivalAt)-48*3_600_000).toISOString()
 })
}
function result(p:any,s:DirectStay){const before=p.latest_charge?.payment_method_details?.card?.capture_before;return {id:p.id,status:p.status,amountCents:s.quote.depositCents,expiresAt:before?new Date(before*1000).toISOString():null,...(Number.isSafeInteger(p.amount_received)?{capturedCents:p.amount_received}:{})}}
export async function reconcileDeposit(env:Bindings,s:DirectStay,actor:AuditActor=DIRECT_SYSTEM){
 s=await depositSchedule(env,s);const stripeEnv=paymentEnv(env,s)
 if(s.previousDeposit){
  const old=await readPayment(stripeEnv,s.previousDeposit.id)
  if(old.status==='canceled')s=await mutate(env.DB,DIRECT_SYSTEM,'direct.deposit.previous.closed',async c=>{const row=await stay(c.db,s.id);if(row.previousDeposit&&row.previousDeposit.id===old.id){await depositLedger(c,{...row,deposit:{...row.previousDeposit,status:'canceled'}});delete row.previousDeposit;saveStay(c,row)}return row})
 }
 if(s.depositCheckout?.status==='open'){
  const session=await readCheckout(stripeEnv,s.depositCheckout.id),pi=session.payment_intent
  if(session.status==='complete'){
   need(pi&&typeof pi==='object'&&pi.status==='requires_capture'&&pi.amount===s.quote.depositCents&&pi.currency==='usd'&&session.metadata?.stayId===s.id&&session.metadata?.purpose==='security_deposit','Stripe damage authorization does not match this stay',409)
   const p=await readPayment(stripeEnv,pi.id),old=s.deposit
   s=await change(env,s.id,'direct.deposit.renewed',row=>{if(old?.status==='requires_capture'&&old.id!==pi.id)row.previousDeposit={...old,status:'releasing'};row.deposit=result(p,row);row.depositCheckout!.status='complete';delete row.error})
   if(old?.status==='requires_capture'&&old.id!==pi.id){
    const scope={kind:'direct-stay',id:s.id,propertyId:s.propertyId,bookingId:s.bookingId,revision:s.revision}
    await record(env.DB,actor,'direct.deposit.previous.release.request',{...scope,result:'pending'})
    try { const released=await releaseDeposit(stripeEnv,old.id);need(released.status==='canceled','The previous authorization release is pending. Refresh its provider status.',409);await mutate(env.DB,DIRECT_SYSTEM,'direct.deposit.previous.closed',async c=>{const row=await stay(c.db,s.id);if(row.previousDeposit&&row.previousDeposit.id===old.id){await depositLedger(c,{...row,deposit:{...old,status:'canceled'}});delete row.previousDeposit;saveStay(c,row)}}) } catch(error) {
     await record(env.DB,actor,'direct.deposit.previous.release.result',{...scope,result:'failed-or-uncertain'});throw error
    }
    await record(env.DB,actor,'direct.deposit.previous.release.result',{...scope,result:'completed'})
   }
  }else if(session.status==='expired')s=await change(env,s.id,'direct.deposit.checkout.expired',row=>{row.depositCheckout!.status='expired'})
 }
 if(s.phase!=='cancelled'&&!s.deposit&&!s.depositCheckout&&Date.now()>=Date.parse(s.depositDueAt!)&&Date.now()<departure(s)){
  if(!s.customerId||!s.paymentMethod)return s.error?s:change(env,s.id,'direct.deposit.needs-guest',r=>{r.error='The saved card is unavailable. No damage funds are secured. Ask the guest to open their booking link and authorize the deposit with Stripe.'})
  if(!s.depositAttempt)s=await change(env,s.id,'direct.deposit.requested',r=>{r.depositAttempt??=newId();r.depositRequestedAt??=new Date().toISOString()})
  const attempt=s.depositAttempt!
  if(s.depositRequestedAt&&Date.now()-Date.parse(s.depositRequestedAt)>23*3_600_000)return change(env,s.id,'direct.deposit.uncertain',r=>{r.error='The earlier damage authorization request has no saved result. Review Stripe before placing another hold; its safe retry window ended.'})
  try{
   const p=await createDeposit(stripeEnv,{id:s.id,attempt,customer:s.customerId!,paymentMethod:s.paymentMethod!,amountCents:s.quote.depositCents})
   s=await change(env,s.id,'direct.deposit.held',row=>{row.deposit=result(p,row);delete row.depositUncertain;delete row.error})
  }catch(error){
   return change(env,s.id,'direct.deposit.needs-guest',r=>{r.depositUncertain=!(Number((error as {status?:number}).status)<500);r.error=r.depositUncertain?'The damage authorization outcome is uncertain. Cabin will reconcile the original request; review Stripe before asking the guest for another hold.':'The damage hold was not completed. No damage funds are secured. Ask the guest to open their booking link and authorize the deposit with Stripe.'})
  }
 }
 if(s.deposit){
  const p=await readPayment(stripeEnv,s.deposit.id)
  s=await change(env,s.id,'direct.deposit.checked',r=>{const pending=r.deposit?.action;r.deposit={...r.deposit!,...result(p,r)};if(pending&&p.status==='requires_capture')r.deposit.status=pending==='capture'?'capturing':'releasing'})
  if(s.deposit!.status==='requires_capture'&&s.deposit!.expiresAt&&Date.parse(s.deposit!.expiresAt)<=Date.now())s=await change(env,s.id,'direct.deposit.expired',r=>{r.deposit!.status='canceled';r.error='The damage authorization expired. No damage funds are secured. Ask the guest to renew the hold from their booking page.'})
 }
 return s
}
export async function guestDeposit(env:Bindings,id:string,token:string){
 let s=await depositSchedule(env,await stay(env.DB,id));need(s.phase!=='cancelled','This reservation was cancelled. Contact the host about deposit settlement.',409);need(s.paymentId&&s.quote.depositCents&&s.customerId,'Pay for the stay before authorizing a damage deposit',409)
 need(!s.depositUncertain,'The previous damage authorization needs provider reconciliation. Contact your host before requesting another hold.',409)
 need(Date.now()>=Date.parse(s.depositDueAt!),'The damage authorization opens 48 hours before arrival. Return then to avoid a hold expiring before you arrive.',409)
 need(Date.now()<departure(s),'This stay has ended. Contact the host about deposit settlement.',409)
 if(s.depositCheckout?.status==='open')return s.depositCheckout.url
 need(!s.previousDeposit,'The earlier authorization release is still being reconciled. Contact your host before requesting another hold.',409)
 const expires=s.deposit?.expiresAt?Date.parse(s.deposit.expiresAt):0
 need(s.deposit?.status!=='requires_capture'||(expires&&expires<departure(s)),'A damage hold already covers this stay',409)
 s=await change(env,id,'direct.deposit.checkout.requested',r=>{r.depositCheckoutPending??={attempt:newId(),at:new Date().toISOString()}})
 const attempt=s.depositCheckoutPending!.attempt
 need(Date.now()-Date.parse(s.depositCheckoutPending!.at)<23*3_600_000,'The previous checkout authorization needs host reconciliation before another request.',409)
 let session:any
 try { session=await createDepositCheckout(paymentEnv(env,s),{id,attempt,token,origin:env.AUTH_ORIGIN,customer:s.customerId!,amountCents:s.quote.depositCents}) } catch(error) {
  await record(env.DB,{id:'guest:'+s.id,role:'guest',isAgent:false,operatorVersion:0},'guest.deposit.checkout.result',{kind:'direct-stay',id:s.id,propertyId:s.propertyId,bookingId:s.bookingId,revision:s.revision,result:'failed-or-uncertain'});throw error
 }
 await change(env,id,'direct.deposit.checkout.ready',r=>{r.depositCheckout={id:session.id,url:session.url,attempt,status:'open'};delete r.depositCheckoutPending})
 return session.url
}
