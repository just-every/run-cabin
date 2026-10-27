import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {harness} from './harness.mjs'

// Only the held virtual device is eligible. Never discover a substitute or print access secrets.
assert.ok(process.env.SEAM_API_KEY&&process.env.SEAM_SANDBOX_DEVICE_ID,'Inject the named Seam sandbox inputs')
const deviceId=process.env.SEAM_SANDBOX_DEVICE_ID,sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
async function api(path,body={},method='GET'){
 const url=new URL('https://connect.getseam.com'+path)
 if(method==='GET')for(const [key,value]of Object.entries(body))url.searchParams.set(key,String(value))
 const response=await fetch(url,{method,headers:{authorization:'Bearer '+process.env.SEAM_API_KEY,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20_000)})
 assert.ok(response.ok,'Seam sandbox '+path+' HTTP '+response.status)
 const value=await response.json();assert.notEqual(value.ok,false,'Seam sandbox refused '+path);return value
}
async function remoteCodes(){
 const rows=[],seen=new Set();let cursor
 do{
  const page=await api('/access_codes/list',{device_id:deviceId,...(cursor?{page_cursor:cursor}:{})})
  assert.ok(Array.isArray(page.access_codes),'Provider returned a usable access-code list');rows.push(...page.access_codes)
  if(!page.pagination?.has_next_page)return rows
  cursor=page.pagination.next_page_cursor;assert.ok(cursor&&!seen.has(cursor),'Provider pagination must be complete');seen.add(cursor)
 }while(true)
}
assert.equal((await api('/workspaces/get')).workspace.is_sandbox,true)
const device=(await api('/devices/get',{device_id:deviceId})).device
assert.equal(device.device_id,deviceId);assert.equal(device.properties?.online,true);assert.equal(device.can_program_online_access_codes,true);assert.ok(device.properties.supported_code_lengths.includes(4))
const proofNow=new Date(),zone='America/New_York',anchor=proofNow.toLocaleDateString('en-CA',{timeZone:zone}),day=n=>new Date(Date.parse(anchor+'T12:00Z')+n*86400000).toISOString().slice(0,10)
const utc=local=>{
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(local+'Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','')
 return Date.parse(local+offset)
}
const h=await harness({now:proofNow.toISOString(),auth:{SEAM_API_KEY:process.env.SEAM_API_KEY}})
const owned=new Set();let failure
const codes=async()=>(await h.accessState()).codes
async function observe(id,expected){
 let code
 for(let attempt=0;attempt<60;attempt++){
  code=(await codes()).find(c=>c.id===id)
  if(code.lock.providerId)owned.add(code.lock.providerId)
  if(code.lock.state===expected)break
  if(attempt===59)break
  await new Promise(r=>setTimeout(r,2000));await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 }
 const rows=await remoteCodes(),remote=rows.find(r=>r.access_code_id===code.lock.providerId)
 console.log(JSON.stringify({journey:'lock-sandbox',sourceSha,deviceId,accessCodeId:code.lock.providerId,stage:expected,localState:code.lock.state,detail:code.lock.error,remoteState:remote?.status??'absent',scheduledOnDevice:remote?.is_scheduled_on_device??false,pendingMutations:remote?.pending_mutations?.map(m=>m.mutation_type??m.mutation_code)??[],errors:remote?.errors?.map(e=>e.type??e.error_code)??[],resourceKnown:!!code.lock.providerId}))
 assert.equal(code.lock.state,expected,'Cabin must reconcile the requested state from provider readback')
 if(expected==='removed'){assert.equal(remote,undefined,'Cancellation removes the exact provider code');return code}
 assert.ok(remote,'The exact resource must exist at the provider');assert.equal(remote.device_id,deviceId);assert.ok(remote.code===code.code,'Independent provider PIN readback');assert.equal(Date.parse(remote.starts_at),utc(code.validFrom));assert.equal(Date.parse(remote.ends_at),utc(code.validUntil))
 assert.ok(remote.status==='set'||remote.status==='unset'&&remote.is_scheduled_on_device===true,'Provider confirms programming, including future native schedules')
 assert.equal(remote.errors?.length??0,0);assert.equal(remote.pending_mutations?.length??0,0)
 assert.equal(rows.filter(r=>r.name===code.lock.job.name).length,1,'Exactly one resource for this persisted attempt')
 return code
}
try{
 const home=await h.cmd('property.save',{name:'Synthetic Cabin sandbox lifecycle',ownerName:'Synthetic Cabin Owner',ownerEmail:'owner@stay.example',commissionBps:2000})
 await h.cmd('home.settings',{propertyId:home.id,address:'12 Synthetic Cabin Lane',timeZone:zone,checkInTime:'16:00',checkOutTime:'10:00',checklist:['Ready'],lockDeviceId:deviceId})
 const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',guestName:'Synthetic Cabin Guest',start:day(-1),end:day(2)})
 let code=(await codes()).find(c=>c.bookingId===request.bookingId&&c.holder==='guest'&&c.status==='issued');assert.ok(code,'Reservation confirmation automatically issues access')
 code=await observe(code.id,'set');const providerId=code.lock.providerId
 let booking=(await h.state()).bookings.find(b=>b.id===request.bookingId)
 await h.cmd('reservation.move',{id:booking.id,revision:booking.revision,start:day(-1),end:day(3)})
 try{code=await observe(code.id,'set');assert.equal(code.validUntil,day(3)+'T10:00');assert.equal(code.lock.providerId,providerId,'An extension updates the same code')}
 catch(error){failure=error;console.log(JSON.stringify({journey:'lock-sandbox-extension-pending',sourceSha,accessCodeId:providerId,verified:false}))}
 await h.restart();await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});code=(await codes()).find(c=>c.id===code.id);assert.equal(code.lock.providerId,providerId)
 booking=(await h.state()).bookings.find(b=>b.id===request.bookingId)
 await h.cmd('reservation.cancel',{id:booking.id,revision:booking.revision})
 code=await observe(code.id,'removed')
 console.log(JSON.stringify({journey:'lock-sandbox-lifecycle',sourceSha,sandbox:true,deviceType:device.device_type,createdConfirmed:true,extensionConfirmed:!failure,restartStable:true,cancellationConfirmed:true,physicalDoorTest:false}))
 const expires=new Date(Date.now()+180_000),expiresDay=expires.toLocaleDateString('en-CA',{timeZone:zone}),expiresTime=expires.toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'})
 const expiryHome=await h.cmd('property.save',{name:'Synthetic Cabin expiry',ownerName:'Synthetic Cabin Owner',ownerEmail:'owner@stay.example',commissionBps:2000})
 await h.cmd('home.settings',{propertyId:expiryHome.id,address:'12 Synthetic Cabin Lane',timeZone:zone,checkInTime:'16:00',checkOutTime:expiresTime,checklist:['Ready'],lockDeviceId:deviceId})
 const short=await h.cmd('reservation.request',{propertyId:expiryHome.id,channel:'direct',guestName:'Synthetic Cabin Expiry Guest',start:day(-1),end:expiresDay})
 let expiring=(await codes()).find(c=>c.bookingId===short.bookingId&&c.holder==='guest'&&c.status==='issued')
 expiring=await observe(expiring.id,'set')
 let expired=false
 for(let attempt=0;attempt<90;attempt++){
  const remote=(await remoteCodes()).find(c=>c.access_code_id===expiring.lock.providerId)
  if(Date.now()>=utc(expiring.validUntil)&&(!remote||remote.status==='unset'&&!(remote.pending_mutations?.length))){expired=true;break}
  await new Promise(r=>setTimeout(r,4000))
 }
 console.log(JSON.stringify({journey:'lock-sandbox-expiry',sourceSha,accessCodeId:expiring.lock.providerId,endsAt:new Date(utc(expiring.validUntil)).toISOString(),providerExpired:expired,physicalDoorTest:false}))
 assert.ok(expired,'The provider must confirm expiry after the exact stay deadline')
}catch(error){failure=error;console.log(JSON.stringify({journey:'lock-sandbox-failure',sourceSha,message:String(error.message).split('\n')[0]}))}
finally{
 try{
 // Reconcile only this run's named resources; cleanup is separate from cancellation proof.
 const all=await codes();for(const c of all)if(c.lock.providerId)owned.add(c.lock.providerId)
 const names=new Set(all.map(c=>'Cabin '+c.holder+' access '+c.id))
 let rows=await remoteCodes()
 for(const row of rows)if(owned.has(row.access_code_id)||names.has(row.name)){owned.add(row.access_code_id);await api('/access_codes/delete',{access_code_id:row.access_code_id},'DELETE')}
 for(let attempt=0;attempt<60;attempt++){
  rows=(await remoteCodes()).filter(r=>owned.has(r.access_code_id))
  if(!rows.length)break;await new Promise(r=>setTimeout(r,2000))
 }
 console.log(JSON.stringify({journey:'lock-sandbox-cleanup',sourceSha,ownedCodes:owned.size,remaining:rows.length}));assert.equal(rows.length,0,'Every owned sandbox code must be removed')
 }finally{await h.close()}
}
if(failure)throw failure
