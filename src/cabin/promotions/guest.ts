import { shell } from '../direct/public-ui'
import { bookingSite } from '../website/store'
import { frame } from '../website/pages'
import type { Bindings } from '../../auth.server'
import { need,sha,type Context } from '../model'
import { load } from '../storage'
import { settle } from '../settle'
import { unseal } from '../seal'
import { h } from '../ui/shared'
import { promotionRows } from './store'
import { acceptPromotion,reconcilePromotion } from './payments'
import type { PromotionOffer } from './types'

const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'self'; script-src 'none'; base-uri 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'"}
async function input(request:Request){
 let source='',size=0;const reader=request.body?.getReader(),decoder=new TextDecoder()
 if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=8000,'Offer response is too large',413);source+=decoder.decode(value,{stream:true})}source+=decoder.decode()}finally{reader.releaseLock()}
 if(request.headers.get('content-type')?.includes('application/json'))return JSON.parse(source) as Record<string,unknown>
 return Object.fromEntries(new URLSearchParams(source))
}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
/** A private offer link is a scoped capability, never an operator session or a door-access capability. */
export async function promotionGuestResponse(request:Request,env:Bindings,authorize?:(c:Context)=>void,returnPath?:string){
 const path=new URL(request.url).pathname,token=path.match(/^\/offers\/([a-f0-9-]{72})$/)?.[1],wantsJson=request.headers.get('content-type')?.includes('application/json')||request.headers.get('accept')?.includes('application/json')
 try{
  const url=new URL(request.url),site=await bookingSite(env.DB);if(site?.domainVerified&&url.origin===site.origin)env={...env,AUTH_ORIGIN:url.origin}
  need(url.origin===env.AUTH_ORIGIN,'Wrong application origin',403)
  need(token&&['GET','POST'].includes(request.method),'Not found',404)
  const hash=await sha(token);let o=(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).find(o=>o.tokenHash===hash)
  need(o&&!o.restorePaused&&!['draft','expired','cancelled'].includes(o.status)&&Date.parse(o.expiresAt)>Date.now(),'This private offer has expired or was withdrawn',410)
  const b=(await load(env.DB)).bookings.find(b=>b.id===o!.bookingId)
  need(b&&!b.guestErasedAt&&!b.restorePaused&&b.status==='confirmed','This stay offer is no longer available',410)
  if(request.method==='POST'){
   need(request.headers.get('origin')===env.AUTH_ORIGIN&&new URL(request.url).origin===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
   const p=await input(request)
   if(p.action==='accept'){
    const url=await acceptPromotion(env,o.id,token,p,authorize,returnPath)
    return wantsJson?json({url}):new Response(null,{status:303,headers:{...headers,location:url}})
   }
   need(p.action==='refresh','Unknown offer response',400);await reconcilePromotion(env,o.id);await settle(env)
   return wantsJson?json({status:(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).find(row=>row.id===o!.id)?.status}):new Response(null,{status:303,headers:{...headers,location:path}})
  }
  if(o.status==='checkout'&&new URL(request.url).searchParams.has('returned')){
   await reconcilePromotion(env,o.id);await settle(env);o=(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).find(row=>row.id===o!.id)!
  }
  const state=o.status==='applied'?'<p class="notice" role="status">Payment received. Your original stay has been updated.</p>':o.status==='checkout'?`<p class="notice">Your payment is awaiting Stripe confirmation. Your dates remain held until its outcome is known.</p>${o.checkoutUrl?`<a class="button" href="${h(o.checkoutUrl)}" rel="noreferrer">Continue secure payment</a>`:''}<form method="post"><input type="hidden" name="action" value="refresh"><button>Check payment status</button></form>`:o.status==='refund_due'?'<p class="notice" role="status">Your host is settling this offer under the accepted refund policy.</p>':o.status==='refunded'?'<p class="notice" role="status">The refund has been confirmed.</p>':`<form method="post"><input type="hidden" name="action" value="accept"><label>Full name as on your reservation<input name="signature" autocomplete="name" maxlength="120" required></label><label class="check"><input type="checkbox" name="consent" value="yes" required>I accept these supplemental stay terms and authorize this one payment.</label><button>Accept and pay USD ${(o.amountCents/100).toFixed(2)}</button></form>`
  return shell('Your private stay offer',`<section class="panel stay-sheet"><p class="eyebrow">Your private stay offer</p><h1>${h(o.title)}</h1><p class="intro">${h(o.terms)}</p><p>Offer expires ${h(o.expiresAt)}. This offer changes your existing reservation.</p>${state}<p>Contact your host to cancel or change an accepted offer.</p></section>`,200,frame(site,url))
 }catch(error){const status=(error as {status?:number}).status??400,message=(error as Error).message;return wantsJson?json({error:message},status):new Response(message,{status,headers})}
}
/** Caller must already have authenticated the original guest stay capability. */
export async function promotionGuestPanel(env:Bindings,bookingId:string){
 const rows=(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).filter(o=>o.bookingId===bookingId&&!o.restorePaused&&['sent','checkout','applied','refund_due','refunded'].includes(o.status)&&Date.parse(o.expiresAt)>Date.now())
 const links=[]
 for(const o of rows){const token=await unseal(env.SESSION_SECRET,'promotion-offer',o.tokenSealed);if(token)links.push(`<li><a href="/offers/${h(token)}">${h(o.title)}</a> · USD ${(o.amountCents/100).toFixed(2)} · ${h(o.status)}</li>`)}
 return links.length?`<section class="panel"><h2>Your stay offers and extras</h2><ul>${links.join('')}</ul></section>`:''
}
