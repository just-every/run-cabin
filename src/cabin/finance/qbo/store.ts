import { type Actor, need, owner, newId } from '../../model'
import { assertLive } from '../../storage'
import { record } from '../../audit/write'
import type { Batch, Entry, Mapping } from './types'
export async function requireOwner(db:D1Database,actor:Actor) { owner(actor);need(!actor.isAgent,'The installation owner must review QuickBooks operations',403);await assertLive(db,actor) }
export async function rows<T>(db:D1Database,table:'batches'|'entries'|'mappings'):Promise<T[]> {return (await db.prepare(`SELECT data FROM cb_qbo_${table}`).all<{data:string}>()).results.map(r=>JSON.parse(r.data))}
export async function entry(db:D1Database,id:string) {const row=await db.prepare('SELECT data FROM cb_qbo_entries WHERE id=?').bind(id).first<{data:string}>();need(row,'QuickBooks entry not found',404);return JSON.parse(row.data) as Entry}
export async function batch(db:D1Database,id:string) {const row=await db.prepare('SELECT data FROM cb_qbo_batches WHERE id=?').bind(id).first<{data:string}>();need(row,'QuickBooks batch not found',404);return JSON.parse(row.data) as Batch}
export async function saveEntry(db:D1Database,row:Entry) {row.updatedAt=new Date().toISOString();await db.prepare('UPDATE cb_qbo_entries SET data=? WHERE id=?').bind(JSON.stringify(row),row.id).run();return row}
export async function audit(db:D1Database,actor:Actor,action:string,id:string,propertyId?:string,result='completed') {await record(db,actor,action,{id,propertyId,kind:'quickbooks',result})}
export { newId }
export type { Batch, Entry, Mapping }
