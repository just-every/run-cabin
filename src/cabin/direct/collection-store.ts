import { projectState } from '../permissions/projection'
import { newId,type Context,type Actor } from '../model'
import type { CollectionPlan } from './collection-types'
/** A job still scheduled, uncertain or pending, or with a follow-up deadline; json() makes the match independent of stored spacing. Same text as cb_records_collection_open. */
export const COLLECTION_OPEN=`(instr(json(data),'"status":"scheduled"')>0 OR instr(json(data),'"status":"uncertain"')>0 OR instr(json(data),'"status":"pending"')>0 OR instr(json(data),'"deadline"')>0)`
export async function collectionPlans(db:D1Database):Promise<CollectionPlan[]> {
 return (await db.prepare("SELECT data FROM cb_records WHERE kind='collectionPlans' ORDER BY rowid").all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
export function saveCollection(c:Context,p:CollectionPlan){
 p.revision=newId();c.entityId=p.bookingId
 const index=c.data.collectionPlans.findIndex(v=>v.id===p.id)
 if(index<0)c.data.collectionPlans.push(p);else c.data.collectionPlans[index]=p
}
export const publicCollection=(p:CollectionPlan)=>{const {customerId,paymentMethod,setup,authority,...safe}=p;return {...safe,setupPending:!!setup&&!setup.id}}

export function collectionOutput(p:CollectionPlan,actor:Actor){const view=projectState({homes:[],stays:[],collections:[publicCollection(p)]},actor);return view.collections[0]??{id:p.id,propertyId:p.propertyId,bookingId:p.bookingId,revision:p.revision,status:p.status}}
