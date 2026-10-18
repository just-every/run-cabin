import { h, form, hidden, field, area } from '../ui/shared'
import { arrivalChecks, readinessPlan } from './records'
import { instant } from '../clock'
import { homeSettings } from '../homes'
import type { HomeReadiness } from '../readiness'
export function readinessEvidence(s: any, r: HomeReadiness) {
 const p = r.property, plan = readinessPlan(s,p.id)
 const config = `<details><summary>Supply requirements and inspector</summary>${form('readiness.plan','readiness',hidden('propertyId',p.id)+hidden('revision',plan.revision)+area('supplies','Supply and restock items, one per line',plan.supplies.join('\n'))+`<label>Inspector<select name="inspectorId"><option value="owner"${plan.inspectorId === 'owner' ? ' selected' : ''}>Installation owner</option>${s.members.filter((m:any)=>m.active&&m.role==='manager').map((m:any)=>`<option value="${h(m.id)}"${plan.inspectorId===m.id?' selected':''}>${h(m.name)}</option>`).join('')}</select></label>`,'Save requirements')}</details>`
 if (!r.arrival) return config
 const a = r.arrival, info = arrivalChecks(s,a,r.turnover,r.blockers,r.guestCode)
 const identity = hidden('bookingId',a.id)+hidden('baseline',info.baseline)+hidden('revision',info.saved?.revision ?? '')
 const inspector = plan.inspectorId === 'owner' ? 'Installation owner' : s.members.find((m:any)=>m.id===plan.inspectorId)?.name ?? 'Unavailable inspector'
 const items = info.items.map(item => {
  const v = item.attestation
  const saved = v ? `<p><strong>${h(v.status)}</strong> · ${h(v.name)} · <time>${h(v.at)}</time><br>${h(v.note)}${v.guestImpact ? `<br>Guest impact: ${h(v.guestImpact)}` : ''}</p>` : '<p>Pending attestation</p>'
  return `<section class="readiness-item"><h4>${h(item.label)}</h4>${saved}${form('readiness.attest','readiness',identity+hidden('item',item.id)+`<label>Outcome<select name="status">${!item.id.startsWith('maintenance:')?'<option value="passed">Physically checked and passed</option>':''}<option value="failed">Failed or short</option><option value="excepted">Manager exception</option></select></label>`+area('note','Evidence or exception reason','','maxlength="1000"')+`<label>Guest impact and mitigation (required for an exception)<textarea name="guestImpact" maxlength="1000" rows="2"></textarea></label>`,'Record outcome')}</section>`
 }).join('')
 const due = instant(`${a.start.slice(0,10)}T${a.arrivalTime ?? homeSettings(s,p.id).checkInTime}`,homeSettings(s,p.id).timeZone)
 const overdue = r.state !== 'ready' && due <= Date.now()
 const followup = info.saved?.chases.map(c=>`<li>${h(c.name)} · ${h(c.at)}: ${h(c.note)}</li>`).join('') ?? ''
 return `<div class="arrival-evidence"><p><strong>${overdue?'Overdue arrival — action needed':r.state==='ready'?'Arrival verified':'Arrival at risk until verified'}</strong></p><p>Inspector: ${h(inspector)}. Physical checks record what a person observed; cleaner photos do not certify building safety.</p>${info.saved&&!info.current?'<p role="status">Stay or work evidence changed. Review and attest again. Earlier outcomes are retained below.</p>':''}<details><summary>Review arrival evidence</summary>${items}</details>${r.state!=='ready'?`<details><summary>Chase overdue or pending work</summary>${form('readiness.chase','readiness',identity+area('note','Responsible person and follow-up action','','maxlength="1000"'),'Record follow-up')}</details>`:''}${followup?`<h4>Follow-up</h4><ul>${followup}</ul>`:''}${info.saved?.history?.length?`<details><summary>Earlier observations</summary>${info.saved.history.flatMap(batch=>batch.attestations).map(v=>`<p>${h(v.item)} · ${h(v.status)} · ${h(v.name)} · ${h(v.at)}: ${h(v.note)}${v.guestImpact?` · Guest impact: ${h(v.guestImpact)}`:''}</p>`).join('')}</details>`:''}${config}</div>`
}
