import type { Bindings } from '../../auth.server'
import { integer,manager,need,newId,text,type Actor,type Context,type GuestMessage } from '../model'
import { mutate,assertLive } from '../storage'
import { restorationPaused } from '../connections/guard'
import { queuedAuthority } from '../permissions/commands'
import { hasAction,permitsProperty } from '../permissions/policy'
import { decimalUnits } from './presentation'
import { DIRECT_SYSTEM } from './store'
import { collectionPlans,saveCollection,collectionOutput } from './collection-store'
import { collectionBasis,collectionDue } from './collection-sync'
import { chargeCollection,findCollectionPayment } from './collection-provider'
import { post } from '../ledger/store'
import { debit,credit } from '../ledger/types'
import type { CollectionPlan,CollectionJob,CollectionAttempt } from './collection-types'
const envFor=(env:Bindings,p:CollectionPlan)=>({...env,CABIN_PROVIDER_PROPERTY_ID:p.propertyId,DIRECT_STRIPE_MODE:p.mode})
const plan=async(db:D1Database,id:string)=>{const p=(await collectionPlans(db)).find(p=>p.id===id);need(p,'Collection schedule not found',404);return p}
const owns=(actor:Actor,p:CollectionPlan)=>need(permitsProperty(actor,p.propertyId),'Collection schedule not found',404)
export async function collectionCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 if(!name.startsWith('direct.collection.'))return undefined
 manager(actor);need(!actor.isAgent&&hasAction(actor,name),'Human payment authority required',403);await assertLive(env.DB,actor)
 if(name==='direct.collection.create'){
  const mode=input.mode??'test';need(mode==='test'||mode==='live','Choose Stripe test or live mode');if(mode==='live')need(input.liveConsent==='yes','Confirm this schedule will charge real money')
  return mutate(env.DB,actor,name,async c=>{
   const b=c.data.bookings.find(b=>b.id===input.bookingId);need(b&&permitsProperty(actor,b.propertyId),'Reservation not found',404)
   need(b.channel==='direct'&&b.source!=='feed','Channel-collected reservations require their dedicated payment connection',409)
   need(b.status==='confirmed'&&!b.guestErasedAt&&!b.restorePaused&&b.lifecycle?.price&&b.lifecycle.policy.known,'Choose a current priced reservation with a saved cancellation policy',409)
   need(!await c.db.prepare("SELECT 1 FROM cb_direct_stays WHERE json_extract(data,'$.bookingId')=?").bind(b.id).first(),'This direct checkout has its own payment. Do not collect it again.',409)
   need(!(await collectionPlans(c.db)).some(p=>p.bookingId===b.id),'This reservation already has a collection schedule',409)
   const basis=collectionBasis(b);need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basis.email)&&basis.totalCents>0,'Save the guest email and positive reservation price first')
   let assigneeId=text(input.assigneeId,'payment follow-up owner'),member=c.data.members.find(m=>m.id===assigneeId&&m.active&&m.role==='manager')
   if(assigneeId===actor.id&&actor.memberId)assigneeId=actor.memberId
   need(assigneeId===actor.memberId||assigneeId===actor.id||member&&(!member.scope||member.scope.propertyIds.some(id=>id==='*'||id===b.propertyId)),'Choose yourself or an active manager for this home')
   const existing=await import('../reservations/balances');const balance=await existing.paymentBalance(c,b);need(balance.paidCents===0,'Existing payments must be reconciled before creating a new schedule',409)
   const deposit=integer(('depositDollars'in input?decimalUnits(input.depositDollars,'deposit'):Number(input.depositCents)),'Deposit in cents',1,basis.totalCents),installment=integer(('installmentDollars'in input?decimalUnits(input.installmentDollars,'installment'):Number(input.installmentCents??0)),'Installment in cents',0,basis.totalCents-deposit),balanceCents=basis.totalCents-deposit-installment
   const installmentDays=integer(Number(input.installmentDays??30),'Installment lead days',0,730),balanceDays=integer(Number(input.balanceDays??7),'Balance lead days',0,730)
   need(!installment||installmentDays>=balanceDays,'Installment must fall before the balance')
   const createdAt=c.now,jobs:CollectionJob[]=[]
   const add=(label:string,amountCents:number,leadDays:number|null)=>{if(amountCents)jobs.push({id:newId(),label,amountCents,leadDays,dueAt:collectionDue(c,b,leadDays,c.now),status:'scheduled',attempts:[]})}
   add('Reservation deposit',deposit,null);add('Installment',installment,installmentDays);add('Pre-arrival balance',balanceCents,balanceDays)
   const p:CollectionPlan={id:newId(),revision:newId(),bookingId:b.id,propertyId:b.propertyId,createdAt,authority:structuredClone(actor),basis,mode,status:'consent_required',policy:b.lifecycle.policy.name,assigneeId,jobs,history:[{at:c.now,detail:'Exact guest consent and Stripe setup are required. No charge has been requested.'}]}
   saveCollection(c,p);return collectionOutput(p,actor)
  })
 }
 const prior=await plan(env.DB,text(input.id,'schedule'));owns(actor,prior)
 if(name==='direct.collection.refresh'){await runCollection(env,prior.id);return collectionOutput(await plan(env.DB,prior.id),actor)}
 if(name==='direct.collection.revise')return mutate(env.DB,actor,name,async c=>{
  const p=c.data.collectionPlans.find(v=>v.id===prior.id)!,b=c.data.bookings.find(v=>v.id===p.bookingId)
  need(p.revision===input.revision&&!p.restored&&b&&b.status==='confirmed'&&!b.cancelled&&!b.guestErasedAt&&!b.restorePaused,'Schedule changed or reservation ended',409)
  need(!p.jobs.some(j=>['uncertain','pending'].includes(j.status)),'Reconcile every started payment before changing the mandate',409)
  need(input.confirm==='yes','Confirm the changed schedule and new guest consent')
  const {paymentBalance}=await import('../reservations/balances'),balance=await paymentBalance(c,b),total=balance.balanceCents
  need(total!==null&&total>0,'No outstanding reservation balance remains',409)
  const deposit=integer(('depositDollars'in input?decimalUnits(input.depositDollars,'deposit'):Number(input.depositCents)),'Deposit cents',1,total),installment=integer(('installmentDollars'in input?decimalUnits(input.installmentDollars,'installment'):Number(input.installmentCents??0)),'Installment cents',0,total-deposit),installmentDays=integer(Number(input.installmentDays??30),'Installment lead days',0,730),balanceDays=integer(Number(input.balanceDays??7),'Balance lead days',0,730)
  need(!installment||installmentDays>=balanceDays,'Installment must fall before the balance')
  for(const j of p.jobs)if(j.status!=='succeeded'){closeFollowup(c,j);j.status='suppressed';j.detail='Superseded by a reviewed schedule; prior attempts retained.';delete j.deadline}
  const add=(label:string,amountCents:number,leadDays:number|null)=>{if(amountCents)p.jobs.push({id:newId(),label,amountCents,leadDays,dueAt:collectionDue(c,b,leadDays,c.now),status:'scheduled',attempts:[]})}
  add('Revised reservation deposit',deposit,null);add('Revised installment',installment,installmentDays);add('Revised pre-arrival balance',total-deposit-installment,balanceDays)
  p.basis=collectionBasis(b);p.policy=b.lifecycle!.policy.name;p.status='consent_required';delete p.consent;delete p.setup;delete p.customerId;delete p.paymentMethod;p.authority=structuredClone(actor)
  p.history.push({at:c.now,detail:'Human reviewed the remaining balance and requested a fresh exact guest mandate. Prior payments and attempts retained.'});saveCollection(c,p);return collectionOutput(p,actor)
 })

 need(name==='direct.collection.retry','Unknown collection command',404)
 const j=prior.jobs.find(j=>j.id===input.jobId),a=j?.attempts.at(-1)
 need(j&&a&&j.status==='failed'&&a.outcome==='failed','Only a provider-confirmed failed payment can be retried. Uncertain charges require reconciliation.',409)
 need(input.confirm==='yes','Confirm the reviewed retry');const reference=text(input.reference,'review and follow-up evidence',1000)
 const provider=await findCollectionPayment(envFor(env,prior),prior,a)
 need(provider&&['requires_payment_method','canceled'].includes(provider.status)&&provider.amount_received===0,'Stripe has not confirmed a safe failed outcome',409)
 return mutate(env.DB,actor,name,async c=>{const p=await plan(c.db,prior.id);need(p.revision===input.revision&&p.status==='active','Schedule changed. Reload and review.',409);const job=p.jobs.find(v=>v.id===j.id)!;need(job.status==='failed'&&job.attempts.at(-1)?.id===a.id,'Attempt changed',409);closeFollowup(c,job);delete job.followupNoticeId;delete job.overdueNoticeId;job.status='scheduled';job.resolvedAt=c.now;delete job.deadline;job.detail='Human reviewed Stripe failure and approved one new attempt: '+reference;p.authority=structuredClone(actor);p.history.push({at:c.now,detail:job.detail});saveCollection(c,p);return collectionOutput(p,actor)})
}
async function followup(c:Context,p:CollectionPlan,j:CollectionJob,detail:string,notify=true){
 if(j.detail!==detail)p.history.push({at:c.now,detail:j.label+': '+detail})
 j.detail=detail;j.deadline??=new Date(Date.parse(c.now)+24*3600000).toISOString()
 if(!notify)return
 const overdue=Date.parse(j.deadline)<=Date.parse(c.now),field=overdue?'overdueNoticeId':'followupNoticeId'
 if(j[field])return
 const member=c.data.members.find(m=>m.id===p.assigneeId&&m.active&&m.role==='manager'),owner=await c.db.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{id:string;email:string}>()
 const responsible=member??owner;need(responsible,'Restore the installation owner before following up payments',409)
 p.assigneeId=responsible.id;const id=newId();j[field]=id
 c.data.notices.push({id,revision:newId(),propertyId:p.propertyId,memberId:responsible.id,email:responsible.email,kind:'payment',recordId:p.id,subject:overdue?'Overdue reservation payment follow-up':'Reservation payment needs review',text:j.label+': '+detail+' Follow up by '+j.deadline+'. No automatic retry is authorized.',status:'pending',detail:null,createdAt:c.now,sentAt:null,...(overdue?{priority:'urgent' as const}:{})})
}
function closeFollowup(c:Context,j:CollectionJob){for(const id of [j.followupNoticeId,j.overdueNoticeId]){const n=c.data.notices.find(n=>n.id===id);if(n?.status==='pending'){n.status='suppressed';n.detail='Payment follow-up resolved before delivery';n.revision=newId()}}}

