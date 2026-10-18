// Portable business history has no live installation or guest capabilities.
const pause = 'Restored history: review and reconnect before creating new work. Old effects are never replayed.'
const privateLink = /https?:\/\/[^\s<>"']*\/(?:stay\/|ical\/|book\/stay\/|book\/return\/|owners\/confirm\?|auth\/confirm\?)[^\s<>"']*/g
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
  if (['keySealed','bookingLinkSealed','paymentMethod','customerId','checkoutUrl'].includes(key)) continue
  if (key === 'link' && 'holder' in value) { result[key] = null; continue }
  if (['token','tokenHash'].includes(key)) { result[key] = null; continue }
  result[key] = key === 'code' && typeof item === 'string' && /^\d{4}$/.test(item) ? '' : scrub(item)
 }
 return result
}
export function exportRow(table, row) {
 if (table === 'cb_restore_review') return {...row,restored:1,reviewed:0,revision:'archive-review',reviewed_by:null,reviewed_at:null}
 if (table === 'cb_provider_sharing') return {...row,enabled:0,revision:'archive-review:'+row.id}
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
 const kind = row.kind, stripped = scrub(JSON.parse(row.data)), data = ['messages','notices','scheduled'].includes(kind) ? redact(stripped) : stripped
 if (['messages','notices'].includes(kind) && typeof data.text === 'string') data.text = text(data.text)
 if (kind === 'bookings') data.restorePaused = true
 if (kind === 'connections') { data.url = ''; data.restorePaused = true; data.status = 'stale'; data.error = 'Reconnect this calendar with a fresh link after reviewing the restore.' }
 if (kind === 'exports') data.token = ''
 if (kind === 'codes') { data.code = ''; data.link = null; data.status = 'revoked'; data.reason = pause; data.lock = {...data.lock,state:'manual',providerId:null,error:null} }
 if (kind === 'inbox') data.ai = null
 if (kind === 'guestOffers') { data.status = 'revoked'; data.tokenHash = 'restored:'+data.id }
 if (kind === 'recoveries') { data.restorePaused = true; data.offerUrl = undefined; data.proposal = undefined }
 if (kind === 'scheduled' && typeof data.content === 'string') data.content = text(data.content)
 if (kind === 'scheduled' && ['scheduled','sending','cancelled'].includes(data.status)) { data.status = 'skipped'; data.reason = pause }
 if (kind === 'messages' && ['pending','sending','drafting'].includes(data.status)) { data.status = 'discarded'; data.detail = pause }
 if (['notices','deliveries'].includes(kind) && ['pending','sending'].includes(data.status)) { data.status = 'unavailable'; data.detail = pause }
 return {...row,data:JSON.stringify(data)}
}
