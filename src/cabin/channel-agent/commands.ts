import type { Bindings } from '../../auth.server'
import { need,text,newId,sha,type Actor } from '../model'
import { held,channel,overlaps } from '../inventory'
import { mutate } from '../storage'
import { rows,save } from './store'
import { PROFILE,ACTION,KEY,type Profile,type Action,type RunnerKey } from './types'
export function host(actor:Actor){need(actor.role==='owner'&&!actor.isAgent,'Only the installation owner can control channel profiles',403)}
export function listingUrl(value:unknown,ch:string){
 const v=text(value,'host listing URL',1500);let u:URL;try{u=new URL(v)}catch{need(false,'Use the channel host listing URL')}
 const domains:Record<string,string[]>={airbnb:['airbnb.com'],vrbo:['vrbo.com'],'booking.com':['booking.com']}
 need(u!.protocol==='https:'&&!u!.username&&!u!.password&&!u!.search&&!u!.hash&&domains[ch]?.some(d=>u!.hostname===d||u!.hostname.endsWith('.'+d)),'Use an HTTPS channel host listing URL without query parameters or sign-in tokens')
 return u!.href
}
export async function channelAgentCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 host(actor)
 if(name==='channelAgent.runner.create'){
  const token=crypto.randomUUID()+crypto.randomUUID(),hash=await sha(token)
  await mutate(env.DB,actor,name,c=>{
   const row:RunnerKey={id:'channel-agent-runner',hash,ownerId:actor.id,ownerEmail:actor.email,ownerVersion:actor.operatorVersion,expiresAt:new Date(Date.now()+86400000).toISOString()};save(c,KEY,row)
  })
  return {token,origin:env.AUTH_ORIGIN,expiresInHours:24}
 }
 return mutate(env.DB,actor,name,async c=>{
  const profiles=await rows<Profile>(env.DB,PROFILE),actions=await rows<Action>(env.DB,ACTION)
  if(name==='channelAgent.connect'){
   need(p.confirm==='yes','Review the channel terms risk and explicitly grant the disclosed session and action scope',409)
   const ch=channel(p.channel,false) as Profile['channel'],prop=c.data.properties.find(r=>r.id===p.propertyId);need(prop,'Choose a home')
   const old=profiles.find(r=>r.channel===ch&&r.propertyId===prop.id)
   // Keep existing profile identities so encrypted sessions and source references remain valid.
   const id=old?.id??`channel-profile:${ch}:${prop.id}`
   need(!actions.some(a=>a.profileId===id&&a.status==='running'),'Finish the current browser action first',409)
   const url=listingUrl(p.listingUrl,ch),listingId=text(p.listingId,'channel listing ID',160)
   need(/^[A-Za-z0-9_-]+$/.test(listingId),'Use the channel’s stable listing ID')
   need(!profiles.some(r=>r.id!==id&&r.channel===ch&&r.status!=='disconnected'&&(r.listingId===listingId||r.listingUrl===url)),'This channel listing is already mapped to another home; disconnect it before changing the mapping',409)
   need(!old||old.propertyId===prop.id&&old.listingUrl===url&&(!old.listingId||old.listingId===listingId)||old.status==='disconnected','Disconnect the old listing before changing the mapping',409)
   const row:Profile={id,generation:old&&old.status!=='disconnected'?old.generation:newId(),channel:ch,propertyId:prop.id,listingId,listingUrl:url,grantedAt:c.now,grantedBy:actor.id,status:'connecting',updatedAt:c.now,...(old?.stateSealed?{stateSealed:old.stateSealed}:{})};save(c,PROFILE,row)
   for(const a of actions.filter(a=>a.profileId===id&&a.kind==='connect'&&a.status==='queued')){a.status='cancelled';save(c,ACTION,a)}
   const job:Action={id:newId(),profileId:id,channel:ch,propertyId:prop.id,kind:'connect',requestedBy:actor.email||actor.id,status:'queued',attempts:0,createdAt:c.now,nextAt:c.now};save(c,ACTION,job)
   return {id,status:row.status}
  }
  if(name==='channelAgent.read'){
   const profile=profiles.find(r=>r.id===p.id);need(profile?.status==='connected'&&profile.grantedAt&&profile.listingId,'Review the disclosed channel terms and reconnect this profile first',409)
   need(['read-reservations','read-messages','read-payouts'].includes(String(p.kind)),'Choose reservations, messages or settled payouts')
   need(p.confirm==='yes','Confirm this source page belongs to the mapped listing',409)
   const readUrl=listingUrl(p.readUrl,profile.channel)
   need(!actions.some(a=>a.profileId===profile.id&&a.kind===p.kind&&['queued','running'].includes(a.status)),'A read is already pending',409)
   const row:Action={id:newId(),profileId:profile.id,profileGeneration:profile.generation,channel:profile.channel,propertyId:profile.propertyId,kind:p.kind as Action['kind'],readUrl,requestedBy:actor.email||actor.id,status:'queued',attempts:0,createdAt:c.now,nextAt:c.now};save(c,ACTION,row);return {id:row.id,status:row.status}
  }
  if(name==='channelAgent.disconnect'){
   const row=profiles.find(r=>r.id===p.id);need(row,'Profile not found',404)
   need(!actions.some(a=>a.profileId===row.id&&a.status==='running'),'Finish the current browser action first',409)
   row.status='disconnected';delete row.stateSealed;row.updatedAt=c.now;save(c,PROFILE,row)
   for(const a of actions.filter(a=>a.profileId===row.id&&a.status==='queued')){a.status='cancelled';save(c,ACTION,a)}
   return {id:row.id,status:row.status}
  }
  if(name==='channelAgent.retry'){
   const row=actions.find(a=>a.id===p.id),profile=profiles.find(r=>r.id===row?.profileId)
   need(row?.status==='needs_you'&&row.kind!=='connect'&&row.attempts<3&&profile?.status==='connected','Complete sign-in first; uncertain actions cannot be retried automatically',409)
   row.status='queued';row.nextAt=c.now;save(c,ACTION,row);return {id:row.id,status:row.status}
  }
  if(name==='channelAgent.undo'){
   const old=actions.find(a=>a.id===p.id),profile=profiles.find(r=>r.id===old?.profileId)
   need(old?.kind==='close'&&old.status==='succeeded'&&old.canUndo&&profile?.status==='connected','Undo is unavailable for this action',409)
   need(!actions.some(a=>a.undoOf===old.id&&a.status!=='failed'&&a.status!=='cancelled'),'Reopening already requested',409)
   need(!held(c,old.propertyId).some(b=>b.status==='confirmed'&&!b.cancelled&&overlaps(b,{start:old.start!,end:old.end!})),'These nights are still held by a reservation or block. Release it before reopening.',409)
   const row:Action={id:newId(),profileId:old.profileId,channel:old.channel,propertyId:old.propertyId,kind:'open',bookingId:old.bookingId,start:old.start,end:old.end,undoOf:old.id,requestedBy:actor.email||actor.id,status:'queued',attempts:0,createdAt:c.now,nextAt:c.now};save(c,ACTION,row);return {id:row.id,status:row.status}
  }
  need(false,'Unknown channel agent command',404)
 })
}
