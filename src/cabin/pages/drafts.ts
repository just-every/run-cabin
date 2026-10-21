import type { Actor, Data } from '../model'
import { inIds, scoped } from './core'
/** Count pending conversations, not individual drafts or selected-page records. */
export async function draftThreadCount(db:D1Database,actor:Actor,data:Data) {
 const restricted=!!actor.scope&&!actor.scope.propertyIds.includes('*'),homes=scoped(data)
 const result=await db.batch<any>([
  db.prepare(`SELECT json_extract(r.data,'$.bookingId') bookingId,json_extract(r.data,'$.email') email,json_extract(r.data,'$.phone') phone,json_extract(r.data,'$.ref') ref,b.id matched FROM cb_records r LEFT JOIN cb_records b ON b.kind='bookings' AND b.id=json_extract(r.data,'$.bookingId') WHERE r.kind='messages' AND json_extract(r.data,'$.status') IN ('draft','drafting')${restricted?` AND (${inIds("json_extract(r.data,'$.propertyId')")} OR (json_extract(r.data,'$.propertyId') IS NULL AND ${inIds("json_extract(b.data,'$.propertyId')")}))`:''}`).bind(...(restricted?[homes,homes]:[])),
  db.prepare(`SELECT id,json_extract(data,'$.bookingId') bookingId,json_extract(data,'$.mergedInto') mergedInto,json_extract(data,'$.erasedAt') erasedAt FROM cb_records WHERE kind='guests'`),
 ])
 const profiles=new Map<string,any>(result[1].results.map((r:any)=>[r.id,r])),origins=new Map<string,any>()
 for(const g of profiles.values())if(!g.erasedAt&&!origins.has(g.bookingId))origins.set(g.bookingId,g)
 const key=(m:any)=>{
  if(!m.matched)return m.email?'e:'+m.email:m.phone?'p:'+m.phone:'r:'+(m.ref??'unknown')
  const origin=origins.get(m.bookingId);if(!origin)return 'b:'+m.bookingId
  const seen=new Set<string>();let g=origin
  while(g?.mergedInto){if(g.erasedAt||seen.has(g.id))return 'g:'+origin.id;seen.add(g.id);g=profiles.get(g.mergedInto)}
  return 'g:'+(g&&!g.erasedAt?g.id:origin.id)
 }
 return new Set(result[0].results.map(key)).size
}
