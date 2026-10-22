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
 assert.ok(process.env.CABIN_COLLECTION_TEST_CREDENTIAL,'Inject the held Stripe test credential through _od08-env.py; no fixture key is stored.')
 const sessions=new Map(),payments=new Map(),writes=[],attempts=new Map();let fault='lost',sequence=0
 const h=await harness({assets:true,auth:{STRIPE_TEST_SECRET_KEY:process.env.CABIN_COLLECTION_TEST_CREDENTIAL},outbound:async request=>{
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
   const p={id:'synthetic_cabin_payment_'+(++sequence),customer:f.get('customer'),amount:Number(f.get('amount')),amount_received:fault==='decline'?0:Number(f.get('amount')),currency:'usd',status:fault==='decline'?'requires_payment_method':'succeeded',metadata:{collectionPlanId:f.get('metadata[collectionPlanId]'),collectionJobId:f.get('metadata[collectionJobId]'),collectionAttemptId:aid}}
   payments.set(p.id,p);writes.push(p);if(fault==='lost'){fault='';return new Response('uncertain network response',{status:502})}return Response.json(p)
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
  assert.equal((await h.send(g.path,{action:'refresh'},g.cookie)).status,303)
  assert.equal(writes.length,1);let state=await collectionState(h,p.id);assert.equal(state.jobs[0].status,'uncertain');assert.ok(state.jobs[0].deadline)
  await h.cmd('direct.collection.retry',{id:p.id,jobId:state.jobs[0].id,revision:state.revision,confirm:'yes',reference:'synthetic-cabin-1'},h.owner,409)
  await h.restart();await tick();state=await collectionState(h,p.id);assert.equal(state.jobs[0].status,'succeeded');assert.equal(writes.length,1)
  assert.equal((await h.state()).bookings.find(v=>v.id===b.id).reservationBalance.paidCents,3000)
  assert.equal((await h.state()).messages.filter(m=>m.subject==='Your payment receipt').length,1)
  const makeDue=async index=>{const raw=await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p.id).first();const saved=JSON.parse(raw.data);saved.jobs[index].dueAt=new Date(Date.now()-1000).toISOString();await h.db.prepare('UPDATE cb_records SET data=? WHERE id=?').bind(JSON.stringify(saved),p.id).run()}
  await makeDue(1);fault='decline';await tick();state=await collectionState(h,p.id);assert.equal(state.jobs[1].status,'failed');assert.ok(state.jobs[1].deadline);assert.equal(state.assigneeId,await ownerId(h))
  if(screens)await screens(h,g,'failure')
  await h.cmd('direct.collection.retry',{id:p.id,jobId:state.jobs[1].id,revision:state.revision,confirm:'yes',reference:'Guest confirmed retry after provider-confirmed failure'})
  fault='';await tick();assert.equal(writes.length,3);state=await collectionState(h,p.id);assert.equal(state.jobs[1].status,'succeeded');assert.ok(state.jobs[1].resolvedAt);assert.equal(state.jobs[1].attempts.length,2)
  let booking=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.amend',{id:b.id,revision:booking.revision,propertyId:home.id,start:day(20),end:day(22),guestName:b.guestName,guestEmail:b.guestEmail,reason:'Guest requested later arrival'})
  state=await collectionState(h,p.id);assert.equal(state.status,'consent_required');assert.notEqual(state.jobs[2].dueAt,p.jobs[2].dueAt);await tick();assert.equal(writes.length,3)
  booking=(await h.state()).bookings.find(v=>v.id===b.id)
  await h.cmd('reservation.end',{id:b.id,revision:booking.revision,outcome:'cancelled',reason:'Guest cancellation'})
  await h.restart();await tick();state=await collectionState(h,p.id);assert.equal(state.status,'cancelled');assert.equal(state.jobs[2].status,'suppressed');assert.equal(writes.length,3)
  assert.equal((await h.state()).bookings.find(v=>v.id===b.id).reservationBalance.paidCents,5000)
  const raw=JSON.parse((await h.db.prepare('SELECT data FROM cb_records WHERE id=?').bind(p.id).first()).data)
  const {exportRow}=await import('../src/cabin/archive/transform.mjs');const archived=JSON.parse(exportRow('cb_records',{kind:'collectionPlans',data:JSON.stringify(raw)}).data)
  assert.equal(archived.restored,true);assert.equal(archived.status,'paused');assert.equal(archived.paymentMethod,undefined);assert.equal(archived.customerId,undefined);assert.equal(archived.consent,undefined)
  console.log('Collection provider-edge journey PASS: deposit, lost-acceptance restart reconciliation, failed installment, reviewed retry, date-change reconsent, cancellation, receipts, balances and inactive archive. Provider POST count: '+writes.length)
 }finally{await h.close()}
}
if(process.argv[1]===import.meta.filename)await collectionProviderJourney()
