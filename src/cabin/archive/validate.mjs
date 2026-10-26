import { exportRow } from './transform.mjs'
const quote=name=>'"'+name.replaceAll('"','""')+'"'
/** Validate in bounded reads before publication, including installations with long history. */
export async function validateStaged({ db, tables }) {
 if (!tables.cb_restore_review) throw Error('Archive needs a restore-review fence. Export again using the current Cabin.')
 const table=name=>{if(!tables[name])throw Error('Archive is missing '+name);return quote(tables[name])}
 async function* rows(name) {
  for(let offset=0;;offset+=500){const batch=(await db.prepare(`SELECT * FROM ${table(name)} LIMIT 500 OFFSET ?`).bind(offset).all()).results;if(!batch.length)return;yield* batch}
 }
 const review=await db.prepare(`SELECT restored,reviewed FROM ${table('cb_restore_review')} WHERE id=1`).first()
 if (!review || review.restored !== 1 || review.reviewed !== 0) throw Error('Restored outbound work must be paused.')
 for (const name of ['cb_qbo_mappings','cb_qbo_entries','cb_qbo_batches','cb_records','cb_direct_stays','cb_verifications','cb_provider_sharing','cb_direct_homes','cb_tax_deliveries','cb_provider_moveins']) {
  for await (const row of rows(name)) if (JSON.stringify(exportRow(name,row)) !== JSON.stringify(row)) throw Error('Archive contains active provider work or private capabilities: '+name)
 }
 for await (const row of rows('cb_ledger_journals')) {
  const journal=JSON.parse(row.data)
  if (journal.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0)!==0) throw Error('Archive ledger is not balanced.')
 }
 if(await db.prepare(`SELECT 1 FROM ${table('cb_records')} r LEFT JOIN ${table('cb_properties')} p ON json_extract(r.data,'$.propertyId')=p.id WHERE json_type(r.data,'$.propertyId')='text' AND p.id IS NULL LIMIT 1`).first())throw Error('Archive operational record has no property.')
 if(await db.prepare(`SELECT 1 FROM ${table('cb_photos')} p LEFT JOIN ${table('cb_records')} r ON r.id=p.turnover_id WHERE r.id IS NULL LIMIT 1`).first())throw Error('Archive photo has no operational record.')
 for await (const row of rows('cb_records')) if (row.kind==='rentalAgreements') {
  for (const document of JSON.parse(row.data).documents) {
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(document.text))),b=>b.toString(16).padStart(2,'0')).join('')
   if (digest!==document.sha256) throw Error('Archive rental document does not match its signed evidence.')
  }
 }
 return true
}
