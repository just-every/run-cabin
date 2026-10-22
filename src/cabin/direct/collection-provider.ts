import { stripe,CARD_ONLY,type StripeEnv } from './stripe'
import type { CollectionPlan,CollectionJob,CollectionAttempt } from './collection-types'
const key=(p:CollectionPlan,a:string)=>'cabin:collection:'+p.id+':'+a
export function setupCollection(env:StripeEnv,p:CollectionPlan,origin:string,path:string){
 return stripe(env,'/checkout/sessions','POST',{mode:'setup',customer_creation:'always',customer_email:p.basis.email,...CARD_ONLY,
  'metadata[collectionPlanId]':p.id,'setup_intent_data[metadata][collectionPlanId]':p.id,
  success_url:origin+path,cancel_url:origin+path},key(p,p.setup!.attempt))
}
export const readCollectionSetup=(env:StripeEnv,id:string)=>stripe(env,'/checkout/sessions/'+id,'GET',{'expand[0]':'setup_intent'})
export function chargeCollection(env:StripeEnv,p:CollectionPlan,j:CollectionJob,a:CollectionAttempt){
 return stripe(env,'/payment_intents','POST',{amount:String(j.amountCents),currency:'usd',customer:p.customerId!,payment_method:p.paymentMethod!,off_session:'true',confirm:'true',...CARD_ONLY,
  'metadata[collectionPlanId]':p.id,'metadata[collectionJobId]':j.id,'metadata[collectionAttemptId]':a.id},key(p,a.id))
}
/** Exhaust all customer pages; an empty read is never permission to issue another charge. */
export async function findCollectionPayment(env:StripeEnv,p:CollectionPlan,a:CollectionAttempt){
 if(a.providerId)return stripe(env,'/payment_intents/'+a.providerId)
 let after='';const hits:any[]=[]
 for(;;){const page=await stripe(env,'/payment_intents','GET',{customer:p.customerId!,limit:'100',...(after?{starting_after:after}:{})});if(!Array.isArray(page.data))throw Object.assign(new Error('Stripe collection read is unavailable'),{status:502});hits.push(...page.data.filter((v:any)=>v.metadata?.collectionPlanId===p.id&&v.metadata?.collectionAttemptId===a.id));if(!page.has_more)break;if(!page.data.length||page.data.at(-1).id===after)throw Object.assign(new Error('Stripe collection pagination did not advance'),{status:502});after=page.data.at(-1).id}
 if(hits.length>1)throw Object.assign(new Error('Multiple provider payments match this attempt. Review Stripe before any new collection.'),{status:409})
 return hits[0]??null
}
