import { agreementResponse } from '../agreements/http'
import { verificationResponse } from '../verification/guest'
import { promotionGuestResponse } from '../promotions/guest'
import { unseal } from '../seal'
import { need } from '../model'
import type { Bindings } from '../../auth.server'
import { authorizeGuestWrite, type PortalContext } from './auth'

/** Portal tasks retain their original business handlers behind the guest session boundary. */
export async function portalBridge(request:Request,env:Bindings,p:PortalContext,sessionHash:string,tail:string){
 const path='/stay/'+p.link.token,authorize=(c:Parameters<typeof authorizeGuestWrite>[0])=>{authorizeGuestWrite(c,p,sessionHash)}
 let source='',target='',response:Response|null=null
 if(/^verification(?:\/(?:stripe|manual|refresh))?$/.test(tail)){
  const verification=p.data.verifications.find(v=>v.bookingId===p.booking.id);need(verification?.token,'Identity task unavailable',404)
  source='/book/verification/'+verification.token;target=path+'/verification'
  response=await verificationResponse(new Request(new URL(source+tail.slice('verification'.length)+new URL(request.url).search,env.AUTH_ORIGIN),request),env,authorize)
 }else if(/^agreement(?:\/document\/[\w-]+)?$/.test(tail)){
  const agreement=p.data.rentalAgreements.find(a=>a.bookingId===p.booking.id);need(agreement?.token,'Agreement task unavailable',404)
  source='/book/stay/agreement/'+agreement.token;target=path+'/agreement'
  response=await agreementResponse(new Request(new URL(source+tail.slice('agreement'.length),env.AUTH_ORIGIN),request),env,authorize)
 }else if(/^offers\/[\w-]+$/.test(tail)){
  const id=tail.slice('offers/'.length),row=await env.DB.prepare("SELECT data FROM cb_records WHERE kind='promotionOffers' AND id=? AND json_extract(data,'$.bookingId')=?").bind(id,p.booking.id).first<{data:string}>();need(row,'Offer not found',404)
  const token=await unseal(env.SESSION_SECRET,'promotion-offer',JSON.parse(row.data).tokenSealed);need(token,'Offer unavailable',404)
  source='/offers/'+token;target=path+'/'+tail
  response=await promotionGuestResponse(new Request(new URL(source+new URL(request.url).search,env.AUTH_ORIGIN),request),env,authorize,target)
 }else return null
 need(response,'Task unavailable',404)
 const headers=new Headers(response.headers),location=headers.get('location');if(location?.startsWith(source))headers.set('location',location.replace(source,target))
 if(headers.get('content-type')?.includes('text/html'))return new Response((await response.text()).replaceAll(source,target),{status:response.status,headers})
 return new Response(response.body,{status:response.status,headers})
}
