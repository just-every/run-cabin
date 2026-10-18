import type { Bindings } from '../../auth.server'
import { need, type AccessCode, type Booking } from '../model'
import { mutate, SYSTEM } from '../storage'
import { createMaintenanceTask } from '../maintenance'
import { settle } from '../settle'

/** A stay link authorizes a report for that stay's home only, never staff actions. */
export async function guestWorkReport(request:Request,env:Bindings,token:string,code:AccessCode,booking:Booking){
 const headers={'cache-control':'no-store','referrer-policy':'no-referrer'}
 try{
  need(request.headers.get('origin')===env.AUTH_ORIGIN,'Request refused',403)
  const limit=1_600_000;need(Number(request.headers.get('content-length')??0)<=limit,'Use up to six photos of 256 KB each',413)
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();need(false,'Use up to six photos of 256 KB each',413)}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length}
  const data=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()
  need(data.get('action')==='maintenance','Unknown action')
  const photos:{photo:string;mimeType:string}[]=[]
  for(const file of data.getAll('photoFiles')){
   need(file instanceof File&&file.size>0&&file.size<=256_000,'Choose photos up to 256 KB')
   const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b)
   photos.push({photo:btoa(binary),mimeType:file.type})
  }
  need(photos.length>=1&&photos.length<=6,'Add one to six photos of the problem')
  await mutate(env.DB,{...SYSTEM,id:code.id},'maintenance.guest.report',async c=>{
   const current=c.data.codes.find(r=>r.link===token&&r.status==='issued'),b=current&&c.data.bookings.find(b=>b.id===current.bookingId&&b.status==='confirmed')
   need(b&&b.id===booking.id,'Your stay changed. Reload before reporting.',409)
   const t=c.data.turnovers.find(t=>t.bookingId===b.id&&t.status!=='cancelled')
   await createMaintenanceTask(c,b.propertyId,t?.id??null,{title:data.get('title'),note:data.get('note'),photos},'Guest · '+(b.guestName||'private stay'))
  })
  await settle(env)
  return new Response(null,{status:303,headers:{...headers,location:'/stay/'+token+'?maintenance=reported'}})
 }catch(error){const e=error as Error&{status?:number};return new Response(e.status?e.message:'Could not save this report. Reload and try again.',{status:e.status??500,headers})}
}
export const guestWorkForm=()=>`<section class="panel"><h2>Report something broken</h2><p>A work order goes to the home’s maintenance person. For an emergency, contact local emergency services and your host immediately.</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="action" value="maintenance"><label>What is broken?<input name="title" maxlength="120" required></label><label>Details<textarea name="note" rows="3" maxlength="1000"></textarea></label><label>Photos of the problem (1–6, up to 256 KB each)<input name="photoFiles" type="file" accept="image/png,image/jpeg" multiple required></label><button type="submit">Send maintenance report</button></form></section>`
