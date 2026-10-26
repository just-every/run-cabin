import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {harness} from './harness.mjs'
import {attestArrival} from './readiness-helpers.mjs'
for(const name of ['SEAM_API_KEY','MAIL_API_KEY','TEST_MAIL_TO','QA_INBOX_RECEIPT_TOKEN'])assert.ok(process.env[name],'Supply the named sandbox and fleet inbox inputs through the approved injector')
assert.equal(process.env.TEST_MAIL_TO,'qa-inbox@runeditrun.com','Live proof sends only to the fleet QA inbox')
const from='notifications@mail.runeditrun.com',key=process.env.SEAM_API_KEY,mailKey=process.env.MAIL_API_KEY
async function seam(path,body={}){const r=await fetch('https://connect.getseam.com'+path,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,'Seam sandbox HTTP '+r.status);const value=await r.json();assert.notEqual(value.ok,false,'Seam sandbox refused the request');return value}
const workspace=(await seam('/workspaces/get')).workspace;assert.equal(workspace.is_sandbox,true)
const devices=(await seam('/devices/list')).devices,device=devices.find(d=>d.properties?.online&&d.properties?.supported_code_lengths?.includes(4))??devices.find(d=>d.properties?.online)
assert.ok(device,'The sandbox needs an online code-capable device')
const domains=await fetch('https://api.sendgrid.com/v3/whitelabel/domains',{headers:{authorization:'Bearer '+mailKey}});assert.ok(domains.ok,'Verified sender lookup HTTP '+domains.status)
assert.ok((await domains.json()).some(d=>d.domain==='mail.runeditrun.com'&&d.valid),'The authorized Run Edit Run sender must be authenticated')
const anchorDay=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'})
const date=(offset=0)=>new Date(Date.parse(anchorDay+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10)
const photo=(await readFile('tests/fixtures/checklist.png')).toString('base64'),marker='Cabin recovery '+crypto.randomUUID()
const h=await harness({auth:{SEAM_API_KEY:key,OWNER_EMAIL:process.env.TEST_MAIL_TO,MAIL_FROM:from}})
let home,stayId,oldId,newId,providerMessageId,mailboxId
const ownedIds=new Set()
async function refresh(){const s=await h.accessState();for(const c of s.codes)if(c.lock.providerId)ownedIds.add(c.lock.providerId);return s}
async function advance(){await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});return refresh()}
try{
 home=await h.cmd('property.save',{name:marker,ownerName:'Synthetic Cabin Owner',ownerEmail:process.env.TEST_MAIL_TO,commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin Trust'})
 const original=await h.person('SyntheticOriginal'),backup=await h.person('SyntheticBackup')
 await h.cmd('home.settings',{propertyId:home.id,address:'12 Synthetic Cabin Lane',timeZone:'America/New_York',checkInTime:'23:59',checkOutTime:'00:00',cleanerId:original.id,checklist:['Kitchen ready'],photosRequired:1,lockDeviceId:device.device_id})
 await h.cmd('recovery.settings',{propertyId:home.id,cleanerIds:[original.id,backup.id],auto:false,creditLimitCents:10000,cleaningLimitCents:5000})
 await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Synthetic Departing Guest',start:date(-1),end:date()})
 const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Synthetic Recovery Guest',guestEmail:process.env.TEST_MAIL_TO,start:date(),end:date(2)});stayId=request.bookingId
 let s=await refresh(),old=s.codes.find(c=>c.bookingId===stayId&&c.holder==='guest'&&c.status==='issued');oldId=old.id
 for(let n=0;n<10&&old.lock.state!=='set';n++){await new Promise(r=>setTimeout(r,2000));s=await advance();old=s.codes.find(c=>c.id===oldId)}
 assert.equal(old.lock.state,'set','Initial guest code needs real provider readback')
 let row=await h.cmd('recovery.open',{bookingId:stayId,trigger:'cleaner_cancelled',reason:'Sandbox cleaner cancellation followed by failed guest access'})
 row=await h.cmd('recovery.propose',{id:row.id,revision:row.revision,cleanerId:backup.id,creditCents:7500,extraCleaningCents:2500,why:'Exact approved backup, guest credit and replacement access'})
 await h.cmd('recovery.approve',{id:row.id,revision:row.revision})
 s=await refresh();row=s.recoveries.find(r=>r.id===row.id);newId=row.codeId
 for(let n=0;n<10&&!(s.codes.find(c=>c.id===newId).lock.state==='set'&&s.codes.find(c=>c.id===oldId).lock.state==='removed');n++){await new Promise(r=>setTimeout(r,2000));s=await advance()}
 const replacement=s.codes.find(c=>c.id===newId);assert.equal(replacement.lock.state,'set');assert.equal(s.codes.find(c=>c.id===oldId).lock.state,'removed');assert.notEqual(replacement.code,old.code)
 await h.restart();s=await advance();assert.equal(s.codes.find(c=>c.id===newId).lock.providerId,replacement.lock.providerId)
 row=s.recoveries.find(r=>r.id===row.id);row=await h.cmd('recovery.accept',{id:row.id,revision:row.revision},backup.cookie)
 const turnover=(await h.state()).turnovers.find(t=>t.id===row.turnoverId)
 await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:turnover.checklist,caption:'Synthetic sandbox readiness evidence',photos:[{photo,mimeType:'image/png'}]},backup.cookie)
 await attestArrival(h,stayId)
 const guest=await h.verifyGuest(replacement.link)
 // All setup messages used the test edge. This restart selects the unchanged production mail module.
 s=await refresh();assert.ok(!s.notices.some(n=>n.status==='pending'&&n.email!==process.env.TEST_MAIL_TO),'No other address may be queued when production mail is enabled')
 await h.restart({productionMail:true,auth:{AUTH_LOCAL:'false',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:mailKey,MAIL_FROM:from}})
 row=(await h.state()).recoveries.find(r=>r.id===row.id)
 await h.cmd('recovery.close',{id:row.id,revision:row.revision})
 row=(await h.state()).recoveries.find(r=>r.id===row.id)
 const message=(await h.state()).messages.find(m=>m.id===row.confirmationMessageId);assert.equal(message.status,'sent');assert.ok(message.providerId);providerMessageId=message.providerId
 for(let n=0;n<6;n++){
  const url=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts');url.searchParams.set('subject',marker+' is ready');url.searchParams.set('limit','1')
  const response=await fetch(url,{headers:{authorization:'Bearer '+process.env.QA_INBOX_RECEIPT_TOKEN}});assert.ok(response.ok,'Fleet inbox read HTTP '+response.status)
  const receipt=(await response.json()).receipts?.[0]
  if(receipt){assert.ok(receipt.auth?.dmarc==='pass'||receipt.auth?.dkim==='pass'&&receipt.auth?.dkimDomain==='mail.runeditrun.com','Receiver authentication must pass');mailboxId=receipt.id;break}
  await new Promise(r=>setTimeout(r,5000))
 }
 assert.ok(mailboxId,'Readiness mail must arrive in the real fleet inbox')
 const accepted=await h.send('/stay/'+replacement.link,{action:'recovery-confirm',caseId:row.id,revision:row.revision,response:'confirmed'},guest);assert.equal(accepted.status,303)
 row=(await h.state()).recoveries.find(r=>r.id===row.id)
 await h.cmd('recovery.recurrence',{id:row.id,revision:row.revision,reference:'Seam sandbox readback and fleet QA inbox '+mailboxId,note:'Sandbox code remains confirmed after restart and the verified guest response follows actual readiness mail delivery',confirm:'yes'})
 s=await refresh();row=s.recoveries.find(r=>r.id===row.id);assert.equal(row.status,'closed');assert.equal(s.statements.find(st=>st.id===row.statementId).netCents,-10000)
 const remote=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.filter(c=>c.name?.endsWith(newId));assert.equal(remote.length,1);assert.equal(remote[0].access_code_id,replacement.lock.providerId)
 console.log(JSON.stringify({journey:'recovery-sandbox',sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sandbox:true,oldAccessRemoved:true,replacementConfirmed:true,restartStable:true,duplicates:0,ownerAdjustmentCents:-10000,providerMessageId,mailboxId,guestConfirmed:true,followupConfirmed:true,physicalDoorTest:false}))
}finally{
 await h.restart({productionMail:true,auth:{AUTH_LOCAL:'true',MAIL_PROVIDER:'development',MAIL_API_KEY:''}})
 try{for(const b of (await h.state()).bookings.filter(b=>b.propertyId===home?.id&&b.status==='confirmed'))await h.cmd('reservation.cancel',{id:b.id,revision:b.revision});await refresh()}finally{
  let removed=0
  for(const id of ownedIds){const current=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.find(c=>c.access_code_id===id);if(current){await seam('/access_codes/delete',{access_code_id:id});removed++}}
  const left=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.filter(c=>ownedIds.has(c.access_code_id));assert.equal(left.length,0,'Remove every sandbox access code created by this journey')
  console.log(JSON.stringify({journey:'recovery-sandbox-cleanup',ownedCodes:ownedIds.size,remaining:0}));await h.close()
 }
}
