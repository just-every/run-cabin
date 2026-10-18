import { h, form, hidden, field, area, money, panel, empty } from './shared'
export function blockEditor(s:any){
 const rows=s.bookings.filter((b:any)=>b.blockUse&&b.status==='confirmed').map((b:any)=>{
  const u=b.blockUse,job=s.turnovers.find((t:any)=>t.bookingId===b.id&&t.status!=='cancelled'),done=job?.status==='completed'
  return `<article class="record"><h3>${h(s.properties.find((p:any)=>p.id===b.propertyId)?.name)} · ${u.purpose==='owner'?'Owner personal stay':'Maintenance block'}</h3><p>${h(b.start)} → ${h(b.end)} · ${h(u.reason)}</p><p>Cleaning: ${h(job?.status??'not scheduled')}${u.cleaningCents?` · ${money(u.cleaningCents)} owner-use payable ${done?'recorded':'after evidenced completion'} · ${h(u.ownerName)}`:' · no agreed owner-use charge'}. No guest revenue.</p>${!done?`<details><summary>Edit blocked nights</summary>${form('block.edit','reservations',hidden('id',b.id)+hidden('revision',b.revision)+field('start','First night','date',b.start.slice(0,10))+field('end','Open again on','date',b.end.slice(0,10))+area('note','Reason',u.reason),'Save blocked nights')}</details>`:'<p>Completed cleaning and its allocation remain as evidence.</p>'}${form('reservation.cancel','reservations',hidden('id',b.id)+hidden('revision',b.revision),'Cancel block and release nights')}</article>`
 }).join('')
 return panel('Owner stays and maintenance blocks',rows||empty('No active owner or maintenance blocks.'))
}
