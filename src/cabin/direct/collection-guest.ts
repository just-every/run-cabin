import type { Bindings } from '../../auth.server'
import { need,text,newId,sha,type Context } from '../model'
import { mutate } from '../storage'
import { DIRECT_SYSTEM } from './store'
import { collectionPlans,saveCollection,publicCollection } from './collection-store'
import { collectionBasis } from './collection-sync'
import { setupCollection,readCollectionSetup } from './collection-provider'
import { runCollection } from './collections'
import type { PortalContext } from '../portal/auth'
import { portalShell } from '../portal/shell'
import { h,money,hidden,field } from '../ui/shared'
import { timeLabel } from './presentation'
import { queuedAuthority } from '../permissions/commands'
export async function collectionGuest(request:Request,env:Bindings,portal:PortalContext,authorize:(c:Context)=>void){
 const path='/stay/'+portal.link.token+'/payments'
 let p=(await collectionPlans(env.DB)).find(p=>p.bookingId===portal.booking.id)
 need(p&&!p.restored&&p.status!=='cancelled','Payment schedule unavailable',404)
 const stripeEnv={...env,CABIN_PROVIDER_PROPERTY_ID:p.propertyId,DIRECT_STRIPE_MODE:p.mode}
 if(request.method==='POST'){
  need(Number(request.headers.get('content-length')??0)<=8000,'Request too large',413)
  const raw=await request.text();need(raw.length<=8000,'Request too large',413)
  const input:Record<string,unknown>=request.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw))
  need(input.action==='consent'||input.action==='refresh','Unknown payment action')
  if(input.action==='consent'){
   need(input.consent==='yes'&&text(input.signature,'full guest signature',120)===portal.booking.guestName,'Sign with your full reservation name and explicitly authorize the saved schedule')
   p=await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.consent',async c=>{
    authorize(c);const current=(await collectionPlans(c.db)).find(v=>v.id===p!.id)!,b=c.data.bookings.find(b=>b.id===current.bookingId)!
    need(current.revision===input.revision&&current.status==='consent_required'&&!current.jobs.some(j=>['uncertain','pending'].includes(j.status))&&JSON.stringify(collectionBasis(b))===JSON.stringify(current.basis),'Schedule changed or a charge is pending. Review before signing.',409)
    need(await queuedAuthority(c.db,current.authority,'direct.collection.create',current.propertyId),'Host collection permission changed',403)
    need(current.jobs.filter(j=>j.status!=='suppressed').reduce((n,j)=>n+j.amountCents,0)===current.basis.totalCents,'Price changed. The host must reconcile this schedule before a new mandate.',409)
    current.consent={at:c.now,signature:String(input.signature),digest:await sha(JSON.stringify({basis:current.basis,policy:current.policy,jobs:current.jobs.map(j=>({id:j.id,amountCents:j.amountCents,dueAt:j.dueAt}))}))}
    current.setup={attempt:newId(),at:c.now};saveCollection(c,current);return current
   })
   const result=await setupCollection(stripeEnv,p,env.AUTH_ORIGIN,path)
   need(result.id&&typeof result.url==='string'&&new URL(result.url).origin==='https://checkout.stripe.com','Stripe did not return a secure card setup page',502)
   await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.setup.ready',async c=>{authorize(c);const current=(await collectionPlans(c.db)).find(v=>v.id===p!.id)!;need(current.revision===p!.revision,'Schedule changed during Stripe setup',409);current.setup={...current.setup!,id:result.id,url:result.url};saveCollection(c,current)})
   return new Response(null,{status:303,headers:{location:result.url,'cache-control':'no-store','referrer-policy':'no-referrer'}})
  }
  if(p.setup?.id){
   const session=await readCollectionSetup(stripeEnv,p.setup.id),si=session.setup_intent
   if(session.status==='complete'){
    need(si&&typeof si==='object'&&si.status==='succeeded'&&si.metadata?.collectionPlanId===p.id&&session.metadata?.collectionPlanId===p.id,'Stripe setup does not match this schedule',409)
    const customer=typeof si.customer==='string'?si.customer:si.customer?.id,method=typeof si.payment_method==='string'?si.payment_method:si.payment_method?.id
    need(customer&&method,'Stripe did not return a vaulted customer and payment method',409)
    await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.mandate.ready',async c=>{authorize(c);const current=(await collectionPlans(c.db)).find(v=>v.id===p!.id)!;need(current.revision===p!.revision&&current.consent&&current.status==='consent_required'&&current.setup?.id===session.id,'Schedule changed during setup readback',409);current.customerId=customer;current.paymentMethod=method;current.status='active';delete current.setup;current.history.push({at:c.now,detail:'Stripe confirmed the guest-approved saved-card mandate.'});saveCollection(c,current)})
   }
  }
  await runCollection(env,p.id)
  return new Response(null,{status:303,headers:{location:path,'cache-control':'no-store'}})
 }
 const safe=publicCollection(p)
 if(request.headers.get('accept')?.includes('application/json'))return Response.json(safe,{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
 const list=p.jobs.map(j=>`<li><strong>${h(j.label)}: ${h(money(j.amountCents))}</strong> · due ${h(timeLabel(j.dueAt,'UTC'))} · ${h(j.status)}${j.detail?`<p>${h(j.detail)}</p>`:''}</li>`).join('')
 return portalShell('Your reservation',`<section class="panel"><h1>Your payment schedule</h1><p>${h(p.basis.start)} to ${h(p.basis.end)} · ${h(money(p.basis.totalCents))} total.</p><p>${h(p.policy)}</p><p>${p.mode==='test'?'Stripe test mode; no real money moves.':'Stripe live mode; these collections charge real money.'}</p><ul>${list}</ul>${p.status==='consent_required'&&!p.setup?`<form method="post">${hidden('action','consent')}${hidden('revision',p.revision)}${field('signature','Full guest signature')}<label class="check"><input type="checkbox" name="consent" value="yes" required>I authorize Stripe to save my card and collect only the exact amounts and due dates above. Changed stay terms require my approval again.</label><button>Authorize schedule and open Stripe</button></form>`:''}${p.setup?.url?`<a href="${h(p.setup.url)}" rel="noreferrer">Complete secure card setup on Stripe</a>`:''}<form method="post">${hidden('action','refresh')}<button>Check Stripe setup and payments</button></form><p><a href="/stay/${h(portal.link.token)}">Return to your stay</a></p></section>`)
}
