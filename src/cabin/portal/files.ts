import { integer, manager, need, newId, query, sha, text, type Context } from '../model'
import type { Bindings } from '../../auth.server'
import type { GuestGuide } from './types'
import type { PortalContext } from './auth'

const media=new Set(['application/pdf','text/plain','image/png','image/jpeg'])
export async function guideFileCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!['portal.guide.file.add','portal.guide.file.remove'].includes(name))return undefined
 manager(c.actor);const settings=c.data.homeSettings.find(s=>s.propertyId===text(p.propertyId,'home'))
 need(settings?.guide,'Save this home’s guide first',409)
 const guide=settings.guide,version=integer(Number(p.version),'guide version',1)
 need(guide.version===version,'This guide changed. Reload before saving.',409)
 const files=guide.files??=[]
 if(name==='portal.guide.file.add'){
  need(files.length<5,'Use up to five guide files',409)
  const file=p.guideFile as {name?:unknown;mimeType?:unknown;base64?:unknown}|undefined
  need(file&&typeof file.base64==='string'&&file.base64.length<=1_333_336,'Choose a guide file up to 1 MB')
  const mimeType=text(file.mimeType,'file type'),name=text(file.name,'file name',160).replace(/[\r\n\x00-\x1f/\\]/g,'_')
  need(media.has(mimeType),'Use a PDF, text, PNG or JPEG file')
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0))}catch{need(false,'Invalid file bytes')}
  need(bytes.length>0&&bytes.length<=1_000_000,'Choose a guide file up to 1 MB')
  const signature=String.fromCharCode(...bytes.slice(0,8))
  need(mimeType==='text/plain'?!bytes.includes(0):mimeType==='application/pdf'?signature.startsWith('%PDF-'):mimeType==='image/png'?signature==='\x89PNG\r\n\x1a\n':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'The file does not match its type')
  const id=newId(),sha256=await sha(bytes)
  files.push({id,name,mimeType,sha256,size:bytes.length})
  c.queries.push(query('INSERT INTO cb_guest_guide_files(id,property_id,name,mime_type,sha256,bytes,created_at) VALUES(?,?,?,?,?,?,?)',id,settings.propertyId,name,mimeType,sha256,bytes,c.now))
 }else{
  const id=text(p.fileId,'file'),index=files.findIndex(f=>f.id===id);need(index>=0,'Guide file not found',404)
  files.splice(index,1);c.queries.push(query('DELETE FROM cb_guest_guide_files WHERE id=? AND property_id=?',id,settings.propertyId))
 }
 guide.version++;guide.updatedAt=c.now;guide.updatedBy=c.actor.id;c.entityId=settings.propertyId
 return {version:guide.version,files}
}
export async function guestGuideFile(env:Bindings,p:PortalContext,id:string){
 const guide=p.data.homeSettings.find(s=>s.propertyId===p.booking.propertyId)?.guide,file=guide?.files?.find(f=>f.id===id)
 need(file,'Guide file not found',404)
 const row=await env.DB.prepare('SELECT hex(bytes) AS bytes_hex FROM cb_guest_guide_files WHERE id=? AND property_id=? AND sha256=?').bind(id,p.booking.propertyId,file.sha256).first<{bytes_hex:string}>()
 need(row,'Guide file not found',404)
 const bytes=Uint8Array.from(row.bytes_hex.match(/../g)??[],s=>parseInt(s,16))
 need(await sha(bytes)===file.sha256,'Guide file integrity check failed',500)
 return new Response(bytes,{headers:{'content-type':file.mimeType,'content-disposition':`attachment; filename="guide-file"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
export function guideFilesHtml(guide:GuestGuide|undefined,path:string){return guide?.files?.length?`<h3>Guide files</h3><ul>${guide.files.map(f=>`<li><a href="${path}/files/${f.id}">${escape(f.name)}</a> · ${f.size} bytes</li>`).join('')}</ul>`:''}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
