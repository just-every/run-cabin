import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {harness} from './harness.mjs'
import {attestArrival} from './readiness-helpers.mjs'
import {productionMail} from './recovery-production-mail.mjs'
for(const name of ['SEAM_API_KEY','MAIL_API_KEY','MAIL_FROM','TEST_MAIL_TO','QA_INBOX_RECEIPT_TOKEN'])assert.ok(process.env[name],'Supply the named sandbox and fleet inbox inputs through the approved injector')
assert.ok(process.env.TEST_MAIL_TO.endsWith('@runeditrun.com'),'Live proof requires the approved fleet QA recipient input')
const from=process.env.MAIL_FROM,key=process.env.SEAM_API_KEY,mailKey=process.env.MAIL_API_KEY
async function seam(path,body={}){const r=await fetch('https://connect.getseam.com'+path,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,'Seam sandbox HTTP '+r.status);const value=await r.json();assert.notEqual(value.ok,false,'Seam sandbox refused the request');return value}
const workspace=(await seam('/workspaces/get')).workspace;assert.equal(workspace.is_sandbox,true)
const devices=(await seam('/devices/list')).devices,device=devices.find(d=>(!process.env.SEAM_TEST_DEVICE_ID||d.device_id===process.env.SEAM_TEST_DEVICE_ID)&&d.properties?.online&&d.properties?.supported_code_lengths?.includes(4))
assert.ok(device,'The sandbox needs an online code-capable device')
const domains=await fetch('https://api.sendgrid.com/v3/whitelabel/domains',{headers:{authorization:'Bearer '+mailKey}});assert.ok(domains.ok,'Verified sender lookup HTTP '+domains.status)
assert.ok((await domains.json()).some(d=>d.domain==='mail.runeditrun.com'&&d.valid),'The authorized Run Edit Run sender must be authenticated')
const proofNow=new Date(),arrivalAt=new Date(proofNow.getTime()+30*60_000)
const anchorDay=proofNow.toLocaleDateString('en-CA',{timeZone:'America/New_York'}),arrivalDay=arrivalAt.toLocaleDateString('en-CA',{timeZone:'America/New_York'}),arrivalTime=arrivalAt.toLocaleTimeString('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'})
const [hour,minute]=proofNow.toLocaleTimeString('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'}).split(':').map(Number),departureMinute=Math.max(0,hour*60+minute-60),departureTime=String(Math.floor(departureMinute/60)).padStart(2,'0')+':'+String(departureMinute%60).padStart(2,'0')
const date=(offset=0)=>new Date(Date.parse(anchorDay+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10)
const photo=(await readFile('tests/fixtures/checklist.png')).toString('base64'),marker='Cabin recovery '+crypto.randomUUID()
const outbound=async request=>{
 const response=await fetch(request)
 if(new URL(request.url).hostname==='connect.getseam.com'&&!response.ok){
  const body=await response.clone().json().catch(()=>({})),safe=value=>typeof value==='string'&&/^[a-z_]{1,80}$/.test(value)?value:null
  console.log(JSON.stringify({stage:'provider-refusal',path:new URL(request.url).pathname,httpStatus:response.status,errorType:safe(body.error?.type),errorCode:safe(body.error?.code)}))
 }
 return response
}
const h=await harness({now:proofNow.toISOString(),outbound,auth:{SEAM_API_KEY:key,OWNER_EMAIL:process.env.TEST_MAIL_TO,MAIL_FROM:from}})
let home,stayId,oldId,newId,providerMessageId,mailboxId,failure,live,stage='setup'
const ownedIds=new Set()
async function refresh(){const s=await h.accessState();for(const c of s.codes)if(c.lock.providerId)ownedIds.add(c.lock.providerId);return s}
async function advance(){await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});return refresh()}
try{
 home=await h.cmd('property.save',{name:marker,ownerName:'Synthetic Cabin Owner',ownerEmail:process.env.TEST_MAIL_TO,commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin Trust'})
 const original=await h.person('SyntheticOriginal'),backup=await h.person('SyntheticBackup')
 await h.cmd('home.settings',{propertyId:home.id,address:'12 Synthetic Cabin Lane',timeZone:'America/New_York',checkInTime:arrivalTime,checkOutTime:departureTime,cleanerId:original.id,checklist:['Kitchen ready'],photosRequired:1,lockDeviceId:device.device_id})
 await h.cmd('recovery.settings',{propertyId:home.id,cleanerIds:[original.id,backup.id],auto:false,creditLimitCents:10000,cleaningLimitCents:5000})
 await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Synthetic Departing Guest',start:date(-1),end:date()})
 const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Synthetic Recovery Guest',guestEmail:process.env.TEST_MAIL_TO,start:arrivalDay,end:date(2)});stayId=request.bookingId
 let s=await refresh(),old=s.codes.find(c=>c.bookingId===stayId&&c.holder==='guest'&&c.status==='issued');oldId=old.id
 for(let n=0;n<180&&old.lock.state!=='set';n++){await new Promise(r=>setTimeout(r,2000));s=await advance();old=s.codes.find(c=>c.id===oldId)}
 stage='initial-code';const remoteInitial=(await seam('/access_codes/get',{access_code_id:old.lock.providerId})).access_code;console.log(JSON.stringify({stage,state:old.lock.state,detail:old.lock.error,remote:{status:remoteInitial.status,scheduled:remoteInitial.is_scheduled_on_device,preferNative:remoteInitial.prefer_native_scheduling,mutations:remoteInitial.pending_mutations?.map(m=>({type:m.mutation_type,scheduledAt:m.scheduled_at})),codeMatches:remoteInitial.code===old.code,deviceMatches:remoteInitial.device_id===device.device_id,expectedStart:old.lock.job?.starts_at,expectedEnd:old.lock.job?.ends_at,jobStage:old.lock.job?.stage,claimUntil:old.lock.job?.claim?.until,starts:remoteInitial.starts_at,ends:remoteInitial.ends_at,pending:remoteInitial.pending_mutations?.length,errors:remoteInitial.errors?.map(e=>e.type)}}));assert.equal(old.lock.state,'set','Initial guest code needs real provider readback')
 stage='approved-recovery';let row=await h.cmd('recovery.open',{bookingId:stayId,trigger:'cleaner_cancelled',reason:'Sandbox cleaner cancellation followed by failed guest access'})
 row=await h.cmd('recovery.propose',{id:row.id,revision:row.revision,cleanerId:backup.id,creditCents:7500,extraCleaningCents:2500,why:'Exact approved backup, guest credit and replacement access'})
 await h.cmd('recovery.approve',{id:row.id,revision:row.revision})
 stage='replacement-code';s=await refresh();row=s.recoveries.find(r=>r.id===row.id);newId=row.codeId;const started=s.codes.find(c=>c.id===newId);console.log(JSON.stringify({stage,state:started.lock.state,detail:started.lock.error,operation:started.lock.job?.operation,jobStage:started.lock.job?.stage,acknowledged:!!started.lock.job?.acceptedAt,providerResourceKnown:!!started.lock.providerId,starts:started.lock.job?.starts_at,ends:started.lock.job?.ends_at}))
 for(let n=0;n<180&&!(s.codes.find(c=>c.id===newId).lock.state==='set'&&s.codes.find(c=>c.id===oldId).lock.state==='removed');n++){await new Promise(r=>setTimeout(r,2000));s=await advance()}
 stage='replacement-code';const replacement=s.codes.find(c=>c.id===newId);console.log(JSON.stringify({stage,state:replacement.lock.state,detail:replacement.lock.error,oldState:s.codes.find(c=>c.id===oldId).lock.state}));assert.equal(replacement.lock.state,'set');assert.equal(s.codes.find(c=>c.id===oldId).lock.state,'removed');assert.notEqual(replacement.code,old.code)
 await h.restart();s=await advance();assert.equal(s.codes.find(c=>c.id===newId).lock.providerId,replacement.lock.providerId)
 row=s.recoveries.find(r=>r.id===row.id);row=await h.cmd('recovery.accept',{id:row.id,revision:row.revision},backup.cookie)
 const turnover=(await h.state()).turnovers.find(t=>t.id===row.turnoverId)
 await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:turnover.checklist,caption:'Synthetic sandbox readiness evidence',photos:[{photo,mimeType:'image/png'}]},backup.cookie)
 await attestArrival(h,stayId)
 const guest=await h.verifyGuest(replacement.link)
 // All setup messages used the test edge. This restart selects the unchanged production mail module.
 s=await refresh();assert.ok(!s.notices.some(n=>n.status==='pending'&&n.email!==process.env.TEST_MAIL_TO),'No other address may be queued when production mail is enabled')
 stage='production-mail';live=await productionMail(h,{MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:mailKey,MAIL_FROM:from})
 row=(await live.state()).recoveries.find(r=>r.id===row.id)
 await live.cmd('recovery.close',{id:row.id,revision:row.revision})
 row=(await live.state()).recoveries.find(r=>r.id===row.id)
 const message=(await live.state()).messages.find(m=>m.id===row.confirmationMessageId);assert.equal(message.status,'sent');assert.ok(message.providerId);providerMessageId=message.providerId
 for(let n=0;n<24;n++){
  const url=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts');url.searchParams.set('subject',marker+' is ready');url.searchParams.set('limit','1')
  const response=await fetch(url,{headers:{authorization:'Bearer '+process.env.QA_INBOX_RECEIPT_TOKEN}});assert.ok(response.ok,'Fleet inbox read HTTP '+response.status)
  const receipt=(await response.json()).receipts?.[0]
  if(receipt){assert.ok(receipt.auth?.dmarc==='pass'||receipt.auth?.dkim==='pass'&&receipt.auth?.dkimDomain==='mail.runeditrun.com','Receiver authentication must pass');mailboxId=receipt.id;break}
  await new Promise(r=>setTimeout(r,5000))
 }
 stage='mailbox';assert.ok(mailboxId,'Readiness mail must arrive in the real fleet inbox')
 const accepted=await live.send('/stay/'+replacement.link,{action:'recovery-confirm',caseId:row.id,revision:row.revision,response:'confirmed'},guest);assert.equal(accepted.status,303)
 row=(await live.state()).recoveries.find(r=>r.id===row.id)
 await live.cmd('recovery.recurrence',{id:row.id,revision:row.revision,reference:'Seam sandbox readback and fleet QA inbox '+mailboxId,note:'Sandbox code remains confirmed after restart and the verified guest response follows actual readiness mail delivery',confirm:'yes'})
 s=await live.state();row=s.recoveries.find(r=>r.id===row.id);assert.equal(row.status,'closed');assert.equal(s.statements.find(st=>st.id===row.statementId).netCents,-10000)
 const remote=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.filter(c=>c.name?.endsWith(newId));assert.equal(remote.length,1);assert.equal(remote[0].access_code_id,replacement.lock.providerId)
 console.log(JSON.stringify({journey:'recovery-sandbox',sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sandbox:true,replacementProviderId:replacement.lock.providerId,oldProviderId:old.lock.providerId,oldAccessRemoved:true,replacementConfirmed:true,restartStable:true,duplicates:0,ownerAdjustmentCents:-10000,providerMessageId,mailboxId,guestConfirmed:true,followupConfirmed:true,physicalDoorTest:false}))
}catch(error){failure=error;console.log(JSON.stringify({journey:'recovery-sandbox-failure',stage,message:String(error.message).split('\n')[0],providerMessageId:providerMessageId??null}))}finally{
 await h.restart({productionMail:true,auth:{AUTH_ORIGIN:h.origin,AUTH_LOCAL:'true',MAIL_PROVIDER:'development',MAIL_API_KEY:''}})
 try{for(const b of (await h.state()).bookings.filter(b=>b.propertyId===home?.id&&b.status==='confirmed'))await h.cmd('reservation.cancel',{id:b.id,revision:b.revision});await refresh()}finally{
  let removed=0
  for(const id of ownedIds){const current=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.find(c=>c.access_code_id===id);if(current){await seam('/access_codes/delete',{access_code_id:id});removed++}}
  let left=[]
  for(let n=0;n<120;n++){left=(await seam('/access_codes/list',{device_id:device.device_id})).access_codes.filter(c=>ownedIds.has(c.access_code_id));if(!left.length)break;await new Promise(r=>setTimeout(r,5000))}
  console.log(JSON.stringify({journey:'recovery-sandbox-cleanup',ownedCodes:ownedIds.size,remaining:left.length,remainingIds:left.map(c=>c.access_code_id)}));await h.close();assert.equal(left.length,0,'Remove every sandbox access code created by this journey')
 }
}

if(failure)throw failure
