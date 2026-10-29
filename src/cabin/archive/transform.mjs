// Portable business history has no live installation or guest capabilities.
const pause = 'Restored history: review and reconnect before creating new work. Old effects are never replayed.'
const privateLink = /https?:\/\/[^\s<>"']*\/(?:stay\/|offers\/|ical\/|book\/stay\/|book\/quote\/|book\/return\/|owners\/confirm\?|auth\/confirm\?)[^\s<>"']*/g
function text(value) {
 return value.replace(privateLink, '[private link removed on export]')
  .replace(/\/stay\/[a-f0-9]{48}\b/g, '[private link removed on export]')
  .replace(/((?:door|guest|cleaner|entry|access)\s*code\s*[:#]?\s*)\d{4}\b/gi, '$1[removed on export]')
}
function redact(value) {
 if(typeof value==='string')return text(value)
 if(Array.isArray(value))return value.map(redact)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]))
 return value
}
function scrub(value) {
 if (typeof value === 'string') return value
 if (Array.isArray(value)) return value.map(scrub)
 if (!value || typeof value !== 'object') return value
 const result = {}
 for (const [key, item] of Object.entries(value)) {
  if (['keySealed','bookingLinkSealed','tokenSealed','paymentMethod','customerId','checkoutUrl'].includes(key)) continue
  if (key === 'link' && 'holder' in value) { result[key] = null; continue }
  if (key==='authority'&&item&&typeof item==='object') { result[key]={...item,operatorVersion:-1}; continue }
  if (['token','tokenHash'].includes(key)) { result[key] = null; continue }
  result[key] = key === 'code' && typeof item === 'string' && /^\d{4}$/.test(item) ? '' : scrub(item)
 }
 return result
}
export function exportRow(table, row) {
 if(table==='agent_door_approvals')return ['pending','executing'].includes(row.state)?{...row,state:'expired'}:row
 if(table==='agent_door_reviews'){
  // Preserve attribution and the outcome, but an old review cannot authorize a new reversal.
  const saved=JSON.parse(row.saved);delete saved.undo
  return {...row,saved:JSON.stringify(saved)}
 }
 if(['cb_qbo_mappings','cb_qbo_entries','cb_qbo_batches'].includes(table)){const data=JSON.parse(row.data);data.restored=true;return {...row,data:JSON.stringify(data)}}
 if(table==='cb_saved_reports'||table==='cb_report_schedules'||table==='cb_report_runs'){
  const data=JSON.parse(row.data),invalidate=a=>a?{...a,operatorVersion:-1}:a
  data.creator=invalidate(data.creator)
  if(data.recipient?.actor)data.recipient.actor=invalidate(data.recipient.actor)
  if(data.scope){data.scope.creator=invalidate(data.scope.creator);if(data.scope.recipient?.actor)data.scope.recipient.actor=invalidate(data.scope.recipient.actor)}
  if(table==='cb_report_schedules'){data.enabled=false;data.pausedAt='restored';return {...row,enabled:0,data:JSON.stringify(data)}}
  if(table==='cb_report_runs'&&['generating','sending'].includes(data.status)){data.status=data.status==='sending'?'delivery_failed':'generation_failed';data.finishedAt=data.startedAt;data.detail=pause;data.history.push({at:data.startedAt,status:data.status,detail:pause});return {...row,data:JSON.stringify(data)}}
  return {...row,data:JSON.stringify(data)}
 }
 if (table === 'cb_restore_review') return {...row,restored:1,reviewed:0,revision:'archive-review',reviewed_by:null,reviewed_at:null}
 if (table === 'cb_provider_sharing') return {...row,enabled:0,revision:'archive-review:'+row.id}
 if (table === 'cb_booking_site') { const data=JSON.parse(row.data); data.domainVerified=false; data.domainChallenge=''; return {...row,data:JSON.stringify(data)} }
 if (table === 'cb_direct_homes') { const data=JSON.parse(row.data); data.enabled=false; return {...row,data:JSON.stringify(data)} }
 if (table === 'cb_direct_stays') {
  const data = scrub(JSON.parse(row.data)); data.restored = true; data.error = 'Restored payment history is inactive. Reconcile existing charges and holds directly in Stripe; Cabin will not replay them.'
  if (data.depositCheckout) delete data.depositCheckout.url
  return {...row,token_hash:'restored:'+row.id,data:JSON.stringify(data)}
 }
 if (table === 'cb_verifications') {
  const data = scrub(JSON.parse(row.data)); data.restorePaused = true
  return {...row,data:JSON.stringify(data)}
 }
 if (table === 'cb_tax_deliveries' && ['pending','sending'].includes(row.status)) { const data = JSON.parse(row.data); data.status = 'unavailable'; data.detail = pause; return {...row,status:'unavailable',data:JSON.stringify(data)} }
 if (table === 'cb_provider_moveins') {
  const plan=JSON.parse(row.plan); plan.restorePaused=true
  for(const home of plan.homes)home.links=[]
  const inventory=row.inventory?JSON.parse(row.inventory):null
  if(inventory)inventory.records=inventory.records.map(record=>({...record,data:exportRow('cb_records',{kind:record.kind,data:record.data}).data}))
  // Keep the original approved fingerprint as history. A restored preview must
  // be recreated, never applied from a changed or credential-stripped plan.
  return {...row,plan:JSON.stringify(plan),inventory:inventory?JSON.stringify(inventory):null}
 }
 if (table !== 'cb_records') return row
 const kind = row.kind, stripped = scrub(JSON.parse(row.data)), data = ['messages','notices','scheduled','threadCases'].includes(kind) ? redact(stripped) : stripped
 if (['messages','notices'].includes(kind) && typeof data.text === 'string') data.text = text(data.text)
 if(kind==='messages'&&data.control)delete data.control.baseline
 if(kind==='inquiries')data.restorePaused=true
 if(kind==='messages'&&data.providerId?.startsWith('channel-read:inquiry:')){data.status='discarded';data.detail=pause}
 if(kind==='threadCases'&&data.key?.startsWith('r:inquiry-thread:')){data.status='answered';data.waitingSince=null;data.dueAt=null;data.claim=null}
 if(kind==='financialCases')data.restorePaused=true
 if(kind==='distributionPlans')data.restorePaused=true
 if(kind==='guestPortalLinks'){data.token=null;data.status='revoked';data.sessionEpoch='restored'}
 if (kind === 'statementSchedules') { data.enabled=false; data.error=pause; data.actor={...data.actor,operatorVersion:-1} }
 if (kind === 'bookings') { data.restorePaused = true; if(data.quoteId){data.status='cancelled';data.cancelled=true} }
 if (kind === 'collectionPlans') { if(!data.restored)data.history=[...(data.history??[]),{at:data.createdAt,detail:pause}]; data.restored=true; data.status='paused'; delete data.setup; delete data.consent }
 if (kind === 'connections') { data.url = ''; data.restorePaused = true; data.status = 'stale'; data.error = 'Reconnect this calendar with a fresh link after reviewing the restore.' }
 if (kind === 'channelAgentAccounts') { data.status='revoked'; data.generation='restored:'+data.id }
 if (kind === 'channelAgentProfiles') { delete data.stateSealed; delete data.grantedAt; delete data.grantedBy; delete data.challenge; data.status='disconnected' }
 if (kind === 'channelAgentKeys') { delete data.hash; data.expiresAt='1970-01-01T00:00:00.000Z' }
 if (kind === 'channelAgentEvidence') delete data.bodySealed
 if (kind === 'channelAgentActions') {
  delete data.lease; delete data.leaseUntil; delete data.beforeSealed; delete data.afterSealed; data.canUndo=false
  if (['pending','queued','running','needs_you'].includes(data.status)) { data.status='cancelled'; data.detail=pause }
 }
 if (kind === 'exports') data.token = ''
 if (kind === 'codes') { data.code = ''; data.link = null; data.status = 'revoked'; data.reason = pause; data.lock = {state:'manual',providerId:null,error:null,at:null} }
 if (kind === 'inbox') data.ai = null
 if (kind === 'promotionOffers') { data.restorePaused=true; data.tokenHash=null; delete data.tokenSealed; delete data.checkoutUrl }
 if (kind === 'promotionPolicies') data.enabled=false
 if (kind === 'staffQuotes') { if(data.status==='issued')data.status='expired'; data.tokenHash=null; delete data.tokenSealed }
 if (kind === 'guestOffers') { data.status = 'revoked'; data.tokenHash = 'restored:'+data.id }
 if (kind === 'recoveries') { data.restorePaused = true; data.offerUrl = undefined; data.proposal = undefined }
 if (kind === 'scheduled' && typeof data.content === 'string') data.content = text(data.content)
 if (kind === 'scheduled' && ['scheduled','sending','cancelled'].includes(data.status)) { data.status = 'skipped'; data.reason = pause }
 if (kind === 'messages' && ['pending','sending','drafting'].includes(data.status)) { data.status = 'discarded'; data.detail = pause }
 if (['notices','deliveries'].includes(kind) && ['pending','sending'].includes(data.status)) { data.status = 'unavailable'; data.detail = pause }
 return {...row,data:JSON.stringify(data)}
}
