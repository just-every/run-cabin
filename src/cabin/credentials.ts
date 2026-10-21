import { memberActor } from './permissions/authority'
import { sharingAllowed } from './connections/guard'
import { event, record } from './audit/write'
import { operatorAuth, type Bindings } from '../auth.server'
import { type Actor, need, fail, text, newId, sha, owner, guard, query } from './model'
import { assertLive, authority } from './storage'
export async function principal(request:Request,env:Bindings,isAgent=false):Promise<Actor>{
 if(isAgent){
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];need(token&&token.length<=200,'Agent credential required',401)
  const key=await env.DB.prepare("SELECT k.id,k.owner_id,k.owner_version,o.email FROM cb_agent_keys k JOIN oa_operators o ON o.id=k.owner_id WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=k.owner_version").bind(await sha(token),Date.now()).first<any>();need(key,'Agent credential expired or revoked',401)
  const actor:Actor={id:key.owner_id,email:key.email,operatorVersion:key.owner_version,role:'agent',isAgent:true,keyId:key.id};await assertLive(env.DB,actor);return actor
 }
 const session=await operatorAuth(env).getSession(request);need(session,'Sign in to continue',401)
 const op=session.operator,email=op.email.trim().toLowerCase()
 const actor=await memberActor(env.DB,op.id);need(actor,'Team access is not granted',403);await assertLive(env.DB,actor);return actor
}
export async function agentKeys(env:Bindings,actor:Actor){if(actor.role!=='owner')return [];return (await env.DB.prepare('SELECT id,label,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt FROM cb_agent_keys WHERE owner_id=? ORDER BY created_at DESC').bind(actor.id).all<Record<string,unknown>>()).results}
export async function credentialCommand(request:Request,env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 owner(actor);await assertLive(env.DB,actor);const a=authority(actor),at=Date.now(),id=newId()
 if(name==='member.invite'){
  await sharingAllowed(env.DB, 'mail','message:send')
  const member=await env.DB.prepare('SELECT * FROM cb_members WHERE id=? AND active=1').bind(text(p.id,'member ID')).first<any>();need(member,'Activate a member before inviting them',409)
  await record(env.DB,actor,'member.invite.requested',{kind:'member',id:member.id,revision:String(member.version),result:'requested'})
  try{await operatorAuth(env).invite(request,{email:member.email,displayName:member.name,role:'member',returnTo:'/app'})}catch(error){await record(env.DB,actor,'member.invite.result',{kind:'member',id:member.id,revision:String(member.version),result:'failed-or-uncertain'});throw error}
  await env.DB.batch([guard(a.sql,...a.params),event(actor,name,new Date().toISOString(),{kind:'member',id:member.id,revision:String(member.version),result:'invited'}),guard(a.sql,...a.params),query('DELETE FROM cb_guard')].map(q=>env.DB.prepare(q.sql).bind(...q.params)));await assertLive(env.DB,actor);return {id:member.id,invited:true}
 }
 const queries=[]
 let result:unknown
 if(name==='agent.create'){
  const label=text(p.label,'key label',80),token='cabin_'+newId()+newId(),expiresAt=at+30*86400_000
  queries.push(query('INSERT INTO cb_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',id,actor.id,actor.operatorVersion,label,await sha(token),at,expiresAt));result={id,token,expiresAt}
 }else if(name==='agent.revoke'){
  const keyId=text(p.id,'key ID');need(await env.DB.prepare('SELECT 1 FROM cb_agent_keys WHERE id=? AND owner_id=?').bind(keyId,actor.id).first(),'Agent key not found',404)
  queries.push(query('UPDATE cb_agent_keys SET revoked_at=? WHERE id=? AND owner_id=?',at,keyId,actor.id));result={id:keyId,revoked:true}
 }else fail('Unknown access command',404)
 await env.DB.batch([guard(a.sql,...a.params),...queries,event(actor,name,new Date(at).toISOString(),{kind:'agent-key',id:(result as {id:string}).id,revision:(result as {id:string}).id,result:name==='agent.create'?'created':'revoked'}),guard(a.sql,...a.params),query('DELETE FROM cb_guard')].map(q=>env.DB.prepare(q.sql).bind(...q.params)))
 return result
}
