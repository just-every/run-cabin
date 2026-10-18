import { query, newId, need, type Context, type Actor } from '../model'
import { assertLive } from '../storage'
import type { TaxData, Config, TaxReport, TaxDelivery } from './types'
const tables={config:'cb_tax_config',sources:'cb_tax_sources',lines:'cb_tax_lines',reports:'cb_tax_reports',deliveries:'cb_tax_deliveries',evidence:'cb_tax_evidence'} as const
export async function taxData(db:D1Database):Promise<TaxData> {
 const keys=Object.keys(tables) as (keyof typeof tables)[]
 const rows=await db.batch<{data:string}>(keys.map(k=>db.prepare(`SELECT data FROM ${tables[k]} ORDER BY rowid`)))
 return Object.fromEntries(keys.map((k,i)=>[k,rows[i].results.map(r=>JSON.parse(r.data))])) as unknown as TaxData
}
export function scope(c:Context,row:{id:string;propertyId?:string;bookingId?:string;revision?:string},result='completed') {c.entityId=row.id;(c.audit??=[]).push({kind:'tax',id:row.id,propertyId:row.propertyId,bookingId:row.bookingId,revision:row.revision,result})}
export function saveConfig(c:Context,row:Config){c.queries.push(query('INSERT INTO cb_tax_config(id,kind,property_id,revision,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data',row.id,row.kind,row.propertyId,row.revision,JSON.stringify(row)));scope(c,row)}
export function saveReport(c:Context,row:TaxReport,exists=false){c.queries.push(query(exists?'UPDATE cb_tax_reports SET revision=?,status=?,data=? WHERE id=?':'INSERT INTO cb_tax_reports(revision,status,data,id,property_id,month) VALUES(?,?,?,?,?,?)',row.revision,row.status,JSON.stringify(row),row.id,...(exists?[]:[row.propertyId,row.month])));scope(c,row,row.status)}
export function saveDelivery(c:Context,row:TaxDelivery,exists=false){c.queries.push(query(exists?'UPDATE cb_tax_deliveries SET status=?,data=? WHERE id=?':'INSERT INTO cb_tax_deliveries(status,data,id,report_id,jurisdiction_id) VALUES(?,?,?,?,?)',row.status,JSON.stringify(row),row.id,...(exists?[]:[row.reportId,row.jurisdictionId])));scope(c,row,row.status)}
export async function taxState(db:D1Database,actor:Actor) {
 if(actor.isAgent||!['owner','manager'].includes(actor.role))return {config:[],sources:[],lines:[],reports:[],deliveries:[],evidence:[],workItems:[]}
 await assertLive(db,actor);const data=await taxData(db)
 const {load}=await import('../storage'),{workItems}=await import('./calculate');const operational=await load(db)
 const {stays}=await import('../direct/store');const paidDirectStays=(await stays(db)).filter(s=>s.paymentId&&s.phase==='confirmed'&&!data.sources.some(source=>source.bookingId===s.bookingId)).map(s=>({id:s.id,propertyId:s.propertyId,bookingId:s.bookingId,start:s.start,end:s.end,paymentMode:s.paymentMode??'recorded',paymentId:s.paymentId}))
 const state={...data,paidDirectStays,workItems:workItems(data,operational)};await assertLive(db,actor);return state
}
export function revision(old:Config|undefined,input:Record<string,unknown>){if(old)need(old.revision===input.revision,'Tax configuration changed. Reload before saving.',409);return newId()}
