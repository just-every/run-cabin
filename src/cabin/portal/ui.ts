import { h, form, hidden, area, panel } from '../ui/shared'
import { homeSettings } from '../homes'

/** Managers can issue links before physical access, end sessions and publish versioned guide files. */
export function portalPanel(s:any){
 const homes=s.properties.filter((p:any)=>s.homeSettings.some((r:any)=>r.propertyId===p.id)).map((p:any)=>{
  const guide=homeSettings(s,p.id).guide
  const links=(s.guestPortalLinks??[]).filter((link:any)=>link.propertyId===p.id&&link.status==='active'&&Date.parse(link.expiresAt)>Date.now()).map((link:any)=>{
   const stay=s.bookings.find((b:any)=>b.id===link.bookingId)
   return `<li>${h(stay?.guestName??'Guest')} · ${h(stay?.start.slice(0,10))} to ${h(stay?.end.slice(0,10))} ${link.token?`<a href="/stay/${h(link.token)}">Open guest portal</a>`:''} ${form('portal.link.rotate','turnovers',hidden('bookingId',link.bookingId),'Replace guest link')} ${form('portal.sessions.end','turnovers',hidden('bookingId',link.bookingId),'End guest sessions')}</li>`
  }).join('')
  const body=hidden('propertyId',p.id)+hidden('version',guide?.version??0)+area('arrival','Arrival instructions (shown only while access is released)',guide?.arrival??'','maxlength="12000"')+`<label>Digital guidebook (optional)<textarea name="guidebook" rows="6" maxlength="12000">${h(guide?.guidebook??'')}</textarea></label>`
  const files=guide?`<h3>Guide files</h3>${guide.files?.length?`<ul>${guide.files.map((file:any)=>`<li>${h(file.name)} · ${file.size} bytes${form('portal.guide.file.remove','turnovers',hidden('propertyId',p.id)+hidden('version',guide.version)+hidden('fileId',file.id),'Remove guide file')}</li>`).join('')}</ul>`:'<p>No guide files.</p>'}${form('portal.guide.file.add','turnovers',hidden('propertyId',p.id)+hidden('version',guide.version)+'<label>Guide file (up to 1 MB)<input name="guideFile" type="file" accept="application/pdf,text/plain,image/png,image/jpeg" required></label><p class="muted">Up to five PDF, text or image files. Guests download the saved original after verification and access release. Adding or removing a file updates the guide version.</p>','Add guide file','enctype="multipart/form-data"')}`:''
  return `<details class="home-settings"><summary><strong>${h(p.name)}</strong> · ${guide?'guide version '+guide.version:'no guide yet'}</summary>${form('portal.guide','turnovers',body,'Save guide')}<p class="muted">House rules come from the property profile. Saving changed text raises the version guests see.</p>${files}${links?`<h3>Guest links</h3><ul>${links}</ul><p class="muted">Each browser verifies the reservation’s saved email. Links stop working seven days after check-out. Replacement ends the old link and guest sessions at once.</p>`:''}</details>`
 }).join('')
 return panel('Guest portal by home',homes||'<p class="empty">Save a home’s turnover settings first; then write its guide here.</p>')
}
