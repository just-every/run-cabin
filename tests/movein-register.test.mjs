import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'

const header='external_id,name,owner_name,owner_email,commission_bps'
const row=(id,name=id)=>`${id},${name},Morgan Lee,MORGAN@stay.example,1500`
async function form(h,name,input){
 const response=await h.mf.dispatchFetch(`${h.origin}/app/action?name=${name}&returnTo=/app/import`,{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input).toString()})
 const text=await response.text();assert.equal(response.status,200,text);return text
}
async function finish(h,id,result){
 for(let n=0;n<6&&['queued','applying','undoing','rolling_back'].includes(result.job.state);n++)result=await h.cmd('import.resume',{id})
 return result
}

test('MIGRATE-001: reviewed property rows, exact source custody, resumable publication and durable safe reversal',()=>run(async h=>{
 const csv='\uFEFF'+header+'\r\n'+Array.from({length:13},(_,i)=>row(`register-${i}`,i===0?'  Lake House  ':`Home ${i}`)).join('\r\n')+'\r\n'+row('bad-email').replace('MORGAN@stay.example','invalid')+'\r\n'+row('register-0','Duplicate')+'\r\nmissing,cells\r\n'
 const before=await h.state()
 let page=await form(h,'import.preview',{csv})
 let state=await h.state(),review=state.importJobs.find(j=>j.status==='review')
 assert.equal(state.properties.length,0);assert.equal(state.members.length,before.members.length);assert.equal(state.bookings.length,0);assert.equal(state.connections.length,0)
 assert.equal(review.properties.length,13);assert.equal(review.properties[0].name,'Lake House');assert.equal(review.properties[0].ownerEmail,'morgan@stay.example')
 assert.deepEqual(review.diagnostics.map(d=>d.location.row),[15,16,17])
 page=(await h.send('/app/import',undefined,h.owner)).text
 assert.ok(page.includes(review.fingerprint));assert.ok(page.includes('Lake House'));assert.ok(page.includes(review.diagnostics[0].message))
 await h.cmd('import.approve',{id:review.id,fingerprint:'changed'},h.owner,409)
 await form(h,'import.approve',{id:review.id,fingerprint:review.fingerprint})
 state=await h.state();assert.equal(state.properties.length,10)
 assert.ok(state.approvals.some(a=>a.kind==='import'&&a.recordId===review.id&&a.revision===review.fingerprint&&a.actorId&&a.at))
 assert.equal(state.statements.length,0);assert.equal(state.payouts.length,0);assert.equal(state.bookings.length,0);assert.equal(state.members.length,before.members.length)
 let result=await finish(h,review.id,await h.cmd('import.resume',{id:review.id}));assert.equal(result.job.state,'completed')
 await h.cmd('import.approve',{id:review.id,fingerprint:review.fingerprint});assert.equal((await h.state()).properties.length,13)
 let journal=await h.cmd('import.journal',{id:review.id})
 const source=journal.originals.find(o=>o.name==='properties.csv')
 assert.equal(Buffer.from(source.original.base64,'base64').toString('utf8'),csv)
 assert.ok(journal.batches.some(b=>b.action==='apply'));assert.equal(journal.job.checkpoint,13)
 page=await form(h,'import.journal',{id:review.id});assert.ok(page.includes('properties.csv'))
 state=await h.state();const home=id=>state.properties.find(p=>p.id===`register-${id}`)
 await h.cmd('property.save',{...home(0),name:'Native correction'})
 const calendar='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:register-stay\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261104\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
 const draft=await h.cmd('calendar.prepare',{propertyId:home(1).id,channel:'Airbnb',calendar});await h.cmd('calendar.approve',{id:draft.id,revision:draft.revision})
 await h.cmd('owner.policy',{propertyId:home(2).id,calendarVisibility:'availability',expenseLimitCents:20000,maxStayNights:7,noticeDays:0,agreement:'Owner reviewed management terms'})
 await h.cmd('tax.profile.save',{propertyId:home(3).id,country:'US',state:'FL',county:'Monroe',city:'Key West'})
 result=await finish(h,review.id,await h.cmd('import.undo',{id:review.id}));assert.equal(result.job.state,'undone')
 state=await h.state();assert.equal(state.properties.length,4);assert.equal(home(0).name,'Native correction');assert.ok(state.bookings.some(b=>b.uid==='register-stay'))
 journal=await h.cmd('import.journal',{id:review.id})
 assert.equal(journal.report.dispositions.length,13)
 assert.ok(journal.report.dispositions.some(d=>d.targetId===home(0).id&&d.disposition==='retained'&&d.reason==='edited'))
 for(const id of [1,2,3])assert.ok(journal.report.dispositions.some(d=>d.targetId===home(id).id&&d.disposition==='retained'&&d.protectedBy.length))
 page=await form(h,'import.journal',{id:review.id});assert.ok(page.includes(home(0).id));assert.ok(page.includes('retained'))
 // Erasure retires the shared original while unrelated imported native work survives.
 const erased=home(1),pending=await h.cmd('import.preview',{csv:header+'\n'+row(erased.id)+'\n'})
 await h.cmd('privacy.erase',{entity:'property',id:erased.id,revision:erased.revision})
 journal=await h.cmd('import.journal',{id:review.id})
 assert.ok(journal.originals.every(o=>o.original.status==='unavailable'&&!o.original.base64))
 assert.ok(!(await h.state()).importJobs.some(j=>j.id===pending.id))
 assert.equal((await h.state()).properties.find(p=>p.id===home(0).id).name,'Native correction')
 const refused=await h.cmd('import.preview',{csv:header+'\n'+row(erased.id)+'\n'})
 assert.ok(refused.conflicts.some(c=>c.reason==='erased_identity'))
 await h.cmd('import.approve',{id:refused.id,fingerprint:refused.fingerprint},h.owner,409)
}))

