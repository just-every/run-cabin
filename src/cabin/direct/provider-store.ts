import type { Bindings } from '../../auth.server'
import { need,query,type Actor } from '../model'
import { mutate } from '../storage'
import { seal,unseal } from '../seal'
export type StripeMode='test'|'live'
export interface ProviderKey { keySealed:string; checkedAt:string }
export interface ProviderSettings { mode:StripeMode; test?:ProviderKey; live?:ProviderKey; check?:{id:string;url:string;status:'pending'|'paid'|'expired';at:string} }
export const KEY_PURPOSE='direct-stripe-key'
export async function providerSettings(db:D1Database):Promise<ProviderSettings|null>{const row=await db.prepare('SELECT data FROM cb_direct_provider WHERE id=1').first<{data:string}>();return row?JSON.parse(row.data):null}
export async function saveProvider(env:Bindings,actor:Actor,action:string,change:(saved:ProviderSettings)=>Promise<void>|void){return mutate(env.DB,actor,action,async c=>{const row=await providerSettings(env.DB)??{mode:'test'};await change(row);c.queries.push(query('INSERT INTO cb_direct_provider(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',JSON.stringify(row)));return row})}
export async function sealKey(env:Bindings,key:string){need(env.SESSION_SECRET,'This install needs its session secret before a payment key can be saved',503);return seal(env.SESSION_SECRET,KEY_PURPOSE,key)}
export async function savedKey(env: {DB?:D1Database;SESSION_SECRET?:string},mode?:StripeMode){
 if(!env.DB)return null
 const row=await providerSettings(env.DB);if(!row)return null
 const selected=mode??row.mode,entry=row[selected];if(!entry)return {mode:selected,key:null,stored:false}
 return {mode:selected,key:env.SESSION_SECRET?await unseal(env.SESSION_SECRET,KEY_PURPOSE,entry.keySealed):null,stored:true}
}
