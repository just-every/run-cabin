import { applyBookingCoupon } from '../promotions/booking-coupons'
import { promotionGuestPanel } from '../promotions/guest'
import { bookingSite } from '../website/store'
import { websiteResponse,countVisit } from '../website/http'
import { directory,listingPage,frame } from '../website/pages'
import { managementFor } from '../properties/terms'
import { agreementResponse } from '../agreements/http'
import { agreementOf,templateVersion } from '../agreements/records'
import { documentDownload } from '../agreements/ui'
import type { Bindings } from '../../auth.server'
import { need,sha } from '../model'
import { load } from '../storage'
import { homes,byToken } from './store'
import { quote } from './rules'
import { offeredRate } from '../guests/offers'
import { checkout,retryCheckout } from './checkout'
import { refresh,identity } from './payments'
import { guestDeposit } from './deposit'
import { stripeCredentials } from './stripe'
import { quotePage,stayPage,shell,signedAgreement,guestText } from './public-ui'
import { h } from '../ui/shared'
import { homeSettings } from '../homes'
import { instant,localDay } from '../clock'
import { verificationResponse,verificationGuestPanel } from '../verification/guest'
import { verificationOf,resolved } from '../verification/records'
export async function bookingResponse(request:Request,env:Bindings):Promise<Response|null> {
 const site=await bookingSite(env.DB),incoming=new URL(request.url)
 const proof=incoming.pathname.startsWith('/book/domain-proof/')
 if(proof)return websiteResponse(request,env,site)
 if(incoming.origin!==env.AUTH_ORIGIN&&site?.domainVerified&&incoming.origin===site.origin)env={...env,AUTH_ORIGIN:incoming.origin}
 const verification=await verificationResponse(request,env);if(verification)return verification
 const rental=await agreementResponse(request,env);if(rental)return rental
 const url=new URL(request.url),path=url.pathname;if(path!=='/book'&&!path.startsWith('/book/'))return null
 let json=false
 try{
  need(url.origin===env.AUTH_ORIGIN,'Wrong application origin',403);need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  if(request.method==='POST')need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
  let input:Record<string,unknown>={}
  if(request.method==='POST'){
   need(Number(request.headers.get('content-length')??0)<=32_000,'Request too large',413)
   const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
   if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32_000){await reader.cancel();need(false,'Request too large',413)}chunks.push(value)}
   const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}const body=new TextDecoder().decode(bytes)
   if(request.headers.get('content-type')?.includes('application/json')){json=true;input=JSON.parse(body);need(input&&typeof input==='object'&&!Array.isArray(input),'Use an input object')}else input=Object.fromEntries(new URLSearchParams(body))
  }
  await countVisit(env.DB,request,site)
  const website=await websiteResponse(request,env,site,input);if(website)return website
  if(path==='/book/stripe-check'&&request.method==='GET')return shell('Check your Stripe connection','<h1>Check your Stripe connection</h1><p>You have returned from Stripe. Open Direct bookings to see whether Stripe confirmed the test payment.</p><a class="button" href="/app/direct">Check Stripe test result</a>')
  const saved=path.match(/^\/book\/stay\/([a-f0-9-]{72})(?:\/(refresh|identity|agreement|deposit|pay))?$/)
  if(saved){
   let s=await byToken(env.DB,await sha(saved[1]))
   const renderStay=async(row:typeof s,message='')=>{const data=await load(env.DB),v=verificationOf(data,row.bookingId);return stayPage(row,saved[1],message,env.AUTH_LOCAL==='true',agreementOf(data,row.bookingId),verificationGuestPanel(data,row.bookingId)+await promotionGuestPanel(env,row.bookingId),!!v&&resolved(v))}
   if(saved[2]==='agreement'&&request.method==='GET'){const a=agreementOf(await load(env.DB),s.bookingId);if(a){const version=url.searchParams.get('version'),d=version?a.documents.find(d=>d.id===version):[...a.documents].reverse().find(d=>d.signature);need(d,'Signed document not found',404);return documentDownload(a,d)}return signedAgreement(s)}
   if(request.method==='POST'&&saved[2]==='refresh'){s=await refresh(env,s.id,{id:'guest:'+s.id,role:'guest',isAgent:false,operatorVersion:0});return json?Response.json({stay:{id:s.id,phase:s.phase,quote:s.quote,identity:s.identity,deposit:s.deposit}}):renderStay(s)}
   if(request.method==='POST'&&s.phase==='cancelled'&&['identity','deposit','pay'].includes(saved[2]??''))need(false,'This reservation was cancelled. Contact your host about its settlement.',409)
   if(request.method==='POST'&&(saved[2]==='identity'||saved[2]==='deposit'||saved[2]==='pay')){const target=saved[2]==='identity'?await identity(env,s.id,saved[1]):saved[2]==='pay'?await retryCheckout(env,s.id,saved[1]):await guestDeposit(env,s.id,saved[1]);return new Response(null,{status:303,headers:{location:target,'cache-control':'no-store','referrer-policy':'no-referrer'}})}
   need(request.method==='GET'&&!saved[2],'Not found',404);if(s.checkoutId&&s.phase!=='expired')try{s=await refresh(env,s.id,{id:'guest:'+s.id,role:'guest',isAgent:false,operatorVersion:0})}catch(error){return renderStay(await byToken(env.DB,await sha(saved[1])),guestText(error))}return renderStay(s)
  }
  const data=await load(env.DB),all=(await homes(env.DB)).filter(h=>h.enabled)
  if(path==='/book'&&request.method==='GET')return directory(site,url,data,all)
  const match=path.match(/^\/book\/([a-z0-9-]+)(?:\/(quote|checkout))?$/),home=all.find(h=>h.slug===match?.[1]);need(match&&home,'Booking page not found',404)
  const name=data.properties.find(p=>p.id===home.propertyId)?.name??home.slug,settings=homeSettings(data,home.propertyId)
  if(request.method==='GET'&&!match[2]){const offer=await offeredRate(data,home,url.searchParams.get('offer'));return listingPage(site,url,data,home,offer?{token:url.searchParams.get('offer')!,name:offer.guestName}:undefined)}
  if(request.method==='POST'&&match[2]==='quote'){const offer=await offeredRate(data,home,input.offerToken),price=quote(home,data.bookings,input,localDay(Date.now(),settings.timeZone),offer);need(!data.propertyProfiles.find(p=>p.propertyId===home.propertyId)||price.guests<=data.propertyProfiles.find(p=>p.propertyId===home.propertyId)!.occupancyLimit,'Guest count exceeds the property occupancy limit');price.managementVersion=managementFor(data,home.propertyId,price.start).id;await applyBookingCoupon(env.DB,data,home,price,input);let mode:'test'|'live'|null=null;try{mode=(await stripeCredentials(env)).mode}catch{}return json?Response.json({quote:price,homeRevision:home.revision}):quotePage(home,name,price,mode,instant(`${price.start}T${settings.checkInTime}`,settings.timeZone)-48*3_600_000<=Date.now(),offer?String(input.offerToken):undefined,data.rentalTemplates.find(t=>t.propertyId===home.propertyId)?templateVersion(data.rentalTemplates.find(t=>t.propertyId===home.propertyId)!):undefined,frame(site,url))}
  if(request.method==='POST'&&match[2]==='checkout'){const result=await checkout(env,home.slug,input);return json?Response.json(result):new Response(null,{status:303,headers:{location:result.url,'cache-control':'no-store','referrer-policy':'no-referrer'}})}
  need(false,'Not found',404)
 }catch(error){const stayToken=(error as any)?.stayToken as string|undefined
  if(stayToken&&!json)return new Response(null,{status:303,headers:{location:'/book/stay/'+stayToken,'cache-control':'no-store','referrer-policy':'no-referrer'}})
  const status=Number((error as any)?.status)||500,message=status<500||(status===502||status===503)?guestText(error):'Could not complete this request. Contact the host or try again.'
  return json?Response.json({error:message,...(stayToken?{bookingUrl:env.AUTH_ORIGIN+'/book/stay/'+stayToken}:{})},{status,headers:{'cache-control':'no-store'}}):shell('Booking needs attention',`<h1>Booking needs attention</h1><div class="notice error" role="alert">${h(message)}</div><p>${path.startsWith('/book/stay/')?'Your payment or verification may still be pending. Return to your saved stay page to check its status.':'Choose other dates or contact the host.'}</p><a href="${h(path.startsWith('/book/stay/')?path.replace(/\/(refresh|identity|deposit|pay)$/,''):'/book/'+(path.split('/')[2]??''))}">Return to booking</a>`,status)
 }
}
