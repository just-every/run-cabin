import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'
const model=(owners,extra={})=>({commissionBase:'netRent',fixedFeeCents:1000,reserveBps:1000,ownerUseCleaningCents:8000,passThrough:'owner',taxExpense:'owner',owners,mapping:{owner:'Owner payable',manager:'Management revenue',reserve:'Owner reserves',tax:'Lodging tax payable',vendor:'Vendor payable',reviewedBy:'Pat Accountant'},...extra})
const owners=[{name:'Karen Lee',email:'karen@stay.example',bps:6000},{name:'Morgan Lee',email:'morgan@stay.example',bps:4000}]
const calendar=(uid,start,end)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
async function home(h,name,email){const p=await h.cmd('property.save',{name,ownerName:name+' owner',ownerEmail:email,commissionBps:2000});await h.cmd('ledger.configure',{propertyId:p.id,legalEntity:'Lake Homes LLC'});return p}
async function terms(h,p,allocation,effectiveFrom='2026-01-01'){return h.cmd('property.terms',{propertyId:p.id,propertyRevision:p.revision,effectiveFrom,ownerName:p.ownerName,ownerEmail:p.ownerEmail,commissionBps:2000,terms:'Signed management agreement',allocation})}
async function stay(h,p,uid,start,end){const d=await h.cmd('calendar.prepare',{propertyId:p.id,channel:'airbnb',calendar:calendar(uid,start,end)});await h.cmd('calendar.approve',{id:d.id,revision:d.revision});return (await h.state()).bookings.find(b=>b.uid===uid)}

