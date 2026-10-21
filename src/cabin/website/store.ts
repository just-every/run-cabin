import { embedOrigins } from './embed'
import type { Actor, Context } from '../model'
import { need, newId, owner, query, text } from '../model'
import { assertLive, mutate } from '../storage'
import type { Bindings } from '../../auth.server'
export interface SitePage {slug:string;title:string;body:string;description:string}
export interface ListingPage {propertyId:string;photoIds:string[];guide:string;description:string}
export interface BookingSite {embedOrigins?:string[];revision:string;name:string;intro:string;color:string;origin:string;domainVerified:boolean;domainChallenge:string;seoDescription:string;analytics:boolean;privacy:string;pages:SitePage[];listings:ListingPage[]}
export async function bookingSite(db:D1Database):Promise<BookingSite|null>{const r=await db.prepare("SELECT data FROM cb_booking_site WHERE id='site'").first<{data:string}>();return r?JSON.parse(r.data):null}
const optional=(v:unknown,max:number)=>v?text(v,'text',max):''
export async function websiteCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 if(!name.startsWith('direct.site.'))return undefined
 owner(actor);need(!actor.isAgent,'Human owner required',403);await assertLive(env.DB,actor)
 if(name==='direct.site.verify'){
  const old=await bookingSite(env.DB);need(old?.origin,'Save your custom domain first',409)
  let r:Response;try{r=await fetch(old.origin+'/book/domain-proof/'+old.domainChallenge,{redirect:'manual',signal:AbortSignal.timeout(10000)})}catch{need(false,'The domain did not answer. Route its HTTPS traffic to this installation, then check again.',409)}
  need(r.ok&&(await r.text())===old.domainChallenge,'This domain does not reach this installation. Check its HTTPS route before enabling it.',409)
  return mutate(env.DB,actor,name,async c=>{const current=await bookingSite(c.db);need(current?.revision===old.revision,'Settings changed. Check the domain again.',409);current.domainVerified=true;save(c,current);return current})
 }
 need(name==='direct.site.save','Unknown website command',404)
 return mutate(env.DB,actor,name,async c=>{
  const old=await bookingSite(c.db);need(!old||old.revision===p.revision,'Website settings changed. Reload before saving.',409)
  const raw=optional(p.origin,250);let origin='';if(raw){let u:URL;try{u=new URL(raw)}catch{need(false,'Enter an HTTPS origin, such as https://stays.example.com')};need(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&!u.port,'Enter an HTTPS origin without a path, credentials or port');need(!/^(localhost|.*\.localhost|.*\.local|\[.*\]|[\d.]+)$/.test(u.hostname),'Use a public domain');origin=u.origin}
  const color=optional(p.color,7)||'#214d3d';need(/^#[\da-f]{6}$/i.test(color),'Use a six digit hex brand color')
  const parse=(v:unknown)=>{if(typeof v!=='string')return v;try{return JSON.parse(v)}catch{need(false,'Enter valid JSON for pages and published listings')}}
  const values=(v:unknown):unknown[]=>Array.isArray(v)?v:v===undefined?[]:[v]
  const pageRows=values(p.pageSlug).map((slug,i)=>({slug,title:values(p.pageTitle)[i],body:values(p.pageBody)[i],description:values(p.pageDescription)[i]})).filter(v=>v.slug||v.title||v.body||v.description)
  const pages=parse(p.pages??pageRows);need(Array.isArray(pages)&&pages.length<=12,'Use at most 12 pages')
  const normalized:SitePage[]=pages.map(v=>{need(v&&typeof v==='object'&&!Array.isArray(v),'Use page objects');const slug=text(v.slug,'page address',60);need(/^[a-z][a-z0-9-]*$/.test(slug),'Use lowercase page addresses');return {slug,title:text(v.title,'page title',120),body:text(v.body,'page content',12000),description:optional(v.description,300)}})
  need(new Set(normalized.map(p=>p.slug)).size===normalized.length,'Each page needs its own address')
  const listingRows=c.data.properties.filter(v=>'guide_'+v.id in p||'description_'+v.id in p||'photos_'+v.id in p).map(v=>({propertyId:v.id,guide:p['guide_'+v.id],description:p['description_'+v.id],photoIds:values(p['photos_'+v.id])}))
  const listings=parse(p.listings??listingRows);need(Array.isArray(listings)&&listings.length<=100,'Use a listing settings array')
  const published:ListingPage[]=listings.map(v=>{need(v&&typeof v==='object'&&!Array.isArray(v),'Use listing objects');need(c.data.properties.some(p=>p.id===v.propertyId),'Choose a current property');const profile=c.data.propertyProfiles.find(p=>p.propertyId===v.propertyId),ids=typeof v.photoIds==='string'?v.photoIds.split(/\s*,\s*/).filter(Boolean):v.photoIds??[];need(Array.isArray(ids)&&ids.length<=12&&new Set(ids).size===ids.length&&ids.every(id=>profile?.photos.some(p=>p.id===id)),'Select only photos belonging to this property');return {propertyId:v.propertyId,photoIds:ids,guide:optional(v.guide,12000),description:optional(v.description,300)}})
  need(new Set(published.map(v=>v.propertyId)).size===published.length,'List each property once')
  const row:BookingSite={embedOrigins:embedOrigins(p.embedOrigins??old?.embedOrigins),revision:newId(),name:text(p.name,'site name',120),intro:optional(p.intro,2000),color,origin,domainVerified:origin===old?.origin&&!!old?.domainVerified,domainChallenge:origin===old?.origin&&old.domainChallenge?old.domainChallenge:newId()+newId(),seoDescription:optional(p.seoDescription,300),analytics:p.analytics===true||p.analytics==='yes',privacy:optional(p.privacy,4000),pages:normalized,listings:published};save(c,row);return row
 })
}
function save(c:Context,row:BookingSite){row.revision=newId();c.queries.push(query("INSERT INTO cb_booking_site(id,data) VALUES('site',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",JSON.stringify(row)));c.entityId='booking-site'}
