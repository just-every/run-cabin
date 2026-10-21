import type { Bindings } from '../../auth.server'
import { operatorMail } from '../connections/mail'
import { event } from '../audit/write'
import { guard, need, newId, query, sha } from '../model'
import { portalToken, recipientHint, savedEmail } from './lifecycle'
import { atomic, browserCookie, cookie, portalFence, readCookie, sessionCookie, type PortalContext } from './auth'

const windowMs=15*60_000
const actor=(id:string)=>({id:'guest:'+id,role:'guest',isAgent:false,operatorVersion:0})
const scope=(p:PortalContext,result:string)=>({kind:'guestPortalLinks',id:p.link.id,propertyId:p.booking.propertyId,bookingId:p.booking.id,result,facts:{guestRecipient:recipientHint(savedEmail(p.booking.guestEmail))}})
const digest=(env:Bindings,id:string,code:string)=>sha(`${env.SESSION_SECRET}:guest-email:${id}:${code}`)

export async function sendGuestCode(request:Request,env:Bindings,p:PortalContext){
 const email=savedEmail(p.booking.guestEmail),browser=readCookie(request,browserCookie),now=Date.now(),fence=portalFence(p.link,email,now)
 need(email,'Ask your host to add your email',409);need(browser,'Reload this page before requesting a code',409)
 const id=newId(),random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(random[0]%1_000_000).padStart(6,'0')
 const statements=[
  guard(fence.sql,...fence.params),
  query(`INSERT INTO cb_guest_limits(booking_id,send_start,sends,wrong_start) VALUES(?,?,1,?) ON CONFLICT(booking_id) DO UPDATE SET send_start=CASE WHEN send_start<=? THEN ? ELSE send_start END,sends=CASE WHEN send_start<=? THEN 1 ELSE sends+1 END WHERE locked_until<=? AND (send_start<=? OR sends<3)`,p.booking.id,now,now,now-windowMs,now,now-windowMs,now,now-windowMs),
  guard('changes()=1'),
  query('INSERT INTO cb_guest_challenges(id,booking_id,link_id,browser_hash,code_hash,email_hash,session_epoch,created_at,expires_at,status) VALUES(?,?,?,?,?,?,?,?,?,?)',id,p.booking.id,p.link.id,await sha(browser),await digest(env,id,code),await sha(email),p.link.sessionEpoch,now,now+10*60_000,'pending'),
  event(actor(p.booking.id),'guest.portal.code.send',new Date(now).toISOString(),scope(p,'pending')),query('DELETE FROM cb_guard'),
 ]
 const limit=await env.DB.prepare('SELECT locked_until,send_start,sends FROM cb_guest_limits WHERE booking_id=?').bind(p.booking.id).first<{locked_until:number;send_start:number;sends:number}>()
 need(!limit||limit.locked_until<=now,'Too many wrong codes. Try again in 15 minutes.',429)
 need(!limit||limit.send_start<=now-windowMs||limit.sends<3,'Three codes have been requested. Try again in 15 minutes.',429)
 await atomic(env.DB,statements)
 let accepted=false
 try{
  const mail=operatorMail(env,p.booking.propertyId)
  if(mail&&env.MAIL_FROM){const result=await mail.send({deliveryId:'guest-code:'+id,headers:{'Auto-Submitted':'auto-generated'},from:env.MAIL_FROM,to:[email],subject:'Your Cabin reservation verification code',text:`Your one-use code is ${code}.\n\nEnter it in the browser that requested it within 10 minutes. This verifies your reservation email; it does not complete an identity check.`,html:`<p>Your one-use code is <strong>${code}</strong>.</p><p>Enter it in the browser that requested it within 10 minutes.</p>`});accepted=result?.status==='accepted'}
 }catch{/* A provider failure is reported without exposing its response or the code. */}
 await env.DB.batch([
  env.DB.prepare('UPDATE cb_guest_challenges SET status=? WHERE id=?').bind(accepted?'accepted':'failed',id),
  ...[event(actor(p.booking.id),'guest.portal.code.send',new Date().toISOString(),scope(p,accepted?'accepted':'failed'))].map(q=>env.DB.prepare(q.sql).bind(...q.params)),
 ])
 return {challengeId:id,status:accepted?'accepted by the mail provider':'failed'}
}

