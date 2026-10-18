import { restorationPaused } from '../connections/guard'
import type { Bindings } from '../../auth.server'
import { record, type AuditActor } from '../audit/write'
import { need,newId,type Actor } from '../model'
import { mutate } from '../storage'
import { stay,dueStays,saveStay,DIRECT_SYSTEM } from './store'
import { readCheckout,releaseDeposit,captureDeposit,readIdentity,createIdentity } from './stripe'
import { reconcileDeposit,paymentEnv,departure } from './deposit'
import { activeDeposit } from './presentation'
import { queueConfirmation } from './confirmation'
import { deliverGuestMessages } from '../inbox/deliver'
import type { DirectStay } from './types'
import { verificationOf,resolved,saveVerification } from '../verification/records'
import { load } from '../storage'
import { verificationDue } from '../verification/retention'
import { startVerification,reconcileVerification } from '../verification/provider'
const update=async(env:Bindings,id:string,action:string,change:(s:DirectStay)=>void,actor=DIRECT_SYSTEM)=>mutate(env.DB,actor,action,async c=>{const s=await stay(env.DB,id);change(s);saveStay(c,s);return s})
export async function refresh(env:Bindings,id:string,actor:AuditActor=DIRECT_SYSTEM) {
 let s=await stay(env.DB,id)
 if(s.restored||s.phase==='expired'||s.phase==='cancelled')return s
 if(s.checkoutId&&!s.paymentId){
  const session=await readCheckout(paymentEnv(env,s),s.checkoutId)
  if(session.payment_status==='paid'){
   const pi=session.payment_intent;need(pi&&typeof pi==='object'&&pi.status==='succeeded'&&pi.amount_received===s.quote.totalCents&&pi.currency==='usd'&&session.metadata?.stayId===s.id,'Stripe payment does not match this stay',409)
   s=await mutate(env.DB,DIRECT_SYSTEM,'direct.paid',async c=>{const row=await stay(env.DB,id);row.paymentId=pi.id;row.customerId=typeof session.customer==='string'?session.customer:session.customer?.id;row.paymentMethod=typeof pi.payment_method==='string'?pi.payment_method:pi.payment_method?.id;row.phase='paid';delete row.error;saveStay(c,row);return row})
  }else if(session.status==='expired')return expire(env,id)
 }
 if(!s.paymentId){if(!s.checkoutId&&Date.now()>Date.parse(s.holdUntil))return expire(env,id);return s}
 if(s.requireIdentity&&s.identity&&s.identity.status!=='verified'){const identity=await readIdentity(paymentEnv(env,s),s.identity.id);s=await update(env,id,'direct.identity.checked',row=>{row.identity={id:identity.id,status:identity.status}})}
 // The receipt states the damage hold as it now stands, so it is written once the hold step has run, even when that step failed.
 let failure:unknown=null
 if(s.quote.depositCents)try{s=await reconcileDeposit(env,s,actor)}catch(error){failure=error;s=await stay(env.DB,id)}
 if(!s.paymentMessageId)s=await mutate(env.DB,DIRECT_SYSTEM,'direct.receipt',async c=>{const row=await stay(env.DB,id);await queueConfirmation(env,c,row,'payment');saveStay(c,row);return row})
 if(failure){await deliverGuestMessages(env);throw failure}
 const deferred=!!s.depositDueAt&&Date.now()<Date.parse(s.depositDueAt)
 const verification=await mutate(env.DB,DIRECT_SYSTEM,'direct.verification.checked',async c=>{const v=verificationOf(c.data,s.bookingId);if(v)await reconcileVerification(env,c,v);return v})
 const ready=(verification?(!verification.policy.requireBeforeConfirmation||resolved(verification)):!s.requireIdentity||s.identity?.status==='verified')&&(!s.quote.depositCents||deferred||activeDeposit(s))
 if(ready&&s.phase==='paid')s=await mutate(env.DB,DIRECT_SYSTEM,'direct.confirmed',async c=>{
  const row=await stay(env.DB,id);need(row.phase==='paid'||row.phase==='confirmed','This stay is no longer awaiting confirmation',409)
  row.phase='confirmed';delete row.error;const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking&&booking.status==='confirmed','The booking hold is missing. Contact the host.',409)
  Object.assign(booking,{kind:'stay',summary:row.guestName,guestName:row.guestName,guestEmail:row.email,revision:newId()});await queueConfirmation(env,c,row,'confirmation');saveStay(c,row);return row
 })
 await deliverGuestMessages(env)
 return s
}
async function expire(env:Bindings,id:string) {return mutate(env.DB,DIRECT_SYSTEM,'direct.expired',async c=>{const row=await stay(env.DB,id);need(!row.paymentId,'A paid stay cannot expire',409);row.phase='expired';const b=c.data.bookings.find(b=>b.id===row.bookingId);if(b)Object.assign(b,{status:'cancelled',cancelled:true,revision:newId()});saveStay(c,row);return row})}
export async function identity(env:Bindings,id:string,token:string) {
 let s=await stay(env.DB,id);need(s.paymentId&&s.requireIdentity,'Pay for the stay before starting the required ID check',409)
 const verification=verificationOf(await load(env.DB),s.bookingId)
 if(verification?.token){
  need(verification.consentAt&&verification.consentMethod==='stripe','Open your identity check page and consent before continuing',409)
  const result=await startVerification({...env,DIRECT_STRIPE_MODE:s.paymentMode} as Bindings,verification)
  await mutate(env.DB,DIRECT_SYSTEM,'direct.identity.started',async c=>{const v=verificationOf(c.data,s.bookingId)!;need(v.status!=='erased'&&!resolved(v),'Verification changed',409);v.provider=result.provider;v.status='requires_input';saveVerification(c,v);const row=await stay(env.DB,id);row.identity={id:result.provider.id,status:result.provider.status};saveStay(c,row)})
  return result.url
 }
 if(s.identity){const saved=await readIdentity(paymentEnv(env,s),s.identity.id);if(saved.url)return saved.url;need(saved.status!=='verified','Your ID check is already complete',409)}
 const actor:AuditActor={id:'guest:'+s.id,role:'guest',isAgent:false,operatorVersion:0},scope={kind:'direct-stay',id:s.id,propertyId:s.propertyId,bookingId:s.bookingId,revision:s.revision}
 await record(env.DB,actor,'guest.identity.request', {...scope,result:'pending'})
 let result:any
 try { result=await createIdentity(paymentEnv(env,s),{id,token,origin:env.AUTH_ORIGIN}) } catch(error) {
  await record(env.DB,actor,'guest.identity.result',{...scope,result:'failed-or-uncertain'});throw error
 }
 await update(env,id,'direct.identity.started',row=>{row.identity={id:result.id,status:result.status}});return result.url
}
export async function settleDeposit(env:Bindings,actor:Actor,id:string,action:'release'|'capture',amount=0,reason='',evidence='') {
 const s=await update(env,id,`direct.deposit.${action}.requested`,row=>{
  need(!row.restored,'Restored payment operations must be reconciled in Stripe; Cabin will not replay them.',409)
  need(row.deposit&&activeDeposit(row),'No active authorization is available',409);need(Date.now()>=departure(row),'Settle the damage deposit after checkout',409)
  if(action==='capture'){need(Number.isSafeInteger(amount)&&amount>0&&amount<=row.deposit.amountCents,'Capture an amount within the held deposit');need(reason.trim()&&evidence.trim(),'Give a damage reason and evidence reference')}
  if(action==='capture')row.deposit.claimCents=amount;row.deposit.status=action==='release'?'releasing':'capturing';row.deposit.reason=reason;row.deposit.evidence=evidence
 },actor)
 try{
  const p=action==='release'?await releaseDeposit(paymentEnv(env,s),s.deposit!.id):await captureDeposit(paymentEnv(env,s),s.deposit!.id,amount)
  return update(env,id,`direct.deposit.${action}.completed`,row=>{row.deposit!.status=p.status;if(Number.isSafeInteger(p.amount_received))row.deposit!.capturedCents=p.amount_received;delete row.error},actor)
 }catch(error){await update(env,id,'direct.deposit.error',row=>{row.error=(error as Error).message+' Refresh the payment status before submitting another action.'},actor);throw error}
}
export async function directDue(env:Bindings) {
 if(await restorationPaused(env.DB))return
 await verificationDue(env)
 for(const row of await dueStays(env.DB))try{
  let s=row;s=await refresh(env,s.id)
  if(s.deposit?.status==='canceled'&&!s.checkedOutAt&&Date.now()<departure(s))await update(env,s.id,'direct.deposit.expired-alert',r=>{r.error='The damage authorization closed before checkout. No damage funds are secured. Ask the guest to renew it from their booking page.'})
  else if(s.deposit?.status==='requires_capture'&&Date.now()>=departure(s)+s.releaseHours*3_600_000&&!s.deposit.reason)await settleDeposit(env,DIRECT_SYSTEM,s.id,'release')
  else if(s.deposit?.status==='requires_capture'&&!s.deposit.expiresAt)await update(env,s.id,'direct.deposit.expiry-alert',r=>{r.error='Stripe did not report this authorization’s expiry. Review the hold in Stripe before arrival.'})
  else if(s.deposit?.status==='requires_capture'&&s.deposit.expiresAt&&Date.parse(s.deposit.expiresAt)<Math.min(Date.now()+86_400_000,departure(s)))await update(env,s.id,'direct.deposit.expiry-alert',r=>{r.error='Damage authorization expires before checkout. Ask the guest to renew the hold from their booking page; expired authorizations secure no funds.'})
 }catch(error){await update(env,row.id,'direct.provider.error',s=>{s.error=(error as Error).message})}
}
