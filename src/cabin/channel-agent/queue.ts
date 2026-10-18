import { newId,query,type Context } from '../model'
import { rows } from './store'
import { PROFILE,ACTION,type Profile,type Action } from './types'
/** Part of the guarded booking commit: includes iCal, direct checkout and host reservations. */
export async function queueChannelClosures(c:Context){
 const profiles=(await rows<Profile>(c.db,PROFILE)).filter(p=>p.status!=='disconnected')
 if(!profiles.length)return
 const existing=new Set((await c.db.prepare('SELECT id FROM cb_records WHERE kind=?').bind(ACTION).all<{id:string}>()).results.map(r=>r.id))
 for(const p of profiles)for(const b of c.data.bookings){
  if(b.propertyId!==p.propertyId||b.channel===p.channel||b.status!=='confirmed'||b.cancelled||b.restorePaused||b.end.slice(0,10)<=c.now.slice(0,10))continue
  const id=`channel-close:${p.id}:${p.generation}:${b.id}:${b.start.slice(0,10)}:${b.end.slice(0,10)}`
  if(existing.has(id))continue;existing.add(id)
  const a:Action={id,profileId:p.id,channel:p.channel,propertyId:p.propertyId,kind:'close',bookingId:b.id,start:b.start.slice(0,10),end:b.end.slice(0,10),status:'queued',attempts:0,createdAt:c.now,nextAt:c.now}
  c.queries.push(query('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',ACTION,id,newId(),JSON.stringify(a)))
 }
}
