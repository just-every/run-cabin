import { promotionGuestPanel } from '../promotions/guest'
import { guestIssuePanels } from '../issues/ui'
import { verificationGuestPanel } from '../verification/guest'
import { guestWorkForm } from '../work-orders/guest'
import { accessBlocked } from '../agreements/records'
import { guestRecovery } from '../recovery/guest'
import { homeSettings } from '../homes'
import { codeState } from '../codes'
import { between, instant, when } from '../clock'
import { h } from '../ui/shared'
import { unseal } from '../seal'
import type { Bindings } from '../../auth.server'
import { portalGuide,portalTasks,reservationFacts,accessLive } from './page'
import { portalBalance } from './balance'
import { portalShell } from './shell'
import type { PortalContext } from './auth'

export function portalAccess(p:PortalContext){
 const settings=homeSettings({data:p.data},p.booking.propertyId),code=p.data.codes.find(c=>c.bookingId===p.booking.id&&c.holder==='guest'&&c.status==='issued'),blocked=accessBlocked(p.data,p.booking.id),ended=Date.now()>=instant(`${p.booking.end.slice(0,10)}T${p.booking.departureTime??settings.checkOutTime}`,settings.timeZone)
 return {settings,code,blocked,ended,live:!!code&&accessLive(code,p.booking,blocked)}
}
export async function stayPage(request:Request,env:Bindings,p:PortalContext,reported=false){
 const {data,booking,link}=p,home=data.properties.find(h=>h.id===booking.propertyId)!,path='/stay/'+link.token,{settings:s,code,blocked,ended,live}=portalAccess(p)
 const body=ended?'<p class="notice">Your stay has ended, so your door code and arrival instructions are no longer shown.</p>':blocked||!code?'<p class="notice">Complete your required tasks before door access is released. Your host will confirm when access is ready.</p>':!live?'<p class="notice">Your host has withheld access. Contact your host.</p>':`<div class="code-card"><p class="eyebrow">Your door code</p><p class="code">${h(code.code)}</p><p class="chip ${codeState(code)==='active'?'chip-good':''}"><span class="dot"></span>${h(codeState(code)==='active'?'Active now':codeState(code)==='scheduled'?'Not active yet':'Expired')}</p><p>Works ${h(between(code.validFrom,code.validUntil))}.</p></div><dl class="facts"><dt>Check in</dt><dd>${h(when(code.validFrom))}</dd><dt>Check out</dt><dd>${h(when(code.validUntil))}</dd><dt>Address</dt><dd>${s.address?`<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(s.address)}" rel="noreferrer">${h(s.address)}</a>`:'Your host will send the address.'}</dd></dl><p class="muted">${code.lock.state==='set'?'This code is set on the door lock.':'Your host sets this code on the door keypad before you arrive.'}</p>`
 let offers=await promotionGuestPanel(env,booking.id)
 for(const offer of (await env.DB.prepare("SELECT id,data FROM cb_records WHERE kind='promotionOffers' AND json_extract(data,'$.bookingId')=?").bind(booking.id).all<{id:string;data:string}>()).results){const raw=JSON.parse(offer.data),token=raw.tokenSealed?await unseal(env.SESSION_SECRET,'promotion-offer',raw.tokenSealed):null;if(token)offers=offers.replace(`href="/offers/${token}"`,`href="${path}/offers/${offer.id}"`)}
 const tasks=(await portalTasks(env,data,booking,path)).replace(/href="\/book\/stay\/agreement\/[a-f0-9-]{72}"/g,`href="${path}/agreement"`)
 const identity=verificationGuestPanel(data,booking.id).replace(/href="\/book\/verification\/[a-f0-9-]{72}"/g,`href="${path}/verification"`)
 const reporting=!ended?guestWorkForm()+guestRecovery(data,booking.id)+`<section class="panel"><h2>Report a problem</h2><p>Your host reviews the problem and approves the response. For an emergency, contact local emergency services.</p><form method="post"><label>Issue type<select name="category"><option value="other">Host review</option><option value="access">Access problem</option><option value="maintenance">Maintenance</option><option value="cleaning">Cleaning</option><option value="emergency">Emergency — call 911 now</option></select></label><label>What needs attention?<textarea name="reason" rows="4" maxlength="2000" required></textarea></label><button type="submit">Report to your host</button></form></section>`:''
 return portalShell(home.name,`<section class="panel stay-sheet"><p class="eyebrow">Your stay</p><h1>${h(home.name)}</h1><dl class="facts">${reservationFacts(booking,s)}</dl>${body}</section>${tasks}${live?portalGuide(data,s,home.id,path):''}${identity}${offers}${guestIssuePanels(data,booking.id)}${new URL(request.url).searchParams.get('maintenance')==='reported'?'<p class="notice" role="status">Maintenance report saved. Your host and maintenance team will follow up.</p>':''}${reporting}${reported?'<p class="notice" role="status">Problem reported. Your host has a recovery case and will follow up.</p>':''}<form method="post" action="${path}/signout"><button>End this guest session</button></form>`)
}
export async function stayJson(env:Bindings,p:PortalContext){
 const {data,booking}=p,{settings,code,live}=portalAccess(p),balance=await portalBalance(env,data,booking)
 const agreement=data.rentalAgreements.find(a=>a.bookingId===booking.id),verification=data.verifications.find(v=>v.bookingId===booking.id)
 return Response.json({home:data.properties.find(h=>h.id===booking.propertyId)?.name,reservation:{id:booking.id,guestName:booking.guestName,status:booking.status,start:booking.start,end:booking.end},tasks:{agreement:agreement?{required:agreement.required,signed:!!agreement.documents.at(-1)?.signature}:null,verification:verification?{status:verification.status}:null,payment:balance},access:live&&code?{code:code.code,validFrom:code.validFrom,validUntil:code.validUntil,state:codeState(code)}:null,guide:live&&settings.guide?{version:settings.guide.version,arrival:settings.guide.arrival,guidebook:settings.guide.guidebook,files:settings.guide.files,updatedAt:settings.guide.updatedAt}:null,houseRules:live?data.propertyProfiles.find(h=>h.propertyId===booking.propertyId)?.houseRules??'':null},{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
}
