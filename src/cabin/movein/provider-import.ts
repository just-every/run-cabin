import { type Actor, type Context, owner, need, text, newId, sha, query, guard } from '../model'
import { assertLive, mutate } from '../storage'
import { canonicalJson } from '../../modules/import-kit/src/d1/index.ts'
import { providerPlan, listingId } from './provider-plan'
import { installRecords, removeRecords, type Inventory } from './provider-records'
import { comparison, plannedTotals, importedTotals } from './reconcile'
import type { Normalized } from './providers'
interface Saved {id:string;actor_id:string;provider:string;fingerprint:string;plan:string;status:string;created_at:string;imported_at:string|null;signed_off_at:string|null;explanations:string|null;inventory:string|null}
async function saved(db:D1Database,actor:Actor,id:string){
 const row=await db.prepare('SELECT * FROM cb_provider_moveins WHERE id=? AND actor_id=?').bind(id,actor.id).first<Saved>()
 need(row,'Provider move-in not found',404);return row
}
async function details(db:D1Database,row:Saved){
 const plan=JSON.parse(row.plan) as Normalized
 const reconciliation=comparison(plan.sourceTotals,row.status==='review'||row.status==='undone'?plannedTotals(plan):await importedTotals(db,row.id,plan))
 return {id:row.id,provider:row.provider,status:row.status,fingerprint:row.fingerprint,plan,reconciliation,createdAt:row.created_at,importedAt:row.imported_at,signedOffAt:row.signed_off_at,explanations:row.explanations?JSON.parse(row.explanations):null}
}
export async function providerJobs(db:D1Database,actor:Actor){
 if(actor.role!=='owner')return []
 const rows=(await db.prepare('SELECT * FROM cb_provider_moveins WHERE actor_id=? ORDER BY rowid DESC LIMIT 30').bind(actor.id).all<Saved>()).results
 return Promise.all(rows.map(row=>details(db,row)))
}
/** Owner session and cb_meta fences cover preview, approval, sign-off and reversal alike. */
export async function providerCommand(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>){
 owner(actor);await assertLive(db,actor)
 if(name==='import.provider.preview'){
  const plan=await providerPlan(db,input),id=newId(),fingerprint=await sha(canonicalJson(plan))
  await mutate(db,actor,name,c=>{c.entityId=id;c.queries.push(query('INSERT INTO cb_provider_moveins(id,actor_id,provider,fingerprint,plan,status,created_at) VALUES(?,?,?,?,?,?,?)',id,actor.id,plan.provider,fingerprint,JSON.stringify(plan),'review',c.now))})
  return details(db,await saved(db,actor,id))
 }
 const id=text(input.id,'move-in ID'),row=await saved(db,actor,id),plan=JSON.parse(row.plan) as Normalized
 need(!(plan as Normalized & {restorePaused?:boolean}).restorePaused,'This restored move-in is historical. Preview the source files again with fresh calendar links before applying or changing it.',409)
 need(await sha(canonicalJson(plan))===row.fingerprint,'The saved preview changed. Preview the exports again.',409)
 if(name==='import.provider.apply'){
  need(input.fingerprint===row.fingerprint,'Approve the exact preview fingerprint',409)
  need(row.status==='review','This move-in has already been imported or undone',409)
  need(plan.homes.length>0,'Correct the refused listing rows and preview again before importing',409)
  await mutate(db,actor,name,async c=>{
   fence(c,row);c.entityId=id
   for(const home of plan.homes){
    // Erasure can happen between preview and approval; check it in the same write batch.
    c.queries.push(guard("NOT EXISTS(SELECT 1 FROM cb_erasure_fences WHERE entity='property' AND id_hash IN (?,?))",await sha(listingId(plan.provider,home.externalId)),await sha(home.ownerEmail)))
   }
   const inventory=installRecords(c,id,plan)
   c.queries.push(query("UPDATE cb_provider_moveins SET status='imported',imported_at=?,inventory=? WHERE id=?",c.now,JSON.stringify(inventory),id),query('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?)',newId(),'provider-import',id,row.fingerprint,actor.id,c.now))
  })
 }else if(name==='import.provider.signoff'){
  need(input.fingerprint===row.fingerprint,'Sign off the exact imported preview',409)
  need(row.status==='imported','Import this preview before signing off',409)
  need(input.confirm==='yes','Confirm you reviewed the cutover totals')
  await mutate(db,actor,name,async c=>{
   fence(c,row);c.entityId=id
   const reconciled=comparison(plan.sourceTotals,await importedTotals(db,id,plan)),explanations:Record<string,string>={}
   for(const difference of reconciled.differences)explanations[difference.metric]=text(input[`${difference.metric}Explanation`],`an explanation for ${difference.metric}`,2000)
   if(plan.refusals.length)explanations.refusals=text(input.refusalsExplanation,'an explanation covering every refused row',4000)
   c.queries.push(query("UPDATE cb_provider_moveins SET status='signed-off',signed_off_at=?,explanations=? WHERE id=?",c.now,JSON.stringify(explanations),id),query('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?)',newId(),'provider-cutover',id,row.fingerprint,actor.id,c.now))
  })
 }else if(name==='import.provider.undo'){
  need(row.status==='imported'||row.status==='signed-off','Only an imported move-in can be undone',409)
  await mutate(db,actor,name,async c=>{fence(c,row);c.entityId=id;await removeRecords(c,id,JSON.parse(row.inventory!) as Inventory);c.queries.push(query("UPDATE cb_provider_moveins SET status='undone' WHERE id=?",id))})
 }else need(false,'Unknown provider move-in command',404)
 return details(db,await saved(db,actor,id))
}
function fence(c:Context,row:Saved){c.queries.push(guard('EXISTS(SELECT 1 FROM cb_provider_moveins WHERE id=? AND actor_id=? AND status=? AND fingerprint=? AND plan=?)',row.id,c.actor.id,row.status,row.fingerprint,row.plan))}
