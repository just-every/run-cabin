import type { Bindings } from '../../auth.server'
import type { BookingSite } from './store'
import { need } from '../model'
import { load } from '../storage'
import { homes } from '../direct/store'
import { shell } from '../direct/public-ui'
import { h } from '../ui/shared'
import { frame } from './pages'
export async function websiteResponse(request:Request,env:Bindings,site:BookingSite|null,input?:Record<string,unknown>):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname
 const proof=path.match(/^\/book\/domain-proof\/([a-f0-9-]{72})$/)
 if(proof){need(request.method==='GET'&&url.origin===site?.origin&&proof[1]===site.domainChallenge,'Not found',404);return new Response(site.domainChallenge,{headers:{'cache-control':'no-store','content-type':'text/plain'}})}
 if(path==='/book/consent'){
  need(request.method==='POST','Method not allowed',405);const choice=input?.choice??new URLSearchParams(await request.text()).get('choice');need(choice==='allow'||choice==='deny','Choose whether to allow analytics');return new Response(null,{status:303,headers:{location:'/book'+(url.searchParams.has('embedReturn')?'?'+new URLSearchParams({embedReturn:url.searchParams.get('embedReturn')!}):''),'cache-control':'no-store','set-cookie':`cabin_booking_analytics=${choice}; Path=/book; HttpOnly; SameSite=Lax; Max-Age=15552000${url.protocol==='https:'?'; Secure':''}`}})
 }
 if(path==='/book/sitemap.xml'){
  need(request.method==='GET','Method not allowed',405);const all=(await homes(env.DB)).filter(h=>h.enabled),origin=site?.domainVerified?site.origin:url.origin;return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/book',...all.map(h=>'/book/'+h.slug),...(site?.pages??[]).map(p=>'/book/pages/'+p.slug)].map(path=>`<url><loc>${h(origin+path)}</loc></url>`).join('')}</urlset>`,{headers:{'content-type':'application/xml','cache-control':'no-store'}})
 }
 const page=path.match(/^\/book\/pages\/([a-z][a-z0-9-]*)$/)
 if(page){need(request.method==='GET','Method not allowed',405);const content=site?.pages.find(p=>p.slug===page[1]);need(content,'Page not found',404);return shell(content.title,`<a href="/book">← All homes</a><h1>${h(content.title)}</h1><div class="intro">${h(content.body)}</div>`,200,{...frame(site,url,true),head:frame(site,url,true).head?.replace(h(site?.seoDescription??'Book a vacation home directly with your host.'),h(content.description||site?.seoDescription||content.title))})}
 const photo=path.match(/^\/book\/photos\/([\w-]+)$/)
 if(photo){need(request.method==='GET','Method not allowed',405);const data=await load(env.DB),all=await homes(env.DB),listing=site?.listings.find(v=>v.photoIds.includes(photo[1])&&all.some(h=>h.enabled&&h.propertyId===v.propertyId));const profile=listing&&data.propertyProfiles.find(p=>p.propertyId===listing.propertyId&&p.photos.some(v=>v.id===photo[1]));need(profile,'Photo not published',404);const r=await env.DB.prepare('SELECT mime_type,hex(bytes) AS bytes_hex FROM cb_photos WHERE id=? AND turnover_id=?').bind(photo[1],profile.id).first<{mime_type:string;bytes_hex:string}>();need(r,'Photo unavailable',404);need(r.bytes_hex&&/^(?:[0-9A-F]{2})+$/.test(r.bytes_hex),'Stored photo is invalid',500);const bytes=Uint8Array.from(r.bytes_hex.match(/../g)!,v=>parseInt(v,16));return new Response(bytes,{headers:{'content-type':r.mime_type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})}
 return null
}
export async function countVisit(db:D1Database,request:Request,site:BookingSite|null){
 const path=new URL(request.url).pathname
 if(!site?.analytics||request.method!=='GET'||!/^\/book(?:\/[a-z0-9-]+|\/pages\/[a-z0-9-]+)?$/.test(path)||/^\/book\/(stay|consent|stripe-check)/.test(path)||!/(?:^|;\s*)cabin_booking_analytics=allow(?:;|$)/.test(request.headers.get('cookie')??''))return
 await db.prepare('INSERT INTO cb_booking_views(day,path,views) VALUES(?,?,1) ON CONFLICT(day,path) DO UPDATE SET views=views+1').bind(new Date().toISOString().slice(0,10),path).run()
}
