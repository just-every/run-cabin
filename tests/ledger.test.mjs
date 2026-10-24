import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from './harness.mjs'

test('FIN-001: reservation funds remain balanced, scoped and source-linked through a closed-period correction',()=>run(async h=>{
 const home=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Morgan Lee',ownerEmail:'morgan@stay.example',commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Pine Ridge Rentals LLC'})
 const reservation=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',start:'2026-11-01',end:'2026-11-05',guestName:'Alex Rivera',kind:'stay'})
 const base={propertyId:home.id,bookingId:reservation.bookingId,effectiveDate:'2026-11-05',sourceRevision:'document-1'}
 const post=(operation,amountCents,extra={})=>h.cmd('ledger.post',{...base,operation,amountCents,sourceId:'document-'+operation,...extra})
 await post('deposit',100000);const earned=await post('earn',100000);await post('applyAdvance',100000)
 await post('tax',9000);await post('payment',9000);await post('channelFee',3000);await post('expense',10000);await post('refund',7500);await post('hold',25000);await post('releaseHold',25000);await post('commission',20000)
 await post('deposit',100000)
 await h.cmd('ledger.post',{...base,operation:'deposit',amountCents:1,sourceId:'document-deposit'},h.owner,409)
 const other=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Casey',ownerEmail:'casey@stay.example',commissionBps:1000})
 await h.cmd('ledger.configure',{propertyId:other.id,legalEntity:'Lake Loft LLC'})
 await h.cmd('ledger.post',{...base,propertyId:other.id,operation:'deposit',amountCents:100,sourceId:'wrong-owner'},h.owner,409)
 await h.cmd('ledger.close',{month:'2026-11'})
 await h.cmd('ledger.post',{...base,operation:'earn',amountCents:1,sourceId:'closed'},h.owner,409)
 await h.cmd('ledger.reverse',{id:earned.id,effectiveDate:'2026-11-06'},h.owner,409)
 await h.cmd('property.save',{...home,ownerName:'New owner',ownerEmail:'new@stay.example'})
 const reversed=await h.cmd('ledger.reverse',{id:earned.id,effectiveDate:'2026-12-01'})
 assert.equal(reversed.ownerKey,earned.ownerKey);assert.equal(reversed.legalEntity,earned.legalEntity)
 assert.deepEqual(reversed.lines,earned.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents})))
 await h.cmd('ledger.reverse',{id:earned.id,effectiveDate:'2026-12-01'},h.owner,409)
 const corrected=await post('earn',90000,{effectiveDate:'2026-12-01',sourceRevision:'document-2'})
 assert.equal(corrected.ownerKey,earned.ownerKey);assert.equal(corrected.correctionOf,earned.id)
 const ledger=(await h.state()).ledger
 for(const j of ledger.journals){assert.equal(j.lines.reduce((n,l)=>n+l.debitCents,0),j.lines.reduce((n,l)=>n+l.creditCents,0));assert.ok(j.propertyId&&j.bookingId&&j.ownerKey&&j.legalEntity&&j.sourceId&&j.sourceRevision&&j.actorId&&j.postedAt)}
 const csv=await h.send('/api/cabin/ledger.csv',undefined,h.owner);assert.equal(csv.status,200);assert.ok(csv.text.includes(earned.id)&&csv.text.includes(reversed.id))
 const cleaner=await h.person('Taylor');await h.cmd('ledger.post',{...base,operation:'deposit',amountCents:1,sourceId:'unauthorized'},cleaner.cookie,403)
 assert.equal((await h.send('/api/cabin/ledger.csv',undefined,cleaner.cookie)).status,403)
 assert.deepEqual((await h.state(cleaner.cookie)).ledger.journals,[])
 assert.equal((await h.send('/app/ledger',undefined,h.owner)).status,200)
}))

test('a matched channel receipt posts its actual net cash and owner fee once',()=>run(async h=>{
 const home=await h.cmd('property.save',{name:'Cedar Creek Lodge',ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Cedar Creek Rentals LLC'})
 const d=await h.cmd('calendar.prepare',{propertyId:home.id,channel:'airbnb',calendar:'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:HM123ABC\r\nDTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261005\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'})
 await h.cmd('calendar.approve',{id:d.id,revision:d.revision})
 const csv='Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n10/06/2026,Reservation,HM123ABC,10/01/2026,4,USD,1000.00,30.00,970.00,AB-PAYOUT-1\n'
 const imported=await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv})
 await h.cmd('payout.import',{propertyId:home.id,source:'airbnb',csv})
 const rows=(await h.state()).ledger.journals;assert.equal(rows.length,1);assert.equal(rows[0].sourceId,imported.imported[0].id)
 assert.equal(rows[0].lines.filter(l=>l.account==='cash').reduce((n,l)=>n+l.debitCents-l.creditCents,0),97000)
 assert.equal(rows[0].lines.filter(l=>l.account==='ownerLiability').reduce((n,l)=>n+l.creditCents-l.debitCents,0),97000)
}))


test('trust accounts reconcile bank, ledger and owner controls and reserve only the approved owner’s funds without executing transfers',{timeout:120000},async()=>{
 const {bankingJourney}=await import('./banking-support.mjs');await bankingJourney()
})

test('financial exception cases pursue split-payment fee and refund sources, reject and exactly approve a linked frozen-statement correction without inventing a distribution',{timeout:120000},async()=>{
 const {exceptionJourney}=await import('./financial-exceptions-support.mjs');for(const legacy of [false,true])await exceptionJourney({legacy})
})
