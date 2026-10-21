import { syncPortal, endPortalSessions } from '../portal/lifecycle'
import { recordReservations } from '../reservations/history'
import { captureManagement } from '../properties/terms'
import { syncGuests } from '../guests/sync'
import { type Context, type Booking, type Connection, kinds, query, need, newId } from '../model'
import { dispatch } from '../dispatch'
import { scheduleMessages } from '../inbox/schedule'
import type { Normalized } from './providers'
import { listingId } from './provider-plan'
export interface Inventory { properties:unknown[]; records:{kind:string;id:string;data:string}[]; guests:{id:string;source_id:string;data:string}[]; balances:{id:string;property_id:string;source_id:string;owner_email:string;amount_cents:number;as_of:string}[] }
export function capture(c:Context,ids:Set<string>):Inventory{
 const bookings=new Set(c.data.bookings.filter(b=>ids.has(b.propertyId)).map(b=>b.id)),guests=new Set(c.data.guests.filter(g=>bookings.has(g.bookingId)).map(g=>g.id))
 return {properties:c.data.properties.filter(p=>ids.has(p.id)),records:kinds.flatMap(kind=>c.data[kind].filter(r=>'propertyId' in r&&ids.has(String(r.propertyId))||kind==='guests'&&'bookingId' in r&&bookings.has(String(r.bookingId))||kind==='guestMerges'&&'fromId' in r&&'intoId' in r&&(guests.has(String(r.fromId))||guests.has(String(r.intoId)))).map(r=>({kind,id:r.id,data:JSON.stringify(r)}))),guests:[],balances:[]}
}
export async function installRecords(c:Context,id:string,plan:Normalized):Promise<Inventory>{
 const ids=new Set<string>()
 for(const home of plan.homes){
  const propertyId=listingId(plan.provider,home.externalId);ids.add(propertyId)
  need(!c.data.properties.some(p=>p.id===propertyId),'A provider listing now exists. Preview the exports again.',409)
  const row={id:propertyId,revision:1,name:home.name,ownerName:home.ownerName,ownerEmail:home.ownerEmail,commissionBps:home.commissionBps}
  c.data.properties.push(row)
  c.queries.push(query('INSERT INTO cb_properties(id,name,owner_name,owner_email,commission_bps,version) VALUES(?,?,?,?,?,?)',row.id,row.name,row.ownerName,row.ownerEmail,row.commissionBps,1))
  for(const link of home.links){
   const connection:Connection={id:`${propertyId}:${link.channel}`,revision:newId(),propertyId,channel:link.channel,url:link.url,intervalMinutes:15,status:'pending',error:null,lastAttemptAt:null,lastSuccessAt:null,lastChangeAt:null,nextPollAt:c.now,events:0,createdBy:c.actor.id}
   c.data.connections.push(connection)
  }
  c.data.exports.push({id:newId(),revision:newId(),propertyId,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),createdAt:c.now,createdBy:c.actor.id})
 }
 for(const stay of plan.stays){
  const guest=plan.guests.find(g=>g.externalId===stay.guestId)!
  const booking:Booking={id:`${id}:stay:${stay.externalId}`,revision:newId(),uid:stay.icalUid??`${plan.provider}:${stay.externalId}`,propertyId:listingId(plan.provider,stay.listingId),channel:stay.channel,start:stay.start,end:stay.end,summary:guest.name,kind:'stay',status:stay.status,cancelled:stay.status==='cancelled',approvedAt:c.now,source:'migration',guestName:guest.name,...(guest.email?{guestEmail:guest.email}:{}),...(guest.phone?{guestPhone:guest.phone}:{}),channelRef:stay.channelRef??stay.externalId}
  c.data.bookings.push(booking)
 }
 // Include the same automatic operations as a reservation created through any other public door.
 captureManagement(c);syncGuests(c);await recordReservations(c,'import.provider.apply');dispatch(c);await syncPortal(c);scheduleMessages(c)
 const inventory=capture(c,ids)
 for(const guest of plan.guests){
  const row={id:`${id}:guest:${guest.externalId}`,source_id:guest.externalId,data:JSON.stringify(guest)}
  inventory.guests.push(row);c.queries.push(query('INSERT INTO cb_movein_guests(id,movein_id,source_id,data) VALUES(?,?,?,?)',row.id,id,row.source_id,row.data))
 }
 for(const balance of plan.balances){
  const row={id:`${id}:balance:${balance.externalId}`,property_id:listingId(plan.provider,balance.listingId),source_id:balance.externalId,owner_email:balance.ownerEmail,amount_cents:balance.amountCents,as_of:balance.asOf}
  inventory.balances.push(row);c.queries.push(query('INSERT INTO cb_opening_balances(id,movein_id,property_id,source_id,owner_email,amount_cents,as_of) VALUES(?,?,?,?,?,?,?)',row.id,id,row.property_id,row.source_id,row.owner_email,row.amount_cents,row.as_of))
 }
 return inventory
}
const stable=(rows:unknown[])=>JSON.stringify([...rows].sort((a:any,b:any)=>String(a.id).localeCompare(String(b.id))))
export async function removeRecords(c:Context,id:string,inventory:Inventory){
 const ids=new Set((inventory.properties as {id:string}[]).map(p=>p.id)),current=capture(c,ids)
 need(stable(current.properties)===stable(inventory.properties)&&stable(current.records)===stable(inventory.records),'Imported listings or dependent records changed. Undo is blocked to preserve your work.',409)
 const guests=(await c.db.prepare('SELECT id,source_id,data FROM cb_movein_guests WHERE movein_id=?').bind(id).all()).results
 const balances=(await c.db.prepare('SELECT id,property_id,source_id,owner_email,amount_cents,as_of FROM cb_opening_balances WHERE movein_id=?').bind(id).all()).results
 need(stable(guests)===stable(inventory.guests)&&stable(balances)===stable(inventory.balances),'Imported guests or owner balances changed. Undo is blocked to preserve your work.',409)
 for(const propertyId of ids){
  const dependency=await c.db.prepare('SELECT 1 FROM cb_direct_homes WHERE property_id=? UNION ALL SELECT 1 FROM cb_direct_stays WHERE property_id=? LIMIT 1').bind(propertyId,propertyId).first()
  need(!dependency,'An imported listing now has direct-booking configuration or stays. Undo is blocked.',409)
 }
 for(const link of c.data.guestPortalLinks.filter(l=>ids.has(l.propertyId)))endPortalSessions(c,link,'erased')
 const recordIds=new Set(inventory.records.map(r=>r.id))
 for(const kind of kinds){
  const rows=c.data[kind] as {id:string;propertyId?:string}[]
  for(let i=rows.length-1;i>=0;i--)if(recordIds.has(rows[i].id)){c.queries.push(query('DELETE FROM cb_records WHERE kind=? AND id=?',kind,rows[i].id));rows.splice(i,1)}
 }
 c.data.properties=c.data.properties.filter(p=>!ids.has(p.id))
 c.queries.push(query('DELETE FROM cb_opening_balances WHERE movein_id=?',id),query('DELETE FROM cb_movein_guests WHERE movein_id=?',id))
 for(const propertyId of ids)c.queries.push(query('DELETE FROM cb_properties WHERE id=?',propertyId))
}
