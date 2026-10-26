import type { Bindings } from '../../../auth.server'
import { type Actor, need, newId, sha, text } from '../../model'
import { seal, unseal } from '../../seal'
import { managedInstall } from '../../channels'
import { sharingAllowed } from '../../connections/guard'
import { api, tokenRequest, app } from './client'
import { audit, requireOwner } from './store'
import type { Connection, Grant } from './types'
const purpose=(realm:string)=>'quickbooks:'+realm
export function available(env:Bindings) {need(!managedInstall(env),'QuickBooks provider calls are not available on RER Managed hosting',409)}
export async function savedConnection(env:Bindings):Promise<Connection|null> {
 const row=await env.DB.prepare('SELECT * FROM cb_qbo_connection WHERE id=1').first<any>();if(!row)return null
 const decrypted=await unseal(env.SESSION_SECRET,purpose(row.realm),row.sealed);need(decrypted,'Reconnect QuickBooks on this installation',409)
 return {realm:row.realm,mode:row.mode,version:row.version,grant:JSON.parse(decrypted)}
}
export async function saveGrant(env:Bindings,realm:string,mode:string,grant:Grant,version=newId(),expectedVersion?:string) {
 const sealed=await seal(env.SESSION_SECRET,purpose(realm),JSON.stringify(grant))
 if(expectedVersion){const changed=await env.DB.prepare('UPDATE cb_qbo_connection SET sealed=?,version=?,lease_until=NULL WHERE id=1 AND version=?').bind(sealed,version,expectedVersion).run();need(changed.meta.changes===1,'QuickBooks connection changed during refresh. Reconnect with fresh authority.',409);return {realm,mode,grant,version} as Connection}
 await env.DB.prepare('INSERT INTO cb_qbo_connection(id,realm,mode,sealed,version) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET realm=excluded.realm,mode=excluded.mode,sealed=excluded.sealed,version=excluded.version,lease_until=NULL').bind(realm,mode,sealed,version).run()
 return {realm,mode,grant,version} as Connection
}
export async function connection(env:Bindings,propertyId?:string) {
 available(env);await sharingAllowed(env.DB,'quickbooks','journal:read',propertyId)
 let c=await savedConnection(env);need(c,'Connect a QuickBooks company first',409)
 if(Date.parse(c.grant.expiresAt)>Date.now()+60000)return c
 const lease=new Date(Date.now()+60000).toISOString(),now=new Date().toISOString()
 const claimed=await env.DB.prepare('UPDATE cb_qbo_connection SET lease_until=? WHERE id=1 AND version=? AND (lease_until IS NULL OR lease_until<?)').bind(lease,c.version,now).run()
 need(claimed.meta.changes===1,'QuickBooks authorization is being refreshed. Try again after it finishes.',409)
 try {
  const grant=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:c.grant.refreshToken})
  // Store a rotated refresh grant durably before any company request can fail.
  c=await saveGrant(env,c.realm,c.mode,grant,newId(),c.version)
 }catch(error){await env.DB.prepare('UPDATE cb_qbo_connection SET lease_until=NULL WHERE id=1 AND version=?').bind(c.version).run();throw error}
 return c
}
export async function connectGrant(env:Bindings,actor:Actor,input:Record<string,unknown>) {
 await requireOwner(env.DB,actor);available(env);need(input.consent===true||input.consent==='on','Explicit Accounting access consent is required')
 need(input.mode==='sandbox'||input.mode==='production','Choose sandbox or production');const realm=text(input.realmId,'QuickBooks company ID',100);need(/^\d+$/.test(realm),'Invalid QuickBooks company ID')
 const old=await savedConnection(env);need(!old||old.realm===realm&&old.mode===input.mode,'Disconnect the current company before connecting another',409)
 const grant:Grant={accessToken:text(input.accessToken,'OAuth access token',5000),refreshToken:text(input.refreshToken,'OAuth refresh token',5000),expiresAt:new Date(Date.now()+3000000).toISOString()}
 const candidate:Connection={provisional:true,realm,mode:input.mode,grant,version:newId()}
 const company=(await api(env,candidate,'companyinfo/'+realm)).CompanyInfo
 need(company?.Country==='US','Connect a US QuickBooks company with USD home currency',409)
 await requireOwner(env.DB,actor);await saveGrant(env,realm,input.mode,grant);await audit(env.DB,actor,'qbo.connect',realm)
 return {connected:true,companyName:company.CompanyName,realm,mode:input.mode}
}
export async function authorize(env:Bindings,actor:Actor,input:Record<string,unknown>) {
 await requireOwner(env.DB,actor);available(env);need(input.consent===true||input.consent==='on','Explicit Accounting access consent is required');const credentials=await app(env)
 const mode=input.mode==='production'?'production':'sandbox',state=newId()+newId()
 await env.DB.prepare('INSERT INTO cb_qbo_oauth(state_hash,actor_id,mode,expires_at) VALUES(?,?,?,?)').bind(await sha(state),actor.id,mode,new Date(Date.now()+600000).toISOString()).run()
 await audit(env.DB,actor,'qbo.authorize','quickbooks')
 return {url:'https://appcenter.intuit.com/connect/oauth2?'+new URLSearchParams({client_id:credentials.clientId,redirect_uri:env.AUTH_ORIGIN+'/api/cabin/qbo/callback',response_type:'code',scope:'com.intuit.quickbooks.accounting',state})}
}
export async function callback(env:Bindings,actor:Actor,url:URL) {
 await requireOwner(env.DB,actor);available(env)
 const stateHash=await sha(text(url.searchParams.get('state'),'OAuth state',200)),now=new Date().toISOString()
 const state=await env.DB.prepare('DELETE FROM cb_qbo_oauth WHERE state_hash=? AND actor_id=? AND expires_at>? RETURNING mode').bind(stateHash,actor.id,now).first<{mode:string}>();need(state,'QuickBooks authorization state expired or belongs to another session',403)
 need(!url.searchParams.has('error'),'QuickBooks authorization was declined',409)
 const realm=text(url.searchParams.get('realmId'),'QuickBooks company ID',100);need(/^\d+$/.test(realm),'Invalid QuickBooks company ID')
 const old=await savedConnection(env);need(!old||old.realm===realm&&old.mode===state.mode,'Disconnect the current company before connecting another',409)
 const grant=await tokenRequest(env,{grant_type:'authorization_code',code:text(url.searchParams.get('code'),'OAuth code',2000),redirect_uri:env.AUTH_ORIGIN+'/api/cabin/qbo/callback'})
 await saveGrant(env,realm,state.mode,grant)
 await audit(env.DB,actor,'qbo.connected',realm)
 return {connected:true}
}
