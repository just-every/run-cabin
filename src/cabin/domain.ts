import type { Bindings } from '../auth.server'
import { type Actor, type Context, type State, need, text, kinds } from './model'
import { load, assertLive, commit } from './storage'
import { peopleCommand } from './people'
import { calendarCommand } from './calendars'
import { reservationCommand } from './inventory'
import { exportCommand } from './ical-export'
import { managedInstall } from './channels'
import { turnoverCommand } from './turnovers'
import { statementCommand } from './statements'
import { privacyCommand } from './privacy'
import { importJobs } from './movein'
import { agentKeys } from './credentials'
export type * from './model'
export async function command(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>){
 await assertLive(db,actor);need(!actor.isAgent||['calendar.prepare','turnover.prepare','statement.prepare'].includes(name),'Agents may only prepare drafts',403)
 const before=await load(db),c:Context={db,actor,before,data:structuredClone(before),queries:[],now:new Date().toISOString(),entityId:null}
 if(name==='privacy.erase')return privacyCommand(c,input)
 for(const handler of [peopleCommand,calendarCommand,reservationCommand,exportCommand,turnoverCommand,statementCommand]){const result=await handler(c,name,input);if(result!==undefined){await commit(c,name);return result}}
 need(false,'Unknown command',404)
}
export async function snapshot(env:Bindings,actor:Actor):Promise<State>{
 await assertLive(env.DB,actor);const data=await load(env.DB)
 if(actor.role==='cleaner'){
  data.turnovers=data.turnovers.filter(t=>t.cleanerId===actor.memberId&&t.status!=='draft')
  const bookingIds=new Set(data.turnovers.map(t=>t.bookingId)),propertyIds=new Set(data.turnovers.map(t=>t.propertyId))
  data.bookings=data.bookings.filter(b=>bookingIds.has(b.id)).map(b=>({...b,summary:'Reserved'}))
  data.properties=data.properties.filter(p=>propertyIds.has(p.id)).map(p=>({...p,ownerName:'',ownerEmail:'',commissionBps:0}))
  data.members=data.members.filter(m=>m.id===actor.memberId);data.feeds=[];data.calendarDrafts=[];data.statements=[];data.events=[];data.connections=[];data.exports=[];data.requests=[]
  const ids=new Set(data.turnovers.map(t=>t.id));data.approvals=data.approvals.filter(a=>a.kind==='turnover'&&ids.has(a.recordId))
 }
 // Channel links and export tokens are capabilities; a bearer agent reads availability, not them.
 if(actor.isAgent){data.connections=data.connections.map(r=>({...r,url:''}));data.exports=[]}
 const state={...data,actor,origin:env.AUTH_ORIGIN,managed:managedInstall(env),agentKeys:await agentKeys(env,actor),importJobs:await importJobs(env.DB,actor)}
 await assertLive(env.DB,actor);return state
}
export async function turnoverPhoto(db:D1Database,actor:Actor,id:string,byPhotoId=false){
 need(!actor.isAgent,'Human access required for photo evidence',403);await assertLive(db,actor)
 const photo=await db.prepare(`SELECT p.id,p.mime_type,hex(p.bytes) AS bytes_hex,r.data FROM cb_photos p JOIN cb_records r ON r.id=p.turnover_id AND r.kind='turnovers' WHERE p.${byPhotoId?'id':'turnover_id'}=?`).bind(id).first<any>()
 need(photo,'Photo not found',404);const row=JSON.parse(photo.data)
 need(actor.role==='owner'||actor.role==='manager'||(actor.role==='cleaner'&&row.cleanerId===actor.memberId&&row.status==='completed'),'Photo not found',404)
 need(typeof photo.bytes_hex==='string'&&photo.bytes_hex.length>0&&/^(?:[0-9A-F]{2})+$/.test(photo.bytes_hex),'Stored photo evidence is invalid',500)
 const hex:string=photo.bytes_hex,bytes=Uint8Array.from(hex.match(/../g)!,value=>parseInt(value,16)).buffer
 await assertLive(db,actor);return {bytes,mimeType:photo.mime_type as string}
}