test('FIN-003: frozen revenue allocations explain commission bases, fixed fees, tax, reserves and multiple owners across amendments',()=>run(async h=>{
 const p=await home(h,'Lake Loft','karen@stay.example'),t=await terms(h,p,model(owners)),b=await stay(h,p,'HM-1','20261001','20261005')
 await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:'Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n10/06/2026,Reservation,HM-1,10/01/2026,4,USD,1200.00,30.00,1170.00,SETTLEMENT-1\n'})
 const input={bookingId:b.id,rentCents:100000,passThroughCents:10000,taxCents:10000,evidence:'Channel itemized receipt: rent 1000, cleaning 100, lodging tax 100'}
 await h.cmd('allocation.prepare',{...input,rentCents:90000},h.owner,400)
 const draft=await h.cmd('allocation.prepare',input)
 assert.equal(draft.agreementId,t.id);assert.equal(draft.parts.reduce((n,p)=>n+p.managementFeeCents,0),20400)
 assert.equal(draft.parts.reduce((n,p)=>n+p.reserveCents,0),8660)
 assert.equal(draft.parts.reduce((n,p)=>n+p.payableCents,0),77940)
 await h.cmd('allocation.approve',{id:draft.id,revision:'stale'},h.owner,409)
 await h.cmd('allocation.approve',{id:draft.id,revision:draft.revision})
 await h.cmd('allocation.approve',{id:draft.id,revision:draft.revision},h.owner,409)
 const statement=await h.cmd('statement.prepare',{propertyId:p.id,month:'2026-10'})
 assert.equal(statement.netCents,77940);assert.equal(statement.reserveCents,8660);assert.equal(statement.ownerAllocations.length,2)
 await h.cmd('statement.approve',{id:statement.id,revision:statement.revision})
 const csv=await h.send('/api/cabin/statements/'+statement.id+'.csv',undefined,h.owner);assert.equal(csv.status,200);assert.ok(csv.text.includes('karen@stay.example'))
 const frozen=(await h.state()).financialAllocations.find(a=>a.id===draft.id)
 assert.equal(frozen.parts.find(p=>p.ownerEmail===owners[0].email).payableCents,46764)
 const journals=(await h.state()).ledger.journals.filter(j=>j.sourceType==='agreement-allocation')
 assert.equal(journals.length,3)
 const report=(await h.send('/api/cabin/reports.json?from=2026-10-01&until=2026-11-01',undefined,h.owner)).value
 assert.equal(report.totals.grossCents,120000);assert.equal(report.totals.feesCents,3000);assert.equal(report.totals.commissionCents,20400);assert.equal(report.totals.taxCents,10000);assert.equal(report.totals.netCents,86600)
 assert.equal(report.performance.find(o=>o.name==='Karen Lee').grossCents,72000);const beneficiary=report.performance.find(o=>o.name==='Morgan Lee');assert.equal(beneficiary.grossCents,48000);assert.equal(beneficiary.netCents,34640)
 const scoped=(await h.send('/api/cabin/reports.json?from=2026-10-01&until=2026-11-01&owner='+beneficiary.id,undefined,h.owner)).value
 assert.equal(scoped.reservations.length,1);assert.ok(scoped.reservations[0].ownerKeys.includes(beneficiary.id));assert.equal(scoped.totals.grossCents,48000);assert.equal(scoped.totals.netCents,34640)

 // An explicitly invited co-owner reads and receives only their recorded interest.
 const coowner=await h.cmd('member.save',{name:'Morgan Lee',email:owners[1].email,pmsRole:'rental_owner',propertyIds:[p.id],actions:['owners:read'],active:true})
 await h.cmd('member.invite',{id:coowner.id});const coownerSession=await h.signIn(owners[1].email)
 const native=await h.send('/app',undefined,coownerSession);assert.equal(native.status,200,native.text);assert.ok(!native.text.includes('Karen Lee'))
 const definition=await h.cmd('report.save',{name:'Co-owner monthly interest',filters:{from:'2026-10-01',until:'2026-11-01',property:p.id}}),schedule=await h.cmd('report.schedule',{savedReportId:definition.id,savedReportRevision:definition.revision,recipientKind:'owner',recipientEmail:owners[1].email,period:'saved-window',cadence:'once',format:'json',nextRunAt:new Date(Date.now()+86400000).toISOString(),consent:true})
 const due=new Date(Date.now()-60000).toISOString();await h.db.prepare("UPDATE cb_report_schedules SET next_run_at=?,data=json_set(data,'$.nextRunAt',?) WHERE id=?").bind(due,due,schedule.id).run();await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
 const sharing=(await h.send('/api/cabin/report-sharing.json',undefined,h.owner)).value,run=sharing.reportRuns.find(r=>r.scheduleId===schedule.id);assert.equal(run.status,'sent')
 await h.send('/owners/signin',{email:owners[1].email});const mail=JSON.parse((await h.db.prepare("SELECT message FROM rer_mail_development_outbox WHERE instr(message,'Sign in to your Cabin owner portal')>0 ORDER BY sequence DESC LIMIT 1").first()).message),token=new URL(mail.text.match(/http:\/\/[^\s]+\/owners\/confirm\?token=[^\s]+/)[0]).searchParams.get('token'),session=(await h.send('/owners/confirm',{token})).cookie
 const file=await h.send('/owners/reports/'+run.id,undefined,session);assert.equal(file.status,200,file.text);const own=JSON.parse(file.text)
 assert.ok(own.journals.every(j=>j.ownerKey===beneficiary.id));assert.equal(own.totals.grossCents,48000);assert.equal(own.reservations[0].contractCents,null);assert.equal(own.payouts.length,0);assert.ok(!file.text.includes('Karen Lee'));assert.ok(own.exceptions.some(e=>e.kind==='missing-price'))
 const question={question:'Why did my owner net change?',filters:{from:'2026-10-01',until:'2026-11-01',property:p.id}}
 for(const [path,cookie] of [['/owners/questions',session],['/app/rental-owner/questions',coownerSession]]){const answer=await h.send(path,question,cookie);assert.equal(answer.status,200,answer.text);assert.equal(answer.value.reports[0].totals.grossCents,48000);assert.equal(answer.value.reports[0].totals.netCents,34640);assert.ok(!answer.text.includes('Karen Lee'));assert.ok(!answer.value.citations.some(c=>c.kind==='payout'));for(const c of answer.value.citations.filter(c=>c.kind==='journal'))assert.ok(c.detail.includes('agreement-allocation'))}
 await h.cmd('member.save',{...coowner,active:false});assert.equal((await h.send('/owners/reports/'+run.id,undefined,session)).status,401);assert.equal((await h.send('/app',undefined,coownerSession)).status,403)

 for(const j of journals)assert.equal(j.lines.reduce((n,l)=>n+l.debitCents-l.creditCents,0),0)
 assert.equal(journals.flatMap(j=>j.lines).filter(l=>l.account==='allocationClearing').reduce((n,l)=>n+l.debitCents-l.creditCents,0),0)
 await terms(h,p,model([{name:'New Owner',email:'new@stay.example',bps:10000}],{fixedFeeCents:5000,reserveBps:0}),'2026-11-01')
 const later=await stay(h,p,'HM-2','20261101','20261105');assert.notEqual(later.managementTerms.id,t.id)
 assert.deepEqual((await h.state()).financialAllocations.find(a=>a.id===draft.id),frozen)
 const cleaner=await h.person('Luis');const restricted=await h.state(cleaner.cookie);assert.equal(restricted.financialAllocations.length,0);assert.equal(restricted.sharedCosts.length,0)
 await h.cmd('allocation.prepare',input,cleaner.cookie,403)
 for(const path of ['/app/people','/app/statements'])assert.equal((await h.send(path,undefined,h.owner)).status,200)
}))

