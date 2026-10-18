import type { Context } from '../model'
import { query } from '../model'
import { ACTION,PROFILE,type Profile,type Action } from './types'
export async function rows<T>(db:D1Database,kind:string):Promise<T[]>{
 const result=await db.prepare('SELECT data FROM cb_records WHERE kind=? ORDER BY rowid').bind(kind).all<{data:string}>()
 return result.results.map(r=>JSON.parse(r.data))
}
export function save(c:Context,kind:string,row:{id:string}){
 c.queries.push(query('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data',kind,row.id,c.now,JSON.stringify(row)))
 c.entityId=row.id
 c.audit??=[];c.audit.push({kind,id:row.id,propertyId:(row as Profile).propertyId,bookingId:(row as Action).bookingId,result:(row as Action).status??'completed'})
}
export async function agentState(db:D1Database){
 const profiles=await rows<Profile>(db,PROFILE),actions=await rows<Action>(db,ACTION)
 return {profiles:profiles.map(({stateSealed:_,...p})=>p),actions:actions.slice(-100).reverse().map(({lease:_,beforeSealed,afterSealed,...a})=>({...a,before:!!beforeSealed,after:!!afterSealed}))}
}
