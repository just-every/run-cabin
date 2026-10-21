import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
import { attestArrival } from './readiness-helpers.mjs'
// Days count from the home's own calendar: dispatch starts a turnover for a stay that checks out today there.
const day = n => { const d = new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10) }
const unescape = v => v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
async function input(h,bookingId,item) {
 const b=(await h.state()).bookings.find(b=>b.id===bookingId)
 const page=(await h.send('/app/readiness?from='+b.start,undefined,h.owner)).text
 const section=[...page.matchAll(/<section class="readiness-item">([\s\S]*?)<\/section>/g)].find(m=>m[1].includes(`value="${item}"`))
 assert.ok(section)
 return Object.fromEntries([...section[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map(m=>[m[1],unescape(m[2])]))
}
test('OPS-003: arrival stays unready until physical supplies, access, maintenance and named inspection pass',async()=>{
 const h=await harness()
 try {
  const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen',ownerEmail:'karen@stay.example',commissionBps:2000})
  const cleaner=await h.person('Luis'), inspector=await h.person('Ana','manager')
  await h.cmd('home.settings',{propertyId:home.id,address:'240 Lake Road, Boone, NC',timeZone:'America/New_York',cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
  await h.cmd('readiness.plan',{propertyId:home.id,revision:'',supplies:['Linens','Coffee'],inspectorId:inspector.id})
  const prev=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Departed guest',start:day(-3),end:day(-1)})
  const arrival=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',start:day(1),end:day(4)})
  let t=await h.cmd('turnover.prepare',{bookingId:prev.bookingId,cleanerId:cleaner.id,dueDate:day(1),checklist:['Ready']})
  await h.cmd('turnover.approve',{id:t.id,revision:t.revision})
  t=(await h.state()).turnovers.find(row=>row.id===t.id)
  await h.cmd('turnover.complete',{id:t.id,revision:t.revision,checks:['Ready'],caption:'Cleaned',photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}]},cleaner.cookie)
  const task=await h.cmd('task.raise',{propertyId:home.id,title:'Entry latch jammed',blocking:true})
  const attest=async(item,status,note,cookie=h.owner,extra={})=>h.cmd('readiness.attest',{...await input(h,arrival.bookingId,item),status,note,...extra},cookie)
  await attest('access','failed','Latch does not open')
  await attest('supply:Coffee','failed','Coffee is short')
  const board=async()=>(await h.send('/app/readiness?from='+day(1),undefined,h.owner)).text
  assert.match(await board(),/home-ready not-ready/)
  assert.match(await board(),/Entry latch jammed/)
  const ins=await input(h,arrival.bookingId,'inspection')
  await h.cmd('readiness.attest',{...ins,status:'passed',note:'Photos alone'},h.owner,403)
  await h.cmd('readiness.attest',{...ins,status:'passed',note:'Not resolved'},inspector.cookie,409)
  await h.cmd('readiness.attest',{...ins,status:'passed',note:'Cleaner cannot inspect'},cleaner.cookie,403)
  await h.cmd('readiness.chase',{...ins,note:'Ana to check the latch before 2 pm'})
  assert.match(await board(),/Ana to check the latch/)
  const accepted=await h.cmd('work.accept',{id:task.id,revision:task.revision})
  await h.cmd('task.close',{id:task.id,revision:accepted.revision,checks:['Verify repair'],note:'Latch replaced; opened successfully',photos:[{photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}]})
  await h.cmd('readiness.attest',{...ins,status:'passed',note:'Stale observation'},inspector.cookie,409)
  await attest('access','passed','Opened using the arrival code and checked backup entry')
  await attest('supply:Linens','passed','Clean linens counted and restocked')
  const coffee=await input(h,arrival.bookingId,'supply:Coffee')
  await h.cmd('readiness.attest',{...coffee,status:'excepted',note:'Coffee delivery delayed'},h.owner,400)
  await h.cmd('readiness.attest',{...coffee,status:'excepted',note:'Coffee delivery delayed',guestImpact:'Megan agreed to bring coffee; welcome credit arranged'})
  await attest('inspection','passed','Ana inspected the home and accepted the documented exception',inspector.cookie)
  assert.match(await board(),/home-ready ready/)
  assert.match(await board(),/Megan agreed to bring coffee/)
  assert.match(await board(),/Ana/)
  // A restock can replace the exception; a changed observation requires new inspector acceptance.
  await attest('supply:Coffee','passed','Delivery arrived, coffee restocked')
  assert.match(await board(),/home-ready not-ready/)
  await attest('inspection','passed','Restock inspected',inspector.cookie)
  assert.match(await board(),/home-ready ready/)
  const s=await h.state(), b=s.bookings.find(b=>b.id===arrival.bookingId)
  await h.cmd('reservation.move',{id:b.id,revision:(await h.state()).bookings.find(row=>row.id===b.id).revision,start:day(2),end:day(5)})
  assert.match((await h.send('/app/readiness?from='+day(2),undefined,h.owner)).text,/home-ready not-ready/)
  // Draft-only agents cannot write readiness, and physical history survives in local records.
  assert.equal((await h.state(cleaner.cookie)).readinessRecords.length,0)
 } finally {await h.close()}
})

test('OPS-008: departures share a selected home-local day and retain actual checkout evidence without requiring another arrival',async()=>{
 const h=await harness()
 try {
  const cleaner=await h.person('Avery'), staff=await h.person('Mira','manager')
  const selected=day(-2), start=day(-5), stays=[]
  for(const [name,timeZone,checkOutTime] of [['Eastern Cottage','America/New_York','09:15'],['Island Cottage','Pacific/Honolulu','11:30'],['Quiet Cottage','Pacific/Honolulu','10:45']]){
   const home=await h.cmd('property.save',{name,ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000})
   await h.cmd('home.settings',{propertyId:home.id,address:'24 Test Lane',timeZone,checkOutTime,cleanerId:cleaner.id,checklist:['Ready'],photosRequired:1})
   const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',kind:'stay',guestName:`Guest at ${name}`,start,end:selected})
   stays.push({home,bookingId:request.bookingId,timeZone,checkOutTime})
  }
  // Past stays do not get automatically dispatched; the board must still list them.
  for(const [i,cookie] of [cleaner.cookie,staff.cookie].entries()){
   let t=await h.cmd('turnover.prepare',{bookingId:stays[i].bookingId,cleanerId:cleaner.id,checklist:['Ready']})
   await h.cmd('turnover.approve',{id:t.id,revision:t.revision})
   stays[i].turnover=await h.cmd('turnover.checkout',{id:t.id},cookie)
  }
  const cancelledHome=await h.cmd('property.save',{name:'Cancelled Cottage',ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000})
  const cancelled=await h.cmd('reservation.create',{propertyId:cancelledHome.id,method:'manual',channel:'direct',sourceId:'cancelled-departure',guestName:'Cancelled guest',start,end:selected,rentCents:10000,policyName:'Flexible',retainedBps:0,noShowBps:0})
  await h.cmd('reservation.end',{id:cancelled.id,revision:cancelled.revision,reason:'Guest cancelled by phone'})
  const section=async cookie=>{
   const page=await h.send(`/app/readiness?from=${selected}`,undefined,cookie)
   const board=page.text.match(/<section class="panel" aria-label="Departures">([\s\S]*?)<\/section>/)
   assert.ok(board,'authorised staff can read the departures board')
   return board[1]
  }
  const board=await section(staff.cookie), cards=[...board.matchAll(/<article class="record">([\s\S]*?)<\/article>/g)].map(m=>m[1])
  assert.equal(cards.length,stays.length)
  for(const stay of stays){
   const card=cards.find(c=>c.includes(`reservation=${stay.bookingId}`))
   assert.ok(card,`departure for ${stay.home.name} links to its source`)
   assert.ok(card.includes(`datetime="${selected}T${stay.checkOutTime}"`))
   assert.ok(card.includes(stay.timeZone))
   const times=[...card.matchAll(/<time datetime="([^"]+)">([^<]+)<\/time>/g)]
   assert.equal(times.length,stay.turnover?2:1)
   if(stay.turnover){
    const out=stay.turnover.checkedOut
    assert.equal(times[1][1],out.at)
    const local=new Intl.DateTimeFormat('en-US',{timeZone:stay.timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(out.at)).toLowerCase().replace(/\s+/g,' ')
    assert.ok(times[1][2].toLowerCase().includes(local.replace(':00','')))
    const source=card.match(/<dt>Source<\/dt><dd>([^<]+)<\/dd>/)[1]
    assert.ok(source.toLowerCase().includes(out.source))
    assert.ok(card.includes(`/app/turnovers#turnover-${stay.turnover.id}`))
   }
   const href=unescape(card.match(/href="([^"]*reservation=[^"]+)"/)[1])
   assert.equal((await h.send(href,undefined,staff.cookie)).status,200)
  }
  assert.equal((await section(h.owner)).includes(`reservation=${cancelled.id}`),false)
  const cleanerPage=await h.send(`/app/readiness?from=${selected}`,undefined,cleaner.cookie)
  assert.ok(!cleanerPage.text.includes('Guest at Eastern Cottage'))
 } finally {await h.close()}
})
