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


test('REPORT-001: filtered mixed-channel reports reconcile occupancy, bases, exceptions and complete exports to permitted sources',()=>run(async h=>{
 const {reportBooks,reportMonth}=await import('./reports-support.mjs'),b=await reportBooks(h,{many:true}),r=await b.report()
 assert.equal(r.totals.calendarNights,62);assert.equal(r.totals.ownerNights,2);assert.equal(r.totals.maintenanceNights,2);assert.equal(r.totals.otherBlockedNights,0);assert.equal(r.totals.availableNights,58)
 assert.equal(r.totals.occupiedNights,15);assert.equal(r.totals.pricedNights,13);assert.equal(r.totals.rentalCents,233334);assert.equal(r.totals.adrCents,Math.round(233334/13));assert.equal(r.totals.revparCents,Math.round(233334/58));assert.equal(r.totals.occupancy,15/58);assert.equal(r.totals.cancellations,1)
 assert.equal(r.totals.grossCents,212500);assert.equal(r.totals.feesCents,2700);assert.equal(r.totals.refundsCents,10000);assert.equal(r.totals.commissionCents,12000);assert.equal(r.totals.expensesCents,12000);assert.equal(r.totals.netCents,175800);assert.equal(r.totals.cleaningCents,7000)
 assert.equal(r.reservations.find(x=>x.id===b.cancel.id).nights,0);assert.equal(r.reservations.find(x=>x.id===b.cancel.id).contractCents,10000)
 assert.equal(r.channels.find(c=>c.channel==='airbnb').nights,4);assert.equal(r.channels.find(c=>c.channel==='vrbo').nights,3);assert.equal(r.performance.find(p=>p.name==='Casey Owner').grossCents,40000)
 assert.ok(r.exceptions.some(e=>e.bookingId===b.unpaid.id&&e.kind==='missing-settlement'));assert.ok(r.exceptions.some(e=>e.bookingId===b.vrbo.id&&e.kind==='collection-due'));assert.ok(r.exceptions.some(e=>e.bookingId===b.unknown.bookingId&&e.kind==='missing-price'));assert.ok(r.exceptions.some(e=>e.kind==='unmatched-payout'))
 assert.ok(r.operations.some(o=>o.kind==='readiness'&&o.bookingId===b.unpaid.id&&o.status!=='ready'));assert.ok(r.operations.some(o=>o.kind==='turnover'));assert.ok(r.operations.some(o=>o.kind==='service'&&o.id===b.task.id&&o.due==='2026-10-25'));assert.ok(r.operations.some(o=>o.kind==='guest-message'))
 assert.equal(r.payouts.length,128);assert.equal(r.journals.filter(j=>j.sourceType==='payout').length,127)
 const state=await h.state(),source=new Map(state.ledger.journals.map(j=>[j.id,j]));assert.equal(r.journals.length,state.ledger.journals.filter(j=>j.effectiveDate>='2026-10-01'&&j.effectiveDate<'2026-11-01').length)
 for(const j of r.journals){assert.deepEqual(j.lines,source.get(j.id).lines);assert.equal(j.netCents,j.grossCents-j.feesCents-j.refundsCents-j.expensesCents-j.commissionCents);assert.equal((await h.send(j.href,undefined,h.owner)).status,200)}
 for(const row of r.reservations){const page=await h.send(row.href,undefined,h.owner);assert.equal(page.status,200,page.text);assert.ok(page.text.includes(row.id))}
 const csv=await h.send('/api/cabin/reports.csv?'+reportMonth,undefined,h.owner);assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);for(const row of [...r.reservations,...r.journals,...r.payouts,...r.operations])assert.ok(csv.text.includes('"'+row.id+'"'),'all selected sources export, including the last row')
 assert.ok(csv.text.includes('"grossCents","212500"'));assert.ok(csv.text.includes('"netCents","175800"'));assert.ok(csv.text.includes('"journal-lines"'));assert.ok(csv.text.includes('"semantics"'))
 const cash=await b.report(reportMonth+'&basis=cash');assert.equal(cash.totals.grossCents,142500);assert.equal(cash.totals.cleaningCents,0);assert.equal(cash.totals.expensesCents,5000);assert.equal(cash.totals.commissionCents,0,'the commission command has no cash leg');assert.equal(cash.totals.netCents,142500-10000-2700-5000,'cash receipts less actual refund, net channel fees and paid expense; payable-only commission and cleaning remain accrual costs')
 const channel=await b.report(reportMonth+'&channel=vrbo');assert.deepEqual(channel.reservations.map(x=>x.id),[b.vrbo.id]);assert.equal(channel.totals.availableNights,58);assert.equal(channel.totals.grossCents,60000);assert.equal(channel.totals.netCents,43000)
 const one=await b.report(reportMonth+'&property='+b.p.id);assert.equal(one.totals.calendarNights,31);assert.equal(one.totals.availableNights,27);assert.equal(one.reservations.some(x=>x.propertyId===b.other.id),false)
 const owner=r.performance.find(o=>o.name==='Casey Owner'),owned=await b.report(reportMonth+'&owner='+owner.id);assert.ok(owned.journals.every(j=>j.ownerKey===owner.id));assert.ok(owned.reservations.every(x=>x.propertyId===b.other.id));assert.equal(owned.totals.grossCents,40000)
 // Booking-date filters use the first local revision, independent of the future stay date.
 const date=r.reservations.find(x=>x.id===b.boundary.id).bookedDate,until=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10),cohort=await b.report('from='+date+'&until='+until+'&dates=booking');assert.ok(cohort.reservations.some(x=>x.id===b.boundary.id));assert.equal(cohort.pace.reduce((n,p)=>n+p.bookings,0),cohort.reservations.length)
 const nov=await b.report('from=2026-11-01&until=2026-11-03&property='+b.other.id);assert.equal(nov.totals.occupiedNights,2);assert.equal(nov.totals.rentalCents,6666,'DST and split-month rounding retain exactly the original 10000 rental cents')
 const manager=await h.person('ReportManager','manager'),cleaner=await h.person('ReportCleaner');assert.equal((await h.send('/app/reports?'+reportMonth,undefined,manager.cookie)).status,200)
 for(const path of ['/app/reports','/api/cabin/reports.json','/api/cabin/reports.csv']){assert.equal((await h.send(path,undefined,cleaner.cookie)).status,403);assert.ok([303,401].includes((await h.send(path)).status))}
 await h.send('/owners/signin',{email:b.p.ownerEmail});const messages=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results.map(row=>JSON.parse(row.message)),mail=messages.find(m=>m.subject.includes('Sign in to your Cabin owner portal')),token=new URL(mail.text.match(/http:\/\/[^\s]+\/owners\/confirm\?token=[^\s]+/)[0]).searchParams.get('token'),rentalOwner=await h.send('/owners/confirm',{token});assert.equal((await h.send('/api/cabin/reports.json',undefined,rentalOwner.cookie)).status,401)
 for(const query of ['from=2026-02-30','from=2026-11-01&until=2026-10-01','basis=unknown','dates=unknown','channel=unknown','property=unknown','owner=unknown'])assert.ok([400,404].includes((await h.send('/api/cabin/reports.json?'+query,undefined,h.owner)).status),query)
 const earned=state.ledger.journals.find(j=>j.sourceType==='earn'&&j.bookingId===b.second.id);await h.cmd('ledger.reverse',{id:earned.id,effectiveDate:'2026-10-31'});const reversed=await b.report();assert.equal(reversed.totals.grossCents,r.totals.grossCents-40000)
 await h.restart();assert.equal((await b.report()).totals.grossCents,reversed.totals.grossCents)
 await h.cmd('member.save',{id:manager.id,revision:manager.revision,name:manager.name,email:manager.email,role:'manager',active:false});assert.ok([401,403].includes((await h.send('/api/cabin/reports.csv?'+reportMonth,undefined,manager.cookie)).status))
}))
