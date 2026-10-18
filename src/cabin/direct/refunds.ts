import type { Bindings } from '../../auth.server'
import { need,text,integer,newId,type Actor } from '../model'
import { mutate } from '../storage'
import { stay,saveStay,DIRECT_SYSTEM } from './store'
import { paymentEnv } from './deposit'
import { createRefund,readRefund,paymentRefunds } from './stripe'
import { decimalUnits } from './presentation'
import { calculateRefund,refundBasis,unsettled } from './refund-calculation'
import { refundLedger,paymentLedger } from './settlement-ledger'
import { refundReceipt } from './settlement-receipts'
import { deliverGuestMessages } from '../inbox/deliver'
import type { Refund } from './refund-types'
function amount(input:Record<string,unknown>){return input.amountDollars!==undefined?decimalUnits(input.amountDollars,'refund amount'):integer(Number(input.amountCents),'refund amount cents',1)}
export async function refundCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 if(!name.startsWith('direct.refund.'))return undefined
 need(!actor.isAgent,'A human manager must approve refunds',403)
 const id=text(input.id,'stay ID')
 if(name==='direct.refund.prepare')return mutate(env.DB,actor,name,async c=>{
  const s=await stay(c.db,id),b=c.data.bookings.find(b=>b.id===s.bookingId)
  need(s.paymentId&&b&&!s.restored&&!b.guestErasedAt,'A current provider-paid reservation is required',409)
  need(c.data.ledgerSettings.some(l=>l.propertyId===s.propertyId),'Set this home’s ledger legal entity before approving money settlement.',409)
  need(!unsettled(s),'Reconcile the pending refund before preparing another',409)
  const kind=text(input.kind,'refund type') as Refund['kind'];need(['rent','full','settlement','deposit'].includes(kind),'Choose rent, full payment, saved settlement or captured deposit')
  const calculation=calculateRefund(s,b,kind,['rent','deposit'].includes(kind)?amount(input):undefined)
  const reason=text(input.reason,'refund reason',1000),evidence=text(input.evidence,'refund evidence',2000),basis=await refundBasis(c,s,b)
  const duplicate=s.refunds?.find(r=>r.status==='draft'&&r.basis===basis&&r.kind===kind&&r.reason===reason&&r.evidence===evidence&&JSON.stringify(r.amounts)===JSON.stringify(calculation.amounts));if(duplicate)return duplicate
  for(const r of s.refunds??[])if(r.status==='draft')r.status='cancelled'
  const r:Refund={id:newId(),revision:newId(),kind,status:'draft',paymentId:kind==='deposit'?s.deposit!.id:s.paymentId,bookingRevision:b.revision,basis,...calculation,reason,evidence,createdAt:c.now}
  ;(s.refunds??=[]).push(r);await paymentLedger(c,s);saveStay(c,s);return r
 })
 const refundId=text(input.refundId,'refund ID')
 if(name==='direct.refund.reconcile'){await reconcileRefund(env,id,refundId);return (await stay(env.DB,id)).refunds!.find(r=>r.id===refundId)}
 if(name==='direct.refund.discard')return mutate(env.DB,actor,name,async c=>{const s=await stay(c.db,id),r=s.refunds?.find(r=>r.id===refundId);need(r&&r.status==='draft','Only an unsubmitted draft may be discarded',409);r.status='cancelled';saveStay(c,s);return r})
 need(name==='direct.refund.approve','Unknown refund command',404)
 const snapshot=await stay(env.DB,id),draft=snapshot.refunds?.find(r=>r.id===refundId);need(draft,'Refund not found',404)
 // Repeated approval of an already claimed operation only reads its provider outcome.
 if(draft.status!=='draft'){await reconcileRefund(env,id,refundId);return (await stay(env.DB,id)).refunds!.find(r=>r.id===refundId)}
 const prior=await paymentRefunds(paymentEnv(env,snapshot),draft.paymentId)
 need(prior.every(p=>snapshot.refunds?.some(r=>r.providerId===p.id&&(r.status===p.status||r.status==='failed'&&p.status==='canceled'))),'Stripe has a refund whose outcome Cabin has not reconciled. Review it before approving another.',409)
 const claimed=await mutate(env.DB,actor,name,async c=>{
  const s=await stay(c.db,id),r=s.refunds?.find(r=>r.id===refundId),b=c.data.bookings.find(b=>b.id===s.bookingId)
  need(r&&b&&r.status==='draft'&&r.revision===input.revision,'This refund changed. Reload the exact plan.',409)
  need(input.confirm==='yes','Approve the exact amount, original payment, tax adjustment and guest receipt')
  need(!await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(c.now.slice(0,7)).first(),'The current accounting period is closed. Resolve the posting date before submitting a refund.',409)
  need(!s.restored&&!b.guestErasedAt&&!unsettled(s)&&await refundBasis(c,s,b)===r.basis,'Reservation, payment or refund terms changed. Prepare a fresh refund.',409)
  r.status='requested';r.approvedBy=actor.id;r.approvedAt=c.now;r.requestedAt=c.now
  c.data.approvals.push({id:newId(),kind:'direct-refund',recordId:r.id,revision:r.revision,actorId:actor.id,at:c.now});saveStay(c,s);return {s,r}
 })
 try{const provider=await createRefund(paymentEnv(env,claimed.s),{id:refundId,stayId:id,paymentId:claimed.r.paymentId,amountCents:claimed.r.amounts.totalCents});await acceptRefund(env,id,refundId,provider)}
 catch(error){await mutate(env.DB,DIRECT_SYSTEM,'direct.refund.uncertain',async c=>{const s=await stay(c.db,id),r=s.refunds!.find(r=>r.id===refundId)!;if(r.status!=='succeeded'){r.status='uncertain';r.error='Submission outcome needs reconciliation with Stripe before another refund. '+(error as Error).message;saveStay(c,s)}});throw error}
 await deliverGuestMessages(env);return (await stay(env.DB,id)).refunds!.find(r=>r.id===refundId)
}
async function acceptRefund(env:Bindings,id:string,refundId:string,p:any){
 return mutate(env.DB,DIRECT_SYSTEM,'direct.refund.provider-result',async c=>{
  const s=await stay(c.db,id),r=s.refunds!.find(r=>r.id===refundId)!
  need(p.id&&p.payment_intent===r.paymentId&&p.amount===r.amounts.totalCents&&p.currency==='usd'&&p.metadata?.cabinRefundId===r.id&&p.metadata?.stayId===s.id,'Stripe refund does not match the exact approved settlement',409)
  if(r.status==='succeeded')return r
  need(['requested','pending','uncertain'].includes(r.status),'Refund is not awaiting provider reconciliation',409)
  r.providerId=p.id;r.providerStatus=p.status
  if(p.status==='succeeded'){
   r.status='succeeded';r.completedAt=c.now;delete r.error;await refundLedger(c,s,r);refundReceipt(c,s,r)
   if(['rent','full'].includes(r.kind)){const b=c.data.bookings.find(b=>b.id===s.bookingId);if(b?.lifecycle?.price&&!b.lifecycle.outcome){const price=b.lifecycle.price;price.rentCents=Math.max(0,price.rentCents-r.amounts.rentCents);price.feesCents=Math.max(0,price.feesCents-r.amounts.feesCents);price.taxCents=Math.max(0,price.taxCents-r.amounts.taxes.reduce((n,t)=>n+t.amountCents,0));price.totalCents=price.rentCents+price.feesCents+price.taxCents;b.revision=newId()}}
  }else if(['failed','canceled'].includes(p.status)){r.status='failed';r.error='Stripe did not complete this refund. Review the provider outcome before preparing a new plan.'}
  else r.status='pending'
  saveStay(c,s);return r
 })
}
export async function reconcileRefund(env:Bindings,id:string,refundId:string){
 const s=await stay(env.DB,id),r=s.refunds?.find(r=>r.id===refundId);need(r,'Refund not found',404)
 if(s.restored||!['requested','pending','uncertain'].includes(r.status))return r
 const p=r.providerId?await readRefund(paymentEnv(env,s),r.providerId):(await paymentRefunds(paymentEnv(env,s),r.paymentId)).find(p=>p.metadata?.cabinRefundId===r.id)
 if(p)await acceptRefund(env,id,refundId,p)
 // An absent result is not proof that the interrupted request was never submitted. Leave it for human reconciliation.
 await deliverGuestMessages(env);return r
}
export async function reconcileRefunds(env:Bindings,id:string){const s=await stay(env.DB,id);for(const r of s.refunds??[])if(['requested','pending','uncertain'].includes(r.status))await reconcileRefund(env,id,r.id)}