test('FIN-003: shared invoice approval binds accountant-reviewed agreements and allocates each cent with immutable evidence',()=>run(async h=>{
 const p=await home(h,'Lake Loft','karen@stay.example'),q=await home(h,'Pine Ridge','sam@stay.example')
 const a=await terms(h,p,model(owners)),b=await terms(h,q,model([{name:'Sam',email:'sam@stay.example',bps:10000}],{taxExpense:'manager'}))
 const input={date:'2026-10-19',invoice:'Acme / repair 481',description:'Shared water pump repair',amountCents:10001,category:'repair',shares:[{propertyId:p.id,bps:7000},{propertyId:q.id,bps:3000}],evidence:'Invoice 481: pump parts $75.01 + labor $25.00; both homes share pump. Accountant approved property mapping.'}
 const draft=await h.cmd('cost.prepare',input)
 await h.cmd('cost.approve',{id:draft.id,revision:draft.revision,agreementIds:[b.id,a.id]},h.owner,409)
 await h.cmd('cost.approve',{id:draft.id,revision:draft.revision,agreementIds:[a.id,b.id]})
 const rows=(await h.state()).financialAllocations.filter(a=>a.sourceIds.includes(draft.id))
 assert.deepEqual(rows.map(a=>a.totalCents),[7001,3000]);assert.deepEqual(rows[0].parts.map(p=>p.expenseCents),[4201,2800])
 assert.equal(rows.reduce((n,a)=>n+a.parts.reduce((n,p)=>n+p.expenseCents,0),0),10001)
 assert.ok(rows.every(a=>a.evidence===input.evidence&&a.terms.allocation.mapping.reviewedBy==='Pat Accountant'))
 await h.cmd('cost.prepare',input,h.owner,409)
 const stale=await h.cmd('cost.prepare',{...input,invoice:'Acme / repair 482'})
 await terms(h,q,model([{name:'Sam',email:'sam@stay.example',bps:10000}],{fixedFeeCents:2000}),'2026-10-01')
 await h.cmd('cost.approve',{id:stale.id,revision:stale.revision,agreementIds:stale.agreementIds},h.owner,409)
 const ledger=(await h.state()).ledger.journals.filter(j=>j.sourceType==='agreement-expense')
 assert.equal(ledger.reduce((n,j)=>n+j.lines.filter(l=>l.account==='vendorPayable').reduce((n,l)=>n+l.creditCents,0),0),10001)
}))
