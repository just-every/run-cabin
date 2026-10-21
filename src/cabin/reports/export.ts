import { csvCell } from '../statements'
import type { Report } from './read'
/** A long-form CSV preserves every source and metric, with no row cap or client-side selection. */
export function reportCsv(r:Report){
 const rows:unknown[][]=[['Section','Record ID','Property ID','Booking ID','Owner reference','Channel','Metric','Value','Source link']]
 const add=(section:string,id:string,record:Record<string,unknown>)=>{for(const [key,value] of Object.entries(record)){if(key==='lines')continue;rows.push([section,id,record.propertyId??'',record.bookingId??'',record.ownerKey??'',record.channel??'',key,value===null?'unavailable':typeof value==='object'?JSON.stringify(value):value,record.href??''])}}
 add('filters','filters',{...r.filters});add('metadata','cutoff',{cutoff:r.cutoff,version:r.version});add('semantics','semantics',r.semantics);add('totals','portfolio',r.totals)
 for(const section of ['properties','channels','pace','performance','reservations','blocks','journals','payouts','operations','exceptions','freshness'] as const){for(const [i,record] of r[section].entries()){const row=record as unknown as Record<string,unknown>;add(section,String(row.id??row.channel??row.date??i),row);if(section==='journals')for(const [n,line] of (record as Report['journals'][number]).lines.entries())add('journal-lines',String(row.id)+':'+n,{...line,propertyId:row.propertyId,bookingId:row.bookingId,ownerKey:row.ownerKey,journalId:row.id,href:row.href})}}
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
