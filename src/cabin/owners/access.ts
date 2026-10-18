import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { need, text, sha, newId } from '../model'
import { authorizedStatement } from './state'
export { portalState } from './state'
import { recordStatementAccess } from './activity'
import { approvedStatementCsv } from '../statements'
import { h } from '../ui/shared'
const cookieName='cabin_owner_session'
export async function ownerEmail(request:Request,env:Bindings){
 const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)
 need(raw&&raw.length<=200,'Sign in to your owner portal',401)
 const session=await env.DB.prepare('SELECT email FROM cb_owner_sessions WHERE token_hash=? AND expires_at>?').bind(await sha(raw),Date.now()).first<{email:string}>()
 need(session,'Your owner sign-in expired',401);return session.email
}
export async function requestOwnerLink(env:Bindings,input:Record<string,unknown>){
 const email=text(input.email,'owner email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email')
 const now=Date.now(),count=await env.DB.prepare('SELECT count(*) AS n FROM cb_owner_links WHERE email=? AND created_at>?').bind(email,now-15*60_000).first<{n:number}>()
 if((count?.n??0)>=3)return
 const property=await env.DB.prepare(`SELECT 1 FROM cb_properties WHERE owner_email=? COLLATE NOCASE UNION ALL SELECT 1 FROM cb_owner_statement_grants g JOIN cb_records s ON s.id=g.statement_id AND s.kind='statements' WHERE g.email=? COLLATE NOCASE AND g.revoked_at IS NULL AND json_extract(s.data,'$.status')='approved' AND json_extract(s.data,'$.ownerEmail')=g.email COLLATE NOCASE LIMIT 1`).bind(email,email).first()
 if(!property)return
 const token=newId()+newId(),hash=await sha(token)
 await env.DB.batch([env.DB.prepare('DELETE FROM cb_owner_links WHERE expires_at<?').bind(now),env.DB.prepare('DELETE FROM cb_owner_sessions WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO cb_owner_links(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)').bind(hash,email,now,now+20*60_000)])
 const sender=operatorMail(env);if(!sender||!env.MAIL_FROM)return
 const link=new URL('/owners/confirm',env.AUTH_ORIGIN);link.searchParams.set('token',token)
 try{await sender.send({deliveryId:hash,headers:{'Auto-Submitted':'auto-generated'},from:env.MAIL_FROM,to:[email],subject:'Sign in to your Cabin owner portal',text:`Open your homes, stays and approved statements:\n${link.href}\n\nThis sign-in link expires in 20 minutes. It does not grant operator access.`,html:`<p><a href="${h(link.href)}">Open your Cabin owner portal</a></p><p>This link expires in 20 minutes.</p>`})}catch{/* Same public reply for every email and delivery outcome. */}
}
export async function confirmOwner(env:Bindings,token:unknown){
 const hash=await sha(text(token,'sign-in token',200)),now=Date.now(),session=newId()+newId(),sessionHash=await sha(session),expires=now+30*86400_000
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO cb_owner_sessions(token_hash,email,expires_at) SELECT ?,email,? FROM cb_owner_links WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND (EXISTS(SELECT 1 FROM cb_properties WHERE owner_email=cb_owner_links.email COLLATE NOCASE) OR EXISTS(SELECT 1 FROM cb_owner_statement_grants g JOIN cb_records s ON s.id=g.statement_id AND s.kind='statements' WHERE g.email=cb_owner_links.email COLLATE NOCASE AND g.revoked_at IS NULL AND json_extract(s.data,'$.status')='approved' AND json_extract(s.data,'$.ownerEmail')=g.email COLLATE NOCASE))`).bind(sessionHash,expires,hash,now),
  env.DB.prepare('UPDATE cb_owner_links SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(now,hash,now),
 ])
 need(results[0].meta.changes===1,'This sign-in link has expired or was already used. Request another link.',401)
 return `${cookieName}=${session}; Path=/owners; HttpOnly; SameSite=Lax; Max-Age=${30*86400}${new URL(env.AUTH_ORIGIN).protocol==='https:'?'; Secure':''}`
}
export async function signOutOwner(request:Request,env:Bindings){
 const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)
 if(raw)await env.DB.prepare('DELETE FROM cb_owner_sessions WHERE token_hash=?').bind(await sha(raw)).run()
 return `${cookieName}=; Path=/owners; HttpOnly; SameSite=Lax; Max-Age=0`
}
export async function ownerCsv(env:Bindings,email:string,id:string){
 const s=await authorizedStatement(env,email,id);await recordStatementAccess(env,email,[s],'download')
 return approvedStatementCsv(s)
}
