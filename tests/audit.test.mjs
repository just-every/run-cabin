import { erase } from './privacy-flow.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'

test('AUDIT-001: a stay has portable attributable history past the view window and erasure preserves anonymized actions',()=>run(async h=>{
 const home=await h.cmd('property.save',{name:'Cedar Creek Lodge',ownerName:'Morgan Lee',ownerEmail:'morgan@stay.example',commissionBps:2000})
 const cleaner=await h.person('Taylor')
 const request=await h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',kind:'stay',start:'2026-11-01',end:'2026-11-05',guestName:'Ana Ruiz',guestEmail:'ana@stay.example'})
 const bookingId=request.bookingId,s=await h.accessState(),code=s.codes.find(c=>c.bookingId===bookingId&&c.holder==='guest')
 assert.equal((await h.send('/stay/'+code.link)).status,200)
 const inbox=await h.send('/app/inbox',undefined,h.owner),thread=inbox.text.match(/name="thread" value="([^"]+)"/)?.[1];assert.ok(thread)
 await h.cmd('message.compose',{thread,subject:'Arrival question',text:'Private guest discussion about the late arrival'})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Cedar Creek Rentals LLC'})
 await h.cmd('ledger.post',{propertyId:home.id,bookingId,operation:'refund',amountCents:7500,effectiveDate:'2026-11-05',sourceId:'refund-1105',sourceRevision:'statement-1'})
 const key=await h.cmd('agent.create',{label:'Reservations drafting'})
 const draft=await h.send('/api/cabin/agent/command',{name:'turnover.prepare',input:{bookingId,cleanerId:cleaner.id,checklist:['Beds made']}},'',{authorization:'Bearer '+key.token});assert.equal(draft.status,200)
 await h.cmd('turnover.approve',{id:draft.value.result.id,revision:draft.value.result.revision})
 const maintenance=await h.cmd('task.raise',{turnoverId:draft.value.result.id,title:'Patio lamp needs repair',note:'Bulb is flickering',blocking:false})
 await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv:'Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n11/06/2026,Reservation,AUDIT-STAY,11/01/2026,4,USD,1000.00,30.00,970.00,AUDIT-PAYOUT\n'})
 const statement=await h.cmd('statement.prepare',{propertyId:home.id,month:'2026-11'})
 await h.cmd('statement.approve',{id:statement.id,revision:statement.revision})
 const get=async path=>{const r=await h.send(path,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value}
 const first=(await get('/api/cabin/activity')).events.at(-1)
 let moved=false
 for(let n=0;n<150;n++){await h.cmd('booking.details',{id:bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===bookingId).revision,guestName:'Ana Ruiz '+n,guestEmail:'ana@stay.example'});if(!(await get('/api/cabin/activity')).events.some(e=>e.id===first.id)){moved=true;break}}
 assert.ok(moved,'history extends beyond one displayed page')
 const exported=await h.send('/api/cabin/activity.jsonl',undefined,h.owner);assert.equal(exported.status,200)
 const events=exported.text.trim().split('\n').map(JSON.parse);assert.ok(events.some(e=>e.id===first.id));assert.ok(events.some(e=>e.actorKind==='agent'&&e.actorKeyId===key.id));assert.ok(events.some(e=>e.action==='guest.access.release'&&e.bookingId===bookingId));assert.ok(events.some(e=>e.entityKind==='ledger-journal'&&e.bookingId===bookingId));assert.ok(events.some(e=>e.action==='statement.provider.result'&&e.bookingId===bookingId&&e.result==='sent'));assert.ok(events.some(e=>e.action==='task.raise'&&e.bookingId===bookingId&&e.result===maintenance.status),'history must retain the unfinished task state')
 assert.ok(!exported.text.includes('ana@stay.example'));assert.ok(!exported.text.includes('Private guest discussion'));assert.ok(!exported.text.includes(code.link));assert.ok(!exported.text.includes(key.token))
 const current=(await h.accessState()).bookings.find(b=>b.id===bookingId)
 await erase(h,{entity:'guest',id:bookingId,revision:current.revision})
 assert.equal((await h.send('/stay/'+code.link)).status,404)
 const erasedState=await h.accessState();assert.ok(!erasedState.bookings.find(b=>b.id===bookingId).guestEmail);assert.ok(erasedState.messages.filter(m=>m.bookingId===bookingId).every(m=>!m.text&&!m.email))
 await h.cmd('booking.details',{id:bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===bookingId).revision,guestName:'Ana Ruiz',guestEmail:'ana@stay.example'},h.owner,409)
 const after=await h.send('/api/cabin/activity.jsonl',undefined,h.owner),history=after.text.trim().split('\n').map(JSON.parse),old=history.find(e=>e.id===events.find(e=>e.action==='guest.access.release').id)
 assert.match(old.bookingId,/^erased:/);assert.equal(old.action,'guest.access.release');assert.equal(old.at,events.find(e=>e.id===old.id).at);assert.ok(!after.text.includes('ana@stay.example')&&!after.text.includes('Private guest discussion'))
 assert.ok((await get('/api/cabin/activity?booking='+encodeURIComponent(old.bookingId))).events.length)
 assert.equal((await h.send('/api/cabin/activity',undefined,cleaner.cookie)).status,403);assert.equal((await h.send('/api/cabin/activity.jsonl',undefined,cleaner.cookie)).status,403)
 assert.equal((await h.send('/app/activity',undefined,h.owner)).status,200)
 const native=(await h.accessState(cleaner.cookie)).actor,changed=await h.send('/auth/operator/role',{operatorId:native.id,role:'admin'},h.owner);assert.equal(changed.status,200)
 const authorization=await get('/api/cabin/activity?action=authority.role.result');assert.ok(authorization.events.some(e=>e.entityId===native.id&&e.facts.role==='admin'&&e.sourceRevision))
}))