export async function verifyGuestCode(request:Request,env:Bindings,p:PortalContext,input:Record<string,unknown>){
 const browser=readCookie(request,browserCookie),id=String(input.challengeId??''),code=String(input.code??''),now=Date.now(),email=savedEmail(p.booking.guestEmail)
 need(browser&&email&&id.length<=80,'Request a new code in this browser',400)
 const row=await env.DB.prepare('SELECT * FROM cb_guest_challenges WHERE id=? AND booking_id=? AND browser_hash=?').bind(id,p.booking.id,await sha(browser)).first<{code_hash:string;expires_at:number;consumed_at:number|null;status:string;email_hash:string;session_epoch:string}>()
 const limits=await env.DB.prepare('SELECT locked_until FROM cb_guest_limits WHERE booking_id=?').bind(p.booking.id).first<{locked_until:number}>()
 need(!limits||limits.locked_until<=now,'Too many wrong codes. Try again in 15 minutes.',429)
 if(!(row&&row.status==='accepted'&&row.consumed_at===null&&row.expires_at>now&&row.email_hash===await sha(email)&&row.session_epoch===p.link.sessionEpoch)){
  const q=event(actor(p.booking.id),'guest.portal.code.verify',new Date(now).toISOString(),scope(p,'refused'));await env.DB.prepare(q.sql).bind(...q.params).run()
  need(false,'This code expired or was already used. Request a new code.',401)
 }
 const fence=portalFence(p.link,email,now)
 if(!/^\d{6}$/.test(code)||row.code_hash!==await digest(env,id,code)){
  const queries=[guard(fence.sql,...fence.params),guard("EXISTS(SELECT 1 FROM cb_guest_challenges WHERE id=? AND consumed_at IS NULL AND status='accepted' AND expires_at>?)",id,now),query(`UPDATE cb_guest_limits SET wrong_start=CASE WHEN wrong_start<=? OR locked_until>0 AND locked_until<=? THEN ? ELSE wrong_start END,wrong=CASE WHEN wrong_start<=? OR locked_until>0 AND locked_until<=? THEN 1 ELSE wrong+1 END,locked_until=CASE WHEN (CASE WHEN wrong_start<=? OR locked_until>0 AND locked_until<=? THEN 1 ELSE wrong+1 END)>=5 THEN ? ELSE 0 END WHERE booking_id=? AND locked_until<=?`,now-windowMs,now,now,now-windowMs,now,now-windowMs,now,now+windowMs,p.booking.id,now),event(actor(p.booking.id),'guest.portal.code.verify',new Date(now).toISOString(),scope(p,'failed')),query('DELETE FROM cb_guard')]
  await atomic(env.DB,queries)
  const locked=await env.DB.prepare('SELECT locked_until FROM cb_guest_limits WHERE booking_id=?').bind(p.booking.id).first<{locked_until:number}>()
  if(locked&&locked.locked_until>now){const q=event(actor(p.booking.id),'guest.portal.code.lockout',new Date(now).toISOString(),scope(p,'locked'));await env.DB.prepare(q.sql).bind(...q.params).run();need(false,'Too many wrong codes. Try again in 15 minutes.',429)}
  need(false,'The code is incorrect',401)
 }
 const session=portalToken(),hash=await sha(session),expires=Date.parse(p.link.expiresAt)
 const result=await atomic(env.DB,[guard(fence.sql,...fence.params),query(`INSERT INTO cb_guest_sessions(token_hash,booking_id,link_id,browser_hash,email_hash,session_epoch,created_at,expires_at) SELECT ?,booking_id,link_id,browser_hash,email_hash,session_epoch,?,? FROM cb_guest_challenges WHERE id=? AND consumed_at IS NULL AND status='accepted' AND expires_at>? AND NOT EXISTS(SELECT 1 FROM cb_guest_limits WHERE booking_id=? AND locked_until>?)`,hash,now,expires,id,now,p.booking.id,now),guard('changes()=1'),query('UPDATE cb_guest_challenges SET consumed_at=? WHERE id=?',now,id),event(actor(p.booking.id),'guest.portal.code.verify',new Date(now).toISOString(),scope(p,'accepted')),query('DELETE FROM cb_guard')])
 need(result[1].meta.changes===1,'This code was already used',401)
 return cookie(sessionCookie,session,Math.max(0,Math.floor((expires-now)/1000)))
}

export async function latestChallenge(env:Bindings,p:PortalContext,request:Request){const browser=readCookie(request,browserCookie);if(!browser)return '';const row=await env.DB.prepare("SELECT id FROM cb_guest_challenges WHERE booking_id=? AND browser_hash=? AND consumed_at IS NULL AND status='accepted' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(p.booking.id,await sha(browser),Date.now()).first<{id:string}>();return row?.id??''}
