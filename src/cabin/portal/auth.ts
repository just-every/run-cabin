import type { Bindings } from '../../auth.server'
import { load } from '../storage'
import { guard, need, query, sha, type Booking, type Context, type Data, type Query } from '../model'
import { record } from '../audit/write'
import { portalLinks, recipientHint, savedEmail } from './lifecycle'
import type { GuestPortalLink } from './types'

export const browserCookie='cabin_guest_browser',sessionCookie='cabin_guest_session'
export const cookie=(name:string,value:string,maxAge:number)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
export function readCookie(request:Request,name:string){const raw=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);return raw&&/^[a-f0-9]{48}$/.test(raw)?raw:null}
export interface PortalContext { data:Data; link:GuestPortalLink; booking:Booking }
export async function findPortal(env:Bindings,token:string):Promise<PortalContext>{
 const data=await load(env.DB),link=portalLinks(data).find(r=>r.token===token&&r.status==='active'),booking=link&&data.bookings.find(b=>b.id===link.bookingId)
 if(link&&Date.parse(link.expiresAt)<=Date.now()){
  const sessions=await env.DB.prepare('DELETE FROM cb_guest_sessions WHERE booking_id=?').bind(link.bookingId).run()
  await env.DB.prepare('DELETE FROM cb_guest_challenges WHERE booking_id=?').bind(link.bookingId).run()
  if(sessions.meta.changes)await record(env.DB,{id:'guest:'+link.bookingId,role:'guest',isAgent:false,operatorVersion:0},'guest.portal.session.end',{kind:'guestPortalLinks',id:link.id,bookingId:link.bookingId,propertyId:link.propertyId,result:'expired',facts:{guestRecipient:recipientHint(savedEmail(booking?.guestEmail))}})
 }
 need(link&&booking&&booking.status==='confirmed'&&!booking.guestErasedAt&&!booking.restorePaused&&Date.parse(link.expiresAt)>Date.now()&&data.properties.some(p=>p.id===booking.propertyId),'Stay link expired or unavailable',404)
 return {data,link,booking}
}
/** The same current facts guard both authentication writes and business writes. */
export function portalFence(link:GuestPortalLink,email:string,now=Date.now()):Query {
 return query(`EXISTS(SELECT 1 FROM cb_records p JOIN cb_records b ON b.id=json_extract(p.data,'$.bookingId') AND b.kind='bookings' JOIN cb_properties h ON h.id=json_extract(b.data,'$.propertyId') WHERE p.kind='guestPortalLinks' AND p.id=? AND json_extract(p.data,'$.token')=? AND json_extract(p.data,'$.status')='active' AND json_extract(p.data,'$.sessionEpoch')=? AND json_extract(p.data,'$.expiresAt')>? AND json_extract(b.data,'$.status')='confirmed' AND json_extract(b.data,'$.guestErasedAt') IS NULL AND COALESCE(json_extract(b.data,'$.restorePaused'),0)=0 AND lower(trim(COALESCE(json_extract(b.data,'$.guestEmail'),'')))=?)`,link.id,link.token,link.sessionEpoch,new Date(now).toISOString(),email)
}
export async function atomic(db:D1Database,queries:Query[]){
 try{return await db.batch(queries.map(q=>db.prepare(q.sql).bind(...q.params)))}catch(error){if(/constraint|CHECK|UNIQUE/i.test(String(error)))need(false,'The stay or verification changed. Reload and try again.',409);throw error}
}
export async function guestSession(request:Request,env:Bindings,context:PortalContext){
 const raw=readCookie(request,sessionCookie),browser=readCookie(request,browserCookie)
 if(!raw||!browser)return null
 const hash=await sha(raw),now=Date.now(),row=await env.DB.prepare('SELECT * FROM cb_guest_sessions WHERE token_hash=?').bind(hash).first<{booking_id:string;link_id:string;browser_hash:string;email_hash:string;session_epoch:string;expires_at:number}>()
 if(!row||row.booking_id!==context.booking.id)return null
 const valid=row.link_id===context.link.id&&row.browser_hash===await sha(browser)&&row.email_hash===await sha(savedEmail(context.booking.guestEmail))&&row.session_epoch===context.link.sessionEpoch&&row.expires_at>now&&Date.parse(context.link.expiresAt)>now
 if(!valid){await env.DB.prepare('DELETE FROM cb_guest_sessions WHERE token_hash=?').bind(hash).run();await record(env.DB,{id:'guest:'+context.booking.id,role:'guest',isAgent:false,operatorVersion:0},'guest.portal.session.end',{kind:'guestPortalLinks',id:context.link.id,bookingId:context.booking.id,propertyId:context.booking.propertyId,result:'expired',facts:{guestRecipient:recipientHint(savedEmail(context.booking.guestEmail))}});return null}
 return hash
}
export async function requireGuestSession(request:Request,env:Bindings,bookingId:string){
 const data=await load(env.DB),link=portalLinks(data).find(r=>r.bookingId===bookingId&&r.status==='active'&&r.token),booking=data.bookings.find(b=>b.id===bookingId)
 need(link&&booking&&booking.status==='confirmed'&&!booking.guestErasedAt&&!booking.restorePaused&&Date.parse(link.expiresAt)>Date.now(),'Verify your reservation email before continuing',401)
 const context={data,link,booking},hash=await guestSession(request,env,context);need(hash,'Verify your reservation email before continuing',401);return {...context,sessionHash:hash}
}
export function authorizeGuestWrite(c:Context,context:PortalContext,sessionHash:string){
 const link=portalLinks(c.data).find(r=>r.id===context.link.id),booking=c.data.bookings.find(b=>b.id===context.booking.id)
 need(link&&booking&&link.token===context.link.token&&link.sessionEpoch===context.link.sessionEpoch&&link.status==='active'&&booking.status==='confirmed'&&!booking.guestErasedAt&&!booking.restorePaused&&savedEmail(booking.guestEmail)===savedEmail(context.booking.guestEmail)&&Date.parse(link.expiresAt)>Date.parse(c.now),'Stay changed. Verify your email again.',409)
 const fence=portalFence(link,savedEmail(booking.guestEmail),Date.parse(c.now))
 c.queries.push(guard(fence.sql,...fence.params),guard('EXISTS(SELECT 1 FROM cb_guest_sessions WHERE token_hash=? AND booking_id=? AND session_epoch=? AND expires_at>?)',sessionHash,booking.id,link.sessionEpoch,Date.parse(c.now)))
 return booking
}
