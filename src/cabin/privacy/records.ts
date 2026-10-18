import { assertLive, commit } from '../storage'
import { owner, need, newId, query, sha, text, type Context, type Actor } from '../model'
import { erasureScope } from './scope'
import { retainedRecords, retentionPolicy, saveHolds, type Retained } from './holds'
import { erasureInventory } from './inventory'
export const externalSteps=[
 'Ask each connected booking channel, Stripe, messaging provider and lock provider to delete its independent records and revoke previously delivered access. Stripe Identity redaction is tracked separately until the provider confirms it.',
 'Ask recipients to delete delivered email, attachments and exported accounting files. Cabin cannot recall those deliveries.',
 'Delete old downloaded backups, device copies and exports. Export the later erasure journal and supply it with rer import --journal LATER.rer; isolated old backups cannot discover future erasures.'
]
export async function reviewErasure(c:Context,p:Record<string,unknown>){
 owner(c.actor);const s=await erasureScope(c,p),retained=await retainedRecords(c,s,p),inventory=await erasureInventory(c,s),id=newId()
 const data={version:c.before.version+1,entity:s.entity,id:s.id,revision:s.revision,...retentionPolicy(c,p),bookings:[...s.bookings],inventory,digest:await sha(JSON.stringify({retained,inventory})),retained:retained.map(({payload,...r})=>r),externalSteps}
 c.queries.push(query('DELETE FROM cb_privacy_reviews WHERE entity=? AND subject_id=?',s.entity,s.id),query('INSERT INTO cb_privacy_reviews(id,entity,subject_id,revision,version,created_at,data) VALUES(?,?,?,?,?,?,?)',id,s.entity,s.id,s.revision,c.before.version+1,c.now,JSON.stringify(data)))
 await commit(c,'privacy.review');return {reviewId:id,...data}
}
export async function checkReview(c:Context,p:Record<string,unknown>){
 need(p.reviewId,'Review the erasure scope and retention holds before confirming',409)
 const row=await c.db.prepare('SELECT entity,subject_id,revision,version,data FROM cb_privacy_reviews WHERE id=?').bind(text(p.reviewId,'review')).first<any>()
 need(row&&row.entity===(p.entity??'property')&&row.subject_id===p.id&&row.revision===String(p.revision)&&row.version===c.before.version,'Erasure scope changed. Review it again before confirming.',409)
 const data=JSON.parse(row.data);p.retainUntil=data.until;p.retentionReason=data.reason
 const s=await erasureScope(c,p),retained=await retainedRecords(c,s,p),inventory=await erasureInventory(c,s)
 need(data.digest===await sha(JSON.stringify({retained,inventory})),'Retained records, files or source custody changed. Review the erasure again.',409)
}
export async function completion(c:Context,entity:string,id:string,retained:Retained[]){
 const receiptId=newId(),review=await c.db.prepare('SELECT data FROM cb_privacy_reviews WHERE entity=? AND subject_id=?').bind(entity,id).first<{data:string}>(),plan=review?JSON.parse(review.data):null,data={receiptId,entity,subjectHash:await sha(id),completedAt:c.now,reviewDigest:plan?.digest,erased:plan?.inventory,retained:retained.map(({payload,...row})=>row),externalSteps,status:'Local erasure complete; retained records and external steps are listed explicitly'}
 c.queries.push(query('INSERT INTO cb_privacy_receipts(id,entity,subject_hash,completed_at,data) VALUES(?,?,?,?,?)',receiptId,entity,data.subjectHash,c.now,JSON.stringify(data)),query('DELETE FROM cb_privacy_reviews WHERE entity=? AND subject_id=?',entity,id));saveHolds(c,receiptId,retained)
 return receiptId
}
export async function privacyState(db:D1Database,actor:Actor){
 if(actor.role!=='owner'||actor.isAgent)return {reviews:[],receipts:[],holds:[]}
 await assertLive(db,actor)
 const rows=await db.batch<any>([db.prepare('SELECT id,version,data FROM cb_privacy_reviews ORDER BY created_at DESC'),db.prepare('SELECT data FROM cb_privacy_receipts ORDER BY completed_at DESC'),db.prepare('SELECT id,receipt_id AS receiptId,source_table AS sourceTable,source_id AS sourceId,reason,until_at AS until,released_at AS releasedAt FROM cb_privacy_holds ORDER BY rowid DESC')])
 return {reviews:rows[0].results.map(r=>({reviewId:r.id,version:r.version,...JSON.parse(r.data)})),receipts:rows[1].results.map(r=>JSON.parse(r.data)),holds:rows[2].results}
}
export async function holdCommand(c:Context,name:string,p:Record<string,unknown>,fence:import('../model').Query[]=[]){
 owner(c.actor);const id=text(p.id,'hold ID'),row=await c.db.prepare('SELECT * FROM cb_privacy_holds WHERE id=?').bind(id).first<any>();need(row,'Retention hold not found',404)
 if(name==='privacy.hold.read'){need(row.payload&&!row.released_at,'No retained document remains in this hold',404);return {holdId:id,reason:row.reason,until:row.until_at,record:JSON.parse(row.payload)}}
 need(name==='privacy.hold.release','Unknown privacy command',404);need(row.payload&&!row.released_at&&row.until_at<=c.now.slice(0,10),'This hold is not due for release, or protects immutable accounting evidence',409)
 c.queries.push(query('UPDATE cb_privacy_holds SET payload=NULL,released_at=? WHERE id=? AND released_at IS NULL',c.now,id),...fence);c.entityId=id;await commit(c,name);return {released:true,id}
}
