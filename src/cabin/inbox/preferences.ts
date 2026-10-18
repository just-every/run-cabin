import type { Bindings } from '../../auth.server'
import { load, mutate } from '../storage'
import { INBOX_SYSTEM } from './inbound'
import { inboxSettings, stored } from './settings'
import { newId } from '../model'
async function signature(env: Bindings, id: string) {
 const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('cabin:lifecycle-preferences:'+id)))).map(b=>b.toString(16).padStart(2,'0')).join('')
}
export async function preferenceLink(env: Bindings, id: string) { return `${env.AUTH_ORIGIN}/message-preferences/${encodeURIComponent(id)}/${await signature(env,id)}` }
/** A signed, stay-specific capability permits only lifecycle opt-out, never reservation or access reads. */
export async function lifecyclePreferences(request: Request, env: Bindings) {
 const url=new URL(request.url),match=/^\/message-preferences\/([^/]+)\/([a-f0-9]{64})$/.exec(url.pathname)
 if(!url.pathname.startsWith('/message-preferences/'))return null
 const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'strict-origin','x-robots-tag':'noindex'}
 if(!match||await signature(env,match[1])!==match[2])return new Response('Preference link not found',{status:404,headers})
 const data=await load(env.DB),b=data.bookings.find(b=>b.id===match[1]&&!b.guestErasedAt)
 if(!b)return new Response('Preference link not found',{status:404,headers})
 let done=false
 if(request.method==='POST'){
  if(request.headers.get('origin')!==env.AUTH_ORIGIN)return new Response('Open this preference page first',{status:403,headers})
  await mutate(env.DB,INBOX_SYSTEM,'message.guest.optout',c=>{const row=stored(c,inboxSettings(c).revision);row.lifecycle??={homes:[],optouts:[]};row.lifecycle.optouts=[...row.lifecycle.optouts.filter(o=>o.bookingId!==b.id),{bookingId:b.id,disabled:true,at:c.now,by:'guest:'+b.id,reason:'Guest used their private lifecycle preference link'}];row.revision=newId()})
  done=true
 }else if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers})
 const opted=done||data.inbox.some(i=>i.lifecycle?.optouts.some(o=>o.bookingId===b.id&&o.disabled))
 return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Message preferences · Cabin</title><body style="font:18px/1.6 system-ui;margin:40px auto;padding:0 20px;max-width:650px"><main><h1>Lifecycle message preferences</h1><p>${opted?'Your lifecycle messages are stopped for this home and contact. Contact your host directly for essential payment, identity and arrival arrangements.':'Stop automatic booking, reminder and follow-up messages for this home and contact. Your reservation stays in place; contact your host for essential arrangements.'}</p>${opted?'':`<form method="post"><button style="font:inherit;padding:12px">Stop lifecycle messages</button></form>`}</main></body></html>`,{headers})
}
