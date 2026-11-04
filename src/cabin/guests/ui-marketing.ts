import { h, form, hidden, field, select, propertyName } from '../ui/shared'
import type { GuestProfile } from './types'

export function marketingConsentForm(s:any,origin:GuestProfile) {
 if(s.actor.role!=='owner')return ''
 const booking=s.bookings.find((b:any)=>b.id===origin.bookingId)
 if(!booking||booking.guestErasedAt)return ''
 const contacts=origin.identities.filter(i=>i.kind==='email'&&i.value.toLowerCase()===booking.guestEmail?.trim().toLowerCase())
 return `<details class="marketing-consent"><summary>Record separate marketing consent</summary><p>Repeat-stay marketing needs its own explicit guest decision and a verified current email at this home. A booking or returning-offer decision supplies no marketing permission.</p>${form('guest.consent','guests',hidden('id',origin.id)+hidden('revision',origin.revision)+hidden('propertyId',booking.propertyId)+hidden('purpose','marketing')+`<p>Home: ${h(propertyName(s,booking.propertyId))}</p>`+select('allowed','Marketing decision',[['yes','Explicit marketing opt-in'],['no','Marketing opt-out']])+`<label>Current email<select name="identityId"><option value="">No verified email selected</option>${contacts.map(i=>`<option value="${h(i.id)}">${h(i.value)} · ${i.verified?'verified':'verify first'}</option>`).join('')}</select></label>`+field('source','Separate marketing evidence','text','','maxlength="400"')+`<label class="check"><input name="confirm" type="checkbox" value="yes">The guest separately requested repeat-stay marketing.</label>`,'Record marketing decision')}</details>`
}
export function marketingPanel(s:any) {
 if(s.actor.role!=='owner')return ''
 const prepare=form('guest.marketing.prepare','guests',select('propertyId','Segment home',s.properties.map((p:any)=>[p.id,p.name]))+field('label','Segment name','text','','maxlength="100"'),'Prepare local segment')
 const segments=(s.guestSegments??[]).map((segment:any)=>`<article class="record marketing-segment"><h3>${h(segment.label)}</h3><p>${h(propertyName(s,segment.propertyId))} · ${h(segment.status)} · prepared ${h(segment.preparedAt)}</p>${segment.status==='prepared'?`<p>${segment.members.length} eligible guest${segment.members.length===1?'':'s'} · ${segment.excluded} excluded. Local preview only.</p><ul>${segment.members.map((m:any)=>`<li>${h(m.name)} · ${h(m.email)} · <a href="#guest-${h(m.guestId)}">Review identity and consent</a></li>`).join('')}</ul>${form('guest.marketing.review','guests',hidden('id',segment.id)+hidden('revision',segment.revision),'Recheck local preparation')}`:'<p>This preparation is inactive. Review current identities, consent and authority, then prepare a fresh segment.</p>'}</article>`).join('')
 return `<section class="panel" id="marketing"><h2>Repeat-stay marketing preparation</h2><p>Owner-reviewed local segments include completed stays with separately evidenced marketing opt-in and a verified current email. An opt-out on any merged origin suppresses the guest. Changes to identities, consent or team grants invalidate the preview.</p><p>Preparation stays in Cabin. It does not export contacts, sync an audience, send a campaign or complete guest recovery.</p>${prepare}${segments}</section>`
}
