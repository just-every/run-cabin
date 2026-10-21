import { type Context, need } from '../model'
import { hasAction,permitsProperty } from './policy'
/** Check the handler's actual writes before installation automation synchronizes other homes. */
export function mutationScope(c:Context,name:string){
 if(!c.actor.scope||c.actor.role==='system'||c.actor.scope.actions.includes('*')&&c.actor.scope.propertyIds.includes('*'))return
 need(hasAction(c.actor,name),'Action grant changed before commit',403)
 const check=(row:any)=>{
  if(!row||typeof row!=='object')return
  const ids=[...(typeof row.propertyId==='string'?[row.propertyId]:[]),...(Array.isArray(row.propertyIds)?row.propertyIds:[])]
  for(const id of ids)need(permitsProperty(c.actor,id),'Write is outside your property grant',403)
  for(const key of ['parts','shares'])if(Array.isArray(row[key]))for(const part of row[key])check(part)
 }
 for(const [key,rows] of Object.entries(c.data))if(Array.isArray(rows)){
  const before=new Map(((c.before as any)[key]??[]).map((row:any)=>[row.id,JSON.stringify(row)]))
  for(const row of rows)if(row&&before.get(row.id)!==JSON.stringify(row))check(row)
 }
 for(const q of c.queries)for(const param of q.params)if(typeof param==='string'&&param.startsWith('{')){try{check(JSON.parse(param))}catch(error){if((error as any)?.status)throw error}}
}
