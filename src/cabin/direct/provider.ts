import type { Bindings } from '../../auth.server'
import { record, type AuditActor } from '../audit/write'
import { need,owner,text,newId,type Actor } from '../model'
import { managedInstall } from '../channels'
import { stripe,stripeCredentials,MANAGED_STRIPE_LINE,CARD_ONLY } from './stripe'
import { providerSettings,saveProvider,sealKey,type StripeMode } from './provider-store'
import { DIRECT_SYSTEM } from './store'
export async function providerState(env:Bindings){
 if(managedInstall(env))return {configured:false,mode:'test',managed:true}
 let saved=await providerSettings(env.DB)
 if(saved?.check?.status==='pending')try{await checkTest(env);saved=await providerSettings(env.DB)}catch{/* Page retains pending state; Check connection exposes the provider error. */}
 let credentials=null;try{credentials=await stripeCredentials(env)}catch{/* Re-entering the key is available on the page. */}
 return {configured:!!credentials,mode:saved?.mode??credentials?.mode??'test',source:saved?'page':'server',testConfigured:!!saved?.test||!!env.STRIPE_TEST_SECRET_KEY,liveConfigured:!!saved?.live||!!env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),checkedAt:saved?.[saved.mode]?.checkedAt,check:saved?.check}
}
export async function checkTest(env:Bindings){
 const saved=await providerSettings(env.DB);need(saved?.check,'Start a test checkout first',409)
 const session=await stripe({...env,DIRECT_STRIPE_MODE:'test'},'/checkout/sessions/'+saved.check.id,'GET',{'expand[0]':'payment_intent'})
 const pi=session.payment_intent
 if(session.payment_status==='paid')need(pi?.status==='succeeded'&&pi.amount_received===100&&pi.currency==='usd'&&session.metadata?.purpose==='cabin_connection_check','The test payment did not match this connection check',409)
 const status=session.payment_status==='paid'?'paid':session.status==='expired'?'expired':'pending'
 if(status!==saved.check.status)await saveProvider(env,DIRECT_SYSTEM,'direct.stripe.test.checked',row=>{if(row.check&&row.check.id===session.id)row.check.status=status})
 return {message:status==='paid'?'Stripe test charge succeeded: $1.00 in test money. Your connection can create and read a paid checkout.':status==='expired'?'The test checkout expired. Start another test checkout.':'The test checkout is awaiting payment. Open it below, then check again.'}
}
export async function providerCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 owner(actor)
 need(!managedInstall(env),MANAGED_STRIPE_LINE,409)
 if(name==='direct.stripe.save'){
  const mode=text(p.mode,'payment mode');need(mode==='test'||mode==='live','Choose test or live mode')
  const key=text(p.key,'Stripe secret key',500);need(new RegExp('^sk_'+mode+'_[A-Za-z0-9]+$').test(key),`Use an sk_${mode}_ secret key from Stripe’s API keys page`)
  if(mode==='live')need(p.liveConsent==='yes','Confirm that live mode charges real money')
  await stripe({...env,DIRECT_STRIPE_KEY:key,DIRECT_STRIPE_MODE:mode},'/balance')
  const keySealed=await sealKey(env,key)
  await saveProvider(env,actor,name,row=>{row.mode=mode as StripeMode;row[mode as StripeMode]={keySealed,checkedAt:new Date().toISOString()};if(mode==='test')delete row.check})
  return {message:`Stripe ${mode} key saved securely and connection checked.${mode==='live'?' New bookings charge real money.':' Run the $1 test checkout below to prove payment.'}`}
 }
 if(name==='direct.stripe.mode'){
  const mode=text(p.mode,'payment mode');need(mode==='test'||mode==='live','Choose test or live mode');if(mode==='live')need(p.liveConsent==='yes','Confirm that live mode charges real money')
  await stripe({...env,DIRECT_STRIPE_MODE:mode},'/balance');await saveProvider(env,actor,name,row=>{row.mode=mode});return {message:`New bookings now use Stripe ${mode} mode.`}
 }
 if(name==='direct.stripe.check'){await stripe(env,'/balance');const saved=await providerSettings(env.DB);return saved?.check?checkTest(env):{message:'Stripe accepted the connected key. Run the test checkout to check payment end to end.'}}
 if(name==='direct.stripe.test'){
  const saved=await providerSettings(env.DB)
  if(saved?.check?.status==='pending')return {url:saved.check.url}
  const id=newId()
  await record(env.DB,actor,'direct.stripe.test.request',{kind:'stripe-connection',id,revision:id,result:'pending'})
  let session:any
  try { session=await stripe({...env,DIRECT_STRIPE_MODE:'test'},'/checkout/sessions','POST',{
   mode:'payment',...CARD_ONLY,'metadata[purpose]':'cabin_connection_check',
   'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':'100',
   'line_items[0][price_data][product_data][name]':'Cabin connection check — test money only','line_items[0][quantity]':'1',
   success_url:env.AUTH_ORIGIN+(env.AUTH_LOCAL==='true'?'/book/stripe-check':'/app/direct?stripeCheck=returned'),cancel_url:env.AUTH_ORIGIN+'/app/direct',
  },'cabin:connection-check:'+id)
  need(typeof session.id==='string'&&typeof session.url==='string','Stripe did not return a test checkout',502)
  } catch(error) {
   await record(env.DB,actor,'direct.stripe.test.result',{kind:'stripe-connection',id,revision:id,result:'failed-or-uncertain'});throw error
  }
  await saveProvider(env,actor,name,row=>{row.check={id:session.id,url:session.url,status:'pending',at:new Date().toISOString()}})
  return {url:session.url}
 }
 need(false,'Unknown Stripe setup command',404)
}
