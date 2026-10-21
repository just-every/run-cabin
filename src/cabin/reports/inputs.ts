import type { Actor, Data } from '../model'
import type { Journal } from '../ledger/types'
import type { DirectStay, Quote } from '../direct/types'
import { permitsProperty } from '../permissions/policy'
import { initialWork } from '../work-orders/records'

const collections=['bookings','managementTerms','financialAllocations','homeSettings','tasks','turnovers','scheduled','connections','payouts','codes','readinessPlans','readinessRecords'] as const
export type ReportData=Pick<Data,'version'|'properties'|'members'|typeof collections[number]>
export type ReportPayment=Pick<DirectStay,'bookingId'|'propertyId'|'paymentId'> & {quote:Pick<Quote,'rentCents'|'cleaningCents'|'extraGuestCents'|'taxes'|'totalCents'>}

/** Stable insertion order is significant for first-saved sources and readiness baselines. */
export function groupBy<T>(items:readonly T[],key:(item:T)=>string){
 const groups=new Map<string,T[]>()
 for(const item of items){const id=key(item),rows=groups.get(id);if(rows)rows.push(item);else groups.set(id,[item])}
 return groups
}
/** Load only report dependencies. In particular, never deserialize message bodies,
 * direct-stay signatures/payment credentials or unrelated verification cases.
 * The caller rechecks this captured installation revision after all derivation. */
export async function reportInputs(db:D1Database,actor:Actor){
 const meta=await db.batch<any>([
  db.prepare('SELECT version FROM cb_meta WHERE id=1'),
  db.prepare('SELECT id,version AS revision,name,owner_name AS ownerName,owner_email AS ownerEmail,commission_bps AS commissionBps FROM cb_properties ORDER BY name,id'),
  db.prepare('SELECT m.id,m.version AS revision,m.name,m.email,m.role,m.active,s.pms_role,s.property_ids,s.actions,s.revision AS scope_revision FROM cb_members m LEFT JOIN cb_member_scopes s ON s.member_id=m.id ORDER BY m.name,m.id'),
 ])
 const data:ReportData={version:meta[0].results[0].version,properties:meta[1].results.filter((p:Data['properties'][number])=>permitsProperty(actor,p.id)),members:meta[2].results.map((m:any)=>({id:m.id,revision:m.revision,name:m.name,email:m.email,role:m.role,active:!!m.active,...(m.pms_role?{scope:{pmsRole:m.pms_role,propertyIds:JSON.parse(m.property_ids),actions:JSON.parse(m.actions),revision:m.scope_revision}}:{})})),bookings:[],managementTerms:[],financialAllocations:[],homeSettings:[],tasks:[],turnovers:[],scheduled:[],connections:[],payouts:[],codes:[],readinessPlans:[],readinessRecords:[]}
 const restricted=!!actor.scope&&!actor.scope.propertyIds.includes('*')&&actor.role!=='owner',ids=JSON.stringify(data.properties.map(p=>p.id))
 const scope=(field:string)=>restricted?` AND ${field} IN (SELECT value FROM json_each(?))`:''
 const bind=(statement:D1PreparedStatement)=>restricted?statement.bind(ids):statement
 const results=await db.batch<any>([
  bind(db.prepare(`SELECT kind,data FROM cb_records WHERE kind IN (${collections.map(k=>`'${k}'`).join(',')})${scope("json_extract(data,'$.propertyId')")} ORDER BY rowid`)),
  bind(db.prepare(`SELECT data FROM cb_ledger_journals WHERE 1=1${scope('property_id')} ORDER BY posted_at,id`)),
  // Reports need the paid quote, never a stay's signature or access/payment tokens.
  bind(db.prepare(`SELECT json_object('bookingId',json_extract(data,'$.bookingId'),'propertyId',property_id,'paymentId',json_extract(data,'$.paymentId'),'quote',json_object('rentCents',json_extract(data,'$.quote.rentCents'),'cleaningCents',json_extract(data,'$.quote.cleaningCents'),'extraGuestCents',json_extract(data,'$.quote.extraGuestCents'),'taxes',json_extract(data,'$.quote.taxes'),'totalCents',json_extract(data,'$.quote.totalCents'))) AS data FROM cb_direct_stays WHERE 1=1${scope('property_id')} ORDER BY rowid DESC`)),
 ])
 for(const record of results[0].results)(data[record.kind as typeof collections[number]] as unknown[]).push(JSON.parse(record.data))
 const turnovers=new Map(data.turnovers.map(t=>[t.id,t])),bookings=new Map(data.bookings.map(b=>[b.id,b]))
 for(const task of data.tasks)if(!task.work){
  const turnover=task.turnoverId?turnovers.get(task.turnoverId):undefined,booking=turnover?bookings.get(turnover.bookingId):undefined
  // Same legacy normalization as storage.load, with indexed source lookups.
  task.work=initialWork({...data,turnovers:turnover?[turnover]:[],bookings:booking?[booking]:[]},task)
 }
 return {data,journals:results[1].results.map((r:{data:string}):Journal=>JSON.parse(r.data)),payments:results[2].results.map((r:{data:string}):ReportPayment=>JSON.parse(r.data))}
}
