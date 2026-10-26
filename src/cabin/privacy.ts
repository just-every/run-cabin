import { eraseReportSharing } from './reports/sharing/custody'
import { eraseVerification } from './verification/retention'
import { cases } from './verification/records'
import { eraseOwnerProperty } from './owners/privacy'
import { eraseProfiles } from './guests/erase'
import { eraseGuest } from './audit/privacy'
import { eraseProviderSource } from './movein/provider-erasure'
import { createPortability } from '@runeditrun/rer/modules/portability'
// @ts-ignore Shared with Base's JavaScript archive CLI.
import archivePolicy from './archive-policy.mjs'
import { retireD1ImportCustody } from '../modules/import-kit/src/d1/index.ts'
import { importContext } from './movein'
import { type Context, type Query, kinds, owner, text, integer, need, query, sha, newId } from './model'
import { commit, transaction } from './storage'
import { reviewErasure, checkReview, completion, holdCommand } from './privacy/records'
import { erasureScope } from './privacy/scope'
import { retainedRecords } from './privacy/holds'
import { eraseMember } from './privacy/member'
import { eraseAttachments, fenceSending, scrubOperational } from './privacy/attachments'
import { eraseSources } from './privacy/sources'
import { fenceContacts } from './privacy/contacts'
/** Preserve Base's generated statements as inert SQL for the kit's shared batch.
 * Reads still use the real D1 binding; no independent erasure commits occur. */
