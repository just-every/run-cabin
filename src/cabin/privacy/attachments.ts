import { kinds, query, newId, need, type Context } from '../model'
import { inScope, scrub, type ErasureScope } from './scope'
/** Evidence files cannot be safely edited in place. Delete the whole affected
 * original, and remove its references from operational records in the batch. */
export async function eraseAttachments(c:Context,s:ErasureScope){
 const parents=new Set<string>()
 for(const kind of ['turnovers','tasks','propertyProfiles'] as const)for(const row of c.data[kind])if(inScope(s,row)||kind==='turnovers'&&s.bookings.has((row as any).id))parents.add(row.id)
 for(const t of c.data.tasks)if(t.turnoverId&&parents.has(t.turnoverId))parents.add(t.id)
 const photos=(await c.db.prepare('SELECT id,turnover_id AS parent FROM cb_photos WHERE turnover_id IN (SELECT value FROM json_each(?)) OR uploaded_by=?').bind(JSON.stringify([...parents]),s.entity==='member'?s.id:'').all<{id:string;parent:string}>()).results
 if(s.entity==='member'){
  const operator=await c.db.prepare('SELECT id FROM oa_operators WHERE email=(SELECT email FROM cb_members WHERE id=?) COLLATE NOCASE').bind(s.id).first<{id:string}>()
  if(operator)photos.push(...(await c.db.prepare('SELECT id,turnover_id AS parent FROM cb_photos WHERE uploaded_by=?').bind(operator.id).all<{id:string;parent:string}>()).results)
 }
 for(const photo of photos){parents.add(photo.parent);c.queries.push(query('DELETE FROM cb_photos WHERE id=?',photo.id))}
 for(const t of c.data.turnovers)if(parents.has(t.id)){if(t.completion){delete t.completion;t.status=t.cleanerId?'approved':'unassigned';t.revision=newId()}}
 for(const t of c.data.tasks)if(parents.has(t.id)){t.photos=[];t.closePhotos=[];t.note='';t.closeNote='';t.revision=newId()}
 return photos.length
}
export async function fenceSending(c:Context,s:ErasureScope){
 const matches=(r:any)=>inScope(s,r)||s.values.some(v=>v.toLowerCase()===r.email?.toLowerCase()||v===r.phone)
 need(![...c.data.messages,...c.data.notices,...c.data.scheduled,...c.data.deliveries].some(r=>matches(r)&&r.status==='sending'),'A scoped delivery is in flight. Wait for its result before erasing.',409)
 const tax=(await c.db.prepare("SELECT d.data,r.property_id FROM cb_tax_deliveries d JOIN cb_tax_reports r ON r.id=d.report_id WHERE d.status='sending'").all<any>()).results
 need(!tax.some(r=>s.properties.has(r.property_id)||s.values.some(v=>r.data.toLowerCase().includes(v.toLowerCase()))),'A scoped tax packet is in flight. Wait for its result before erasing.',409)
}
export function scrubOperational(c:Context,s:ErasureScope){
 for(const kind of kinds)for(const row of c.data[kind] as any[]){
  // Signed bytes remain exact legal evidence. Scoped guest copies have already
  // moved into isolated holds; property copies are deleted in the same batch.
  if(kind==='rentalAgreements')continue
  if(kind==='staffQuotes'&&(inScope(s,row)||s.values.some(v=>v.toLowerCase()===row.email?.toLowerCase()))){row.status='expired';row.tokenHash='';row.tokenSealed='';row.revision=newId();const hold=c.data.bookings.find(b=>b.id===row.holdBookingId);if(hold){hold.status='cancelled';hold.cancelled=true;hold.revision=newId()}}
  // Contact values can occur in cross-home snapshots or free text too. Retained
  // originals are isolated in the hold store before this anonymization.
 const clean=scrub(row,s.values);Object.assign(row,clean)
  if(kind==='notices'&&(inScope(s,row)||s.values.some(v=>v.toLowerCase()===(c.before.notices.find(n=>n.id===row.id)?.email??'').toLowerCase()))){Object.assign(row,{email:'',subject:'Erased notice',text:'',detail:null,status:'suppressed',revision:newId()})}
  if(kind==='tasks'&&(inScope(s,row)||s.entity==='guest'&&row.turnoverId&&c.data.turnovers.some(t=>t.id===row.turnoverId&&s.bookings.has(t.bookingId)))){const task=row as import('../model').Task;if(task.work){if(task.work.quote)task.work.quote.photos=[];if(task.work.invoice)task.work.invoice.photos=[];if(task.work.completed)task.work.completed.photos=[]}}
 }
}
