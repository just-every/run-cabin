import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'
import {pantryEdge} from './pantry-edge.mjs'
const pantry=pantryEdge()

test('channel payouts match stays, freeze expenses, email the owner, isolate their portal and post once to Pantry',()=>run(async h=>{
 const p=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Alex Carter',ownerEmail:'alex@stay.example',commissionBps:2000})
 const other=await h.cmd('property.save',{name:'Sandy Shores',ownerName:'Sam Lee',ownerEmail:'sam@stay.example',commissionBps:1500})
 const calendar=(uid,start,end)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
 for(const [home,uid,channel,start,end] of [[p,'HM123ABC','Airbnb','20261001','20261005'],[p,'VR123456','Vrbo','20261007','20261010'],[other,'OTHER123','Airbnb','20261001','20261005']]){
  const d=await h.cmd('calendar.prepare',{propertyId:home.id,channel,calendar:calendar(uid,start,end)});await h.cmd('calendar.approve',{id:d.id,revision:d.revision})
 }
 const csv='Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n10/06/2026,Reservation,HM123ABC,10/01/2026,4,USD,1000.00,30.00,970.00,AB-PAYOUT-1\n'
 await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:csv.replace('970.00','960.00')},h.owner,400)
 const first=await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv});assert.equal(first.matched,1)
 const repeat=await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv});assert.equal(repeat.imported.length,0);assert.equal(repeat.duplicates.length,1)
 await h.cmd('payout.import',{propertyId:p.id,source:'vrbo',csv:'Date,Type,Reservation ID,Check-in,Check-out,Currency,Gross booking amount,Commission,Processing fee,Net amount,Payout ID\n10/11/2026,Reservation,VR123456,10/07/2026,10/10/2026,USD,500.00,25.00,15.00,460.00,VR-PAYOUT-1\n'})
 const draft=await h.cmd('statement.prepare',{propertyId:p.id,month:'2026-10',expenses:[{description:'Replacement linens paid from owner funds',amountCents:5000}]})
 assert.equal(draft.grossCents,150000);assert.equal(draft.channelFeeCents,7000);assert.equal(draft.managementFeeCents,30000);assert.equal(draft.expenseCents,5000);assert.equal(draft.netCents,108000)
 await h.cmd('statement.approve',{id:draft.id,revision:'stale'},h.owner,409)
 await h.cmd('statement.approve',{id:draft.id,revision:draft.revision})
 const approved=(await h.state()).statements.find(s=>s.id===draft.id);assert.equal(approved.status,'approved');assert.equal((await h.state()).deliveries.at(-1).status,'sent')
 const mail=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r=>JSON.parse(r.message))
 assert.ok(mail.some(m=>m.to.includes(p.ownerEmail)&&m.text.includes(`/owners?statement=${draft.id}`)))
 const login=async email=>{
  assert.equal((await h.send('/owners/signin',{email})).status,200)
  const messages=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results.map(r=>JSON.parse(r.message))
  const m=messages.find(m=>m.to.includes(email)&&m.subject.includes('Sign in to your Cabin owner portal'));assert.ok(m)
  const link=new URL(m.text.match(/http:\/\/[^\s]+\/owners\/confirm\?token=[^\s]+/)[0])
  const confirm=await h.send('/owners/confirm',{token:link.searchParams.get('token')});assert.equal(confirm.status,303)
  assert.equal((await h.send('/owners/confirm',{token:link.searchParams.get('token')})).status,401)
  return confirm.cookie
 }
 const a=await login(p.ownerEmail),b=await login(other.ownerEmail)
 const state=(await h.send('/owners/api/state',undefined,a)).value
 assert.deepEqual(state.properties.map(p=>p.id),[p.id]);assert.equal(state.bookings.length,2);assert.deepEqual(state.statements.map(s=>s.id),[draft.id]);assert.ok(!JSON.stringify(state).includes(other.id))
 assert.equal((await h.send('/owners/statements/'+draft.id+'.csv',undefined,a)).status,200)
 assert.equal((await h.send('/owners/statements/'+draft.id+'.csv',undefined,b)).status,404)
 assert.equal((await h.send('/owners/api/state',undefined,h.owner)).status,401)
 assert.equal((await h.send('/api/cabin/state',undefined,a)).status,401)
 assert.equal((await h.send('/api/cabin/command',{name:'property.save',input:{}},a)).status,401)
 await h.cmd('books.connect',{origin:'https://books.example.com',token:'pantry_integration_'+'a'.repeat(64)})
 const mapping={id:draft.id,revision:draft.revision,clearingAccountId:'clearing',ownerAccountId:'owner-funds',managementAccountId:'management'}
 const posted=await h.cmd('books.sync',mapping);assert.equal(posted.status,'posted');assert.equal(posted.evidenceStatus,'attached');assert.ok(posted.batchId)
 assert.equal((await h.cmd('books.sync',mapping)).batchId,posted.batchId)
 assert.equal((await h.cmd('books.refresh',{id:posted.id})).batchId,posted.batchId)
 assert.equal(pantry.journalWrites,1);assert.equal(pantry.entries.length,1);assert.equal(pantry.documents.length,1)
 assert.equal(pantry.entries[0].lines.filter(l=>l.account_id==='owner-funds').reduce((n,l)=>n+l.credit_cents-l.debit_cents,0),draft.netCents)
 pantry.revoke();const broken=(await h.state()).books;assert.equal(broken.connected,false);assert.equal(broken.status,'broken');assert.match(broken.error,/invalid or revoked/)
 const exported=await h.cmd('books.export.prepare',{id:draft.id,revision:draft.revision,clearingName:'Payout clearing',ownerName:'Rental owner funds',managementName:'Management income'});assert.equal(exported.status,'exported')
 const iif=await h.send('/api/cabin/books/'+exported.id+'.iif',undefined,h.owner);assert.equal(iif.status,200);assert.equal(iif.text.split('\r\n').filter(l=>/^(TRNS|SPL)\t/.test(l)).reduce((n,l)=>n+Math.round(Number(l.split('\t')[6])*100),0),0)
 assert.equal((await h.send('/api/cabin/books/'+exported.id+'.csv',undefined,a)).status,401)
 const frozen=(await h.send('/owners/statements/'+draft.id+'.csv',undefined,a)).text
 await h.cmd('property.save',{...p,ownerName:'Alex updated',commissionBps:1000})
 assert.equal((await h.send('/owners/statements/'+draft.id+'.csv',undefined,a)).text,frozen)
 await h.cmd('property.save',{...(await h.state()).properties.find(r=>r.id===p.id),ownerEmail:other.ownerEmail})
 assert.equal((await h.send('/owners/statements/'+draft.id+'.csv',undefined,a)).status,404)
 assert.equal((await h.send('/owners/statements/'+draft.id+'.csv',undefined,b)).status,404)
},{outbound:request=>pantry.fetch(request)}))
