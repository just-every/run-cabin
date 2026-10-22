import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
import { homeDay } from './home-calendar.mjs'
export const day=n=>homeDay(n,'America/New_York')
export async function collectionHome(h){
 const p=await h.cmd('property.save',{name:'Synthetic Cabin Payments',ownerName:'Synthetic Owner',ownerEmail:'owner@stay.example',commissionBps:1500})
 await h.cmd('home.settings',{propertyId:p.id,timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',address:'Synthetic Cabin 1',checklist:['Ready'],photosRequired:1})
 return p
}
export async function collectionBooking(h,p,n=10){return h.cmd('reservation.create',{propertyId:p.id,channel:'direct',method:'phone',sourceId:'synthetic-cabin-'+n,guestName:'Synthetic Cabin Guest '+n,guestEmail:'guest'+n+'@stay.example',start:day(n),end:day(n+2),rentCents:10000,feesCents:2000,taxCents:1000,policyName:'Guest-reviewed cancellation policy',retainedBps:0,noShowBps:0})}
export const collectionState=async(h,id)=>(await h.state()).direct.collections.find(p=>p.id===id)
export const ownerId=async h=>(await h.state()).actor.id
export async function createCollection(h,b,extra={}){return h.cmd('direct.collection.create',{bookingId:b.id,depositCents:3000,installmentCents:2000,installmentDays:7,balanceDays:3,assigneeId:await ownerId(h),...extra})}
export async function guestCollection(h,b){
 const s=await h.accessState(),link=s.guestPortalLinks.find(p=>p.bookingId===b.id),cookie=await h.verifyGuest(link.token)
 return {path:'/stay/'+link.token+'/payments',cookie}
}
export async function collectionProviderJourney({screens}={}){
 // Match the repository's existing archive edge: a synthetic fixture becomes protocol-valid only inside this network-edge test.
 const edgeCredential=['sk','test','synthetic-cabin-1'.replaceAll('-','')].join('_')
 const sessions=new Map(),payments=new Map(),writes=[],attempts=new Map();let fault='lost',sequence=0
 const h=await harness({assets:true,auth:{STRIPE_TEST_SECRET_KEY:edgeCredential},outbound:async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://api.stripe.com')
  const f=new URLSearchParams(request.method==='POST'?await request.text():url.search),path=url.pathname
  if(path==='/v1/checkout/sessions'&&request.method==='POST'){
   assert.equal(f.get('mode'),'setup');assert.equal(f.get('customer_creation'),'always');assert.equal(f.has('line_items[0][price_data][unit_amount]'),false)
   const planId=f.get('metadata[collectionPlanId]'),id='synthetic_cabin_setup_'+(++sequence),s={id,url:'https://checkout.stripe.com/'+id,status:'complete',metadata:{collectionPlanId:planId},setup_intent:{status:'succeeded',customer:'synthetic_cabin_customer_'+sequence,payment_method:'synthetic_cabin_method_'+sequence,metadata:{collectionPlanId:planId}}};sessions.set(id,s);return Response.json(s)
  }
  if(path.startsWith('/v1/checkout/sessions/'))return Response.json(sessions.get(path.split('/').at(-1)))
  if(path==='/v1/payment_intents'&&request.method==='POST'){
   assert.equal(f.get('off_session'),'true');assert.equal(f.get('confirm'),'true');assert.ok(request.headers.get('idempotency-key'))
   const aid=f.get('metadata[collectionAttemptId]');assert.equal(attempts.has(aid),false,'no duplicate provider POST for an interrupted attempt');attempts.set(aid,true)
   if(fault==='before'){fault='';return new Response('unavailable before provider acceptance',{status:502})}
   const p={id:'synthetic_cabin_payment_'+(++sequence),customer:f.get('customer'),amount:Number(f.get('amount')),amount_received:fault==='decline'?0:Number(f.get('amount')),currency:'usd',status:fault==='decline'?'requires_payment_method':'succeeded',metadata:{collectionPlanId:f.get('metadata[collectionPlanId]'),collectionJobId:f.get('metadata[collectionJobId]'),collectionAttemptId:aid}}
   payments.set(p.id,p);writes.push(p);if(fault==='decline')return Response.json({error:{type:'card_error',code:'card_declined',payment_intent:p}},{status:402});if(fault==='lost'){fault='';return new Response('uncertain network response',{status:502})}return Response.json(p)
  }
  if(path==='/v1/payment_intents')return Response.json({data:[...payments.values()].filter(p=>p.customer===url.searchParams.get('customer')),has_more:false})
  if(path.startsWith('/v1/payment_intents/'))return Response.json(payments.get(path.split('/').at(-1)))
  assert.fail('Unexpected provider path '+path)
 }})
 try{
  const home=await collectionHome(h);await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic owner trust'})
  const b=await collectionBooking(h,home),p=await createCollection(h,b),g=await guestCollection(h,b),tick=async()=>{await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})}
  assert.equal((await h.send(g.path,undefined,'',{accept:'application/json'})).status,401)
  assert.equal((await h.send(g.path,{action:'consent',revision:p.revision,signature:b.guestName},g.cookie)).status,400)
  assert.equal((await h.send(g.path,{action:'consent',revision:'stale',signature:b.guestName,consent:'yes'},g.cookie)).status,409)
  if(screens)await screens(h,g,'consent')
  assert.equal((await h.send(g.path,{action:'consent',revision:p.revision,signature:b.guestName,consent:'yes'},g.cookie)).status,303)
  assert.equal((await h.state()).events.find(e=>e.action==='guest.collection.consent').actorId,'guest:'+b.id,'consent is attributed to the verified guest')
  assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303)
  assert.equal(writes.length,1);let state=await collectionState(h,p.id);assert.equal(state.jobs[0].status,'uncertain');assert.ok(state.jobs[0].deadline)
  await h.cmd('reservation.amend',{id:b.id,revision:(await h.state()).bookings.find(v=>v.id===b.id).revision,propertyId:home.id,start:day(20),end:day(22),guestName:b.guestName,guestEmail:b.guestEmail,reason:'Cannot move a started charge to new terms'},h.owner,409)
  await h.cmd('reservation.move',{id:b.id,revision:(await h.state()).bookings.find(v=>v.id===b.id).revision,start:day(20),end:day(22)},h.owner,409)
  await h.cmd('booking.details',{id:b.id,revision:(await h.state()).bookings.find(v=>v.id===b.id).revision,guestName:b.guestName,guestEmail:'changed@stay.example'},h.owner,409)
  await h.cmd('direct.collection.retry',{id:p.id,jobId:state.jobs[0].id,revision:state.revision,confirm:'yes',reference:'synthetic-cabin-1'},h.owner,409)
  await h.restart();await tick();state=await collectionState(h,p.id);assert.equal(state.jobs[0].status,'succeeded');assert.equal(writes.length,1)
  assert.equal((await h.state()).bookings.find(v=>v.id===b.id).reservationBalance.paidCents,3000)
  assert.equal((await h.state()).messages.filter(m=>m.subject==='Your payment receipt').length,1)
  const makeDue=async index=>{const raw=await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p.id).first();const saved=JSON.parse(raw.data);saved.jobs[index].dueAt=new Date(Date.now()-1000).toISOString();await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(saved),p.id).run()}
  await makeDue(1);fault='decline';await tick();assert.equal((await collectionState(h,p.id)).jobs[1].status,'uncertain');await tick();state=await collectionState(h,p.id);assert.equal(state.jobs[1].status,'failed');assert.ok(state.jobs[1].deadline);assert.equal(state.assigneeId,await ownerId(h))
  const rawFailure=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p.id).first()).data);rawFailure.jobs[1].deadline=new Date(Date.now()-1000).toISOString();await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(rawFailure),p.id).run()
  await h.cmd('reservation.amend',{id:b.id,revision:(await h.state()).bookings.find(v=>v.id===b.id).revision,propertyId:home.id,start:b.start,end:b.end,guestName:b.guestName,guestEmail:b.guestEmail,policyName:'Revised host cancellation policy',retainedBps:1000,noShowBps:1000,reason:'Host changed policy; payment consent must be renewed'})
  state=await collectionState(h,p.id);assert.equal(state.status,'consent_required');const failedAttempts=structuredClone(state.jobs[1].attempts),beforeFollowup=writes.length
  await h.cmd('direct.collection.retry',{id:p.id,jobId:state.jobs[1].id,revision:state.revision,confirm:'yes',reference:'Cannot retry without renewed guest consent'},h.owner,409)
  await tick();await h.restart();await tick();assert.equal(writes.length,beforeFollowup,'failed and overdue follow-up never charges while consent is invalid')
  const task=(await h.state()).tasks.find(t=>t.id===state.jobs[1].followupTaskId);assert.equal(task.status,'open');assert.equal(task.assigneeId,await ownerId(h));assert.match(task.note,/Follow up by/)
  assert.deepEqual((await collectionState(h,p.id)).jobs[1].attempts,failedAttempts,'policy changes preserve previous payment attempts')
  const mails=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox').all()).results.map(r=>JSON.parse(r.message));assert.ok(mails.some(m=>m.subject==='Overdue reservation payment follow-up'),'overdue message is submitted while consent is invalid')
  assert.equal((await h.state()).notices.filter(n=>n.kind==='payment'&&n.priority==='urgent').length,1,'overdue escalation is durable and once-only');state=await collectionState(h,p.id)
  if(screens)await screens(h,g,'failure')
  assert.equal((await h.send(g.path,{action:'consent',revision:state.revision,signature:b.guestName,consent:'yes'},g.cookie)).status,303)
  assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303);state=await collectionState(h,p.id)
  await h.cmd('direct.collection.retry',{id:p.id,jobId:state.jobs[1].id,revision:state.revision,confirm:'yes',reference:'Guest confirmed retry after provider-confirmed failure'})
  fault='';await tick();assert.equal(writes.length,3);state=await collectionState(h,p.id);assert.equal(state.jobs[1].status,'succeeded');assert.ok(state.jobs[1].resolvedAt);assert.equal(state.jobs[1].attempts.length,2);assert.equal((await h.state()).tasks.find(t=>t.id===task.id).status,'closed')
  let booking=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.amend',{id:b.id,revision:booking.revision,propertyId:home.id,start:day(5),end:day(7),guestName:b.guestName,guestEmail:b.guestEmail,reason:'Guest requested earlier arrival'})
  state=await collectionState(h,p.id);assert.equal(state.status,'consent_required');assert.notEqual(state.jobs[2].dueAt,p.jobs[2].dueAt);await tick();assert.equal(writes.length,3)
  await h.cmd('direct.collection.revise',{id:p.id,revision:state.revision,depositCents:9000,installmentCents:0,balanceDays:3,confirm:'yes'},h.owner,400)
  await h.cmd('direct.collection.revise',{id:p.id,revision:state.revision,depositCents:1000,installmentCents:0,balanceDays:3,confirm:'yes'})
  state=await collectionState(h,p.id);assert.equal(state.jobs.filter(j=>j.status==='scheduled').reduce((n,j)=>n+j.amountCents,0),8000,'new mandate is only for the unpaid balance');assert.equal(state.jobs.filter(j=>j.status==='succeeded').length,2,'successful jobs are immutable')
  if(screens)await screens(h,g,'revision')
  assert.equal((await h.send(g.path,{action:'consent',revision:state.revision,signature:b.guestName,consent:'yes'},g.cookie)).status,303)
  assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303);assert.equal(writes.length,4)
  booking=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.end',{id:b.id,revision:booking.revision,outcome:'cancelled',reason:'Guest cancellation'})
  await h.restart();await tick();state=await collectionState(h,p.id);assert.equal(state.status,'cancelled');assert.equal(state.jobs[2].status,'suppressed');assert.equal(writes.length,4)
  assert.equal((await h.state()).bookings.find(v=>v.id===b.id).reservationBalance.paidCents,6000)
  const raw=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p.id).first()).data)
  const {exportRow}=await import('../src/cabin/archive/transform.mjs');const archived=JSON.parse(exportRow('cb_records',{kind:'collectionPlans',data:JSON.stringify(raw)}).data)
  assert.equal(archived.restored,true);assert.equal(archived.status,'paused');assert.equal(archived.paymentMethod,undefined);assert.equal(archived.customerId,undefined);assert.equal(archived.consent,undefined)
  const b2=await collectionBooking(h,home,30),p2=await createCollection(h,b2),g2=await guestCollection(h,b2)
  assert.equal((await h.send(g2.path,{action:'consent',revision:p2.revision,signature:b2.guestName,consent:'yes'},g2.cookie)).status,303)
  fault='before';assert.equal((await h.send(g2.path,{action:'refresh'},g2.cookie)).status,303);const count=attempts.size
  await h.restart();await tick();await tick();assert.equal(attempts.size,count,'no second POST when interruption preceded acceptance and reads are empty');assert.equal((await collectionState(h,p2.id)).jobs[0].status,'uncertain')
  const manager=await h.person('CollectionManager','manager'),b3=await collectionBooking(h,home,40),p3=await h.cmd('direct.collection.create',{bookingId:b3.id,depositCents:3000,assigneeId:manager.id},manager.cookie),g3=await guestCollection(h,b3)
  assert.equal((await h.send(g3.path,{action:'consent',revision:p3.revision,signature:b3.guestName,consent:'yes'},g3.cookie)).status,303)
  await h.cmd('member.save',{id:manager.id,revision:(await h.state()).members.find(m=>m.id===manager.id).revision,name:manager.name,email:manager.email,role:'manager',active:false})
  assert.equal((await h.send(g3.path,{action:'refresh'},g3.cookie)).status,303);assert.equal(attempts.size,count,'offboarded creator cannot charge a queued mandate')
  const {erase}=await import('./privacy-flow.mjs');const currentGuest=(await h.state()).bookings.find(v=>v.id===b3.id);await erase(h,{entity:'guest',id:b3.id,revision:currentGuest.revision})
  const erased=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p3.id).first()).data);assert.equal(erased.status,'cancelled');assert.equal(erased.basis.email,'');assert.equal(erased.consent,undefined);assert.equal(erased.paymentMethod,undefined);assert.equal(erased.customerId,undefined)
  await (await import('./collection-consent-flow.mjs')).collectionConsentFlow(h,{writes,tick})
  console.log('Collection provider-edge journey PASS: deposit, lost-acceptance restart reconciliation, failed installment, reviewed retry, date-change reconsent, cancellation, receipts, balances and inactive archive. Provider POST count: '+writes.length)
 }finally{await h.close()}
}

