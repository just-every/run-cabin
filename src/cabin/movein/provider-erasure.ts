import { type Context, query } from '../model'
import { listingId } from './provider-plan'
import type { Normalized } from './providers'
/** A source file can contain several homes: retire its whole retained plan, as the register importer does. */
export async function eraseProviderSource(c:Context,propertyId:string){
 const rows=(await c.db.prepare('SELECT id,plan FROM cb_provider_moveins').all<{id:string;plan:string}>()).results
 for(const row of rows){
  const plan=JSON.parse(row.plan) as Normalized
  if(!plan.homes.some(h=>listingId(plan.provider,h.externalId)===propertyId))continue
  const retired:Normalized={...plan,homes:[],stays:[],guests:[],balances:[],refusals:[],mappings:[],warnings:['Source custody was retired by property erasure. Preview fresh exports for another move-in.'],sourceTotals:{reservations:0,futureNights:0,ownerBalanceCents:0}}
  c.queries.push(query('DELETE FROM cb_movein_guests WHERE movein_id=?',row.id),query("UPDATE cb_provider_moveins SET plan=?,inventory=NULL,explanations=NULL,status='undone' WHERE id=?",JSON.stringify(retired),row.id))
 }
 c.queries.push(query('DELETE FROM cb_opening_balances WHERE property_id=?',propertyId))
}
