import { guestGroup } from '../guests/resolve'
import { need, text, type Context } from '../model'
export interface ErasureScope { entity:'guest'|'property'|'member'; id:string; revision:string; bookings:Set<string>; properties:Set<string>; values:string[] }
export async function erasureScope(c:Context,p:Record<string,unknown>):Promise<ErasureScope> {
 const entity=text(p.entity??'property','entity'),id=text(p.id,'record ID')
 need(entity==='guest'||entity==='property'||entity==='member','Choose guest, property or member')
 const row=entity==='guest'?c.data.bookings.find(b=>b.id===id):entity==='property'?c.data.properties.find(v=>v.id===id):c.data.members.find(m=>m.id===id)
 need(row,'Record not found',404);need(String(row.revision)===String(p.revision),'Record changed. Review it again before erasing.',409)
 let bookings=entity==='property'?c.data.bookings.filter(b=>b.propertyId===id):[]
 if(entity==='guest'){
  const b=c.data.bookings.find(b=>b.id===id)!,origin=c.data.guests.find(g=>g.bookingId===id),group=origin?guestGroup(c.data,origin.id):[]
  const groupIds=new Set(group.map(g=>g.bookingId))
  bookings=c.data.bookings.filter(v=>v.id===id||(group.length?groupIds.has(v.id):!!b.guestEmail&&v.guestEmail?.toLowerCase()===b.guestEmail.toLowerCase()||!!b.guestPhone&&v.guestPhone===b.guestPhone))
 }
 const values=entity==='member'?[(row as any).name,(row as any).email]:entity==='property'?[(row as any).name,(row as any).ownerName,(row as any).ownerEmail,...bookings.flatMap(b=>[b.guestName,b.guestEmail,b.guestPhone])]:bookings.flatMap(b=>[b.guestName,b.guestEmail,b.guestPhone])
 if(entity==='property')for(const b of bookings)collectOwners(b.managementTerms,values)
 if(entity==='member'){
  const operator=await c.db.prepare('SELECT display_name FROM oa_operators WHERE email=? COLLATE NOCASE').bind((row as any).email).first<{display_name:string}>();if(operator)values.push(operator.display_name)
  const profile=c.data.cleanerProfiles.find(v=>v.id===id);if(profile)values.push(profile.homeBase)
 }
 return {entity,id,revision:String(row.revision),bookings:new Set(bookings.map(b=>b.id)),properties:new Set(entity==='property'?[id]:bookings.map(b=>b.propertyId)),values:[...new Set(values.filter((v):v is string=>typeof v==='string'&&!!v))]}
}
function collectOwners(row:any,values:any[]){if(!row||typeof row!=='object')return;for(const [key,value] of Object.entries(row)){if(['ownerName','ownerEmail'].includes(key)&&typeof value==='string')values.push(value);if(key==='owners'&&Array.isArray(value))for(const owner of value)values.push(owner.name,owner.email);else if(value&&typeof value==='object')collectOwners(value,values)}}
export function inScope(s:ErasureScope,row:any){return s.entity==='property'?row.propertyId===s.id:s.entity==='guest'?s.bookings.has(row.bookingId)||s.bookings.has(row.nextBookingId):[row.actorId,row.preparedBy,row.approvedBy,row.memberId,row.cleanerId,row.assigneeId,row.raisedBy,row.closedBy,row.createdBy,row.recordedBy].includes(s.id)}
export function scrub(value:any,values:string[]):any {
 if(typeof value==='string'){if(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32,128})$/i.test(value))return value;for(const v of values)if(v.length>=3)value=value.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[erased]');return value}
 if(Array.isArray(value))return value.map(v=>scrub(v,values))
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v,values)]))
 return value
}
