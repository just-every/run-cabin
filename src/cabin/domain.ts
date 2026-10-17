import { ledgerCommand } from './ledger/commands'
import { ledgerState } from './ledger/store'
import { recoveryCommand } from './recovery/commands'
import { booksState } from './finance/books'
import type { Bindings } from '../auth.server'
import { type Actor, type Context, type State, need, text, kinds } from './model'
import { load, assertLive, commit } from './storage'
import { peopleCommand } from './people'
import { calendarCommand } from './calendars'
import { reservationCommand } from './inventory'
import { exportCommand } from './ical-export'
import { managedInstall } from './channels'
import { lockAccount } from './locks'
import { smsAccount } from './inbox/adapters/twilio'
import { bookingAccount } from './inbox/adapters/booking'
import { turnoverCommand } from './turnovers'
import { homeCommand } from './homes'
import { taskCommand } from './maintenance'
import { statementCommand } from './statements'
import { privacyCommand } from './privacy'
import { importJobs } from './movein'
import { directState } from './direct/admin'
import { agentKeys } from './credentials'
export type * from './model'
export async function command(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>){
 await assertLive(db,actor);need(!actor.isAgent||['calendar.prepare','turnover.prepare','statement.prepare'].includes(name),'Agents may only prepare drafts',403)
 const before=await load(db),c:Context={db,actor,before,data:structuredClone(before),queries:[],now:new Date().toISOString(),entityId:null}
 if(name==='privacy.erase')return privacyCommand(c,input)
 for(const handler of [ledgerCommand,recoveryCommand,peopleCommand,calendarCommand,reservationCommand,exportCommand,turnoverCommand,homeCommand,taskCommand,statementCommand]){const result=await handler(c,name,input);if(result!==undefined){await commit(c,name);return result}}
 need(false,'Unknown command',404)
}
export async function snapshot(env:Bindings,actor:Actor):Promise<State>{
 await assertLive(env.DB,actor);const data=await load(env.DB)
 if(actor.role==='cleaner'){
  // A cleaner sees their own turnovers and codes, and tasks they raised or were given; never guest codes or other homes.
  data.turnovers=data.turnovers.filter(t=>t.cleanerId===actor.memberId&&t.status!=='draft')
  data.tasks=data.tasks.filter(t=>t.assigneeId===actor.memberId||t.raisedBy===actor.id)
  const bookingIds=new Set(data.turnovers.map(t=>t.bookingId)),propertyIds=new Set([...data.turnovers,...data.tasks].map(t=>t.propertyId)),turnoverIds=new Set(data.turnovers.map(t=>t.id))
  data.codes=data.codes.filter(r=>r.holder==='cleaner'&&r.memberId===actor.memberId&&r.turnoverId&&turnoverIds.has(r.turnoverId))
  data.homeSettings=data.homeSettings.filter(r=>propertyIds.has(r.propertyId)).map(r=>({...r,cleanerId:null,maintenanceId:null,lockDeviceId:null}));data.notices=[];data.payouts=[];data.deliveries=[];data.postings=[]
  data.bookings=data.bookings.filter(b=>bookingIds.has(b.id)).map(({guestName:_,...b})=>({...b,summary:'Reserved'}))
  data.properties=data.properties.filter(p=>propertyIds.has(p.id)).map(p=>({...p,ownerName:'',ownerEmail:'',commissionBps:0}))
  data.messages=[];data.scheduled=[];data.inbox=[];data.recoveryPolicies=[];data.recoveries=data.recoveries.filter(r=>turnoverIds.has(r.turnoverId)).map(r=>({...r,proposal:r.proposal?{...r.proposal,creditCents:0,extraCleaningCents:0,guestText:'',baseline:''}:undefined,previous:undefined,balanceCents:undefined,appliedBaseline:undefined}))
  data.ledgerSettings=[];data.members=data.members.filter(m=>m.id===actor.memberId);data.feeds=[];data.calendarDrafts=[];data.statements=[];data.events=[];data.connections=[];data.exports=[];data.requests=[]
  data.approvals=data.approvals.filter(a=>a.kind==='turnover'&&turnoverIds.has(a.recordId))
 }
 if(actor.isAgent){data.recoveries=[];data.recoveryPolicies=[]}
 // Channel links and export tokens are capabilities; a bearer agent reads availability, not them.
 if(actor.isAgent){data.connections=data.connections.map(r=>({...r,url:''}));data.exports=[];data.codes=[];data.notices=data.notices.map(n=>({...n,text:''}));data.messages=[];data.scheduled=[];data.inbox=[];data.recoveryPolicies=[];data.recoveries=[]}
 // The inbox's AI key stays sealed on the server; people see only its last four characters.
 data.inbox=data.inbox.map(r=>({...r,ai:r.ai&&{...r.ai,keySealed:''}}))
 const state={...data,ledger:await ledgerState(env.DB,actor),books:await booksState(env,actor),direct:await directState(env,actor),actor,origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true',workerName:env.CABIN_WORKER_NAME??(new URL(env.AUTH_ORIGIN).hostname.endsWith('.workers.dev')?new URL(env.AUTH_ORIGIN).hostname.split('.')[0]:null),managed:managedInstall(env),lockAccount:lockAccount(env),messaging:{sms:smsAccount(env),booking:bookingAccount(env)},agentKeys:await agentKeys(env,actor),importJobs:await importJobs(env.DB,actor)}
 await assertLive(env.DB,actor);return state
}
/** A completed turnover's cover photo, or any photo by id: owners and managers, the turnover's cleaner once it is done, a task's assignee or reporter. */
export async function turnoverPhoto(db:D1Database,actor:Actor,id:string,byPhotoId=false){
 need(!actor.isAgent,'Human access required for photo evidence',403);await assertLive(db,actor)
 const photo=await db.prepare(`SELECT p.id,p.mime_type,hex(p.bytes) AS bytes_hex,r.kind,r.data FROM cb_photos p JOIN cb_records r ON r.id=p.turnover_id AND r.kind IN ('turnovers','tasks') WHERE p.id=${byPhotoId?'?':"(SELECT json_extract(data,'$.completion.photoId') FROM cb_records WHERE kind='turnovers' AND id=?)"}`).bind(id).first<any>()
 need(photo,'Photo not found',404);const row=JSON.parse(photo.data),cleaner=actor.role==='cleaner'
 const allowed=photo.kind==='turnovers'?cleaner&&row.cleanerId===actor.memberId&&row.status==='completed':cleaner&&(row.assigneeId===actor.memberId||row.raisedBy===actor.id)
 need(actor.role==='owner'||actor.role==='manager'||allowed,'Photo not found',404)
 need(typeof photo.bytes_hex==='string'&&photo.bytes_hex.length>0&&/^(?:[0-9A-F]{2})+$/.test(photo.bytes_hex),'Stored photo evidence is invalid',500)
 const hex:string=photo.bytes_hex,bytes=Uint8Array.from(hex.match(/../g)!,value=>parseInt(value,16)).buffer
 await assertLive(db,actor);return {bytes,mimeType:photo.mime_type as string}
}
