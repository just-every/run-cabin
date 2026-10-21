import type { Bindings } from '../../auth.server'
import { need,text,newId,type Context } from '../model'
import { load,mutate,SYSTEM } from '../storage'
import { h,hidden,field } from '../ui/shared'
import { shell,post } from '../direct/public-ui'
import { currentDocument,accessBlocked } from './records'
import { documentDownload } from './ui'

export async function agreementResponse(request:Request,env:Bindings,authorize?:(c:Context)=>void):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/book\/stay\/agreement\/([a-f0-9-]{72})(?:\/document\/([\w-]+))?$/)
 if(!url.pathname.startsWith('/book/stay/agreement/'))return null
 try{
  need(match,'Agreement link not found',404);need(url.origin===env.AUTH_ORIGIN,'Wrong application origin',403)
  need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  const token=match[1],data=await load(env.DB),a=data.rentalAgreements.find(a=>a.token===token),b=a&&data.bookings.find(b=>b.id===a.bookingId)
  need(a&&b&&!b.guestErasedAt&&b.status==='confirmed','Agreement link not found',404)
  if(match[2]){need(request.method==='GET','Method not allowed',405);const d=a.documents.find(d=>d.id===match[2]);need(d,'Document not found',404);return documentDownload(a,d)}
  if(request.method==='POST'){
   need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
   const reader=request.body?.getReader();let size=0,source='';const decoder=new TextDecoder()
   if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8000){await reader.cancel();need(false,'Signing request too large',413)}source+=decoder.decode(value,{stream:true})}source+=decoder.decode()}finally{reader.releaseLock()}
   const p=request.headers.get('content-type')?.includes('application/json')?JSON.parse(source):Object.fromEntries(new URLSearchParams(source))
   await mutate(env.DB,{...SYSTEM,id:'guest:agreement:'+a.id},'agreement.signed',c=>{
    authorize?.(c)
    const live=c.data.rentalAgreements.find(a=>a.token===token),booking=live&&c.data.bookings.find(b=>b.id===live.bookingId)
    need(live&&booking&&booking.status==='confirmed'&&!booking.guestErasedAt,'Agreement link expired',404)
    const d=currentDocument(live);need(p.version===d.id&&p.sha256===d.sha256,'Agreement changed. Review the current version before signing.',409)
    const name=text(p.name,'full name',120),email=text(p.email,'email',254).toLowerCase()
    need(name===d.guestName,'Sign using the guest’s full name');need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email');need(!booking.guestEmail||email===booking.guestEmail.toLowerCase(),'Use the email on this reservation');need(p.consent==='yes','Consent to electronic records and the exact agreement before signing')
    if(d.signature){need(d.signature.name===name&&d.signature.email===email,'This version is already signed',409);return}
    d.signature={name,email,at:c.now,consent:'I reviewed this exact agreement and consent to electronic records and my electronic signature. I can download and retain my signed copy.',method:'Private reservation agreement link',userAgent:(request.headers.get('user-agent')??'').replace(/[\r\n]/g,' ').slice(0,500)};live.revision=newId();c.entityId=live.id
   })
   return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store','referrer-policy':'no-referrer'}})
  }
  const d=currentDocument(a),base=`/book/stay/agreement/${token}`,code=data.codes.find(c=>c.bookingId===b.id&&c.holder==='guest'&&c.status==='issued')
  return shell('Your rental agreement',`<h1>Your rental agreement</h1><p>${h(data.properties.find(p=>p.id===b.propertyId)?.name)} · ${h(b.start.slice(0,10))} to ${h(b.end.slice(0,10))}</p><p>${h(d.reason)}. ${accessBlocked(data,b.id)?'Guest door access and check-in instructions wait for your current signature.':''}</p><section class="panel"><h2>${h(d.title)}</h2><p>Document ${h(d.id)} · Template ${h(d.templateVersion)}</p><pre class="agreement">${h(d.text)}</pre>${d.signature?`<p>Signed by ${h(d.signature.name)} at ${h(d.signature.at)}.</p><a href="${h(base+'/document/'+d.id)}">Download saved signed version</a>${code?.link?`<p><a href="/stay/${h(code.link)}">Open your arrival details</a></p>`:''}`:post(base,hidden('version',d.id)+hidden('sha256',d.sha256)+field('name','Electronic signature (full guest name)','text',d.guestName,'maxlength="120" autocomplete="name"')+field('email','Reservation email','email',b.guestEmail??'','maxlength="254" autocomplete="email"')+'<label class="check"><input type="checkbox" name="consent" value="yes" required>I reviewed this exact agreement and consent to electronic records and my electronic signature. I can download and retain my signed copy.</label>','Sign this agreement')}</section><section class="panel"><h2>Previous signed versions</h2>${a.documents.filter(v=>v.id!==d.id&&v.signature).map(v=>`<p><a href="${h(base+'/document/'+v.id)}">${h(v.signature!.at)} · ${h(v.reason)}</a></p>`).join('')||'<p>No earlier signed versions.</p>'}</section>`)
 }catch(error){return shell('Agreement needs attention',`<h1>Agreement needs attention</h1><p>${h((error as any).status?(error as Error).message:'Could not complete signing. Return to your agreement link and try again.')}</p>`,Number((error as any).status)||500)}
}
