import type { Bindings } from '../../auth.server'
import { type Actor, owner, need, newId, query } from '../model'
import { mutate } from '../storage'
export async function restoreState(db: D1Database, actor: Actor) {
 if (actor.isAgent || !['owner','manager'].includes(actor.role)) return null
 return db.prepare('SELECT restored,reviewed,revision,reviewed_at AS reviewedAt FROM cb_restore_review WHERE id=1').first<{restored:number;reviewed:number;revision:string;reviewedAt:string|null}>()
}
export async function restoreCommand(env: Bindings, actor: Actor, name: string, p: Record<string,unknown>) {
 owner(actor)
 return mutate(env.DB,actor,name,async c=>{
  const state=await restoreState(env.DB,actor)
  need(state?.restored,'This installation has no restored archive to review.',409)
  need(p.confirm==='yes','Confirm that you reviewed the restored records and existing provider operations.')
  if(name==='restore.review') {
   need(!state.reviewed && p.revision===state.revision,'Restore review changed. Reload before approving.',409)
   const revision=newId()
   c.queries.push(query('UPDATE cb_restore_review SET reviewed=1,revision=?,reviewed_by=?,reviewed_at=? WHERE id=1',revision,actor.id,c.now))
   c.audit=[{kind:'restore-review',id:'installation',revision,result:'reviewed'}]
   return {reviewed:true}
  }
  need(name==='restore.booking','Unknown restore action',404)
  need(state.reviewed,'Review the installation before restarting reservation service.',409)
  const b=c.data.bookings.find(b=>b.id===p.id)
  need(b?.restorePaused && b.revision===p.revision,'Restored reservation changed. Reload before reviewing.',409)
  need(b.status==='confirmed' && b.end.slice(0,10)>=c.now.slice(0,10),'Only a current or future confirmed reservation can restart service.',409)
  delete b.restorePaused; b.revision=newId()
  // Fresh instructions are composed from current facts; restored queued effects stay retired.
  c.entityId=b.id
  return {id:b.id,reviewed:true}
 })
}
