import type { Bindings } from '../../auth.server'
import { need,type Actor } from '../model'
import { load,mutate } from '../storage'
import { h } from '../ui/shared'
import { shell } from '../direct/public-ui'
import { cases,verificationOf,saveVerification,resolved } from './records'
import { startVerification,reconcileVerification } from './provider'
import type { VerificationCase,VerificationData } from './types'
const consent=(method:'stripe'|'manual')=>`<label class="check"><input type="checkbox" name="consent" value="yes" required>${method==='stripe'?'I consent to Stripe Identity checking my identity. Stripe receives my identity documents; Cabin keeps only the outcome and provider reference.':'I request human identity review and consent to the assigned manager checking my identity directly. I will not upload or email identity documents to Cabin.'}</label>`
const post=(base:string,method:string,body:string,label:string)=>`<form method="post" action="${h(base+'/'+method)}">${body}<button type="submit">${h(label)}</button></form>`
export function verificationGuestPanel(data:VerificationData,bookingId:string){const v=verificationOf(data,bookingId);return !v||!v.token?'':`<section class="panel"><h2>Identity check</h2><p>${resolved(v)?'Identity requirement complete.':v.status==='rejected'?'Your identity review was declined. Contact your host.':v.status==='manual_requested'?'Your assigned manager will contact you for manual identity review.':'Your host requires an identity check under the saved reservation policy.'}</p><p>${v.policy.blockAccess&&!resolved(v)?'Door access waits for completion.':''}</p><a class="button" href="/book/verification/${h(v.token)}">${resolved(v)?'View identity status':'Complete identity check or request manual review'}</a></section>`}
function page(v:VerificationCase,notice=''){const base='/book/verification/'+v.token;return shell('Your identity check',`<h1>Your identity check</h1>${notice?`<p class="notice">${h(notice)}</p>`:''}<p>Status: ${h(v.status.replaceAll('_',' '))}.</p><p>${v.policy.blockAccess&&!resolved(v)?'Your door code and access instructions remain withheld until this required check is resolved.':'Access follows the policy saved for your reservation.'}</p><p>Cabin does not collect ID images or document numbers. Necessary verification state and the Stripe reference are kept until ${h(v.retainUntil.slice(0,10))}, then removed; Stripe redaction is tracked separately.</p>${!resolved(v)&&v.status!=='rejected'?`${post(base,'stripe',consent('stripe'),'Continue with Stripe Identity')}${post(base,'manual',consent('manual'),'Request manual review')}<p>The assigned manager handles the manual alternative. Contact your host directly to arrange it; do not send ID images through the guest inbox.</p>`:''}${post(base,'refresh','','Refresh verification status')}`)}
export async function verificationResponse(request:Request,env:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/book\/verification\/([a-f0-9-]{72})(?:\/(stripe|manual|refresh))?$/);if(!match)return null
 try{
  need(url.origin===env.AUTH_ORIGIN,'Wrong application origin',403);need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  let data=await load(env.DB),v=cases(data).find(v=>v.token===match[1]);need(v&&v.status!=='erased','Verification link expired',404)
  const booking=data.bookings.find(b=>b.id===v!.bookingId);need(booking&&booking.status==='confirmed'&&!booking.guestErasedAt&&Date.parse(v.retainUntil)>Date.now(),'Verification link expired',404)
  const actor:Actor={id:'guest:'+v.bookingId,email:'',role:'system',isAgent:false,operatorVersion:0}
  if(request.method==='POST'){
   need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
   need(Number(request.headers.get('content-length')??0)<=2048,'Request too large',413);const body=await request.text();need(body.length<=2048,'Request too large',413);const input=new URLSearchParams(body)
   need(match[2],'Not found',404)
   if(match[2]==='stripe'||match[2]==='manual'){
    need(input.get('consent')==='yes','Explicit consent is required');need(!resolved(v)&&v.status!=='rejected','This check already has a final outcome',409)
    v=await mutate(env.DB,actor,'guest.verification.consent',c=>{const row=cases(c.data).find(r=>r.id===v!.id)!;need(row.token===match[1]&&row.status!=='erased'&&!resolved(row)&&row.status!=='rejected','Verification changed',409);row.consentAt=c.now;row.consentMethod=match[2]==='manual'?'manual':'stripe';if(match[2]==='manual')row.status='manual_requested';row.history.push({at:c.now,by:actor.id,action:match[2]==='manual'?'Guest requested manual review':'Guest consented to Stripe Identity'});saveVerification(c,row);return row})
    if(match[2]==='stripe'){
     const result=await startVerification(env,v)
     await mutate(env.DB,actor,'guest.verification.started',c=>{const row=cases(c.data).find(r=>r.id===v!.id)!;need(row.status!=='erased'&&row.consentMethod==='stripe','Verification changed',409);row.provider=result.provider;row.status='requires_input';saveVerification(c,row)})
     return new Response(null,{status:303,headers:{location:result.url,'cache-control':'no-store','referrer-policy':'no-referrer'}})
    }
   }else await mutate(env.DB,actor,'guest.verification.refreshed',async c=>{const row=cases(c.data).find(r=>r.id===v!.id)!;await reconcileVerification(env,c,row)})
   data=await load(env.DB);v=cases(data).find(r=>r.id===v!.id)!
  }
  return page(v)
 }catch(error){const status=Number((error as any)?.status)||500;return shell('Identity check needs attention',`<h1>Identity check needs attention</h1><p>${h(status<500?(error as Error).message:'The provider could not complete this step. Your host can arrange manual review. Nothing has been approved.')}</p><a href="/book/verification/${h(match[1])}">Return to identity check</a>`,status)}
}
