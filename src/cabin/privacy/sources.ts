import { query, type Context } from '../model'
import { scrub, type ErasureScope } from './scope'
/** Vendor reports and undo snapshots are indivisible source files. Withdraw an
 * affected report rather than leave a second restorable copy of its contacts. */
export async function eraseSources(c:Context,s:ErasureScope){
 for(const row of (await c.db.prepare('SELECT id,plan,inventory,explanations FROM cb_provider_moveins').all<any>()).results){
  const contents=JSON.stringify(row),match=s.values.some(v=>contents.toLowerCase().includes(v.toLowerCase()))
  if(!match)continue
  const plan=JSON.parse(row.plan);Object.assign(plan,{homes:[],stays:[],guests:[],balances:[],refusals:[],mappings:[],warnings:['Source file withdrawn by erasure. Import fresh sources to continue.'],sourceTotals:{reservations:0,futureNights:0,ownerBalanceCents:0}})
  c.queries.push(query('DELETE FROM cb_movein_guests WHERE movein_id=?',row.id),query("UPDATE cb_provider_moveins SET plan=?,inventory=NULL,explanations=NULL,status='undone' WHERE id=?",JSON.stringify(scrub(plan,s.values)),row.id))
 }
 // Unapproved register previews have no applied target to retire. Their plans
 // carry source rows and are withdrawn when they contain an erased contact.
 for(const row of (await c.db.prepare('SELECT id,plan,job_id FROM cb_import_reviews').all<any>()).results)if(s.values.some(v=>row.plan.toLowerCase().includes(v.toLowerCase())))c.queries.push(query(row.job_id?"UPDATE cb_import_reviews SET plan='{}' WHERE id=?":'DELETE FROM cb_import_reviews WHERE id=?',row.id))
}
