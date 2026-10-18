import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
import { attestArrival } from './readiness-helpers.mjs'
const day = n => new Date(Date.now()+n*86400000).toISOString().slice(0,10)
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
  t=(await h.state()).turnovers.find(t=>t.bookingId===prev.bookingId)
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
