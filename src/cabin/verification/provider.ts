import type { Bindings } from '../../auth.server'
import { need,type Context } from '../model'
import { stripe,stripeCredentials,readIdentity } from '../direct/stripe'
import { saveVerification } from './records'
import type { VerificationCase } from './types'
export async function startVerification(env:Bindings,v:VerificationCase){
 const mode=v.provider?.mode??(await stripeCredentials(env)).mode,providerEnv={...env,DIRECT_STRIPE_MODE:mode}
 if(v.provider){const current=await readIdentity(providerEnv,v.provider.id);need(current.status!=='verified','Identity verification is already complete',409);if(current.url)return {url:current.url,provider:{id:current.id,status:current.status,mode}}}
 const result=await stripe(providerEnv,'/identity/verification_sessions','POST',{type:'document',client_reference_id:v.id,'metadata[bookingId]':v.bookingId,return_url:env.AUTH_ORIGIN+'/book/verification/'+v.token},'cabin:verification:'+v.id)
 need(typeof result.id==='string'&&typeof result.url==='string','Stripe did not return a verification link',502)
 return {url:result.url,provider:{id:result.id,status:result.status,mode}}
}
export async function reconcileVerification(env:Bindings,c:Context,v:VerificationCase){
 if(!v.provider||v.status==='erased'||v.redaction||v.status==='approved'||v.status==='rejected'||v.status==='manual_requested')return
 const result=await readIdentity({...env,DIRECT_STRIPE_MODE:v.provider.mode},v.provider.id),status=['verified','processing','requires_input'].includes(result.status)?result.status:'requires_input'
 if(v.provider.status===result.status&&v.status===status)return
 v.provider.status=String(result.status);v.status=status;delete v.error;v.history.push({at:c.now,by:'cabin:identity',action:'Stripe verification '+status});saveVerification(c,v)
}
