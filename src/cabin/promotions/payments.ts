import type { Bindings } from '../../auth.server'
import { type Actor,need,text,newId } from '../model'
import { mutate } from '../storage'
import { DIRECT_SYSTEM } from '../direct/store'
import { restorationPaused } from '../connections/guard'
import { stripe,stripeCredentials,CARD_ONLY,paymentRefunds,createRefund,readRefund } from '../direct/stripe'
import { offer,promotionRows,savePromotion,publicOffer } from './store'
import { eligible } from './eligibility'
import { applyPromotion,unappliedPayment,refundLedger } from './settlement'
import { releaseHold } from './inventory'
import type { PromotionOffer } from './types'

const provider=(env:Bindings,o:PromotionOffer)=>({...env,CABIN_PROVIDER_PROPERTY_ID:o.propertyId,DIRECT_STRIPE_MODE:o.paymentMode})
async function snapshot(env:Bindings,id:string){const row=(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).find(o=>o.id===id);need(row,'Offer not found',404);return row}
/** A claim survives a crash before/after the HTTP response. An uncertain claim is read from Stripe, never resubmitted. */
export async function acceptPromotion(env:Bindings,id:string,token:string,p:Record<string,unknown>){
 const credentials=await stripeCredentials(env)
 const claimed=await mutate(env.DB,DIRECT_SYSTEM,'promotion.accept',async c=>{
  const o=await offer(c,id);need(o.status==='sent'&&!o.checkoutRequestedAt,'This offer is already accepted or awaiting provider reconciliation',409)
  const {b}=await eligible(c,o);need(!o.cancelReason,'This offer was withdrawn',409)
  need(p.consent==='yes'&&text(p.signature,'full-name signature',120)===(b.guestName??b.summary),'Sign your full name and accept the exact supplemental terms')
  o.signature={name:String(p.signature).trim(),at:c.now,terms:o.terms};o.paymentMode=credentials.mode;o.status='checkout';o.checkoutRequestedAt=c.now;savePromotion(c,'promotionOffers',o);return o
 })
 try{
  const expires=Math.floor(Math.min(Date.parse(claimed.expiresAt),Date.now()+3600000)/1000)
  need(expires*1000>Date.now()+30*60000,'This offer is too close to expiry to open checkout',409)
  const session=await stripe(provider(env,claimed),'/checkout/sessions','POST',{
   mode:'payment',...CARD_ONLY,client_reference_id:claimed.id,customer_email:claimed.email,
   'metadata[purpose]':'cabin_promotion','metadata[promotionId]':claimed.id,'metadata[bookingId]':claimed.bookingId,
   'payment_intent_data[metadata][promotionId]':claimed.id,'payment_intent_data[metadata][bookingId]':claimed.bookingId,
   'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(claimed.amountCents),
   'line_items[0][price_data][product_data][name]':claimed.title,'line_items[0][quantity]':'1',expires_at:String(expires),
   success_url:env.AUTH_ORIGIN+'/offers/'+token+'?returned=1',cancel_url:env.AUTH_ORIGIN+'/offers/'+token,
  },'cabin:promotion:checkout:'+claimed.id)
  need(typeof session.id==='string'&&typeof session.url==='string'&&session.url.startsWith('https://checkout.stripe.com/'),'Stripe did not return a secure checkout',502)
  await saveSession(env,id,session);return session.url as string
 }catch(error){await mutate(env.DB,DIRECT_SYSTEM,'promotion.checkout.uncertain',async c=>{const o=await offer(c,id);o.error='Checkout submission needs provider reconciliation. '+(error as Error).message;savePromotion(c,'promotionOffers',o)});throw error}
}
async function saveSession(env:Bindings,id:string,s:any){return mutate(env.DB,DIRECT_SYSTEM,'promotion.checkout.ready',async c=>{const o=await offer(c,id);need(!o.checkoutId||o.checkoutId===s.id,'A different checkout is already recorded',409);o.checkoutId=s.id;o.checkoutUrl=s.url;delete o.error;savePromotion(c,'promotionOffers',o)})}
async function findCheckout(env:Bindings,o:PromotionOffer){
 if(o.checkoutId)return stripe(provider(env,o),'/checkout/sessions/'+o.checkoutId,'GET',{'expand[0]':'payment_intent'})
 need(o.checkoutRequestedAt,'This offer has no checkout request',409)
 let after=''
 for(;;){
  const page=await stripe(provider(env,o),'/checkout/sessions','GET',{limit:'100','created[gte]':String(Math.floor(Date.parse(o.checkoutRequestedAt)/1000)-60),...(after?{starting_after:after}:{}),'expand[0]':'data.payment_intent'})
  need(Array.isArray(page.data),'Stripe returned an invalid checkout list',502)
  const matches=page.data.filter((s:any)=>s.metadata?.promotionId===o.id);need(matches.length<=1,'Multiple processor sessions need human reconciliation',409)
  if(matches[0])return matches[0]
  if(!page.has_more)return null
  need(page.data.length&&page.data.at(-1).id!==after,'Stripe pagination did not advance',502);after=page.data.at(-1).id
 }
}
export async function reconcilePromotion(env:Bindings,id:string){
 let o=await snapshot(env,id)
 need(!o.restorePaused,'Restored offer history cannot call payment providers',409)
 if(o.status==='refund_due'&&o.refund&&['requested','pending','uncertain'].includes(o.refund.status))return reconcileRefund(env,o)
 if(o.status!=='checkout')return publicOffer(o)
 let s=await findCheckout(env,o)
 if(!s)return {message:'No provider outcome found. This request remains uncertain; its hold has not been released.'}
 if(!o.checkoutId){await saveSession(env,id,s);o=await snapshot(env,id)}
 if(s.status==='open'&&(o.cancelReason||Date.parse(o.expiresAt)<=Date.now())){
  await stripe(provider(env,o),'/checkout/sessions/'+s.id+'/expire','POST',{},'cabin:promotion:expire:'+o.id)
  s=await stripe(provider(env,o),'/checkout/sessions/'+s.id,'GET',{'expand[0]':'payment_intent'})
 }
 if(s.payment_status==='paid'){
  const pi=s.payment_intent
  need(s.metadata?.promotionId===o.id&&s.metadata?.bookingId===o.bookingId&&s.amount_total===o.amountCents&&s.currency==='usd'&&pi&&typeof pi==='object'&&pi.status==='succeeded'&&pi.amount_received===o.amountCents&&pi.currency==='usd','Processor payment does not match the signed supplement',409)
  await mutate(env.DB,DIRECT_SYSTEM,'promotion.payment.applied',async c=>{
   const current=await offer(c,id);if(current.paymentId){need(current.paymentId===pi.id,'Another payment is already recorded',409);return}
   current.paymentId=pi.id;current.paidAt=c.now
   // Eligibility is checked for the third time after payment, so a race never grants an unavailable service.
   let failure:string|undefined
   try{need(!current.cancelReason,'This offer was withdrawn',409);await eligible(c,current)}catch(error){failure=(error as Error).message}
   if(failure){await unappliedPayment(c,current);releaseHold(c,current);current.status='refund_due';current.refund={amountCents:current.amountCents,retainedCents:0,reason:'Service could not be applied: '+failure,status:'due'};current.error=failure}
   else await applyPromotion(c,current)
   savePromotion(c,'promotionOffers',current)
  })
 }else if(s.status==='expired')await mutate(env.DB,DIRECT_SYSTEM,'promotion.checkout.expired',async c=>{const current=await offer(c,id);need(!current.paymentId,'A paid offer cannot expire',409);current.status=current.cancelReason?'cancelled':'expired';releaseHold(c,current);savePromotion(c,'promotionOffers',current)})
 return publicOffer(await snapshot(env,id))
}
export async function refundPromotion(env:Bindings,actor:Actor,p:Record<string,unknown>){
 const id=text(p.id,'offer'),before=await snapshot(env,id)
 need(before.paymentId&&!before.restorePaused,'A current processor-paid supplement is required',409)
 const prior=await paymentRefunds(provider(env,before),before.paymentId)
 need(!prior.length,'Stripe already has a refund for this payment. Reconcile its existing outcome before approving another.',409)
 const claimed=await mutate(env.DB,actor,'promotion.refund.request',async c=>{
  const o=await offer(c,id);need(o.status==='refund_due'&&o.refund&&o.refund.status==='due'&&o.revision===p.revision&&p.confirm==='yes','Review and approve the exact saved refund',409)
  need(!o.restorePaused,'Restored offer history cannot issue refunds',409)
  need(o.paymentId,'No processor payment is recorded',409)
  o.refund.requestedAt=c.now;o.refund.status='requested';savePromotion(c,'promotionOffers',o);return o
 })
 if(!claimed.refund!.amountCents)return mutate(env.DB,actor,'promotion.refund.retained',async c=>{const o=await offer(c,id);o.status='refunded';o.refund!.status='succeeded';o.refund!.completedAt=c.now;savePromotion(c,'promotionOffers',o);return publicOffer(o)})
 try{const result=await createRefund(provider(env,claimed),{id:claimed.id,stayId:'promotion:'+claimed.id,paymentId:claimed.paymentId!,amountCents:claimed.refund!.amountCents});await acceptRefund(env,id,result)}
 catch(error){await mutate(env.DB,DIRECT_SYSTEM,'promotion.refund.uncertain',async c=>{const o=await offer(c,id);if(o.refund!.status!=='succeeded'){o.refund!.status='uncertain';o.error='Refund submission needs provider reconciliation';savePromotion(c,'promotionOffers',o)}});throw error}
 return publicOffer(await snapshot(env,id))
}
async function acceptRefund(env:Bindings,id:string,result:any){
 return mutate(env.DB,DIRECT_SYSTEM,'promotion.refund.result',async c=>{
  const o=await offer(c,id),r=o.refund;need(r&&result.id&&result.payment_intent===o.paymentId&&result.amount===r.amountCents&&result.currency==='usd'&&result.metadata?.cabinRefundId===o.id&&result.metadata?.stayId==='promotion:'+o.id,'Processor refund does not match the approved supplement',409)
  if(r.status==='succeeded')return
  r.providerId=result.id
  if(result.status==='succeeded'){await refundLedger(c,o);r.status='succeeded';r.completedAt=c.now;o.status='refunded';delete o.error}
  else r.status=['failed','canceled'].includes(result.status)?'failed':'pending'
  savePromotion(c,'promotionOffers',o)
 })
}
async function reconcileRefund(env:Bindings,o:PromotionOffer){
 const r=o.refund!,result=r.providerId?await readRefund(provider(env,o),r.providerId):(await paymentRefunds(provider(env,o),o.paymentId!)).find(r=>r.metadata?.cabinRefundId===o.id)
 if(result)await acceptRefund(env,o.id,result)
 return publicOffer(await snapshot(env,o.id))
}
/** Invoked by the scheduled worker; interrupted requests only read their provider outcomes. */
export async function promotionDue(env:Bindings){
 if(await restorationPaused(env.DB))return
 await mutate(env.DB,DIRECT_SYSTEM,'promotion.expiry.sweep',()=>undefined,()=>false)
 for(const o of await promotionRows<PromotionOffer>(env.DB,'promotionOffers'))if(!o.restorePaused&&(o.status==='checkout'||o.status==='refund_due'&&o.refund&&['requested','pending','uncertain'].includes(o.refund.status)))await reconcilePromotion(env,o.id)
}
