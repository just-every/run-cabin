import { createPortability } from '@runeditrun/rer/modules/portability'
// @ts-ignore Shared with Base's JavaScript archive CLI.
import archivePolicy from './archive-policy.mjs'
import { retireD1ImportCustody } from '../modules/import-kit/src/d1/index.ts'
import { importContext } from './movein'
import { type Context, type Query, kinds, owner, text, integer, need, query, sha } from './model'
import { commit, transaction } from './storage'
/** Preserve Base's generated statements as inert SQL for the kit's shared batch.
 * Reads still use the real D1 binding; no independent erasure commits occur. */
async function checkpoint(db:D1Database):Promise<Query[]>{
 const prepare=(sql:string,params:any[]=[]):D1PreparedStatement=>{
  const native=params.length?db.prepare(sql).bind(...params):db.prepare(sql)
  return new Proxy(native,{get(target,key){if(key==='cabinQuery')return query(sql,...params);if(key==='bind')return (...args:any[])=>prepare(sql,args);const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}})
 }
 const traced=new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>prepare(sql);const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}})
 const portability=await createPortability({db:traced,policy:archivePolicy})
 const statements=[...await portability.redactionStatements(),...await portability.invalidateTransfersStatements()]
 return statements.map((s:any)=>{const q=s.cabinQuery;need(q&&typeof q.sql==='string','Base erasure statement could not be bound',500);return q})
}
export async function privacyCommand(c:Context,p:Record<string,unknown>){
 owner(c.actor);const entity=text(p.entity??'property','entity'),id=text(p.id,'record ID'),revision=integer(p.revision,'revision',1),fence=await checkpoint(c.db)
 if(entity==='property'){
  const prop=c.data.properties.find(v=>v.id===id);need(prop,'Property not found',404);need(prop.revision===revision,'Property changed; reload before erasing',409)
  const ids=[] as string[];for(const kind of kinds)for(const row of c.data[kind])if('propertyId' in row&&row.propertyId===id)ids.push(row.id)
  c.queries.push(query("DELETE FROM cb_photos WHERE turnover_id IN (SELECT id FROM cb_records WHERE kind IN ('turnovers','tasks') AND json_extract(data,'$.propertyId')=?)",id),query('DELETE FROM cb_approvals WHERE record_id IN (SELECT id FROM cb_records WHERE json_extract(data,\'$.propertyId\')=?)',id),query("DELETE FROM cb_records WHERE json_extract(data,'$.propertyId')=?",id),query('DELETE FROM cb_import_revisions WHERE property_id=?',id),query('DELETE FROM cb_direct_stays WHERE property_id=?',id),query('DELETE FROM cb_direct_homes WHERE property_id=?',id),query('DELETE FROM cb_properties WHERE id=?',id),query("INSERT INTO cb_erasure_fences(entity,id_hash,at) VALUES('property',?,?)",await sha(id),c.now))
  // Reviewed source bytes live only in these plans and kit custody. Remove any
  // review containing this property; kit retains anonymous source tombstones.
  const reviewRows=(await c.db.prepare('SELECT id,plan,job_id FROM cb_import_reviews').all<{id:string;plan:string;job_id:string|null}>()).results
  for(const r of reviewRows){const plan=JSON.parse(r.plan);if(plan.entries?.some((e:any)=>e.effects?.some((effect:any)=>effect.targetKind==='property'&&effect.targetId===id))){if(r.job_id)c.queries.push(query("UPDATE cb_import_reviews SET plan='{}' WHERE id=?",r.id));else c.queries.push(query('DELETE FROM cb_import_reviews WHERE id=?',r.id))}}
  c.entityId=id
  const result=await retireD1ImportCustody({target:{kind:'property',id}},transaction(c,'privacy.erase'),importContext(c.db,c.actor),fence)
  return {id,entity,erased:true,erasedRecords:ids.length,receiptId:result.receiptId}
 }
 need(entity==='member','Choose property or member')
 const member=c.data.members.find(m=>m.id===id);need(member,'Member not found',404);need(member.revision===revision,'Member changed; reload before erasing',409)
 need(!c.data.turnovers.some(t=>t.cleanerId===id)&&!c.data.tasks.some(t=>t.assigneeId===id)&&!c.data.homeSettings.some(r=>r.cleanerId===id||r.maintenanceId===id),'Members with turnover or maintenance history, or set as a home’s cleaner, must be deactivated; erase the property history first.',409)
 need(!await c.db.prepare('SELECT 1 FROM oa_operators WHERE email=? COLLATE NOCASE').bind(member.email).first(),'An invited identity has authentication history. Deactivate the grant instead.',409)
 c.queries.push(query('DELETE FROM cb_members WHERE id=?',id),query("INSERT INTO cb_erasure_fences(entity,id_hash,at) VALUES('member',?,?)",await sha(member.email.toLowerCase()),c.now),...fence);c.entityId=id
 await commit(c,'privacy.erase');return {id,entity,erased:true}
}
