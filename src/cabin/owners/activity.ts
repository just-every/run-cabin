import type { Bindings } from '../../auth.server'
import { type Statement, type Query, query, guard, newId, sha, fail } from '../model'
import { event } from '../audit/write'

export const statementScope="EXISTS(SELECT 1 FROM cb_records s WHERE s.id=? AND s.kind='statements' AND s.revision=? AND json_extract(s.data,'$.status')='approved' AND json_extract(s.data,'$.ownerEmail')=? COLLATE NOCASE AND (EXISTS(SELECT 1 FROM cb_properties p WHERE p.id=json_extract(s.data,'$.propertyId') AND p.owner_email=? COLLATE NOCASE) OR EXISTS(SELECT 1 FROM cb_owner_statement_grants g WHERE g.statement_id=s.id AND g.email=? COLLATE NOCASE AND g.revoked_at IS NULL)))"
export async function ownerEvent(email:string,action:string,at:string,scope:{id:string;kind:string;propertyId:string;result?:string}){
 return event({id:'rental-owner:'+await sha(email.toLowerCase()),role:'rental-owner',isAgent:false,operatorVersion:0},action,at,scope)
}
export async function ownerBatch(db:D1Database,queries:Query[]){
 try{await db.batch([...queries,query('DELETE FROM cb_guard')].map(q=>db.prepare(q.sql).bind(...q.params)))}
 catch(error){if(/constraint|CHECK|UNIQUE/i.test(String(error)))fail('Records or access changed. Refresh and review before trying again.',409);throw error}
}
export async function recordStatementAccess(env:Bindings,email:string,statements:Statement[],action:'view'|'download'){
 if(!statements.length)return
 const at=new Date().toISOString(),queries:Query[]=[]
 for(const s of statements){
  queries.push(guard(statementScope,s.id,s.revision,email,email,email),query('INSERT INTO cb_owner_statement_views(id,statement_id,revision,owner_key,viewed_at,action) VALUES(?,?,?,?,?,?)',newId(),s.id,s.revision,await sha(email.toLowerCase()),at,action),await ownerEvent(email,`owner.statement.${action}`,at,{kind:'statements',id:s.id,propertyId:s.propertyId,result:'completed'}))
 }
 await ownerBatch(env.DB,queries)
}
