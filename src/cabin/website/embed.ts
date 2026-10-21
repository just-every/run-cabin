import type { BookingSite } from './store'
import { need } from '../model'
import { h } from '../ui/shared'

export function embedOrigins(value:unknown):string[]{
 const values=Array.isArray(value)?value:typeof value==='string'?value.split(/\s+/).filter(Boolean):[]
 need(values.length<=20,'Use at most twenty embedding origins')
 return [...new Set(values.map(raw=>{
  let url:URL;try{url=new URL(String(raw))}catch{need(false,'Use complete HTTPS embedding origins')}
  need(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'Use HTTPS origins without paths or credentials')
  return url.origin
 }))]
}
export function embedReturn(site:BookingSite|null,value:unknown):URL|undefined{
 if(!value)return undefined
 let url:URL;try{url=new URL(String(value))}catch{need(false,'Invalid host return page',403)}
 need(url.protocol==='https:'&&!url.username&&!url.password&&(site?.embedOrigins??[]).includes(url.origin),'This embedding origin is not authorized',403)
 return url
}
/** Only public catalog and price pages can acquire framing permission. */
export function embedContext(site:BookingSite|null,url:URL){
 const target=embedReturn(site,url.searchParams.get('embedReturn'))
 if(!target)return undefined
 need(/^\/book(?:\/[a-z0-9-]+(?:\/quote|\/checkout)?|\/pages\/[a-z0-9-]+)?$/.test(url.pathname)&&!/^\/book\/(stay|quote|verification|stripe-check)(?:\/|$)/.test(url.pathname),'This page cannot be embedded',403)
 return target
}
export function embedMarkup(origin:string,returnUrl:string){
 const src=origin+'/book?'+new URLSearchParams({embedReturn:returnUrl})
 return `<iframe src="${h(src)}" title="Search and book a vacation home" width="100%" height="1100" style="border:0;max-width:100%" referrerpolicy="origin" loading="lazy"></iframe>`
}
/** Propagate the return page through native links and forms; payment leaves the frame. */
export function embeddedPage(response:Response,target:URL){
 const carry=(path:string)=>{const url=new URL(path,'https://booking.invalid');url.searchParams.set('embedReturn',target.href);return url.pathname+url.search}
 const headers=new Headers(response.headers)
 headers.set('content-security-policy',(headers.get('content-security-policy')??'').replace("frame-ancestors 'none'",'frame-ancestors '+target.origin))
 headers.set('referrer-policy','no-referrer');headers.set('x-robots-tag','noindex, nofollow')
 const rewrite=new HTMLRewriter().on('a[href]',{element(el){const path=el.getAttribute('href');if(path?.startsWith('/book'))el.setAttribute('href',carry(path))}}).on('form',{element(el){
  const path=el.getAttribute('action');if(!path?.startsWith('/book'))return
  el.setAttribute('action',carry(path))
  if(/\/checkout$/.test(path))el.setAttribute('target','_top')
  if((el.getAttribute('method')??'get').toLowerCase()==='get')el.append(`<input type="hidden" name="embedReturn" value="${h(target.href)}">`,{html:true})
 }})
 return rewrite.transform(new Response(response.body,{status:response.status,headers}))
}
