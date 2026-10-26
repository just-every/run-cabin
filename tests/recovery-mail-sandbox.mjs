// Live-only journey. Supply held inputs through briefs/_od08-env.py under heavy-slot.
// Setup uses the harness mail edge; readiness uses the unchanged production sender.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {harness} from './harness.mjs'
import {attestArrival} from './readiness-helpers.mjs'
import {productionMail,safePublicError} from './recovery-production-mail.mjs'

const sourceSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
let h,home,providerMessageId,mailboxId,diagnostic,failed=false,stage='inputs'
const inputs=['MAIL_API_KEY','MAIL_FROM','TEST_MAIL_TO','QA_INBOX_RECEIPT_TOKEN']
const local=ms=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(p=>[p.type,p.value]))
 return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}
}
const plus=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
try{
 for(const name of inputs)assert.ok(process.env[name],`Supply ${name} through the approved injector`)
 const recipient=process.env.TEST_MAIL_TO.trim()
 assert.match(recipient,/^[^@\s<>]+@runeditrun\.com$/i,'Use the approved fleet QA recipient')
 const proofNow=new Date(),today=local(proofNow).day,arrival=local(proofNow.getTime()+2*60*60_000)
 const marker='Cabin recovery mail '+randomUUID(),subject=marker+' is ready'
 const photo=(await readFile(new URL('./fixtures/checklist.png',import.meta.url))).toString('base64')
 stage='setup'
 h=await harness({now:proofNow.toISOString(),auth:{OWNER_EMAIL:recipient,MAIL_FROM:process.env.MAIL_FROM}})
 home=await h.cmd('property.save',{name:marker,ownerName:'Synthetic Cabin Owner',ownerEmail:recipient,commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin Trust'})
 const original=await h.person('SyntheticOriginal'),backup=await h.person('SyntheticBackup')
 await h.cmd('home.settings',{propertyId:home.id,address:'12 Synthetic Cabin Lane',timeZone:'America/New_York',checkInTime:arrival.time,checkOutTime:'00:00',cleanerId:original.id,checklist:['Kitchen ready'],photosRequired:1})
 await h.cmd('recovery.settings',{propertyId:home.id,cleanerIds:[original.id,backup.id],auto:false,creditLimitCents:10000,cleaningLimitCents:5000})
 const prior=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Synthetic Departing Guest',start:plus(today,-1),end:today})
 const stay=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:'Synthetic Recovery Guest',guestEmail:recipient,start:arrival.day,end:plus(arrival.day,3)})
 let s=await h.accessState()
 const initial=s.codes.find(c=>c.bookingId===stay.bookingId&&c.holder==='guest'&&c.status==='issued')
 assert.ok(initial);assert.equal(initial.lock.state,'manual');assert.ok(!initial.lock.providerId)
 const priorTurnover=s.turnovers.find(t=>t.bookingId===prior.bookingId)
 assert.ok(priorTurnover)
 stage='approved-recovery'
 let row=await h.cmd('recovery.open',{turnoverId:priorTurnover.id,trigger:'cleaner_cancelled',reason:'Synthetic cleaner cancellation before the arrival preparation'},original.cookie)
 assert.equal(row.bookingId,stay.bookingId)
 row=await h.cmd('recovery.propose',{id:row.id,revision:row.revision,cleanerId:backup.id,creditCents:7500,extraCleaningCents:2500,why:'Approve a backup cleaner, bounded guest credit and replacement manual access'})
 await h.cmd('recovery.approve',{id:row.id,revision:row.revision})
 s=await h.accessState();row=s.recoveries.find(r=>r.id===row.id)
 const replacement=s.codes.find(c=>c.id===row.codeId)
 assert.ok(replacement);assert.equal(replacement.lock.state,'manual');assert.ok(!replacement.lock.providerId)
 assert.notEqual(replacement.code,initial.code)
 assert.equal(s.codes.find(c=>c.id===initial.id).status,'revoked')
 assert.equal(s.statements.find(st=>st.id===row.statementId).netCents,-10000)
 stage='backup-acceptance-and-photo-completion'
 row=await h.cmd('recovery.accept',{id:row.id,revision:row.revision},backup.cookie)
 const turnover=(await h.state()).turnovers.find(t=>t.id===row.turnoverId)
 await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:turnover.checklist,caption:'Synthetic readiness checklist and photo evidence',photos:[{photo,mimeType:'image/png'}]},backup.cookie)
 row=(await h.state()).recoveries.find(r=>r.id===row.id)
 stage='manual-access-and-arrival-attestation'
 await h.cmd('recovery.access',{id:row.id,revision:row.revision})
 await attestArrival(h,stay.bookingId)
 // Guest verification deliberately precedes production mail, so its code stays at the setup edge.
 stage='guest-verification-and-recipient-guard'
 const guest=await h.verifyGuest(replacement.link)
 s=await h.accessState()
 assert.ok(!s.notices.some(n=>n.status==='pending'&&n.email!==recipient),'No other recipient may have a queued production notice')
 assert.ok(!s.messages.some(m=>m.status==='pending'&&m.email!==recipient),'No other recipient may have a queued production guest message')
 stage='production-restart-and-native-session'
 const live=await productionMail(h,{MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:process.env.MAIL_API_KEY,MAIL_FROM:process.env.MAIL_FROM})
 stage='production-state-before-readiness'
 row=(await live.state()).recoveries.find(r=>r.id===row.id)
 stage='production-recovery-close'
 await live.cmd('recovery.close',{id:row.id,revision:row.revision})
 stage='production-readiness-settlement'
 s=await live.state();row=s.recoveries.find(r=>r.id===row.id)
 const confirmation=s.messages.find(m=>m.id===row?.confirmationMessageId)
 const stateValue=value=>['active','ready','closed','pending','sending','sent','suppressed','unavailable','failed','discarded','started','accepted','rejected','uncertain'].includes(value)?value:null
 diagnostic={recoveryStatus:stateValue(row?.status),confirmationPresent:!!confirmation,messageStatus:stateValue(confirmation?.status),sendState:stateValue(confirmation?.send?.state),hasProviderId:!!confirmation?.providerId,subjectMatches:confirmation?.subject===subject,publicError:safePublicError(confirmation?.detail)}
 providerMessageId=confirmation?.providerId??null
 assert.equal(row.status,'ready')
 assert.ok(confirmation);assert.equal(confirmation.subject,subject);assert.equal(confirmation.status,'sent');assert.ok(confirmation.providerId)
 diagnostic=undefined
 stage='authenticated-mailbox-receipt'
 for(let n=0;n<24;n++){
  const url=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts')
  url.searchParams.set('subject',subject);url.searchParams.set('limit','1')
  const response=await fetch(url,{headers:{authorization:'Bearer '+process.env.QA_INBOX_RECEIPT_TOKEN},signal:AbortSignal.timeout(15000)})
  assert.ok(response.ok,'Fleet inbox receipt request must succeed')
  const receipt=(await response.json()).receipts?.[0]
  if(receipt){assert.ok(receipt.auth?.dmarc==='pass'||receipt.auth?.dkim==='pass'&&receipt.auth?.dkimDomain==='mail.runeditrun.com','Readiness mail requires receiver authentication');mailboxId=receipt.id;break}
  if(n<23)await new Promise(r=>setTimeout(r,5000))
 }
 assert.ok(mailboxId,'Readiness mail must arrive in the real fleet QA inbox')
 stage='guest-confirmation-and-followup'
 const accepted=await live.send('/stay/'+replacement.link,{action:'recovery-confirm',caseId:row.id,revision:row.revision,response:'confirmed'},guest)
 assert.equal(accepted.status,303)
 row=(await live.state()).recoveries.find(r=>r.id===row.id)
 assert.ok(row.guestConfirmedAt)
 await live.cmd('recovery.recurrence',{id:row.id,revision:row.revision,reference:'Fleet QA readiness receipt '+mailboxId,note:'The verified synthetic guest confirmed readiness after real mail delivery; the person reviewed manual-keypad confirmation, completed cleaning photos and the owner adjustment. No physical door was tested.',confirm:'yes'})
 s=await live.state();row=s.recoveries.find(r=>r.id===row.id)
 assert.equal(row.status,'closed');assert.ok(row.recurrence)
 assert.equal(s.statements.find(st=>st.id===row.statementId).netCents,-10000)
}catch(error){
 // Public-route diagnostics are constructed only from controlled statuses and
 // exact known application errors. Never print a harness assertion or body.
 if(error?.diagnostic)diagnostic=error.diagnostic
 failed=true
}finally{
 if(h){
  try{
   // Suppress real mail before cancellation or any other cleanup command.
   await h.restart({productionMail:true,auth:{AUTH_LOCAL:'true',AUTH_ORIGIN:h.origin,MAIL_PROVIDER:'development',MAIL_API_KEY:''}})
   for(const b of (await h.state()).bookings.filter(b=>b.propertyId===home?.id&&b.status==='confirmed'))await h.cmd('reservation.cancel',{id:b.id,revision:b.revision})
  }catch{if(!failed)stage='development-cleanup';failed=true}
  finally{try{await h.close()}catch{if(!failed)stage='harness-close';failed=true}}
 }
}
console.log(JSON.stringify({journey:'recovery-mail-sandbox',sourceSHA,providerMessageId:providerMessageId??null,mailboxId:mailboxId??null,manualKeypad:true,physicalDoorTest:false,...(failed?{summary:'FAIL at '+stage,...(diagnostic?{diagnostic}:{})}:{ownerAdjustmentCents:-10000,guestConfirmed:true,followupConfirmed:true,summary:'PASS: authenticated SendGrid readiness delivery and verified recovery closure through the manual-keypad path'})}))
if(failed)process.exitCode=1
