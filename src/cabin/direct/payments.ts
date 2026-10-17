import type { Bindings } from '../../auth.server'
import { need,newId,type Actor } from '../model'
import { mutate } from '../storage'
import { stay,dueStays,saveStay,DIRECT_SYSTEM } from './store'
import { readCheckout,readPayment,createDeposit,releaseDeposit,captureDeposit,readIdentity,createIdentity } from './stripe'
import type { DirectStay } from './types'
const update=async(env:Bindings,id:string,action:string,change:(s:DirectStay)=>void,actor=DIRECT_SYSTEM)=>mutate(env.DB,actor,action,async c=>{const s=await stay(env.DB,id);change(s);saveStay(c,s);return s})
export async function refresh(env:Bindings,id:string) {
 let s=await stay(env.DB,id)
 if(s.phase==='expired')return s
 if(s.checkoutId&&!s.paymentId){
  const session=await readCheckout(env,s.checkoutId)
  if(session.payment_status==='paid'){
   const pi=session.payment_intent;need(pi&&typeof pi==='object'&&pi.status==='succeeded'&&pi.amount_received===s.quote.totalCents&&pi.currency==='usd'&&session.metadata?.stayId===s.id,'Stripe payment does not match this stay',409)
   s=await update(env,id,'direct.paid',row=>{row.paymentId=pi.id;row.customerId=typeof session.customer==='string'?session.customer:session.customer?.id;row.paymentMethod=typeof pi.payment_method==='string'?pi.payment_method:pi.payment_method?.id;row.phase='paid';delete row.error})
  }else if(session.status==='expired')return expire(env,id)
 }
 if(!s.paymentId){if(!s.checkoutId&&Date.now()>Date.parse(s.holdUntil))return expire(env,id);return s}
 if(s.requireIdentity&&s.identity&&s.identity.status!=='verified'){const identity=await readIdentity(env,s.identity.id);s=await update(env,id,'direct.identity.checked',row=>{row.identity={id:identity.id,status:identity.status}})}
 if(s.quote.depositCents&&!s.deposit){
  need(s.customerId&&s.paymentMethod,'Stripe did not save the payment mandate for this deposit',409)
  const deposit=await createDeposit(env,{id:s.id,customer:s.customerId,paymentMethod:s.paymentMethod,amountCents:s.quote.depositCents})
  const before=deposit.latest_charge?.payment_method_details?.card?.capture_before
  s=await update(env,id,'direct.deposit.held',row=>{row.deposit={id:deposit.id,status:deposit.status,amountCents:row.quote.depositCents,expiresAt:before?new Date(before*1000).toISOString():null}})
 }
 if(s.deposit){const p=await readPayment(env,s.deposit.id);s=await update(env,id,'direct.deposit.checked',row=>{row.deposit!.status=p.status;if(Number.isSafeInteger(p.amount_received))row.deposit!.capturedCents=p.amount_received;const before=p.latest_charge?.payment_method_details?.card?.capture_before;if(before)row.deposit!.expiresAt=new Date(before*1000).toISOString()})}
 const ready=(!s.requireIdentity||s.identity?.status==='verified')&&(!s.quote.depositCents||s.deposit?.status==='requires_capture')
 if(ready&&s.phase==='paid')s=await mutate(env.DB,DIRECT_SYSTEM,'direct.confirmed',async c=>{
  const row=await stay(env.DB,id);need(row.phase==='paid'||row.phase==='confirmed','This stay is no longer awaiting confirmation',409)
  row.phase='confirmed';delete row.error;const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking&&booking.status==='confirmed','The booking hold is missing. Contact the host.',409)
  Object.assign(booking,{kind:'stay',summary:row.guestName,guestName:row.guestName,revision:newId()});saveStay(c,row);return row
 })
 return s
}
async function expire(env:Bindings,id:string) {return mutate(env.DB,DIRECT_SYSTEM,'direct.expired',async c=>{const row=await stay(env.DB,id);need(!row.paymentId,'A paid stay cannot expire',409);row.phase='expired';const b=c.data.bookings.find(b=>b.id===row.bookingId);if(b)Object.assign(b,{status:'cancelled',cancelled:true,revision:newId()});saveStay(c,row);return row})}
export async function identity(env:Bindings,id:string,token:string) {
 let s=await stay(env.DB,id);need(s.paymentId&&s.requireIdentity,'Pay for the stay before starting the required ID check',409)
 if(s.identity){const saved=await readIdentity(env,s.identity.id);if(saved.url)return saved.url;need(saved.status!=='verified','Your ID check is already complete',409)}
 const result=await createIdentity(env,{id,token,origin:env.AUTH_ORIGIN});await update(env,id,'direct.identity.started',row=>{row.identity={id:result.id,status:result.status}});return result.url
}
export async function settleDeposit(env:Bindings,actor:Actor,id:string,action:'release'|'capture',amount=0,reason='',evidence='') {
 const s=await update(env,id,`direct.deposit.${action}.requested`,row=>{
  need(row.deposit?.status==='requires_capture','No active authorization is available',409);need(Date.now()>=Date.parse(row.checkedOutAt??row.end+'T23:59:59.999Z'),'Settle the damage deposit after checkout',409)
  if(action==='capture'){need(Number.isSafeInteger(amount)&&amount>0&&amount<=row.deposit.amountCents,'Capture an amount within the held deposit');need(reason.trim()&&evidence.trim(),'Give a damage reason and evidence reference')}
  if(action==='capture')row.deposit.claimCents=amount;row.deposit.status=action==='release'?'releasing':'capturing';row.deposit.reason=reason;row.deposit.evidence=evidence
 },actor)
 try{
  const p=action==='release'?await releaseDeposit(env,s.deposit!.id):await captureDeposit(env,s.deposit!.id,amount)
  return update(env,id,`direct.deposit.${action}.completed`,row=>{row.deposit!.status=p.status;if(Number.isSafeInteger(p.amount_received))row.deposit!.capturedCents=p.amount_received;delete row.error},actor)
 }catch(error){await update(env,id,'direct.deposit.error',row=>{row.error=(error as Error).message+' Refresh the payment status before submitting another action.'},actor);throw error}
}
export async function directDue(env:Bindings) {
 for(const row of await dueStays(env.DB))try{
  let s=row;s=await refresh(env,s.id)
  if(s.deposit?.status==='canceled'&&!s.checkedOutAt&&Date.now()<Date.parse(s.end+'T23:59:59.999Z'))await update(env,s.id,'direct.deposit.expired-alert',r=>{r.error='The damage authorization closed before checkout. Arrange a replacement hold with the guest.'})
  else if(s.deposit?.status==='requires_capture'&&Date.now()>=Date.parse(s.checkedOutAt??s.end+'T23:59:59.999Z')+s.releaseHours*3_600_000&&!s.deposit.reason)await settleDeposit(env,DIRECT_SYSTEM,s.id,'release')
  else if(s.deposit?.status==='requires_capture'&&!s.deposit.expiresAt)await update(env,s.id,'direct.deposit.expiry-alert',r=>{r.error='Stripe did not report this authorization’s expiry. Review the hold in Stripe before arrival.'})
  else if(s.deposit?.status==='requires_capture'&&s.deposit.expiresAt&&Date.parse(s.deposit.expiresAt)<Math.min(Date.now()+86_400_000,Date.parse(s.end+'T23:59:59.999Z')))await update(env,s.id,'direct.deposit.expiry-alert',r=>{r.error='Damage authorization expires before checkout. Arrange a replacement hold with the guest before it expires.'})
 }catch(error){await update(env,row.id,'direct.provider.error',s=>{s.error=(error as Error).message})}
}