async function outcome(env:Bindings,pid:string,jid:string,aid:string,provider:any){
 return mutate(env.DB,DIRECT_SYSTEM,'direct.collection.outcome',async c=>{
  const p=await plan(c.db,pid),j=p.jobs.find(j=>j.id===jid)!,a=j.attempts.find(a=>a.id===aid)!;if(a.outcome==='succeeded')return
  need(provider?.id&&provider.currency==='usd'&&provider.amount===j.amountCents&&provider.metadata?.collectionPlanId===p.id&&provider.metadata?.collectionJobId===j.id&&provider.metadata?.collectionAttemptId===a.id,'Stripe payment does not match the exact collection attempt',409)
  a.providerId=provider.id
  if(provider.status==='succeeded'){
   need(provider.amount_received===j.amountCents,'Stripe amount received does not match the schedule',409);closeFollowup(c,j);a.outcome='succeeded';j.status='succeeded';j.resolvedAt=c.now;delete j.deadline;j.detail='Stripe confirmed this payment.'
   if(c.data.ledgerSettings.some(l=>l.propertyId===p.propertyId))await post(c,{sourceKey:'collection:'+a.id,sourceType:'payment',sourceId:provider.id,sourceRevision:a.id,propertyId:p.propertyId,bookingId:p.bookingId,effectiveDate:c.now.slice(0,10),lines:[debit('processorFunds',j.amountCents),credit('receivable',j.amountCents)]})
   if(!j.receiptId){const b=c.data.bookings.find(b=>b.id===p.bookingId);if(b?.guestEmail&&!b.guestErasedAt){const m:GuestMessage={id:newId(),revision:newId(),propertyId:p.propertyId,bookingId:p.bookingId,email:b.guestEmail,phone:null,ref:null,channel:'email',direction:'out',source:'scheduled',status:'pending',subject:'Your payment receipt',text:`Stripe confirmed USD ${(j.amountCents/100).toFixed(2)} for ${j.label}${p.mode==='test'?' in test mode; no real money moved':''}. Payment reference: ${provider.id}.`,detail:null,replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:null,grounds:['authorized reservation collection'],createdAt:c.now,sentAt:null};c.data.messages.push(m);j.receiptId=m.id}}
  }else if(['requires_payment_method','canceled'].includes(provider.status)){need(provider.amount_received===0,'Reconcile partially collected payment before retry',409);a.outcome='failed';j.status='failed';await followup(c,p,j,'Stripe confirmed no funds received. Contact the guest and review before retry.')}
  else {a.outcome='pending';j.status='pending';await followup(c,p,j,provider.status==='requires_action'?'Guest authentication required. No automatic retry.':'Stripe is still processing; reconcile before another attempt.')}
  saveCollection(c,p)
 })
}
/** Claim first; once an effect might have started, restart only reads the provider. */
export async function runCollection(env:Bindings,id:string){
 let p=await plan(env.DB,id);if(p.restored||await restorationPaused(env.DB))return
 for(const original of p.jobs){
  p=await plan(env.DB,id);let j=p.jobs.find(j=>j.id===original.id)!,a=j.attempts.at(-1)
  if(j.deadline&&Date.parse(j.deadline)<=Date.now()&&!j.overdueNoticeId)await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.overdue',async c=>{const current=c.data.collectionPlans.find(v=>v.id===p.id)!,job=current.jobs.find(v=>v.id===j.id)!;await followup(c,current,job,job.detail??'Payment follow-up is overdue.');saveCollection(c,current)})
  if(['uncertain','pending'].includes(j.status)&&a&&p.customerId){
   try{const result=await findCollectionPayment(envFor(env,p),p,a);if(result)await outcome(env,p.id,j.id,a.id,result)}catch{/* Preserve the visible uncertain attempt; never authorize another POST. */}
   continue
  }
  if(j.status!=='scheduled'||p.status!=='active'||Date.parse(j.dueAt)>Date.now())continue
  try{
   const claimed=await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.claim',async c=>{
    const current=await plan(c.db,id),job=current.jobs.find(v=>v.id===j.id)!,b=c.data.bookings.find(b=>b.id===current.bookingId)
    need(!current.restored&&current.status==='active'&&job.status==='scheduled'&&Date.parse(job.dueAt)<=Date.now()&&b&&b.status==='confirmed'&&!b.cancelled&&!b.guestErasedAt&&!b.restorePaused&&JSON.stringify(collectionBasis(b))===JSON.stringify(current.basis),'Collection schedule is no longer current',409)
    const {paymentBalance}=await import('../reservations/balances');const balance=await paymentBalance(c,b);need(balance.balanceCents!==null&&job.amountCents<=balance.balanceCents,'Recorded receipts changed the outstanding amount; review before collection.',409)
    need(current.consent&&current.customerId&&current.paymentMethod,'Guest payment mandate is missing',409)
    need(await queuedAuthority(c.db,current.authority,'direct.collection.create',current.propertyId),'Collection authority was revoked',403)
    const attempt:CollectionAttempt={id:newId(),at:c.now,outcome:'uncertain'};job.attempts.push(attempt);job.status='uncertain';await followup(c,current,job,'Provider outcome uncertain until reconciled; another charge is refused.',false);saveCollection(c,current);return current
   })
   j=claimed.jobs.find(v=>v.id===j.id)!;a=j.attempts.at(-1)!
   const result=await chargeCollection(envFor(env,claimed),claimed,j,a)
   await outcome(env,claimed.id,j.id,a.id,result)
  }catch(error){
   await mutate(env.DB,DIRECT_SYSTEM,'direct.collection.error',async c=>{const current=await plan(c.db,id),job=current.jobs.find(v=>v.id===j.id)!;await followup(c,current,job,(error as any)?.status?(error as Error).message:'Collection interrupted; reconcile provider outcome before retry.');saveCollection(c,current)})
  }
 }
}
export async function collectionDueJobs(env:Bindings){for(const p of await collectionPlans(env.DB))if(!p.restored)try{await runCollection(env,p.id)}catch{/* A failed family must not stop other independent jobs. */}}
