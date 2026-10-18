import type { Bindings } from '../../auth.server'
import { query,type Context } from '../model'
import { mutate,SYSTEM } from '../storage'
import { stripe,readIdentity } from '../direct/stripe'
import { cases,loadVerifications,saveVerification } from './records'
import { reconcileVerification } from './provider'
/** Called inside guest/property erasure before the normal transaction commits. References remain private only until provider redaction finishes. */
export async function eraseVerification(c:Context,bookingIds:Set<string>){for(const v of cases(c.data))if(bookingIds.has(v.bookingId)){
 v.status='erased';v.token=null;v.reasons=[];delete v.consentAt;delete v.consentMethod;delete v.decision;delete v.error;v.history=[];if(v.provider)v.redaction='pending';saveVerification(c,v)
}for(const id of bookingIds)c.queries.push(query("UPDATE cb_direct_stays SET data = json_remove(data,'$.identity') WHERE json_extract(data,'$.bookingId')=?",id))}
export async function verificationDue(env:Bindings){
 for(const snapshot of (await loadVerifications(env.DB)).filter(v=>v.status==='erased'?!!v.provider:Date.parse(v.retainUntil)<=Date.now()||!!v.provider&&!['verified','approved','rejected','manual_requested'].includes(v.status)).slice(0,100))try{
  await mutate(env.DB,SYSTEM,'verification.reconciled',async c=>{
   const v=cases(c.data).find(v=>v.id===snapshot.id);if(!v)return
   const booking=c.data.bookings.find(b=>b.id===v.bookingId)
   if(!booking||booking.guestErasedAt||Date.parse(v.retainUntil)<=Date.now()){
    if(v.status!=='erased')await eraseVerification(c,new Set([v.bookingId]))
    if(v.provider){
     const providerEnv={...env,DIRECT_STRIPE_MODE:v.provider.mode},result=v.redaction==='processing'?await readIdentity(providerEnv,v.provider.id):await stripe(providerEnv,'/identity/verification_sessions/'+v.provider.id+'/redact','POST',{},'cabin:verification:redact:'+v.id)
     if(result.redaction?.status==='redacted'){delete v.provider;v.redaction='complete'}else v.redaction='processing'
     saveVerification(c,v)
    }
   }else await reconcileVerification(env,c,v)
  })
 }catch{await mutate(env.DB,SYSTEM,'verification.provider.uncertain',c=>{const v=cases(c.data).find(v=>v.id===snapshot.id);if(v){v.error='Verification provider outcome is uncertain. Refresh after checking Stripe; access remains governed by the saved policy.';saveVerification(c,v)}})}
}
