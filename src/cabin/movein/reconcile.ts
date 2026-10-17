import { load } from '../storage'
import type { Normalized } from './providers'
export interface Totals { reservations:number; futureNights:number; ownerBalanceCents:number }
export const futureNights = (stays:{start:string;end:string;status:string}[],asOf:string) => stays.filter(s=>s.status==='confirmed'&&s.end>asOf).reduce((n,s)=>n+Math.max(0,(Date.parse(s.end)-Date.parse(s.start>asOf?s.start:asOf))/86400000),0)
export function comparison(source:Totals,destination:Totals){
 const differences=(Object.keys(source) as (keyof Totals)[]).filter(metric=>source[metric]!==destination[metric]).map(metric=>({metric,source:source[metric],destination:destination[metric]}))
 return {source,destination,differences,matched:differences.length===0}
}
export function plannedTotals(plan:Normalized):Totals{return {reservations:plan.stays.length,futureNights:futureNights(plan.stays,plan.asOf),ownerBalanceCents:plan.balances.reduce((n,b)=>n+b.amountCents,0)}}
export async function importedTotals(db:D1Database,id:string,plan:Normalized):Promise<Totals>{
 const data=await load(db),bookings=data.bookings.filter(b=>b.id.startsWith(`${id}:stay:`))
 const balances=(await db.prepare('SELECT amount_cents FROM cb_opening_balances WHERE movein_id=?').bind(id).all<{amount_cents:number}>()).results
 return {reservations:bookings.length,futureNights:futureNights(bookings,plan.asOf),ownerBalanceCents:balances.reduce((n,b)=>n+b.amount_cents,0)}
}
