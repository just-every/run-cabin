import type { Bindings } from '../../../auth.server'
import { seal } from '../../seal'
import { type Actor, need, text } from '../../model'
import { savedConnection, connectGrant, authorize } from './connection'
import { approveMapping, catalog } from './mappings'
import { preview, sync, reconciliation } from './batches'
import { rows, requireOwner, audit } from './store'
import type { Batch, Mapping } from './types'
export { callback } from './connection'
export async function qboState(env:Bindings,actor:Actor) {
 if(actor.role!=='owner'||actor.isAgent)return null
 await requireOwner(env.DB,actor)
 const saved=await env.DB.prepare('SELECT realm,mode FROM cb_qbo_connection WHERE id=1').first<{realm:string;mode:string}>(),cached=saved?await env.DB.prepare('SELECT data FROM cb_qbo_catalog WHERE realm=?').bind(saved.realm).first<{data:string}>():null
 return {appConfigured:!!await env.DB.prepare('SELECT 1 FROM cb_qbo_app WHERE id=1').first()||!!(env.QUICKBOOKS_CLIENT_ID&&env.QUICKBOOKS_CLIENT_SECRET),connection:saved,catalog:cached?JSON.parse(cached.data):null,mappings:await rows<Mapping>(env.DB,'mappings'),batches:await Promise.all((await rows<Batch>(env.DB,'batches')).map(b=>reconciliation(env,b)))}
}
export async function qboCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>) {
 await requireOwner(env.DB,actor)
 if(name==='qbo.app.configure'){
  need(!await savedConnection(env),'Disconnect QuickBooks before replacing the developer app',409)
  const sealed=await seal(env.SESSION_SECRET,'quickbooks-app',JSON.stringify({clientId:text(input.clientId,'QuickBooks client ID',1000),clientSecret:text(input.clientSecret,'QuickBooks client secret',5000)}))
  await env.DB.prepare('INSERT INTO cb_qbo_app(id,sealed) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET sealed=excluded.sealed').bind(sealed).run();await audit(env.DB,actor,name,'quickbooks');return {configured:true}
 }
 if(name==='qbo.authorize')return authorize(env,actor,input)
 if(name==='qbo.connect')return connectGrant(env,actor,input)
 if(name==='qbo.disconnect'){
  const c=await savedConnection(env);need(c,'QuickBooks is already disconnected',409);need(input.consent===true||input.consent==='on','Confirm disconnecting QuickBooks')
  await env.DB.batch([env.DB.prepare('DELETE FROM cb_qbo_connection WHERE id=1'),env.DB.prepare('DELETE FROM cb_qbo_oauth')]);await audit(env.DB,actor,name,'quickbooks');return {connected:false}
 }
 if(name==='qbo.catalog'){const result=await catalog(env);await env.DB.prepare('INSERT INTO cb_qbo_catalog(realm,data) VALUES(?,?) ON CONFLICT(realm) DO UPDATE SET data=excluded.data').bind(result.realm,JSON.stringify({...result,readAt:new Date().toISOString()})).run();return result}
 if(name==='qbo.mapping.approve')return approveMapping(env,actor,input)
 if(name==='qbo.preview')return preview(env,actor,input)
 if(name==='qbo.sync'||name==='qbo.reconcile')return sync(env,actor,input,name==='qbo.sync')
 need(false,'Unknown QuickBooks command '+text(name,'command'),404)
}
