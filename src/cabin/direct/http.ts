import type { Bindings } from '../../auth.server'
import { need,sha } from '../model'
import { load } from '../storage'
import { homes,byToken } from './store'
import { quote } from './rules'
import { checkout } from './checkout'
import { refresh,identity } from './payments'
import { homePage,quotePage,stayPage,shell,signedAgreement } from './public-ui'
import { h } from '../ui/shared'
export async function bookingResponse(request:Request,env:Bindings):Promise<Response|null> {
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
  const saved=path.match(/^\/book\/stay\/([a-f0-9-]{72})(?:\/(refresh|identity|agreement))?$/)
  if(saved){
   let s=await byToken(env.DB,await sha(saved[1]))
   if(saved[2]==='agreement'&&request.method==='GET')return signedAgreement(s)
   if(request.method==='POST'&&saved[2]==='refresh'){s=await refresh(env,s.id);return json?Response.json({stay:{id:s.id,phase:s.phase,quote:s.quote,identity:s.identity,deposit:s.deposit}}):stayPage(s,saved[1])}
   if(request.method==='POST'&&saved[2]==='identity'){const target=await identity(env,s.id,saved[1]);return new Response(null,{status:303,headers:{location:target,'cache-control':'no-store','referrer-policy':'no-referrer'}})}
   need(request.method==='GET'&&!saved[2],'Not found',404);return stayPage(s,saved[1])
  }
  const data=await load(env.DB),all=(await homes(env.DB)).filter(h=>h.enabled)
  if(path==='/book'&&request.method==='GET')return shell('Find your stay',`<p class="eyebrow">Book directly</p><h1>Find your next stay</h1>${all.length?all.map(home=>`<section class="panel"><h2><a href="/book/${h(home.slug)}">${h(data.properties.find(p=>p.id===home.propertyId)?.name)}</a></h2><p>${h(home.description)}</p></section>`).join(''):'<p>No homes are accepting direct bookings yet.</p>'}`)
  const match=path.match(/^\/book\/([a-z0-9-]+)(?:\/(quote|checkout))?$/),home=all.find(h=>h.slug===match?.[1]);need(match&&home,'Booking page not found',404)
  const name=data.properties.find(p=>p.id===home.propertyId)?.name??home.slug
  if(request.method==='GET'&&!match[2])return homePage(home,name,data.bookings,env.AUTH_ORIGIN)
  if(request.method==='POST'&&match[2]==='quote'){const price=quote(home,data.bookings,input);return json?Response.json({quote:price,homeRevision:home.revision}):quotePage(home,name,price)}
  if(request.method==='POST'&&match[2]==='checkout'){const result=await checkout(env,home.slug,input);return json?Response.json(result):new Response(null,{status:303,headers:{location:result.url,'cache-control':'no-store','referrer-policy':'no-referrer'}})}
  need(false,'Not found',404)
 }catch(error){const status=Number((error as any)?.status)||500,message=status<500||(status===502||status===503)?(error as Error).message:'Could not complete this request. Contact the host or try again.'
  return json?Response.json({error:message},{status,headers:{'cache-control':'no-store'}}):shell('Booking needs attention',`<h1>Booking needs attention</h1><div class="notice error" role="alert">${h(message)}</div><p>${path.startsWith('/book/stay/')||path.endsWith('/checkout')?'Your payment or verification may still be pending. Use your booking link to refresh its status.':'Choose other dates or contact the host.'}</p><a href="${h(path.startsWith('/book/stay/')?path.replace(/\/(refresh|identity)$/,''):'/book/'+(path.split('/')[2]??''))}">Return to booking</a>`,status)
 }
}
