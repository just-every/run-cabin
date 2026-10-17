import { query, need, newId, type Context } from '../model'
import type { Actor } from '../model'
export const DIRECT_SYSTEM:Actor={id:'cabin:direct-booking',email:'',role:'system',isAgent:false,operatorVersion:0}
import type { DirectHome,DirectStay } from './types'
export async function homes(db:D1Database):Promise<DirectHome[]> { return (await db.prepare('SELECT data FROM cb_direct_homes ORDER BY slug').all<{data:string}>()).results.map(r=>JSON.parse(r.data)) }
export async function stays(db:D1Database):Promise<DirectStay[]> { return (await db.prepare('SELECT data FROM cb_direct_stays ORDER BY rowid DESC').all<{data:string}>()).results.map(r=>JSON.parse(r.data)) }
export async function stay(db:D1Database,id:string):Promise<DirectStay> { const row=await db.prepare('SELECT data FROM cb_direct_stays WHERE id=?').bind(id).first<{data:string}>();need(row,'Stay not found',404);return JSON.parse(row.data) }
export async function byToken(db:D1Database,hash:string):Promise<DirectStay> { const row=await db.prepare('SELECT data FROM cb_direct_stays WHERE token_hash=?').bind(hash).first<{data:string}>();need(row,'Stay link not found',404);return JSON.parse(row.data) }
export function saveStay(c:Context,row:DirectStay) { row.revision=newId();c.entityId=row.id;c.queries.push(query('UPDATE cb_direct_stays SET data=? WHERE id=?',JSON.stringify(row),row.id)) }
export function saveHome(c:Context,row:DirectHome) { c.entityId=row.propertyId;c.queries.push(query('INSERT INTO cb_direct_homes(property_id,slug,data) VALUES(?,?,?) ON CONFLICT(property_id) DO UPDATE SET slug=excluded.slug,data=excluded.data',row.propertyId,row.slug,JSON.stringify(row))) }

export async function dueStays(db:D1Database):Promise<DirectStay[]> {
 const rows=await db.prepare("SELECT data FROM cb_direct_stays WHERE json_extract(data,'$.phase') IN ('held','paid') OR (json_extract(data,'$.phase')='confirmed' AND json_extract(data,'$.deposit.status') IN ('requires_capture','capturing','releasing')) ORDER BY json_extract(data,'$.createdAt') LIMIT 100").all<{data:string}>();return rows.results.map(r=>JSON.parse(r.data))
}