async function checkpoint(db:D1Database):Promise<Query[]>{
 const prepare=(sql:string,params:any[]=[]):D1PreparedStatement=>{
  const native=params.length?db.prepare(sql).bind(...params):db.prepare(sql)
  return new Proxy(native,{get(target,key){if(key==='cabinQuery')return query(sql,...params);if(key==='bind')return (...args:any[])=>prepare(sql,args);const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}})
 }
 const traced=new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>prepare(sql);const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}})
 const portability=await createPortability({db:traced,policy:archivePolicy})
 const statements=[...await portability.redactionStatements(),...await portability.invalidateTransfersStatements()]
 return statements.map((s:any)=>{const q=s.cabinQuery;need(q&&typeof q.sql==='string','Base erasure statement could not be bound',500);return q})
}
export async function privacyCommand(c:Context,p:Record<string,unknown>,name='privacy.erase'){
 owner(c.actor);if(name==='privacy.review')return reviewErasure(c,p)
 if(name.startsWith('privacy.hold.'))return holdCommand(c,name,p,name==='privacy.hold.release'?await checkpoint(c.db):[])
 need(name==='privacy.erase','Unknown privacy command',404)
 await checkReview(c,p)
 const scope=await erasureScope(c,p),entity=scope.entity,id=scope.id,fence=await checkpoint(c.db)
 if(entity==='member')return eraseMember(c,scope,p,fence)
 if(entity==='guest')return eraseGuest(c,p,fence)
 const revision=integer(p.revision,'revision',1)
 if(entity==='property'){
  const prop=c.data.properties.find(v=>v.id===id);need(prop,'Property not found',404);need(prop.revision===revision,'Property changed; reload before erasing',409)
  await eraseReportSharing(c,scope)
  const retained=await retainedRecords(c,scope,p);await fenceSending(c,scope);await fenceContacts(c,scope);await eraseAttachments(c,scope);await eraseSources(c,scope);scrubOperational(c,scope)
  const receiptId=await completion(c,entity,id,retained)
  const bookingIds=new Set(c.data.bookings.filter(b=>b.propertyId===id).map(b=>b.id));eraseProfiles(c,new Set(c.data.guests.filter(g=>bookingIds.has(g.bookingId)).map(g=>g.id)))
  for(const g of c.data.guests){g.facts=g.facts.filter(f=>!f.propertyIds.includes(id));g.consents=g.consents.filter(v=>v.propertyId!==id)}
  const ids=[] as string[];for(const kind of kinds)for(const row of c.data[kind])if('propertyId' in row&&row.propertyId===id)ids.push(row.id)
  for(const bookingId of bookingIds)c.queries.push(query('DELETE FROM cb_guest_challenges WHERE booking_id=?',bookingId),query('DELETE FROM cb_guest_sessions WHERE booking_id=?',bookingId),query('DELETE FROM cb_guest_limits WHERE booking_id=?',bookingId))
  c.queries.push(query('DELETE FROM cb_guest_guide_files WHERE property_id=?',id),query('DELETE FROM cb_qbo_catalog'))
  await eraseVerification(c,bookingIds)
  for(const v of cases(c.data).filter(v=>bookingIds.has(v.bookingId))){ids.push(v.id,'guest:'+v.bookingId)}
  for(const subject of [id,...ids])c.queries.push(query('INSERT OR IGNORE INTO cb_audit_redactions(subject_id,anonymous_id,at,actor_id) VALUES(?,?,?,?)',subject,'erased:'+newId(),c.now,c.actor.id))
  await eraseProviderSource(c,id)
  eraseOwnerProperty(c,id)
  const ownerEmail=c.before.properties.find(p=>p.id===id)!.ownerEmail
  c.queries.push(query('DELETE FROM cb_tax_config WHERE property_id=?',id),query("UPDATE cb_tax_deliveries SET status='unavailable',data=json_object('id',id,'reportId',report_id,'status','unavailable','detail','Property erased; contact removed') WHERE report_id IN (SELECT id FROM cb_tax_reports WHERE property_id=?)",id),query('DELETE FROM cb_owner_links WHERE email=? COLLATE NOCASE',ownerEmail),query('DELETE FROM cb_owner_sessions WHERE email=? COLLATE NOCASE',ownerEmail))
  c.queries.push(query("DELETE FROM cb_photos WHERE turnover_id IN (SELECT id FROM cb_records WHERE kind IN ('turnovers','tasks','propertyProfiles') AND json_extract(data,'$.propertyId')=?)",id),query('DELETE FROM cb_approvals WHERE record_id IN (SELECT id FROM cb_records WHERE json_extract(data,\'$.propertyId\')=?)',id),query("DELETE FROM cb_records WHERE json_extract(data,'$.propertyId')=?",id),query('DELETE FROM cb_import_revisions WHERE property_id=?',id),query('DELETE FROM cb_direct_stays WHERE property_id=?',id),query('DELETE FROM cb_direct_homes WHERE property_id=?',id),query('DELETE FROM cb_properties WHERE id=?',id),query("INSERT INTO cb_erasure_fences(entity,id_hash,at) VALUES('property',?,?)",await sha(id),c.now))
  // Reviewed source bytes live only in these plans and kit custody. Remove any
  // review containing this property; kit retains anonymous source tombstones.
  const reviewRows=(await c.db.prepare('SELECT id,plan,job_id FROM cb_import_reviews').all<{id:string;plan:string;job_id:string|null}>()).results
  for(const r of reviewRows){const plan=JSON.parse(r.plan);if(plan.entries?.some((e:any)=>e.effects?.some((effect:any)=>effect.targetKind==='property'&&effect.targetId===id))){if(r.job_id)c.queries.push(query("UPDATE cb_import_reviews SET plan='{}' WHERE id=?",r.id));else c.queries.push(query('DELETE FROM cb_import_reviews WHERE id=?',r.id))}}
  c.entityId=id;c.audit=[{kind:'property',id,propertyId:id,revision:String(revision),result:'erased'}]
  const result=await retireD1ImportCustody({target:{kind:'property',id}},transaction(c,'privacy.erase'),importContext(c.db,c.actor),fence)
  return {id,entity,erased:true,erasedRecords:ids.length,receiptId,sourceReceiptId:result.receiptId}
 }
 need(false,'Unknown erasure entity')
}
