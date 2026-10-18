import { type Actor,type Context,manager,need,newId,query } from '../model'
import { assertLive } from '../storage'
import type { PromotionOffer,PromotionPolicy } from './types'

export async function promotionRows<T>(db:D1Database,kind:'promotionOffers'|'promotionPolicies'):Promise<T[]> {
 return (await db.prepare('SELECT data FROM cb_records WHERE kind=? ORDER BY rowid').bind(kind).all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
const pending=new WeakMap<Context,Map<string,unknown>>()
export async function offers(c:Context){
 let cache=pending.get(c);if(!cache){cache=new Map();pending.set(c,cache)}
 if(!cache.has('offers'))cache.set('offers',await promotionRows<PromotionOffer>(c.db,'promotionOffers'))
 return cache.get('offers') as PromotionOffer[]
}
export function savePromotion(c:Context,kind:'promotionOffers'|'promotionPolicies',row:PromotionOffer|PromotionPolicy){
 row.revision=newId();c.entityId=row.id
 c.audit=[...(c.audit??[]),{kind,id:row.id,propertyId:row.propertyId,...('bookingId' in row?{bookingId:row.bookingId}:{}),revision:row.revision,result:'saved'}]
 c.queries.push(query('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data',kind,row.id,row.revision,JSON.stringify(row)))
}
export async function offer(c:Context,id:unknown){const row=(await offers(c)).find(o=>o.id===id);need(row,'Offer not found',404);return row}
export async function policy(c:Context,propertyId:string){const row=(await promotionRows<PromotionPolicy>(c.db,'promotionPolicies')).find(p=>p.propertyId===propertyId);need(row?.enabled,'Enable and approve this home’s promotions policy first',409);return row}
export const publicOffer=(o:PromotionOffer)=>{const {tokenHash:_hash,tokenSealed:_sealed,...safe}=o;return safe}
export async function promotionState(db:D1Database,actor:Actor){
 if(!['owner','manager'].includes(actor.role)||actor.isAgent)return {policies:[],offers:[]}
 manager(actor);await assertLive(db,actor)
 const policies=await promotionRows<PromotionPolicy>(db,'promotionPolicies'),rows=await promotionRows<PromotionOffer>(db,'promotionOffers')
 await assertLive(db,actor);return {policies,offers:rows.map(publicOffer)}
}
