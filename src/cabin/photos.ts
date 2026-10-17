import { type Context, type StoredPhoto, need, text, newId, query, sha } from './model'
const LIMIT = 256_000
function crc32(bytes: Uint8Array) { let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0 }
function png(bytes: Uint8Array) {
 if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return false
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let pos=8,header=false,data=false,end=false
 while(pos+12<=bytes.length){const size=view.getUint32(pos),type=String.fromCharCode(...bytes.slice(pos+4,pos+8));if(pos+12+size>bytes.length)return false
  if(crc32(bytes.slice(pos+4,pos+8+size))!==view.getUint32(pos+8+size))return false
  if(!header){if(type!=='IHDR'||size!==13)return false;const w=view.getUint32(pos+8),h=view.getUint32(pos+12);if(!w||!h||w>12000||h>12000)return false;header=true}
  if(type==='IDAT'&&size>0)data=true
  if(type==='IEND'){if(size!==0||pos+12!==bytes.length)return false;end=true}
  pos+=12+size
 }
 return header&&data&&end&&pos===bytes.length
}
function jpeg(bytes:Uint8Array){
 if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return false
 let pos=2,frame=false,scan=false
 while(pos<bytes.length-2){if(bytes[pos++]!==255)return false;while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===0xd9)break
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue
  if(pos+2>bytes.length)return false;const size=bytes[pos]*256+bytes[pos+1];if(size<2||pos+size>bytes.length)return false
  if([0xc0,0xc1,0xc2].includes(marker)){if(size<8||!(bytes[pos+3]*256+bytes[pos+4])||!(bytes[pos+5]*256+bytes[pos+6]))return false;frame=true}
  pos+=size
  if(marker===0xda){scan=true;let data=0;while(pos<bytes.length-2){if(bytes[pos]!==255){pos++;data++;continue}if(bytes[pos+1]===0||(bytes[pos+1]>=0xd0&&bytes[pos+1]<=0xd7)){pos+=2;data++;continue}break}if(!data)return false}
 }
 return frame&&scan&&pos===bytes.length-2
}
export function photoBytes(value:unknown,mime:unknown){
 const encoded=text(value,'base64 photo',Math.ceil(LIMIT/3)*4)
 need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),'Photo must use plain base64')
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));need(bytes.length>0&&bytes.length<=LIMIT,'Upload a photo up to 256 KB')
 const media=png(bytes)?'image/png':jpeg(bytes)?'image/jpeg':null
 need(media&&media===mime,'Upload a valid PNG or JPEG photo with the matching MIME type')
 return {bytes,mimeType:media}
}
/** A command's photos: `photos` [{photo, mimeType}] from the phone, or one `photo` and `mimeType`. */
export function photoList(p: Record<string, unknown>, min: number, max = 12) {
 const list = Array.isArray(p.photos) ? p.photos : p.photo === undefined ? [] : [{ photo: p.photo, mimeType: p.mimeType }]
 need(list.length >= min, min === 1 ? 'Add a photo' : `Add at least ${min} photos`); need(list.length <= max, `Add at most ${max} photos`)
 return list.map((v: any) => photoBytes(v?.photo, v?.mimeType))
}
/** Private bytes in cb_photos beside the record they evidence, after the ones it already has.
 * The same bytes already stored for the record, and not in `inUse`, are reused rather than
 * stored again: a reopened job marked ready again, or a resent form, adds no copies. */
export async function storePhotos(c: Context, recordId: string, photos: { bytes: Uint8Array; mimeType: string }[], caption: string, inUse: string[] = []): Promise<StoredPhoto[]> {
 const kept = (await c.db.prepare('SELECT id,mime_type AS mimeType,sha256,position FROM cb_photos WHERE turnover_id=? ORDER BY position').bind(recordId).all<StoredPhoto & { position: number }>()).results
 let next = kept.reduce((n, p) => Math.max(n, p.position + 1), 0)
 const free = kept.filter(p => !inUse.includes(p.id)), stored: StoredPhoto[] = []
 for (const photo of photos) {
  const digest = await sha(photo.bytes), same = free.findIndex(p => p.sha256 === digest && p.mimeType === photo.mimeType)
  if (same >= 0) { const [p] = free.splice(same, 1); stored.push({ id: p.id, mimeType: p.mimeType, sha256: p.sha256 }); continue }
  const id = newId()
  c.queries.push(query('INSERT INTO cb_photos(id,turnover_id,position,mime_type,bytes,sha256,caption,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?)', id, recordId, next++, photo.mimeType, photo.bytes, digest, caption, c.actor.id, c.now))
  stored.push({ id, mimeType: photo.mimeType, sha256: digest })
 }
 return stored
}
