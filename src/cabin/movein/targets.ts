import { sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { D1TargetAdapter, D1Sql, TargetRow, D1Database } from '../../modules/import-kit/src/d1/index.ts'
import { need } from '../model'
export const destination='cabin:properties',mappingVersion='property-csv-v1'
export const fields=['id','name','owner_name','owner_email','commission_bps','version'] as const
const inUse="(EXISTS(SELECT 1 FROM cb_records d WHERE json_extract(d.data,'$.propertyId')=p.id) OR EXISTS(SELECT 1 FROM cb_direct_homes h WHERE h.property_id=p.id) OR EXISTS(SELECT 1 FROM cb_direct_stays s WHERE s.property_id=p.id))"
const select=`SELECT p.*,r.revision AS import_revision,${inUse} AS in_use FROM cb_properties p LEFT JOIN cb_import_revisions r ON r.property_id=p.id`
const sql=(sql:string,...params:any[]):D1Sql=>({sql,params})
function scope(dest:string,kind:string){need(dest===destination&&kind==='property','Invalid import target',409)}
function target(row:Record<string,any>):TargetRow{return {destination,targetKind:'property',targetId:row.id,revision:row.import_revision??`native:${row.version}`,value:{...Object.fromEntries(fields.map(k=>[k,row[k]])),inUse:!!row.in_use}}}
export const propertyTargets:D1TargetAdapter={
 async read(db,dest,kind,id){scope(dest,kind);const row=await db.prepare(`${select} WHERE p.id=?`).bind(id).first();return row?target(row):undefined},
 matches(row,dest,kind,id){scope(dest,kind);if(!row)return sql('NOT EXISTS(SELECT 1 FROM cb_properties WHERE id=?) AND NOT EXISTS(SELECT 1 FROM cb_import_revisions WHERE property_id=?)',id,id)
  const v=row.value as Record<string,any>;return sql(`EXISTS(SELECT 1 FROM cb_properties p LEFT JOIN cb_import_revisions r ON r.property_id=p.id WHERE p.id=? AND ${fields.map(k=>`p.${k} IS ?`).join(' AND ')} AND COALESCE(r.revision,'native:'||p.version)=? AND ${inUse}=?)`,id,...fields.map(k=>v[k]),row.revision,v.inUse?1:0)},
 write(row){scope(row.destination,row.targetKind);const v=row.value as Record<string,any>;need(v.id===row.targetId&&v.version===1&&v.inUse===false,'Invalid import effect',409)
  return [sql("INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cb_erasure_fences WHERE entity='property' AND id_hash IN (?,?)) THEN 1 ELSE 0 END",sha256(v.id),sha256(v.owner_email)),sql(`INSERT INTO cb_properties(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`,...fields.map(k=>v[k])),sql('INSERT INTO cb_import_revisions(property_id,revision) VALUES(?,?)',row.targetId,row.revision)]},
 remove(dest,kind,id){scope(dest,kind);return [sql(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cb_properties p WHERE p.id=? AND ${inUse}) THEN 1 ELSE 0 END`,id),sql('DELETE FROM cb_import_revisions WHERE property_id=?',id),sql('DELETE FROM cb_properties WHERE id=?',id)]},
 async list(db,dest){need(dest===destination,'Invalid import destination',409);return (await db.prepare(select).all()).results.map(target)},
 matchesCount(count,dest){need(dest===destination,'Invalid import destination',409);return sql('(SELECT COUNT(*) FROM cb_properties)=?',count)},
 async preparePreservedUndo(db,dest,effects){const rows=await this.list(db,dest);return {observations:effects.map(effect=>({effectId:effect.provenance.id,current:rows.find(r=>r.targetId===effect.expected.targetId)??null,entity:{table:'cb_properties',recordId:effect.expected.targetId}})),dependencies:[],guards:[this.matchesCount!(rows.length,dest),...rows.map(r=>this.matches(r,dest,'property',r.targetId))]}}
}
export async function nativeConflicts(db:Pick<D1Database,'prepare'>,values:Record<string,any>[]){const conflicts:{propertyId:string;reason:string}[]=[]
 for(const value of values){if(await db.prepare("SELECT 1 FROM cb_erasure_fences WHERE entity='property' AND id_hash IN (?,?)").bind(sha256(value.id),sha256(value.owner_email)).first())conflicts.push({propertyId:value.id,reason:'erased_identity'})
 else if(await db.prepare('SELECT 1 FROM cb_properties WHERE id=?').bind(value.id).first())conflicts.push({propertyId:value.id,reason:'existing_property'})}
 return conflicts
}