test('MIGRATE-001: collision, malformed source and authority guards refuse publication through public doors',()=>run(async h=>{
 const csv=header+'\n'+row('collision')+'\n',a=await h.cmd('import.preview',{csv}),b=await h.cmd('import.preview',{csv})
 await h.cmd('import.approve',{id:a.id,fingerprint:a.fingerprint})
 await h.cmd('import.approve',{id:b.id,fingerprint:b.fingerprint},h.owner,409)
 const colliding=await h.cmd('import.preview',{csv});assert.ok(colliding.conflicts.some(c=>c.reason==='existing_property'))
 const invalid=await h.cmd('import.preview',{csv:header+'\n'+row('bad').replace('1500','1.5')+'\n'})
 assert.equal(invalid.properties.length,0);assert.equal(invalid.diagnostics.length,1)
 await h.cmd('import.approve',{id:invalid.id,fingerprint:invalid.fingerprint},h.owner,409)
 for(const malformed of ['wrong,headers\n',header+'\n"unclosed',header+'\n'+row('nul')+'\0'])await h.cmd('import.preview',{csv:malformed},h.owner,422)
 const manager=await h.person('Registermanager','manager'),cleaner=await h.person('Registercleaner'),key=await h.cmd('agent.create',{label:'Register assistant'})
 for(const [name,input] of [['import.preview',{csv}],['import.approve',{id:b.id,fingerprint:b.fingerprint}],['import.resume',{id:a.id}],['import.journal',{id:a.id}],['import.undo',{id:a.id}]]){
  for(const person of [manager,cleaner])await h.cmd(name,input,person.cookie,403)
  const response=await h.send('/api/cabin/agent/command',{name,input},'',{authorization:`Bearer ${key.token}`});assert.equal(response.status,403)
 }
 assert.equal((await h.send('/api/cabin/command',{name:'import.undo',input:{id:a.id}},'',{authorization:`Bearer ${key.token}`})).status,401)
 assert.equal((await h.state()).properties.length,1)
}))
