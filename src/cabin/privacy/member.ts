import { owner, need, newId, query, sha, type Context } from '../model'
import { commit } from '../storage'
import { eraseAttachments, fenceSending, scrubOperational } from './attachments'
import { retainedRecords } from './holds'
import { completion } from './records'
import { scrub, type ErasureScope } from './scope'
import { fenceContacts } from './contacts'
import { eraseSources } from './sources'
export async function eraseMember(c:Context,s:ErasureScope,p:Record<string,unknown>,fence:import('../model').Query[]){
 owner(c.actor);const member=c.data.members.find(m=>m.id===s.id)!,retained=await retainedRecords(c,s,p)
 const operator=await c.db.prepare('SELECT id,role FROM oa_operators WHERE email=? COLLATE NOCASE').bind(member.email).first<{id:string;role:string}>()
 need(!operator||operator.id!==c.actor.id&&operator.role!=='owner','The installation owner identity cannot be erased through a team grant',409)
 await fenceSending(c,s);await fenceContacts(c,s);await eraseAttachments(c,s);await eraseSources(c,s);scrubOperational(c,s)
 for(const t of c.data.turnovers){if(t.cleanerId===s.id){t.cleanerId=null;t.notified=null;if(t.status==='approved')t.status='unassigned';t.revision=newId()}if(t.dispatch)t.dispatch.offers=t.dispatch.offers.filter(o=>o.memberId!==s.id)}
 for(const t of c.data.tasks){if(t.assigneeId===s.id){t.assigneeId=null;t.notified=null;t.revision=newId()}if(t.work?.inspectorId===s.id){t.work.inspectorId=null as any;t.revision=newId()}}
 for(const h of c.data.homeSettings){if(h.cleanerId===s.id)h.cleanerId=null;if(h.maintenanceId===s.id)h.maintenanceId=null;if(h.dispatch){h.dispatch.approvedCleanerIds=h.dispatch.approvedCleanerIds.filter(id=>id!==s.id);h.dispatch.driveTimes=h.dispatch.driveTimes.filter(v=>v.from!==s.id)}}
 for(const r of c.data.codes)if(r.memberId===s.id){r.status='revoked';r.link=null;r.reason='Member erased';r.revision=newId()}
 for(const r of c.data.verifications){Object.assign(r,scrub(r,s.values));if(r.policy.reviewerId===s.id){r.policy.reviewerId=c.actor.id;r.policy.reviewerEmail=c.actor.email;c.queries.push(query('UPDATE cb_verifications SET data=? WHERE id=?',JSON.stringify(r),r.id))}else c.queries.push(query('UPDATE cb_verifications SET data=? WHERE id=?',JSON.stringify(r),r.id))}
 for(const row of (await c.db.prepare('SELECT property_id,data FROM cb_direct_homes').all<{property_id:string;data:string}>()).results){
  const home=JSON.parse(row.data),policy=home.verificationPolicy
  if(policy?.reviewerId!==s.id&&!s.values.some(v=>row.data.toLowerCase().includes(v.toLowerCase())))continue
  const clean=scrub(home,s.values);if(policy?.reviewerId===s.id){clean.verificationPolicy.reviewerId=c.actor.id;clean.verificationPolicy.reviewerEmail=c.actor.email}
  c.queries.push(query('UPDATE cb_direct_homes SET data=? WHERE property_id=?',JSON.stringify(clean),row.property_id))
 }
 for(const subject of [s.id,...(operator?[operator.id]:[])])c.queries.push(query('INSERT OR IGNORE INTO cb_audit_redactions(subject_id,anonymous_id,at,actor_id) VALUES(?,?,?,?)',subject,'erased:'+newId(),c.now,c.actor.id))
 if(operator){
  const id=operator.id
  c.queries.push(query("UPDATE oa_operators SET status='inactive',email=?,display_name='Erased operator',version=version+1 WHERE id=?",'erased-'+newId()+'@invalid.example',id),query('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=?',Date.parse(c.now),id),query('UPDATE oa_tokens SET revoked_at=?,return_to=\'/\' WHERE operator_id=? OR issuer_id=?',Date.parse(c.now),id,id),query('UPDATE oa_credentials SET revoked_at=? WHERE operator_id=?',Date.parse(c.now),id),query('DELETE FROM oa_external_identities WHERE operator_id=?',id),query('DELETE FROM oa_step_up_challenges WHERE operator_id=?',id),query('DELETE FROM oa_owner_signins WHERE operator_id=?',id),query('DELETE FROM oa_provider_sessions WHERE session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)',id),query('DELETE FROM oa_provider_session_pins WHERE session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)',id),query("UPDATE oa_auth_audit SET value='' WHERE actor_id=? OR instr(value,?)>0",id,id))
 }
 for(const value of s.values)c.queries.push(query('DELETE FROM oa_oidc_transactions WHERE instr(lower(payload),lower(?))>0',value),query("UPDATE oa_auth_audit SET value='' WHERE instr(lower(value),lower(?))>0",value))
 c.data.members=c.data.members.filter(r=>r.id!==s.id);c.data.cleanerProfiles=c.data.cleanerProfiles.filter(r=>r.id!==s.id);c.queries.push(query("DELETE FROM cb_records WHERE kind='cleanerProfiles' AND id=?",s.id),query('DELETE FROM cb_members WHERE id=?',s.id),query("INSERT OR IGNORE INTO cb_erasure_fences(entity,id_hash,at) VALUES('member',?,?)",await sha(s.values.find(v=>v.includes('@'))!.toLowerCase()),c.now),...fence)
 const receiptId=await completion(c,'member',s.id,retained);c.entityId=s.id;c.audit=[{kind:'member',id:s.id,result:'erased'}];await commit(c,'privacy.erase');return {erased:true,entity:'member',id:s.id,receiptId}
}
