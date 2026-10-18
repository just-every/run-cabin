import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { run } from './harness.mjs'
import { erase } from './privacy-flow.mjs'
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)

test('DATA-002: reviewed guest erasure removes photos, threads and legal read links while preserving exact owner-only holds and completion evidence',()=>run(async h=>{
 const p=await h.cmd('property.save',{name:'Cedar Lodge',ownerName:'Morgan Lee',ownerEmail:'morgan@stay.example',commissionBps:2000}),cleaner=await h.person('Taylor'),manager=await h.person('Robin','manager')
 await h.cmd('direct.agreement.template',{propertyId:p.id,agreement:'Quiet hours after 10 pm.',agreementTitle:'Cedar rental agreement',agreementState:'FL',agreementRequired:'yes',agreementBlockAccess:'yes'})
 const stay=await h.cmd('reservation.request',{propertyId:p.id,channel:'airbnb',start:day(-7),end:day(-4),guestName:'Ana Ruiz',guestEmail:'ana@stay.example'})
 let s=await h.accessState(),a=s.rentalAgreements.find(a=>a.bookingId===stay.bookingId),d=a.documents[0],link='/book/stay/agreement/'+a.token
 assert.equal((await h.send(link,{version:d.id,sha256:d.sha256,name:'Ana Ruiz',email:'ana@stay.example',consent:'yes'})).status,303)
 const original=await h.send(link+'/document/'+d.id);assert.equal(original.status,200)
 let t=await h.cmd('turnover.prepare',{bookingId:stay.bookingId,cleanerId:cleaner.id,checklist:['Beds made']});await h.cmd('turnover.approve',{id:t.id,revision:t.revision})
 t=(await h.accessState()).turnovers.find(v=>v.id===t.id)
 await h.cmd('turnover.complete',{id:t.id,revision:t.revision,checks:t.checklist,photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png',caption:'Ana personal attachment'},cleaner.cookie)
 s=await h.accessState();const photo=s.turnovers.find(v=>v.id===t.id).completion.photoId,booking=s.bookings.find(b=>b.id===stay.bookingId)
 assert.equal((await h.send('/api/cabin/photos/'+photo,undefined,h.owner)).status,200)
 await h.cmd('privacy.review',{entity:'guest',id:booking.id,revision:booking.revision},manager.cookie,403)
 await h.cmd('privacy.erase',{entity:'guest',id:booking.id,revision:booking.revision},h.owner,409)
 const review=await h.cmd('privacy.review',{entity:'guest',id:booking.id,revision:booking.revision,retainUntil:day(365),retentionReason:'Signed agreement retained for an open contractual claim'})
 assert.ok(review.inventory.attachments.some(v=>v.id===photo));assert.ok(review.retained.some(v=>v.id===a.id&&v.until===day(365)))
 const result=await h.cmd('privacy.erase',{entity:'guest',id:booking.id,revision:booking.revision,reviewId:review.reviewId})
 assert.equal((await h.send(link)).status,404);assert.equal((await h.send(link+'/document/'+d.id)).status,404);assert.equal((await h.send('/api/cabin/photos/'+photo,undefined,h.owner)).status,404)
 assert.equal((await h.send(`/api/cabin/agreements/${a.id}/${d.id}`,undefined,manager.cookie)).status,404)
 s=await h.accessState();const receipt=s.privacy.receipts.find(r=>r.receiptId===result.receiptId),held=s.privacy.holds.find(v=>v.sourceId===a.id)
 assert.ok(receipt.completedAt&&receipt.reviewDigest);assert.ok(receipt.erased.attachments.some(v=>v.id===photo));assert.ok(receipt.externalSteps.length)
 const legal=await h.cmd('privacy.hold.read',{id:held.id});assert.equal((await h.send(`/api/cabin/privacy/holds/${held.id}/document/${d.id}`,undefined,h.owner)).text,original.text);assert.equal(legal.record.token,undefined)
 await h.cmd('privacy.hold.read',{id:held.id},manager.cookie,403);await h.cmd('privacy.hold.release',{id:held.id},h.owner,409)
 assert.ok(!s.bookings.find(b=>b.id===booking.id).guestEmail);assert.ok(s.messages.filter(m=>m.bookingId===booking.id).every(m=>!m.text&&!m.email));assert.ok(s.scheduled.filter(v=>v.bookingId===booking.id).every(v=>v.status!=='scheduled'))
 const audit=await h.send('/api/cabin/activity.jsonl',undefined,h.owner);assert.ok(audit.text.includes('erased:'));assert.ok(!audit.text.includes('ana@stay.example'))
 // An ordinary command and Cron cannot revive the erased identity or its work.
 await h.cmd('booking.details',{id:booking.id,revision:(await h.accessState()).bookings.find(row=>row.id===booking.id).revision,guestName:'Ana Ruiz',guestEmail:'ana@stay.example'},h.owner,409)
 await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 assert.ok((await h.accessState()).messages.filter(m=>m.bookingId===booking.id).every(m=>m.status!=='pending'&&m.status!=='sending'))
 // A new source record with the erased contact still cannot get past the final mail boundary.
 await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
 await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',start:day(20),end:day(23),guestName:'Imported contact',guestEmail:'ana@stay.example'})
 const before=(await h.db.prepare("SELECT COUNT(*) AS n FROM rer_mail_development_outbox WHERE EXISTS (SELECT 1 FROM json_each(message,'$.to') WHERE value='ana@stay.example')").first()).n
 await h.cmd('inbox.try',{source:'From: Ana <ana@stay.example>\r\nTo: guests@stay.example\r\nSubject: Parking question\r\nMessage-ID: <erased-contact@stay.example>\r\nContent-Type: text/plain\r\n\r\nWhere is parking?'})
 const fresh=(await h.accessState()).messages.find(m=>m.status==='draft'&&m.email==='ana@stay.example')
 assert.ok(fresh)
 await h.cmd('message.send',{id:fresh.id,revision:fresh.revision,text:'Here are the parking instructions.'})
 assert.equal((await h.accessState()).messages.find(m=>m.id===fresh.id).status,'failed')
 assert.equal((await h.db.prepare("SELECT COUNT(*) AS n FROM rer_mail_development_outbox WHERE EXISTS (SELECT 1 FROM json_each(message,'$.to') WHERE value='ana@stay.example')").first()).n,before)
}))

test('DATA-002: invited operators can be erased with historical assignments; stale reviews and old sessions are refused',()=>run(async h=>{
 const p=await h.cmd('property.save',{name:'Pine Lodge',ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:1500}),cleaner=await h.person('Jordan')
 const stay=await h.cmd('reservation.request',{propertyId:p.id,channel:'airbnb',start:day(8),end:day(11),guestName:'Future guest'})
 const t=await h.cmd('turnover.prepare',{bookingId:stay.bookingId,cleanerId:cleaner.id,checklist:['Beds made']});await h.cmd('turnover.approve',{id:t.id,revision:t.revision})
 const member=(await h.accessState()).members.find(m=>m.id===cleaner.id),input={entity:'member',id:member.id,revision:member.revision},review=await h.cmd('privacy.review',input)
 await h.cmd('booking.details',{id:stay.bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===stay.bookingId).revision,guestName:'Changed guest'})
 await h.cmd('privacy.erase',{...input,reviewId:review.reviewId},h.owner,409)
 const erased=await erase(h,input);assert.ok(erased.receiptId)
 assert.equal((await h.send('/api/cabin/state',undefined,cleaner.cookie)).status,401)
 const s=await h.accessState();assert.ok(!s.members.some(m=>m.id===cleaner.id));assert.ok(s.turnovers.filter(t=>t.cleanerId===cleaner.id).length===0);assert.ok(s.notices.filter(v=>v.memberId===cleaner.id).every(v=>!v.email&&v.status!=='pending'))
 await h.cmd('member.save',{name:'Jordan',email:'jordan@stay.example',role:'cleaner',active:true},h.owner,409)
 const audit=await h.send('/api/cabin/activity.jsonl',undefined,h.owner);assert.ok(audit.text.includes('erased:'));assert.ok(!audit.text.includes('jordan@stay.example'))
}))

test('DATA-002: property erasure withdraws retained source files and photos, and keeps exact accounting retention inventory',()=>run(async h=>{
 const review=await h.cmd('import.preview',{csv:'external_id,name,owner_name,owner_email,commission_bps\nprivacy-home,Cedar Source Lodge,Morgan Lee,morgan@stay.example,1500\n'})
 await h.cmd('import.approve',{id:review.id,fingerprint:review.fingerprint})
 const p=(await h.accessState()).properties[0]
 const b=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',start:day(-8),end:day(-5),guestName:'Source guest',guestEmail:'guest@stay.example'})
 await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Cedar Rentals LLC'})
 await h.cmd('ledger.post',{propertyId:p.id,bookingId:b.bookingId,operation:'refund',amountCents:5000,effectiveDate:day(-5),sourceId:'privacy-refund',sourceRevision:'reviewed-refund'})
 const erasure=await erase(h,{entity:'property',id:p.id,revision:p.revision}),s=await h.accessState(),receipt=s.privacy.receipts.find(r=>r.receiptId===erasure.receiptId)
 assert.ok(!s.properties.length&&!s.bookings.length);assert.ok(receipt.retained.some(r=>r.table==='cb_ledger_journals'&&r.until&&r.reason));assert.ok(s.ledger.journals.length)
 const journal=await h.cmd('import.journal',{id:review.id});assert.ok(journal.originals.every(v=>!v.original.base64&&v.original.status==='unavailable'))
 assert.equal((await h.send('/app/people',undefined,h.owner)).status,200)
 const old=await h.cmd('import.preview',{csv:'external_id,name,owner_name,owner_email,commission_bps\nprivacy-home,Cedar Source Lodge,Morgan Lee,morgan@stay.example,1500\n'});assert.ok(old.conflicts.some(v=>v.reason==='erased_identity'))
}))
