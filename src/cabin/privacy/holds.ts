import { newId, query, text, need, type Context } from '../model'
import { inScope, type ErasureScope } from './scope'
export interface Retained { table:string; id:string; reason:string; until:string; payload?:unknown }
const permanent='Permanent: immutable accounting evidence; review with your accountant before deleting this installation'
/** These dates are the installation owner's retention choice, not legal advice. */
export function retentionPolicy(c:Context,p:Record<string,unknown>){
 const until=typeof p.retainUntil==='string'?p.retainUntil:new Date(Date.parse(c.now)+7*366*86400000).toISOString().slice(0,10)
 need(/^\d{4}-\d{2}-\d{2}$/.test(until)&&Number.isFinite(Date.parse(until))&&until>c.now.slice(0,10),'Choose a future retention end date')
 return {until,reason:p.retentionReason?text(p.retentionReason,'retention reason',500):'Installation retention policy: preserve signed agreements and accounting evidence for seven years'}
}
export async function retainedRecords(c:Context,s:ErasureScope,p:Record<string,unknown>):Promise<Retained[]>{
 const policy=retentionPolicy(c,p),out:Retained[]=[]
 const operator=s.entity==='member'?await c.db.prepare('SELECT id FROM oa_operators WHERE email=(SELECT email FROM cb_members WHERE id=?) COLLATE NOCASE').bind(s.id).first<{id:string}>():null
 for(const kind of ['statements','rentalAgreements','workExpenses','managementTerms','financialAllocations','sharedCosts'])for(const row of (c.data as any)[kind]??[])if((inScope(s,row)||!!operator&&JSON.stringify(row).includes(operator.id)||s.entity==='property'&&row.shares?.some((v:any)=>v.propertyId===s.id))&&(kind!=='statements'||row.status==='approved'))out.push({table:'cb_records:'+kind,id:row.id,...policy,payload:row})
 for(const row of (await c.db.prepare("SELECT data FROM cb_records WHERE kind='financialCases'").all<{data:string}>()).results){const data=JSON.parse(row.data);if(inScope(s,data))out.push({table:'cb_records:financialCases',id:data.id,...policy,payload:data})}
 if(s.entity==='property'){
  const row=c.data.properties.find(p=>p.id===s.id)!;out.push({table:'cb_properties',id:row.id,...policy,payload:row})
 }
 if(s.entity!=='member')for(const row of (await c.db.prepare('SELECT id,data FROM cb_direct_stays WHERE property_id=? OR json_extract(data,\'$.bookingId\') IN (SELECT value FROM json_each(?))').bind(s.entity==='property'?s.id:'',JSON.stringify([...s.bookings])).all<{id:string;data:string}>()).results){const d=JSON.parse(row.data);out.push({table:'cb_direct_stays:agreement',id:row.id,...policy,payload:{id:d.id,bookingId:d.bookingId,propertyId:d.propertyId,signature:d.signature,quote:d.quote,start:d.start,end:d.end}})}
 const selections:[string,string,any[]][]=[]
 const bookings=JSON.stringify([...s.bookings]),property=s.entity==='property'?s.id:''
 selections.push(['cb_ledger_journals',s.entity==='member'?'actor_id IN (?,?)':'property_id=? OR booking_id IN (SELECT value FROM json_each(?))',s.entity==='member'?[s.id,operator?.id??s.id]:[property,bookings]])
 if(s.entity!=='member')for(const table of ['cb_tax_sources','cb_tax_lines','cb_tax_reports','cb_tax_evidence']){
  const where=table==='cb_tax_evidence'?'report_id IN (SELECT id FROM cb_tax_reports WHERE property_id=?)':table==='cb_tax_reports'?'property_id=?':'property_id=? OR booking_id IN (SELECT value FROM json_each(?))'
  selections.push([table,where,table==='cb_tax_evidence'||table==='cb_tax_reports'?[property]:[property,bookings]])
 }
 for(const [table,where,args] of selections)for(const row of (await c.db.prepare(`SELECT * FROM ${table} WHERE ${where}`).bind(...args).all<any>()).results)out.push({table,id:row.id,reason:'Posted accounting/tax evidence is immutable; operational contacts and pending deliveries are removed separately',until:permanent})
 if(s.entity==='property')for(const table of ['cb_owner_documents','cb_owner_expenses','cb_owner_reserve_reports'])for(const row of (await c.db.prepare(`SELECT * FROM ${table} WHERE property_id=?`).bind(s.id).all<any>()).results)out.push({table,id:row.id,...policy,payload:row})
 return structuredClone(out)
}
function privateCapabilities(value:any):any {if(Array.isArray(value))return value.map(privateCapabilities);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['token','tokenHash','bookingLinkSealed','keySealed','checkoutUrl','paymentMethod','customerId'].includes(key)).map(([key,v])=>[key,privateCapabilities(v)]));return value}
export function saveHolds(c:Context,receipt:string,rows:Retained[]){for(const row of rows)c.queries.push(query('INSERT INTO cb_privacy_holds(id,receipt_id,source_table,source_id,reason,until_at,payload) VALUES(?,?,?,?,?,?,?)',newId(),receipt,row.table,row.id,row.reason,row.until,row.payload?JSON.stringify(privateCapabilities(row.payload)):null))}
