import { importChannelRead } from './read-import'
import { authorizeEffect } from './authorization'
import type { Bindings } from '../../auth.server'
import { need,sha,newId,type Actor,type Context } from '../model'
import { assertLive,mutate } from '../storage'
import { seal,unseal } from '../seal'
import { held, overlaps } from '../inventory'
import { rows,save } from './store'
import { PROFILE,ACTION,KEY,EVIDENCE,type Profile,type Action,type RunnerKey } from './types'
const domains:Record<string,string>={airbnb:'airbnb.com',vrbo:'vrbo.com','booking.com':'booking.com'}
const domainAllowed=(host:string,ch:string)=>host===domains[ch]||host.endsWith('.'+domains[ch])
async function identity(env:Bindings,request:Request):Promise<Actor>{
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];need(token&&token.length<200,'Runner credential required',401)
 const key=(await rows<RunnerKey>(env.DB,KEY))[0]
 need(key&&key.expiresAt>new Date().toISOString()&&key.hash===await sha(token),'Runner credential expired or revoked',403)
 const actor:Actor={id:key.ownerId,email:key.ownerEmail??'',role:'owner',isAgent:false,operatorVersion:key.ownerVersion};await assertLive(env.DB,actor);return actor
}
function stateValue(value:unknown,ch:string){
 need(value&&typeof value==='object'&&!Array.isArray(value),'Invalid browser state')
 const state=value as {cookies?:any[];origins?:any[]}
 need(Array.isArray(state.cookies)&&Array.isArray(state.origins),'Invalid browser state')
 need(state.cookies.every(c=>typeof c.domain==='string'&&domainAllowed(c.domain.replace(/^\./,''),ch))&&state.origins.every(o=>{try{return domainAllowed(new URL(o.origin).hostname,ch)}catch{return false}}),'Browser state must belong only to this channel')
 const raw=JSON.stringify(value);need(raw.length<=750000,'Browser state is too large');return raw
}
async function screenshot(env:Bindings,c:Context,id:string,side:string,value:unknown){
 if(value===undefined)return undefined
 need(typeof value==='string'&&value.length<=650000&&/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value),'Expected a PNG screenshot up to 480 KB')
 const ref=`channel-image:${id}:${side}`
 const bodySealed=await seal(env.SESSION_SECRET,`channel-evidence:${id}:${side}`,value)
 save(c,EVIDENCE,{id:ref,bodySealed} as {id:string});return ref
}
/** Dedicated runner credentials may only lease authorized jobs and return their results. */
export async function runnerOperation(env:Bindings,request:Request,p:Record<string,unknown>){
 const actor=await identity(env,request)
 if(p.op==='authorize'){
  const action=(await rows<Action>(env.DB,ACTION)).find(a=>a.id===p.id),profile=(await rows<Profile>(env.DB,PROFILE)).find(r=>r.id===action?.profileId)
  need(action&&profile&&action.status==='running'&&action.lease===p.lease&&action.leaseUntil!>new Date().toISOString(),'Browser action lease expired',409)
  await authorizeEffect(env,action,profile);return {allowed:true}
 }
 if(p.op==='claim'){
  const pending=await env.DB.prepare("SELECT 1 FROM cb_records a LEFT JOIN cb_records p ON p.kind=? AND p.id=json_extract(a.data,'$.profileId') WHERE a.kind=? AND ((json_extract(a.data,'$.status')='queued' AND json_extract(a.data,'$.nextAt')<=? AND ((json_extract(a.data,'$.kind')='connect' AND json_extract(p.data,'$.status')='connecting') OR (json_extract(a.data,'$.kind')!='connect' AND json_extract(p.data,'$.status')='connected'))) OR (json_extract(a.data,'$.status')='running' AND json_extract(a.data,'$.leaseUntil')<?)) LIMIT 1").bind(PROFILE,ACTION,new Date().toISOString(),new Date().toISOString()).first()
  if(!pending)return {job:null}
 }
 // Read imports reuse Cabin domain transactions. A durable source identity makes
 // replay safe if transport fails between the import and this job receipt.
 let readImported:number|undefined,readError=false
 if(p.op==='complete'&&p.outcome==='succeeded'){
  const action=(await rows<Action>(env.DB,ACTION)).find(a=>a.id===p.id),profile=(await rows<Profile>(env.DB,PROFILE)).find(r=>r.id===action?.profileId)
  if(action?.kind.startsWith('read-')){
   need(profile&&action.status==='running'&&action.lease===p.lease&&action.leaseUntil!>new Date().toISOString(),'Browser action lease expired',409)
   await authorizeEffect(env,action,profile)
   need(p.result==='read','Expected a source read')
   try {const result=await importChannelRead(env,actor,{...action,kind:action.kind as 'read-reservations'|'read-messages'|'read-payouts',readUrl:action.readUrl!,profileGeneration:action.profileGeneration!},profile,p.read);readImported=result.count}
   catch {readError=true}
  }
 }
 return mutate(env.DB,actor,'channelAgent.runner',async c=>{
  const actions=await rows<Action>(env.DB,ACTION),profiles=await rows<Profile>(env.DB,PROFILE)
  if(p.op==='claim'){
   for(const a of actions.filter(a=>a.status==='running'&&a.leaseUntil!<c.now)){
    a.status='uncertain';a.completedAt=c.now;a.detail='Browser work was interrupted before its completion receipt. Check the source outcome; Cabin will not repeat it.';delete a.lease;delete a.leaseUntil;save(c,ACTION,a)
    if(!c.data.notices.some(n=>n.recordId===a.id&&n.subject==='Interrupted channel work'))c.data.notices.push({id:newId(),revision:newId(),propertyId:a.propertyId,memberId:actor.id,email:env.OWNER_EMAIL,kind:'inbox',recordId:a.id,subject:'Interrupted channel work',text:a.detail,status:'pending',detail:null,createdAt:c.now,sentAt:null})
    const profile=profiles.find(r=>r.id===a.profileId);if(profile){profile.status='needs_you';profile.challenge='uncertain';profile.updatedAt=c.now;save(c,PROFILE,profile)}
   }
   const candidate=actions.find(a=>a.status==='queued'&&a.nextAt<=c.now&&!actions.some(o=>o.profileId===a.profileId&&o.status==='running')&&profiles.some(r=>r.id===a.profileId&&(a.kind==='connect'?r.status==='connecting':r.status==='connected')))
   if(!candidate)return {job:null}
   const profile=profiles.find(r=>r.id===candidate.profileId)!
   if(candidate.kind==='close'){
    const booking=c.data.bookings.find(b=>b.id===candidate.bookingId)
    if(!booking||booking.status!=='confirmed'||booking.cancelled||booking.restorePaused||booking.start.slice(0,10)!==candidate.start||booking.end.slice(0,10)!==candidate.end){candidate.status='cancelled';save(c,ACTION,candidate);return {job:null}}
   }
   if(candidate.kind==='open'&&held(c,candidate.propertyId).some(b=>b.status==='confirmed'&&!b.cancelled&&overlaps(b,{start:candidate.start!,end:candidate.end!}))){candidate.status='cancelled';save(c,ACTION,candidate);return {job:null}}
   await authorizeEffect(env,candidate,profile)
   const state=profile.stateSealed?await unseal(env.SESSION_SECRET,`channel-profile:${profile.id}`,profile.stateSealed):null
   if(profile.stateSealed&&!state){profile.status='needs_you';profile.challenge='signin';save(c,PROFILE,profile);return {job:null}}
   candidate.status='running';candidate.attempts++;candidate.lease=newId();candidate.leaseUntil=new Date(Date.now()+20*60000).toISOString();save(c,ACTION,candidate)
   return {job:{id:candidate.id,lease:candidate.lease,kind:candidate.kind,channel:candidate.channel,propertyId:candidate.propertyId,accountId:profile.accountId,listingId:profile.listingId,listingUrl:profile.listingUrl,readUrl:candidate.readUrl,profileGeneration:candidate.profileGeneration,start:candidate.start,end:candidate.end,bookingId:candidate.bookingId,storageState:state?JSON.parse(state):null}}
  }
  need(p.op==='complete'||p.op==='checkpoint','Unknown runner operation')
  const a=actions.find(a=>a.id===p.id),profile=profiles.find(r=>r.id===a?.profileId)
  need(a&&profile&&a.status==='running'&&a.lease===p.lease&&a.leaseUntil!>c.now,'Browser action lease expired or already completed',409)
  if(p.op==='checkpoint'){
   need(a.kind!=='connect','Sign-in screenshots are never retained');await authorizeEffect(env,a,profile)
   need(p.before,'Operational screenshot required');a.beforeSealed=await screenshot(env,c,a.id,'before',p.before);save(c,ACTION,a);return {recorded:true}
  }
  await authorizeEffect(env,a,profile)
  need(['succeeded','needs_you','failed','uncertain'].includes(String(p.outcome)),'Invalid browser outcome')
  const outcome=(readError?'needs_you':p.outcome) as Action['status']
  const isRead=a.kind.startsWith('read-')
  if(isRead&&outcome==='needs_you'&&!p.challenge)a.detail='Source records could not be reconciled. Check identifiers, dates, settlement amounts and any Cabin changes, then queue a fresh read. Nothing was sent to a guest or bank.'
  if(readImported!==undefined)a.imported=readImported
  if(p.storageState!==undefined)profile.stateSealed=await seal(env.SESSION_SECRET,`channel-profile:${profile.id}`,stateValue(p.storageState,profile.channel))
  if(outcome==='succeeded'){
   need(p.result===(a.kind==='close'?'closed':a.kind==='open'?'open':isRead?'read':'connected'),'Browser result does not match the authorized action')
   if(a.kind!=='connect')need(p.before&&p.after,'Operational actions require before and after screenshots')
   if(a.kind!=='connect'){a.beforeSealed??=await screenshot(env,c,a.id,'before',p.before);a.afterSealed=await screenshot(env,c,a.id,'after',p.after)}
   a.result=p.result as Action['result'];a.canUndo=a.kind==='close'&&p.canUndo===true
   if(a.kind==='connect'){need(profile.stateSealed,'Sign-in state required');profile.status='connected';delete profile.challenge}
  }else{
   // No challenge/auth images are retained; even the before image may contain a password or token.
   if((outcome!=='needs_you'||isRead&&readError)&&!p.challenge&&a.kind!=='connect'){a.beforeSealed=await screenshot(env,c,a.id,'before',p.before);a.afterSealed=await screenshot(env,c,a.id,'after',p.after)}
   else {
    for(const side of ['before','after'])c.queries.push({sql:'DELETE FROM cb_records WHERE kind=? AND id=?',params:[EVIDENCE,`channel-image:${a.id}:${side}`]})
    delete a.beforeSealed;delete a.afterSealed
   }
   a.canUndo=false
   if((outcome==='needs_you'||outcome==='uncertain')&&!(isRead&&outcome==='needs_you'&&!p.challenge)){
    profile.status='needs_you';profile.challenge=['signin','2fa','captcha','bot','terms'].includes(String(p.challenge))?p.challenge as Profile['challenge']:'uncertain'
   }
  }
  a.status=outcome;a.completedAt=c.now;a.performedBy=actor.email||actor.id;delete a.lease;delete a.leaseUntil
  // Only failures reported before any mutation are retryable. Uncertain writes always need the host.
  if(outcome==='failed'&&a.kind!=='connect'&&!isRead&&a.attempts<3){a.status='queued';a.nextAt=new Date(Date.now()+30000*4**(a.attempts-1)).toISOString()}
  profile.updatedAt=c.now;save(c,PROFILE,profile);save(c,ACTION,a)
  if(outcome==='needs_you'||outcome==='uncertain'){
   c.data.notices.push({id:newId(),revision:newId(),propertyId:profile.propertyId,memberId:actor.id,email:env.OWNER_EMAIL??'',kind:'inbox',recordId:a.id,subject:'Channel needs you',text:`${profile.channel} stopped for your help. Open Channels in Cabin and review the source action. Finish any sign-in or security check yourself in the isolated profile.`,status:'pending',detail:null,createdAt:c.now,sentAt:null})
  }
  return {id:a.id,status:a.status}
 })
}
export async function evidence(env:Bindings,actor:Actor,id:string,side:string){
 need(actor.role==='owner'&&!actor.isAgent,'Only the owner can read channel evidence',403);await assertLive(env.DB,actor)
 need(side==='before'||side==='after','Choose before or after');const row=(await rows<Action>(env.DB,ACTION)).find(a=>a.id===id),cipher=side==='before'?row?.beforeSealed:row?.afterSealed
 need(cipher,'Screenshot unavailable: sign-in and security pages are never retained',404)
 const image=await env.DB.prepare('SELECT data FROM cb_records WHERE kind=? AND id=?').bind(EVIDENCE,cipher).first<{data:string}>();need(image,'Screenshot unavailable',404)
 const raw=await unseal(env.SESSION_SECRET,`channel-evidence:${id}:${side}`,JSON.parse(image.data).bodySealed);need(raw,'Evidence cannot be opened on this installation',410)
 await assertLive(env.DB,actor);return Uint8Array.from(atob(raw),c=>c.charCodeAt(0)).buffer
}