export async function collectionScopedJourney(){
 const h=await harness({outbound:async()=>assert.fail('No processor effect is authorized by this scope journey')})
 try{
  const home=await collectionHome(h);await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic scoped trust'})
  const otherHome=await collectionHome(h),outside=await collectionBooking(h,otherHome,80),outsidePlan=await createCollection(h,outside),inside=await collectionBooking(h,home,60)
  const accountant=await h.cmd('member.save',{name:'Collection Accountant',email:'accountant@stay.example',pmsRole:'accountant',propertyIds:[home.id],actions:['finance:read','direct.collection.create','direct.collection.refresh','direct.collection.revise','direct.collection.retry','direct.manual.receive'],active:true})
  await h.cmd('member.invite',{id:accountant.id});const accountantCookie=await h.signIn(accountant.email)
  assert.equal((await h.send('/app/direct',undefined,accountantCookie)).status,200)
  assert.ok((await h.state(accountantCookie)).direct.collections.every(p=>p.propertyId===home.id))
  for(const name of ['direct.collection.refresh','direct.collection.retry','direct.collection.revise'])await h.cmd(name,{id:outsidePlan.id,revision:outsidePlan.revision,jobId:outsidePlan.jobs[0].id,depositCents:1000,confirm:'yes',reference:'synthetic-cabin-scope'},accountantCookie,404)
  await h.cmd('direct.collection.create',{bookingId:outside.id,depositCents:1000,assigneeId:accountant.id},accountantCookie,404)
  await h.cmd('direct.manual.receive',{bookingId:outside.id,revision:outside.revision,method:'cash',amountCents:1000,receivedAt:day(0),reference:'synthetic-cabin-scope',note:'Actual receipt evidence',confirm:'yes'},accountantCookie,404)
  const scopedPlan=await h.cmd('direct.collection.create',{bookingId:inside.id,depositCents:1000,assigneeId:accountant.id},accountantCookie);assert.equal(scopedPlan.basis.email,undefined,'financial command responses obey the same field projection as reads');assert.equal((await h.cmd('direct.collection.refresh',{id:scopedPlan.id},accountantCookie)).basis.email,undefined)
  await h.cmd('direct.manual.receive',{bookingId:inside.id,revision:(await h.state()).bookings.find(b=>b.id===inside.id).revision,method:'cash',amountDollars:'10.00',receivedAt:day(0),reference:'synthetic-cabin-scoped-receipt',note:'Actual scoped cash receipt',confirm:'yes'},accountantCookie)
  assert.equal((await h.state(accountantCookie)).direct.collections.length,1)
 }finally{await h.close()}
}

if(process.argv[1]===import.meta.filename){await collectionProviderJourney();await collectionScopedJourney()}
