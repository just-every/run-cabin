import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'

test('monthly lodging tax keeps separate levies, source-recorded channel collection, exempt/refunded tax, exact reviews and external evidence',()=>run(async h=>{
 const home=await h.cmd('property.save',{name:'Maine tax cabin',ownerName:'Tax Owner',ownerEmail:'tax-owner@stay.example',commissionBps:2000})
 const other=await h.cmd('property.save',{name:'Mountain tax cabin',ownerName:'Other Owner',ownerEmail:'other-tax@stay.example',commissionBps:2000})
 const unsupported=await h.cmd('property.save',{name:'Unconfigured home',ownerName:'Third Owner',ownerEmail:'third-tax@stay.example',commissionBps:2000})
 const configure=async(property,state,county,city,rates)=>{
  await h.cmd('ledger.configure',{propertyId:property.id,legalEntity:'Cabin trust'})
  await h.cmd('tax.profile.save',{propertyId:property.id,country:'US',state,county,city})
  const saved=[]
  for(const [i,level] of ['state','county','city'].entries()){
   const jurisdiction=await h.cmd('tax.jurisdiction.save',{propertyId:property.id,level,registrationStatus:rates[i]?'active':'not-required',registrationReference:'Registration evidence '+level,partner:'Reviewed tax accountant',recipient:'accountant@stay.example',source:'Accountant authorization and registration document in owner custody'})
   const rule=await h.cmd('tax.rule.save',{jurisdictionId:jurisdiction.id,taxType:'lodging',bps:rates[i],from:'2026-01-01',until:'2026-12-31',source:'Owner-supplied effective rule and taxable fee treatment, accountant reviewed'})
   saved.push({jurisdiction,rule})
  }
  return saved
 }
 const rules=await configure(home,'Maine','Example County','Unincorporated',[900,200,0])
 const otherRules=await configure(other,'Colorado','Example Mountain County','Example City',[500,0,100])
 const booking=async(property,channel,start,end)=> (await h.cmd('reservation.request',{propertyId:property.id,channel,start,end,guestName:'Tax guest'})).bookingId
 const direct=await booking(home,'direct','2026-10-01','2026-10-05'),ota=await booking(home,'airbnb','2026-10-10','2026-10-14'),second=await booking(other,'direct','2026-10-03','2026-10-05')
 const unknown=await booking(unsupported,'direct','2026-10-03','2026-10-05')
 await h.cmd('tax.source.preview',{bookingId:unknown,baseCents:100000,exemptCents:0},h.owner,409)
 const source=async(id,base,exempt,ref,channelAmounts)=>{
  const preview=await h.cmd('tax.source.preview',{bookingId:id,baseCents:base,exemptCents:exempt,...(exempt?{exemptionEvidence:'Exempt occupancy certificate retained, partial eligible rent'}:{})})
  return h.cmd('tax.source.record',{bookingId:id,baseCents:base,exemptCents:exempt,...(exempt?{exemptionEvidence:'Exempt occupancy certificate retained, partial eligible rent'}:{}),previewDigest:preview.previewDigest,reference:ref,document:'Actual receipt / channel settlement document kept in owner custody',collections:preview.assessed.map(r=>({ruleId:r.rule.id,month:r.month,channelCents:channelAmounts[r.jurisdiction.level]??0})),confirm:'yes'})
 }
 const stalePreview=await h.cmd('tax.source.preview',{bookingId:direct,baseCents:100000,exemptCents:0})
 const changedRule=await h.cmd('tax.rule.save',{...rules[0].rule,bps:950,source:'Reviewed correction before a source was approved'})
 await h.cmd('tax.source.record',{bookingId:direct,baseCents:100000,exemptCents:0,previewDigest:stalePreview.previewDigest,reference:'STALE-PREVIEW',document:'Document reviewed against the previous rate',collections:stalePreview.assessed.map(r=>({ruleId:r.rule.id,month:r.month,channelCents:0})),confirm:'yes'},h.owner,409)
 await h.cmd('tax.rule.save',{...changedRule,bps:900,source:'Accountant confirmed the original test rate'})
 const directSource=await source(direct,100000,0,'DIRECT-RECEIPT',{})
 const otaSource=await source(ota,100000,20000,'OTA-SETTLEMENT',{state:7200})
 await source(second,100000,0,'SECOND-RECEIPT',{})
 const before=await h.cmd('tax.report.prepare',{propertyId:home.id,month:'2026-10'})
 for(const line of otaSource.lines)await h.cmd('tax.adjust',{lineId:line.id,taxCents:Math.floor(line.taxCents/2),channelCents:Math.floor(line.channelCents/2),baseCents:50000,exemptCents:10000,effectiveDate:'2026-10-15',reference:'OTA-REFUND-'+line.level,reason:'Actual partial refund receipt, channel returned state tax; host returned county tax',confirm:'yes'})
 await h.cmd('tax.report.approve',{id:before.id,revision:before.revision,confirm:'yes'},h.owner,409)
 const report=await h.cmd('tax.report.prepare',{propertyId:home.id,month:'2026-10'})
 assert.deepEqual(report.workItems,[])
 const stateLevy=report.obligations.find(o=>o.jurisdiction.level==='state'),countyLevy=report.obligations.find(o=>o.jurisdiction.level==='county')
 assert.equal(stateLevy.taxCents,12600);assert.equal(stateLevy.channelCents,3600);assert.equal(stateLevy.hostCents,9000)
 assert.equal(countyLevy.hostCents,2800)
 await h.cmd('tax.report.approve',{id:report.id,revision:'stale',confirm:'yes'},h.owner,409)
 await h.cmd('tax.report.approve',{id:report.id,revision:report.revision,confirm:'yes'})
 await h.cmd('tax.evidence.record',{id:report.id,revision:report.revision,jurisdictionId:stateLevy.jurisdiction.id,kind:'acknowledgement',reference:'UNDELIVERED',date:'2026-10-31',document:'Not yet delivered',confirm:'yes'},h.owner,409)
 await h.cmd('tax.report.deliver',{id:report.id,revision:report.revision,confirm:'yes'})
 const state=await h.state(),deliveries=state.taxes.deliveries.filter(d=>d.reportId===report.id)
 assert.equal(deliveries.length,3);assert.ok(deliveries.every(d=>d.status==='sent'))
 const mail=(await h.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').all()).results.map(r=>JSON.parse(r.message))
 assert.ok(mail.some(m=>m.to.includes('accountant@stay.example')&&m.text.includes(report.id)&&m.text.includes(directSource.source.reference)))
 const evidence=async(o,kind,reference,amountCents=0)=>h.cmd('tax.evidence.record',{id:report.id,revision:report.revision,jurisdictionId:o.jurisdiction.id,kind,reference,date:'2026-10-31',document:'Human-checked external document and custody location '+reference,amountCents,confirm:'yes'})
 await evidence(stateLevy,'acknowledgement','STATE-FILING-CONFIRMATION')
 await evidence(countyLevy,'rejection','COUNTY-REJECTION')
 await h.cmd('tax.evidence.record',{id:report.id,revision:report.revision,jurisdictionId:countyLevy.jurisdiction.id,kind:'payment',reference:'NO-ACCEPTANCE',date:'2026-10-31',document:'Payment document',amountCents:2800,confirm:'yes'},h.owner,409)
 const payment=await evidence(stateLevy,'payment','STATE-BANK-PAYMENT',9000);assert.ok(payment.ledgerIds.length)
 await h.cmd('tax.evidence.record',{id:report.id,revision:report.revision,jurisdictionId:stateLevy.jurisdiction.id,kind:'payment',reference:'STATE-OVERPAY',date:'2026-10-31',document:'Duplicate payment document',amountCents:1,confirm:'yes'},h.owner,400)
 const ledger=(await h.state()).ledger.journals.filter(j=>j.propertyId===home.id)
 assert.equal(ledger.flatMap(j=>j.lines).filter(l=>l.account==='taxes').reduce((n,l)=>n+l.creditCents-l.debitCents,0),2800)
 const exported=await h.send(`/api/cabin/taxes/${report.id}.json`,undefined,h.owner);assert.equal(exported.status,200);assert.equal(exported.value.evidence.length,3)
 const frozen=JSON.stringify(exported.value.obligations)
 const originalRule=(await h.state()).taxes.config.find(r=>r.id===rules[0].rule.id)
 await h.cmd('tax.rule.save',{...originalRule,bps:950,source:'New accountant correction source'})
 assert.equal(JSON.stringify((await h.send(`/api/cabin/taxes/${report.id}.json`,undefined,h.owner)).value.obligations),frozen)
 const secondReview=await h.cmd('tax.report.prepare',{propertyId:other.id,month:'2026-10'})
 assert.equal(secondReview.obligations.find(o=>o.jurisdiction.level==='state').hostCents,5000);assert.equal(secondReview.obligations.find(o=>o.jurisdiction.level==='city').hostCents,1000)
 const cleaner=await h.person('TaxCleaner')
 assert.equal((await h.send(`/api/cabin/taxes/${report.id}.json`,undefined,cleaner.cookie)).status,403)
 assert.deepEqual((await h.state(cleaner.cookie)).taxes.sources,[])
 assert.equal((await h.send('/app/taxes',undefined,h.owner)).status,200)
 assert.equal((await h.send(`/api/cabin/taxes/${report.id}.json`)).status,401)
 assert.ok((await h.state()).taxes.workItems.some(i=>i.includes(unsupported.name)))
}))
