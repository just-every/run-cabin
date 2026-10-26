import type { Bindings } from '../../../auth.server'
import { type Actor, need, text, newId, sha } from '../../model'
import { load } from '../../storage'
import { journals } from '../../ledger/store'
import { connection } from './connection'
import { api, query, QboError } from './client'
import { batch, entry, rows, saveEntry, audit, requireOwner } from './store'
import { payload, fingerprint, totals } from './payload'
import type { Batch, Entry, Mapping } from './types'
export async function sources(env:Bindings,propertyId:string,month:string) {return (await journals(env.DB)).filter(j=>j.propertyId===propertyId&&j.effectiveDate.slice(0,7)===month).sort((a,b)=>a.id.localeCompare(b.id))}
export async function preview(env:Bindings,actor:Actor,input:Record<string,unknown>) {
 await requireOwner(env.DB,actor)
 const propertyId=text(input.propertyId,'property'),month=text(input.month,'month',7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Choose a valid accounting month')
 need((await load(env.DB)).properties.some(p=>p.id===propertyId),'Property not found',404)
 const c=await connection(env,propertyId),source=await sources(env,propertyId,month),mappings=await rows<Mapping>(env.DB,'mappings');need(source.length,'No posted ledger journals for this property and month',409)
 const entries:Entry[]=[],existing=await rows<Entry>(env.DB,'entries'),accountTotals:Record<string,number>={};let debitCents=0,creditCents=0
 for(const j of source){
  const m=mappings.find(m=>m.propertyId===propertyId&&m.ownerKey===j.ownerKey&&m.realm===c.realm&&m.mode===c.mode&&!m.restored);need(m,'Approve mappings for every source owner before previewing',409)
  const sourceSha256=await sha(JSON.stringify(j)),old=existing.find(e=>e.realm===c.realm&&e.mode===c.mode&&e.sourceId===j.id)
  if(old)need(old.sourceSha256===sourceSha256,'An immutable source journal changed. Reconcile the original QuickBooks entry.',409)
  const p=old&&old.status!=='preview'?old.payload:await payload(j,m),sum=totals(p);debitCents+=sum.debitCents;creditCents+=sum.creditCents
  for(const [id,n]of Object.entries(sum.accountTotals))accountTotals[id]=(accountTotals[id]??0)+n
  entries.push(old&&old.status!=='preview'?old:{propertyId,id:await sha(c.mode+':'+c.realm+':'+j.id),mode:c.mode,realm:c.realm,sourceId:j.id,sourceSha256,mappingRevision:m.revision,payload:p,status:'preview',detail:'Preview only. No journal sent.',updatedAt:new Date().toISOString()})
 }
 need(Number.isSafeInteger(debitCents)&&debitCents===creditCents,'Batch totals do not balance')
 const b:Batch={id:newId(),propertyId,month,mode:c.mode,realm:c.realm,revision:newId(),entryIds:entries.map(e=>e.id),entrySha256:Object.fromEntries(await Promise.all(entries.map(async e=>[e.id,await fingerprint(e.payload)]))),sourceIds:source.map(j=>j.id),sourceSha256:await sha(JSON.stringify(source)),debitCents,creditCents,accountTotals,createdAt:new Date().toISOString(),createdBy:actor.id}
 await requireOwner(env.DB,actor)
 await env.DB.batch([...entries.filter(e=>!existing.some(old=>old.id===e.id&&old.status!=='preview')).map(e=>env.DB.prepare('INSERT INTO cb_qbo_entries(id,mode,realm,source_id,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(cb_qbo_entries.data,"$.status")="preview"').bind(e.id,e.mode,e.realm,e.sourceId,JSON.stringify(e))),env.DB.prepare('INSERT INTO cb_qbo_batches(id,property_id,data) VALUES(?,?,?)').bind(b.id,propertyId,JSON.stringify(b))])
 await audit(env.DB,actor,'qbo.preview',b.id,propertyId);return b
}
async function readRemote(env:Bindings,c:Awaited<ReturnType<typeof connection>>,e:Entry,propertyId:string) {
 if(e.externalId)return (await api(env,c,'journalentry/'+encodeURIComponent(e.externalId),undefined,propertyId)).JournalEntry
 const matches=await query(env,c,'JournalEntry',`DocNumber = '${e.payload.DocNumber}'`,propertyId)
 need(matches.length<=1,'More than one remote journal has this identity. Review QuickBooks.',409);return matches[0]
}
async function sendEntry(env:Bindings,actor:Actor,b:Batch,id:string,send:boolean) {
 let e=await entry(env.DB,id);need(await fingerprint(e.payload)===b.entrySha256[id],'The preview mapping changed. Review a new batch before continuing.',409);need(e.realm===b.realm&&e.mode===b.mode,'QuickBooks company changed',409)
 const c=await connection(env,b.propertyId)
 try {
  let remote=await readRemote(env,c,e,b.propertyId)
  if(!remote&&e.externalId){e.status='conflict';e.detail='The saved QuickBooks journal was removed. Reconcile it manually; no replacement was sent.';return saveEntry(env.DB,e)}
  if(remote){
   const exact=await fingerprint(remote)===await fingerprint(e.payload),sameToken=!e.syncToken||String(remote.SyncToken)===e.syncToken
   if(!exact||!sameToken){e.status='conflict';e.externalId=String(remote.Id);e.detail='QuickBooks was externally edited. No overwrite or duplicate was sent. Reconcile the saved external journal manually.';return saveEntry(env.DB,e)}
   e.status='posted';e.externalId=String(remote.Id);e.syncToken=String(remote.SyncToken);e.remoteSha256=await fingerprint(remote);e.detail='Remote accounts, class, vendor, date and cent amounts match the saved source journal.';return saveEntry(env.DB,e)
  }
  if(!send||e.status==='rejected'||e.status==='conflict')return e
  await requireOwner(env.DB,actor)
  // Compare and claim before the network write. Concurrent callers cannot send a new intent.
  const old=JSON.stringify(e);if(e.status==='sending'&&Date.parse(e.updatedAt)>Date.now()-60000)return e
  e.status='sending';e.updatedAt=new Date().toISOString();e.detail='Sending the saved journal with its stable request identity.'
  const claim=await env.DB.prepare('UPDATE cb_qbo_entries SET data=? WHERE id=? AND data=?').bind(JSON.stringify(e),id,old).run();if(!claim.meta.changes)return entry(env.DB,id)
  remote=(await api(env,c,'journalentry?'+new URLSearchParams({requestid:e.id.slice(0,40)}),e.payload,b.propertyId)).JournalEntry
  need(remote?.Id,'QuickBooks did not return the journal identity',502)
  e.externalId=String(remote.Id);e.syncToken=String(remote.SyncToken)
  if(await fingerprint(remote)!==await fingerprint(e.payload)){e.status='conflict';e.detail='QuickBooks accepted different accounting detail. Review the saved external journal; no replacement will be sent.'}
  else {e.status='posted';e.remoteSha256=await fingerprint(remote);e.detail='Posted and reconciled to the exact saved source journal.'}
 }catch(error){
  e.status=e.externalId?'conflict':error instanceof QboError&&error.status>=400&&error.status<500?'rejected':'uncertain'
  e.detail=error instanceof QboError?error.message:'QuickBooks outcome is unconfirmed. Check the saved remote identity before any further action.'
 }
 return saveEntry(env.DB,e)
}
export async function sync(env:Bindings,actor:Actor,input:Record<string,unknown>,send:boolean) {
 await requireOwner(env.DB,actor);const b=await batch(env.DB,text(input.id,'batch'))
 const c=await connection(env,b.propertyId);need(c.realm===b.realm&&c.mode===b.mode,'Reconnect the company that owns this batch',409)
 if(send){
  need(!b.restored,'Restored batches are inactive history. Preview a new batch with freshly approved mappings.',409)
  need((await load(env.DB)).properties.some(p=>p.id===b.propertyId),'This property was erased. Retained accounting history cannot send new journals.',409)
  need(input.revision===b.revision,'Review this exact batch revision',409);need(input.consent===true||input.consent==='on','Explicit approval is required before posting to QuickBooks')
  need(await sha(JSON.stringify(await sources(env,b.propertyId,b.month)))===b.sourceSha256,'The month changed. Preview a new batch; saved source identities will be reused.',409)
  const mappings=await rows<Mapping>(env.DB,'mappings')
  for(const id of b.entryIds){const e=await entry(env.DB,id);if(e.status==='preview')need(mappings.some(m=>m.propertyId===b.propertyId&&m.realm===b.realm&&m.mode===b.mode&&m.revision===e.mappingRevision),'The approved mapping changed. Reconcile this saved preview before sending.',409)}
  b.approvedAt=new Date().toISOString();b.approvedBy=actor.id;await env.DB.prepare('UPDATE cb_qbo_batches SET data=? WHERE id=?').bind(JSON.stringify(b),b.id).run();await audit(env.DB,actor,'qbo.sync.approve',b.id,b.propertyId,'approved')
 }
 // Bounded work per request; explicit repeat resumes the same durable identities.
 let writes=0
 for(const id of b.entryIds){const e=await entry(env.DB,id);if(send&&['preview','uncertain','sending'].includes(e.status)&&writes++>=20)continue;await sendEntry(env,actor,b,id,send)}
 await audit(env.DB,actor,send?'qbo.sync':'qbo.reconcile',b.id,b.propertyId)
 return reconciliation(env,b)
}
export async function reconciliation(env:Bindings,b:Batch) {
 const all=await rows<Entry>(env.DB,'entries'),entries=b.entryIds.map(id=>all.find(e=>e.id===id)!).filter(Boolean),posted=entries.filter(e=>e.status==='posted'),sums=posted.map(e=>totals(e.payload)),accountTotals:Record<string,number>={}
 for(const s of sums)for(const [id,n]of Object.entries(s.accountTotals))accountTotals[id]=(accountTotals[id]??0)+n
 const snapshotMatches=(await Promise.all(entries.map(async e=>await fingerprint(e.payload)===b.entrySha256[e.id]))).every(Boolean)
 const debitCents=sums.reduce((n,s)=>n+s.debitCents,0),creditCents=sums.reduce((n,s)=>n+s.creditCents,0)
 return {...b,entries,reconciled:snapshotMatches&&posted.length===b.entryIds.length&&debitCents===b.debitCents&&creditCents===b.creditCents&&Object.keys(b.accountTotals).every(id=>accountTotals[id]===b.accountTotals[id]),remoteDebitCents:debitCents,remoteCreditCents:creditCents,remoteAccountTotals:accountTotals}
}
