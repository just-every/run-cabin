import { guestIssueResponse } from './issues/commands'
import { openGuestIssue } from './issues/records'
import { guestWorkReport } from './work-orders/guest'
import { guestSettlement, guestRecoveryConfirmation } from './recovery/guest'
import { settle } from './settle'
import { event, record } from './audit/write'
import type { Bindings } from '../auth.server'
import { mutate, SYSTEM } from './storage'
import { need, query } from './model'
import { authorizeGuestWrite, atomic, findPortal, guestSession, sessionCookie, cookie, type PortalContext } from './portal/auth'
import { sendGuestCode, verifyGuestCode } from './portal/challenge'
import { verificationGate, wantsJson } from './portal/gate'
import { portalHeaders, portalShell } from './portal/shell'
import { portalAccess, stayJson, stayPage } from './portal/stay'
import { guestGuideFile } from './portal/files'
import { portalBridge } from './portal/bridges'
import { recipientHint, savedEmail } from './portal/lifecycle'

async function input(request:Request){
 let source='',size=0;const reader=request.body?.getReader(),decoder=new TextDecoder()
 if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;need(size<=8000,'Request too large',413);source+=decoder.decode(value,{stream:true})}source+=decoder.decode()}finally{reader.releaseLock()}
 const result:unknown=request.headers.get('content-type')?.includes('application/json')?JSON.parse(source):Object.fromEntries(new URLSearchParams(source))
 need(result&&typeof result==='object'&&!Array.isArray(result),'Use a form or JSON object');return result as Record<string,unknown>
}
/** Each private stay door first proves both a live reservation link and this browser's verified email session. */
export async function guestStayResponse(request:Request,env:Bindings){
 const url=new URL(request.url),match=url.pathname.match(/^\/stay\/([0-9a-f]{48})(?:\/(.*))?$/)
 let p:PortalContext|undefined
 try{
  need(match&&['GET','POST'].includes(request.method),'Not found',404)
  need(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Wrong application origin',403)
  p=await findPortal(env,match[1]);const tail=match[2]??'',path='/stay/'+match[1]
  if(request.method==='POST')need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
  if(request.method==='POST'&&['send-code','verify'].includes(tail)){
   try{
    const value=await input(request)
    if(tail==='send-code'){const sent=await sendGuestCode(request,env,p);return verificationGate(request,env,p,sent.status,200,sent.challengeId)}
    const session=await verifyGuestCode(request,env,p,value),headers=new Headers({...portalHeaders,location:path});headers.append('set-cookie',session)
    return new Response(null,{status:303,headers})
   }catch(error){const status=Number((error as {status?:number}).status)||400;return verificationGate(request,env,p,(error as Error).message,status)}
  }
  const sessionHash=await guestSession(request,env,p)
  if(!sessionHash)return verificationGate(request,env,p,'',request.method==='GET'&&!tail?200:401)
  const actor={...SYSTEM,id:'guest:'+p.booking.id}
  if(tail==='signout'&&request.method==='POST'){
   await atomic(env.DB,[query('DELETE FROM cb_guest_sessions WHERE token_hash=?',sessionHash),event(actor,'guest.portal.session.end',new Date().toISOString(),{kind:'guestPortalLinks',id:p.link.id,bookingId:p.booking.id,propertyId:p.booking.propertyId,result:'guest_ended',facts:{guestRecipient:recipientHint(savedEmail(p.booking.guestEmail))}})])
   return new Response(null,{status:303,headers:{...portalHeaders,location:path,'set-cookie':cookie(sessionCookie,'',0)}})
  }
  if(tail.startsWith('files/')){need(request.method==='GET'&&portalAccess(p).live,'Guide file not available',404);return await guestGuideFile(env,p,tail.slice(6))}
  const bridge=await portalBridge(request,env,p,sessionHash,tail);if(bridge)return bridge
  need(!tail||tail==='api','Not found',404)
  let reported=false
  if(request.method==='POST'){
   need(!portalAccess(p).ended,'Contact your host about this completed stay',409)
   const context=p
   if(request.headers.get('content-type')?.includes('multipart/form-data'))return guestWorkReport(request,env,match[1],p.booking,c=>authorizeGuestWrite(c,context,sessionHash))
   const value=await input(request),form=new URLSearchParams(Object.entries(value).map(([k,v])=>[k,String(v)]))
   await mutate(env.DB,actor,value.action==='issue-response'?'issue.guest.response':value.action==='settlement'?'recovery.guest.response':'recovery.guest.report',c=>{
    const booking=authorizeGuestWrite(c,context,sessionHash),code=c.data.codes.find(code=>code.bookingId===booking.id&&code.holder==='guest'&&code.status==='issued')
    if(value.action==='issue-response'){need(code,'Access is not released for this stay',409);guestIssueResponse(c,booking,code,form)}
    else if(value.action==='recovery-confirm'){need(code,'Access is not released for this stay',409);guestRecoveryConfirmation(c,booking,code,form)}
    else if(value.action==='settlement'){need(code,'Access is not released for this stay',409);guestSettlement(c,booking,code,form,env.OWNER_EMAIL)}
    else{const reason=String(value.reason??'').trim();need(reason&&reason.length<=2000,'Enter a problem of up to 2000 characters');openGuestIssue(c,booking,reason,'portal',env.OWNER_EMAIL,value.category)}
   })
   await settle(env)
   if(value.action==='issue-response'||value.action==='settlement'||value.action==='recovery-confirm')return new Response(null,{status:303,headers:{...portalHeaders,location:path}})
   p=await findPortal(env,match[1]);reported=true
  }
  const access=portalAccess(p)
  if(access.live&&access.code)await record(env.DB,actor,'guest.access.release',{kind:'codes',id:access.code.id,propertyId:p.booking.propertyId,bookingId:p.booking.id,revision:access.code.revision,result:'released'})
  return wantsJson(request)?await stayJson(env,p):await stayPage(request,env,p,reported)
 }catch(error){
  const status=Number((error as {status?:number}).status)||500,message=status<500?(error as Error).message:'Could not open this stay. Reload and try again.'
  if(wantsJson(request))return Response.json({error:message},{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
  return p?portalShell(p.data.properties.find(h=>h.id===p!.booking.propertyId)?.name??'Your host',`<section class="panel"><h1>Stay needs attention</h1><p>${message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}</p></section>`,status):new Response(message,{status,headers:portalHeaders})
 }
}
