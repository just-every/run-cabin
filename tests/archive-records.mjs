import {seamEdge} from './seam-edge.mjs'
const locks=seamEdge()
import {qboEdge} from './qbo-edge.mjs'
import {populateQboArchive,checkQboArchive} from './qbo-archive.mjs'
const qbo=qboEdge()
import { populateExceptionArchive,checkExceptionArchive } from './financial-exceptions-archive.mjs'
import { populateBankArchive,checkBankArchive } from './banking-archive.mjs'
import { collectionBooking,createCollection } from './collection-support.mjs'
import { homeDay } from './home-calendar.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const day=n=>homeDay(n, 'America/New_York')
export async function archiveEdge(request) {
 const u=new URL(request.url)
 if(u.hostname==='connect.getseam.com')return locks.outbound(request)
 if(u.hostname==='sandbox-quickbooks.api.intuit.com')return qbo.outbound(request)
 if(u.hostname==='calendar.stay.example')return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')
 if(u.hostname==='api.stripe.com'&&u.pathname==='/v1/balance')return Response.json({object:'balance',available:[],pending:[],livemode:false})
 if(u.hostname==='api.stripe.com'&&u.pathname==='/v1/checkout/sessions'&&request.method==='POST')return Response.json({id:'cs_archive',url:'https://checkout.stripe.com/c/pay/cs_archive'})
 assert.fail('Unexpected archive test network request')
}
async function populateChannelArchive(h,p) {
 const key=await h.cmd('channelAgent.runner.create',{})
 const runner=async body=>{const response=await h.send('/api/cabin/channel-agent/runner',body,'',{authorization:'Bearer '+key.token});assert.equal(response.status,200,response.text);return response.value}
 const profile=await h.cmd('channelAgent.connect',{propertyId:p.id,channel:'vrbo',listingId:'archive-home',listingUrl:'https://www.vrbo.com/hosting/calendar/archive-home',confirm:'yes'})
 // The channel edge supplies the isolated browser's saved session and screenshots.
 const storageState={cookies:[{name:'session',value:'archive-channel-session',domain:'.vrbo.com',path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'Lax'}],origins:[]}
 const connect=async()=>{const {job}=await runner({op:'claim'});assert.equal(job.kind,'connect');await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'connected',storageState})}
 await connect()
 const {job:closure}=await runner({op:'claim'});assert.equal(closure.kind,'close')
 const image=(await readFile('tests/fixtures/checklist.png')).toString('base64')
 await runner({op:'complete',id:closure.id,lease:closure.lease,outcome:'succeeded',result:'closed',canUndo:true,before:image,after:image})
 const claimUntil=async id=>{for(;;){const {job}=await runner({op:'claim'});assert.ok(job);if(job.id===id)return job;assert.equal(job.kind,'close');await runner({op:'complete',id:job.id,lease:job.lease,outcome:'succeeded',result:'closed',before:image,after:image})}}
 const stopped=await h.cmd('channelAgent.read',{id:profile.id,kind:'read-reservations',readUrl:'https://www.vrbo.com/hosting/reservations/archive-home',confirm:'yes'})
 const challenge=await claimUntil(stopped.id);assert.equal(challenge.id,stopped.id)
 await runner({op:'complete',id:challenge.id,lease:challenge.lease,outcome:'needs_you',challenge:'2fa'})
 await h.cmd('channelAgent.connect',{propertyId:p.id,channel:'vrbo',listingId:'archive-home',listingUrl:'https://www.vrbo.com/hosting/calendar/archive-home',confirm:'yes'})
 await connect()
 const running=await h.cmd('channelAgent.read',{id:profile.id,kind:'read-messages',readUrl:'https://www.vrbo.com/hosting/messages/archive-home',confirm:'yes'})
 const leased=await claimUntil(running.id);assert.equal(leased.id,running.id)
 await runner({op:'checkpoint',id:leased.id,lease:leased.lease,before:image})
 const queued=await h.cmd('channelAgent.read',{id:profile.id,kind:'read-payouts',readUrl:'https://www.vrbo.com/hosting/payouts/archive-home',confirm:'yes'})
 const records=(await h.db.prepare("SELECT kind,data FROM cb_records WHERE kind IN ('channelAgentAccounts','channelAgentProfiles','channelAgentKeys','channelAgentEvidence','channelAgentActions') ORDER BY rowid").all()).results.map(row=>({kind:row.kind,data:JSON.parse(row.data)})).sort((a,b)=>a.data.id.localeCompare(b.data.id))
 const privateValues=[key.token,storageState.cookies[0].value,...records.flatMap(({data})=>[data.stateSealed,data.hash,data.bodySealed,data.lease].filter(Boolean))]
 const history=records.filter(row=>row.kind==='channelAgentActions'&&row.data.status==='succeeded').map(({data})=>({id:data.id,status:data.status,result:data.result,completedAt:data.completedAt,attempts:data.attempts}))
 return {profileId:profile.id,runnerToken:key.token,closureId:closure.id,cancelledIds:[stopped.id,running.id,queued.id],history,privateValues}
}
export async function populateArchive(h,p,cleaner) {
 const imported=await h.cmd('import.provider.preview',{provider:'guesty',asOf:day(0),files:[{name:'cabin-cutover.csv',text:'Record type,Provider,Listing ID,Listing name,Owner name,Owner email,Commission percent,Channel,iCal URL\n'+'home,guesty,archive-listing,Archive Lodge,Karen Ortiz,karen@stay.example,20,,\n'+'link,guesty,archive-listing,,,,,airbnb,https://calendar.stay.example/private-import-link.ics\n'}]})
 await h.cmd('home.settings',{propertyId:p.id,address:'14 Lake View Drive, Asheville, NC',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',cleanerId:cleaner.id,checklist:['Linen changed'],photosRequired:1,lockDeviceId:'synthetic-cabin-1'})
 await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Lake Loft Rentals LLC'})
 const collection=await createCollection(h,await collectionBooking(h,p,100))
 await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:'Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n2026-01-06,Reservation,archive-stay,2026-01-01,4,USD,1000.00,30.00,970.00,ARCHIVE-PAYOUT\n'})
 const statement=await h.cmd('statement.prepare',{propertyId:p.id,month:'2026-01'})
 await h.cmd('statement.approve',{id:statement.id,revision:statement.revision})
 await h.cmd('channel.connect',{propertyId:p.id,channel:'ical',name:'Partner inventory',url:'https://calendar.stay.example/secret-calendar.ics'})
 await h.cmd('export.publish',{propertyId:p.id})
 await h.cmd('provider.sharing',{id:'seam',operation:'credential',securityRevision:'',actions:['access:write'],propertyIds:[p.id],confirm:'yes',SEAM_API_KEY:'synthetic-cabin-2'})
 const booking=await h.cmd('reservation.request',{propertyId:p.id,channel:'direct',guestName:'Megan Ortiz',start:day(10),end:day(13)})
 await h.cmd('booking.details',{id:booking.bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===booking.bookingId).revision,guestName:'Megan Ortiz',guestEmail:'megan@stay.example'})
 await h.cmd('inbox.address',{address:'guests@stay.example',revision:''})
 await h.cmd('inbox.try',{source:'From: Megan <megan@stay.example>\r\nTo: guests@stay.example\r\nSubject: Parking\r\nMessage-ID: <archive@stay.example>\r\nContent-Type: text/plain\r\n\r\nWhere can I park?'})
 await h.cmd('direct.stripe.save',{mode:'test',key:['sk','test','synthetic-cabin-1'.replaceAll('-','')].join('_')})
 const cfg=await h.cmd('direct.configure',{propertyId:p.id,enabled:true,slug:'archive-home',description:'Lake Loft for the next stay.',nightlyCents:18000,cleaningCents:7500,extraGuestCents:0,includedGuests:2,maxGuests:4,minNights:2,maxNights:14,minGapNights:0,depositCents:0,releaseHours:0,taxLabel:'State lodging tax',taxBps:900,countyTaxLabel:'County lodging tax',countyTaxBps:0,agreement:'No smoking. Quiet hours after 10 pm.',requireIdentity:false})
 const checkout=await h.send('/book/archive-home/checkout',{start:day(20),end:day(23),guests:2,homeRevision:cfg.revision,guestName:'Jordan Reyes',email:'jordan@stay.example',signature:'Jordan Reyes',consent:'yes'})
 assert.equal(checkout.status,200,checkout.text)
 const inbox=(await h.accessState()).inbox[0]
 await h.cmd('inbox.ai.save',{revision:inbox.revision,key:'archive-ai-fixture-key',model:'test-model'})
 await h.cmd('portal.guide',{propertyId:p.id,version:0,arrival:'Private archive arrival',guidebook:'Retained walking guide'})
 const guideBytes='Original synthetic-cabin-1 guide\n',guide=await h.cmd('portal.guide.file.add',{propertyId:p.id,version:1,guideFile:{name:'synthetic-cabin-1.txt',mimeType:'text/plain',base64:Buffer.from(guideBytes).toString('base64')}})
 const portal=(await h.accessState()).guestPortalLinks.find(l=>l.bookingId===booking.bookingId),guestCookie=await h.verifyGuest(portal.token)
 const pending=await h.send('/stay/'+portal.token+'/send-code',{},guestCookie);assert.equal(pending.status,200)
 const authSecrets=[...(await h.db.prepare('SELECT token_hash FROM cb_guest_sessions').all()).results.map(r=>r.token_hash),...(await h.db.prepare('SELECT code_hash,browser_hash FROM cb_guest_challenges').all()).results.flatMap(r=>[r.code_hash,r.browser_hash])]
 const financialCase=await populateExceptionArchive(h,p)
 const qbo=await populateQboArchive(h)
 const bank=await populateBankArchive(h)
 const state=await h.accessState();assert.ok(state.codes.some(c=>c.lock.job?.startedAt&&c.lock.providerId),'The archive source includes real claimed provider work through its network boundary')
 const codes=state.codes.filter(c=>c.link).map(c=>c.link)
 const sealed=JSON.parse((await h.db.prepare('SELECT data FROM cb_direct_provider').first()).data).test.keySealed
 const journals=(await h.db.prepare('SELECT data FROM cb_ledger_journals ORDER BY id').all()).results.map(r=>r.data)
 const signed=(await h.db.prepare('SELECT data FROM cb_direct_stays').first()).data
 const channelAgent=await populateChannelArchive(h,p)
 return {qbo,financialCase,bank,collectionId:collection.id,importedId:imported.id,bookingId:booking.bookingId,statementId:statement.id,netCents:statement.netCents,portal:{token:portal.token,cookie:guestCookie,file:guide.files[0],guideBytes},privateLinks:[...codes,portal.token,...authSecrets,...channelAgent.privateValues],sealed,journals,signature:JSON.parse(signed).signature,bookingUrl:checkout.value.bookingUrl,channelAgent}
}
export async function checkRestored(h,owner,proof) {
 await checkExceptionArchive(h,owner,proof.financialCase)
 await checkBankArchive(h,owner,proof.bank)
 await checkQboArchive(h,owner,proof.qbo)
 assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_provider_security').first()).n,0,'provider credentials and grants stay installation-local')
 for(const table of ['cb_guest_challenges','cb_guest_sessions','cb_guest_limits'])assert.equal((await h.db.prepare('SELECT count(*) AS n FROM '+table).first()).n,0,'guest authentication is never restored')
 assert.equal((await h.send('/stay/'+proof.portal.token,undefined,proof.portal.cookie)).status,404)
 const guideFile=await h.db.prepare('SELECT hex(bytes) AS bytes,sha256 FROM cb_guest_guide_files WHERE id=?').bind(proof.portal.file.id).first();assert.equal(Buffer.from(guideFile.bytes,'hex').toString(),proof.portal.guideBytes);assert.equal(guideFile.sha256,proof.portal.file.sha256)
 const collection=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(proof.collectionId).first()).data);assert.equal(collection.restored,true);assert.equal(collection.status,'paused');assert.equal(collection.customerId,undefined);assert.equal(collection.paymentMethod,undefined);assert.equal(collection.setup,undefined)
 let s=await h.accessState(owner)
 assert.ok(s.codes.every(c=>!c.lock.job),'Restored access cannot retain a live provider claim or its PIN and request identity')
 const imported=await h.db.prepare('SELECT plan,fingerprint FROM cb_provider_moveins WHERE id=?').bind(proof.importedId).first();assert.equal(JSON.parse(imported.plan).homes[0].links.length,0);await h.cmd('import.provider.apply',{id:proof.importedId,fingerprint:imported.fingerprint},owner,409)
 assert.equal(s.restore.reviewed,0)
 assert.ok(s.sharing.every(p=>!p.enabled))
 assert.equal(s.channelAgent.profiles.find(p=>p.id===proof.channelAgent.profileId).status,'disconnected')
 const agentRows=async()=>(await h.db.prepare("SELECT kind,data FROM cb_records WHERE kind IN ('channelAgentAccounts','channelAgentProfiles','channelAgentKeys','channelAgentEvidence','channelAgentActions') ORDER BY rowid").all()).results.map(row=>({kind:row.kind,data:JSON.parse(row.data)})).sort((a,b)=>a.data.id.localeCompare(b.data.id))
 const restoredAgent=await agentRows()
 for(const {kind,data} of restoredAgent){
  if(kind==='channelAgentAccounts')assert.equal(data.status,'revoked')
  if(kind==='channelAgentProfiles')assert.ok(!data.stateSealed&&!data.grantedAt&&!data.grantedBy)
  if(kind==='channelAgentKeys')assert.ok(!data.hash&&Date.parse(data.expiresAt)<Date.now())
  if(kind==='channelAgentEvidence')assert.ok(!data.bodySealed)
  if(kind==='channelAgentActions')assert.ok(!data.lease&&!data.leaseUntil&&!data.beforeSealed&&!data.afterSealed&&!data.canUndo)
 }
 for(const id of proof.channelAgent.cancelledIds)assert.equal(s.channelAgent.actions.find(a=>a.id===id).status,'cancelled')
 assert.deepEqual(restoredAgent.filter(row=>row.kind==='channelAgentActions'&&row.data.status==='succeeded').map(({data})=>({id:data.id,status:data.status,result:data.result,completedAt:data.completedAt,attempts:data.attempts})),proof.channelAgent.history)
 assert.equal((await h.send('/api/cabin/channel-agent/runner',{op:'claim'},'',{authorization:'Bearer '+proof.channelAgent.runnerToken})).status,403)
 assert.equal((await h.send(`/api/cabin/channel-agent/evidence?id=${encodeURIComponent(proof.channelAgent.closureId)}&side=after`,undefined,owner)).status,404)
 assert.equal(s.inbox[0].ai,null)
 assert.ok(s.codes.every(c=>c.status==='revoked'&&!c.code&&!c.link))
 assert.ok(s.messages.some(m=>m.direction==='in'&&m.text==='Where can I park?'))
 assert.equal(s.statements.find(s=>s.id===proof.statementId).netCents,proof.netCents)
 assert.equal(s.payouts.find(p=>p.payoutId==='ARCHIVE-PAYOUT').netCents,97000)
 assert.deepEqual((await h.db.prepare('SELECT data FROM cb_ledger_journals ORDER BY id').all()).results.map(r=>r.data),proof.journals)
 const direct=JSON.parse((await h.db.prepare('SELECT data FROM cb_direct_stays').first()).data)
 assert.deepEqual(direct.signature,proof.signature)
 assert.equal(direct.restored,true)
 assert.ok(!direct.bookingLinkSealed&&!direct.checkoutUrl&&!direct.paymentMethod)
 assert.equal((await h.send(new URL(proof.bookingUrl).pathname)).status,404)
 assert.equal((await h.send('/stay/'+proof.privateLinks[0])).status,404)
 assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM cb_direct_provider').first()).n,0)
 await h.cmd('provider.sharing',{id:'stripe',revision:s.sharing.find(p=>p.id==='stripe').revision,enabled:true,confirm:'yes'},owner,409)
 await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 await h.cmd('property.save',{...s.properties[0],name:'Lake Loft restored'},owner)
 s=await h.accessState(owner)
 assert.ok(s.bookings.every(b=>b.restorePaused))
 assert.ok(s.codes.every(c=>c.status==='revoked'))
 await h.cmd('restore.review',{revision:s.restore.revision,confirm:'yes'},owner)
 await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 assert.deepEqual(await agentRows(),restoredAgent,'restore review and scheduled work never replay channel jobs or reconnect profiles')
 s=await h.accessState(owner)
 assert.ok(s.bookings.find(b=>b.id===proof.bookingId).restorePaused)
 const b=s.bookings.find(b=>b.id===proof.bookingId)
 await h.cmd('restore.booking',{id:b.id,revision:b.revision,confirm:'yes'},owner)
 s=await h.accessState(owner)
 assert.equal(s.bookings.find(r=>r.id===b.id)?.restorePaused,undefined)
 const fresh=s.guestPortalLinks.find(l=>l.bookingId===b.id);assert.ok(fresh.token&&fresh.token!==proof.portal.token);assert.equal((await h.send('/stay/'+fresh.token+'/api',undefined,proof.portal.cookie)).status,401,'fresh restored links require fresh email proof')
 assert.ok(s.codes.some(c=>c.bookingId===b.id&&c.status==='issued'&&!proof.privateLinks.includes(c.link)))
 const pdf=await h.mf.dispatchFetch(h.origin+`/api/cabin/statements/${proof.statementId}.pdf`,{headers:{cookie:owner}})
 assert.equal(pdf.status,200)
 assert.equal(pdf.headers.get('content-type'),'application/pdf')
 const bytes=new Uint8Array(await pdf.arrayBuffer())
 assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-')
 const {PDFDocument}=await import('pdf-lib');assert.ok((await PDFDocument.load(bytes)).getPageCount()>0)
 assert.equal((await h.send(`/api/cabin/statements/${proof.statementId}.pdf`,undefined,'')).status,401)
}
