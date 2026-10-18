import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './harness.mjs'
const calendar=(uid,n)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:202609${n}\r\nDTEND;VALUE=DATE:202609${String(Number(n)+2).padStart(2,'0')}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
const csv=(id,ref,amount='100.00',fee='5.00',net='95.00',type='payment',date='2026-09-20')=>`Transaction ID,Payout ID,Reservation ID,Date,Currency,Gross amount,Fee amount,Net amount,Type\n${id},${id.startsWith('txn_')?'po_September':'BATCH-SEPT'},${ref},${date},USD,${amount},${fee},${net},${type}\n`

test('FIN-004: ledger close refuses missing evidence, freezes all four providers, schedules once and supplements corrections',()=>run(async h=>{
 const p=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen Reed',ownerEmail:'karen@stay.example',commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Lake Rentals trust'})
 for(const [uid,channel,n] of [['AIRBNB123','Airbnb','01'],['VRBO12345','Vrbo','05'],['BOOKING123','Booking.com','10']]){
  const d=await h.cmd('calendar.prepare',{propertyId:p.id,channel,calendar:calendar(uid,n)});await h.cmd('calendar.approve',{id:d.id,revision:d.revision})
 }
 const direct=await h.cmd('reservation.create',{propertyId:p.id,method:'manual',channel:'direct',sourceId:'DIRECT123',guestName:'Megan Ortiz',guestEmail:'megan@stay.example',start:'2026-09-15',end:'2026-09-18',rentCents:10000,policyName:'Refundable',retainedBps:0,noShowBps:0})
 await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-09'},h.owner,409)
 const air='Date,Type,Confirmation code,Currency,Gross earnings,Host service fee,Amount,Payout ID,Transaction ID\n2026-09-20,Reservation,AIRBNB123,USD,100.00,5.00,95.00,AIR-SEPT,AIR-TX1\n'
 await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:air})
 await h.cmd('payout.import',{propertyId:p.id,source:'vrbo',csv:'Date,Type,Reservation ID,Currency,Gross booking amount,Commission,Net amount,Payout ID\n2026-09-20,Reservation,VRBO12345,USD,100.00,5.00,95.00,VR-SEPT\n'})
 const booking={propertyId:p.id,source:'booking.com',evidenceReference:'Accountant reviewed Booking.com September payout report',csv:csv('BOOK-TX1','BOOKING123','50.00','2.50','47.50')+csv('BOOK-TX2','BOOKING123','50.00','2.50','47.50').split('\n').slice(1).join('\n')}
 await h.cmd('payout.import',{...booking,csv:csv('BOOK-TX1','BOOKING123','100.00','5.00','94.00')},h.owner,400)
 await h.cmd('payout.import',booking);assert.equal((await h.cmd('payout.import',booking)).imported.length,0)
 await h.cmd('payout.import',{...booking,csv:booking.csv.replace('50.00','51.00').replace('47.50','48.50')},h.owner,409)
 await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-09'},h.owner,409)
 await h.cmd('payout.import',{propertyId:p.id,source:'stripe',evidenceReference:'Stripe September automatic USD settlement',csv:csv('txn_direct','DIRECT123')})
 await h.cmd('payout.import',{propertyId:p.id,source:'stripe',evidenceReference:'Stripe September refunded settlement',csv:csv('txn_refund','DIRECT123','-10.00','-0.50','-9.50','refund')})
 const ledger=async(op,amount,date='2026-09-21')=>h.cmd('ledger.post',{propertyId:p.id,bookingId:direct.id,operation:op,amountCents:amount,effectiveDate:date,sourceId:op+'-evidence',sourceRevision:'1'})
 await ledger('earn',2500,'2026-08-31')
 await ledger('commission',8000);await ledger('tax',1000);await ledger('expense',1500);await ledger('refund',2000);await ledger('distribution',5000)
 const draft=await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-09'})
 assert.equal(draft.close.openingCents,2500);assert.equal(draft.close.receipts.length,6);assert.equal(new Set(draft.payoutIds).size,6)
 assert.equal(draft.netCents,23050);assert.equal(draft.close.distributionsCents,5000);assert.equal(draft.close.refundsCents,2950)
 const expense=await ledger('expense',1500) // exact replay doesn't change journals
 assert.equal((await h.cmd('statement.approve',{id:draft.id,revision:draft.revision})).status,'approved')
 await h.cmd('statement.approve',{id:draft.id,revision:draft.revision},h.owner,409)
 const frozen=(await h.send(`/api/cabin/statements/${draft.id}.csv`,undefined,h.owner)).text
 assert.ok(frozen.includes('booking.com'));assert.ok(frozen.includes('Stripe September automatic USD settlement'))
 const pdf=await h.mf.dispatchFetch(h.origin+`/api/cabin/statements/${draft.id}.pdf`,{headers:{cookie:h.owner}});assert.equal(pdf.status,200);const before=Buffer.from(await pdf.arrayBuffer())
 if(process.env.CABIN_PDF_PROOF)await (await import('node:fs/promises')).writeFile(process.env.CABIN_PDF_PROOF,before)
 await h.cmd('ledger.reverse',{id:expense.id,effectiveDate:'2026-10-01'})
 await h.cmd('property.save',{...p,ownerEmail:'sam@stay.example'})
 const correction=await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-10',statementOwnerEmail:'karen@stay.example'})
 assert.equal(correction.close.openingCents,23050);assert.equal(correction.netCents,24550);assert.deepEqual(correction.close.adjustsStatementIds,[draft.id])
 await h.cmd('statement.approve',{id:correction.id,revision:correction.revision})
 await h.send('/owners/signin',{email:'karen@stay.example'})
 const mails=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results.map(r=>JSON.parse(r.message))
 const login=mails.find(m=>m.to.includes('karen@stay.example')&&m.text.includes('/owners/confirm?'))
 const token=new URL(login.text.match(/http:\/\/[^\s]+\/owners\/confirm\?token=[^\s]+/)[0]).searchParams.get('token')
 const owner=(await h.send('/owners/confirm',{token})).cookie
 const portal=await h.send('/owners?statement='+correction.id,undefined,owner);assert.ok(portal.text.includes(`/owners/statements/${correction.id}.pdf`))
 assert.equal((await h.send(`/owners/statements/${correction.id}.pdf`,undefined,owner)).status,200)
 assert.equal((await h.send(`/owners/statements/${draft.id}.pdf`,undefined,owner)).status,404) // a new grant covers only its exact statement
 const after=await h.mf.dispatchFetch(h.origin+`/api/cabin/statements/${draft.id}.pdf`,{headers:{cookie:h.owner}})
 assert.deepEqual(Buffer.from(await after.arrayBuffer()),before);assert.equal((await h.send(`/api/cabin/statements/${draft.id}.csv`,undefined,h.owner)).text,frozen)
 await h.cmd('ledger.post',{propertyId:p.id,bookingId:direct.id,operation:'refund',amountCents:100,effectiveDate:'2026-10-02',sourceId:'later-refund-evidence',sourceRevision:'1'})
 await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-10',statementOwnerEmail:'karen@stay.example'},h.owner,409)
 const supplement=await h.cmd('statement.close.prepare',{propertyId:p.id,month:'2026-10',statementOwnerEmail:'karen@stay.example',adjustmentOf:correction.id})
 assert.equal(supplement.close.openingCents,24550);assert.equal(supplement.close.movementCents,-100);assert.equal(supplement.netCents,24450);assert.equal(supplement.close.journals.length,1)
 await h.cmd('statement.approve',{id:supplement.id,revision:supplement.revision})
 // Native schedule requires current owner authority; review policy never silently releases a draft.
 const scheduledHome=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Alex Carter',ownerEmail:'alex@stay.example',commissionBps:0})
 await h.cmd('ledger.configure',{propertyId:scheduledHome.id,legalEntity:'Pine trust'})
 const future=await h.cmd('reservation.create',{propertyId:scheduledHome.id,method:'phone',sourceId:'PHONE-APRIL',guestName:'Avery Brooks',start:'2027-04-01',end:'2027-04-05',rentCents:10000,policyName:'Refundable'})
 await h.cmd('ledger.post',{propertyId:scheduledHome.id,bookingId:future.id,operation:'earn',amountCents:10000,effectiveDate:'2026-08-10',sourceId:'recognized-income-evidence',sourceRevision:'1'})
 await h.cmd('statement.schedule',{propertyId:scheduledHome.id,nextMonth:'2026-08',day:1,time:'00:00',policy:'release',enabled:true})
 const auto=(await h.state()).statements.find(s=>s.propertyId===scheduledHome.id&&s.month==='2026-08');assert.equal(auto.status,'approved');assert.equal((await h.state()).deliveries.filter(d=>d.statementId===auto.id).length,1)
 const schedule=await h.cmd('statement.schedule',{propertyId:p.id,statementOwnerEmail:'karen@stay.example',nextMonth:'2026-08',day:1,time:'00:00',policy:'review',enabled:true})
 let state=await h.state();assert.equal(state.statementSchedules.find(s=>s.id===p.id).nextMonth,'2026-09');const generated=state.statements.find(s=>s.propertyId===p.id&&s.month==='2026-08');assert.equal(generated.status,'draft')
 await h.mf.getWorker().then(w=>w.scheduled());state=await h.state();assert.equal(state.statements.filter(s=>s.propertyId===p.id&&s.month==='2026-08').length,1);assert.ok(state.statementSchedules.find(s=>s.id===p.id).error)
 assert.equal((await h.send('/app/statements',undefined,h.owner)).status,200)
}))
