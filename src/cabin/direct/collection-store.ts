import { newId,type Context } from '../model'
import type { CollectionPlan } from './collection-types'
export async function collectionPlans(db:D1Database):Promise<CollectionPlan[]> {
 return (await db.prepare("SELECT data FROM cb_records WHERE kind='collectionPlans' ORDER BY rowid").all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
export function saveCollection(c:Context,p:CollectionPlan){
 p.revision=newId();c.entityId=p.bookingId
 const index=c.data.collectionPlans.findIndex(v=>v.id===p.id)
 if(index<0)c.data.collectionPlans.push(p);else c.data.collectionPlans[index]=p
}
export const publicCollection=(p:CollectionPlan)=>{const {customerId,paymentMethod,setup,authority,...safe}=p;return {...safe,setupPending:!!setup&&!setup.id}}
