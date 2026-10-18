import type { Bindings } from '../../auth.server'
import { type Context,manager,owner,need,text,integer,newId } from '../model'
import { load,mutate } from '../storage'
import { homeSettings } from '../homes'
import { wall } from '../clock'
import { closeMonth,nextMonth,prepareClose } from './month-close'
import { statementCommand } from '../statements'
export async function closeScheduleCommand(c:Context,p:Record<string,unknown>){
 owner(c.actor);const propertyId=text(p.propertyId,'home');need(c.data.properties.some(h=>h.id===propertyId),'Home not found',404)
 const old=c.data.statementSchedules.find(s=>s.id===String(p.id||propertyId));if(old)need(old.revision===p.revision,'Schedule changed. Reload before saving.',409)
 const enabled=p.enabled===true||p.enabled==='true',policy=p.policy??'review';need(policy==='review'||policy==='release','Choose review or automatic release')
 const time=text(p.time||'09:00','local delivery time',5);need(/^([01]\d|2[0-3]):[0-5]\d$/.test(time),'Use HH:MM local time')
 const row={id:propertyId,revision:newId(),propertyId,ownerEmail:String(p.statementOwnerEmail||c.data.properties.find(h=>h.id===propertyId)!.ownerEmail).trim().toLowerCase(),nextMonth:closeMonth(p.nextMonth),day:integer(Number(p.day||1),'day of month',1,28),time,policy:policy as 'review'|'release',actor:{...c.actor},enabled}
 if(old)Object.assign(old,row);else c.data.statementSchedules.push(row);c.entityId=propertyId;return row
}
/** Native grants are checked at commit. Unfinished or revoked schedules remain assigned work, never automatic success. */
export async function generateStatements(env:Bindings){
 for(const s of (await load(env.DB)).statementSchedules.filter(s=>s.enabled)){
  const data=await load(env.DB),local=wall(Date.now(),homeSettings(data,s.propertyId).timeZone),due=`${nextMonth(s.nextMonth)}-${String(s.day).padStart(2,'0')}T${s.time}`
  if(local<due)continue
  // Failed source review is retried by Cron; never spin or repeat an approved delivery.
  try{await mutate(env.DB,s.actor,'statement.schedule.run',async c=>{
   manager(c.actor);const current=c.data.statementSchedules.find(r=>r.id===s.id);if(!current?.enabled||current.revision!==s.revision)return
   const row=await prepareClose(c,{propertyId:s.propertyId,month:s.nextMonth,statementOwnerEmail:s.ownerEmail})
   if(s.policy==='release')await statementCommand(c,'statement.approve',{id:row.id,revision:row.revision})
   current.lastStatementId=row.id;current.nextMonth=nextMonth(s.nextMonth);current.error=undefined;current.attemptedAt=c.now;current.revision=newId()
  })}catch(error){await mutate(env.DB,{id:'cabin:ical-sync',email:'',role:'system',isAgent:false,operatorVersion:0},'statement.schedule.failed',c=>{
   const current=c.data.statementSchedules.find(r=>r.id===s.id);if(current?.revision===s.revision){current.error=(error as any)?.status?(error as Error).message:'Generation failed; review sources and access before retrying.';current.attemptedAt=c.now}
  })}
 }
}
