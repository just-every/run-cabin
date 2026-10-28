import { need, text, integer, newId, query, sha, property, exact, type Context } from '../model'
import { post, contextJournals } from '../ledger/store'
import { debit, credit } from '../ledger/types'
import { reviewPeriod, reportPeriod, priorReports, jurisdictions, date, workItems, obligations, baseline } from './calculate'
import { saveReport, saveDelivery, scope } from './store'
import type { TaxData, TaxReport, TaxEvidence, TaxDelivery, Rule } from './types'
export const paid=(data:TaxData,reportId:string,jurisdictionId:string)=>data.evidence.filter(e=>e.reportId===reportId&&e.jurisdictionId===jurisdictionId&&e.kind==='payment').reduce((n,e)=>n+e.amountCents,0)
export async function reportCommand(c:Context,data:TaxData,name:string,p:Record<string,unknown>){
 if(name==='tax.report.prepare'){
  const home=property(c,p.propertyId),period=reviewPeriod(p.month,p.periodKind??'month'),jurisdictionId=p.jurisdictionId&&p.jurisdictionId!=='all'?text(p.jurisdictionId,'jurisdiction'):undefined
  need(!jurisdictionId||jurisdictions(data.config,home.id).some(j=>j.id===jurisdictionId),'Choose a jurisdiction belonging to this property',404)
  const rows=obligations(data,home.id,period,jurisdictionId),sourceIds=new Set(rows.flatMap(o=>o.lines.map(l=>l.sourceId))),ruleIds=new Set(rows.flatMap(o=>o.lines.map(l=>l.ruleId)))
  const sourceRows=data.sources.filter(s=>sourceIds.has(s.id)),rules=[...new Map(sourceRows.flatMap(s=>s.rules).filter(r=>ruleIds.has(r.id)).map(r=>[r.id+':'+r.revision,r])).values()]
  const report:TaxReport={id:newId(),revision:newId(),propertyId:home.id,month:period.start.slice(0,7),period,...(jurisdictionId?{jurisdictionId}:{}),status:'draft',baseline:await baseline(data,c.data,home.id,period,jurisdictionId),obligations:rows,sources:sourceRows,rules,preparedAt:c.now,preparedBy:c.actor.id,priorReportIds:priorReports(data,home.id,period,jurisdictionId).map(r=>r.id),workItems:workItems(data,c.data,home.id,period)}
  saveReport(c,report);return report
 }
 if(!['tax.report.approve','tax.report.deliver','tax.evidence.record'].includes(name))return undefined
 const report=data.reports.find(r=>r.id===text(p.id,'tax review'));need(report,'Tax review not found',404);exact(report,p.revision)
 if(name==='tax.report.approve'){
  need(report.status==='draft','This review is already approved',409)
  need(await baseline(data,c.data,report.propertyId,reportPeriod(report),report.jurisdictionId)===report.baseline,'Tax sources, configuration or reservations changed. Prepare a new review.',409)
  need(!report.workItems.length,'Resolve the work items before approving this review: '+report.workItems.join(' '),409)
  need(report.obligations.length,'There are no unreviewed tax lines in this period',409)
  need(p.confirm==='yes','Confirm the exact source records, separate levies, registrations and filing recipients')
  const ledger=await contextJournals(c)
  for(const o of report.obligations)for(const line of o.lines.filter(l=>l.hostCents)){
   const j=ledger.find(j=>j.id===line.ledgerId)
   need(j&&j.sourceId===line.id&&j.lines.filter(l=>l.account==='taxes').reduce((n,l)=>n+l.creditCents-l.debitCents,0)===line.hostCents&&!ledger.some(r=>r.reversalOf===j.id),'A tax line no longer reconciles to its ledger posting. Record a linked correction.',409)
  }
  report.status='approved';report.approvedAt=c.now;report.approvedBy=c.actor.id
  c.data.approvals.push({id:newId(),kind:'tax-review',recordId:report.id,revision:report.revision,actorId:c.actor.id,at:c.now});saveReport(c,report,true);return report
 }
 need(report.status==='approved','Approve this exact tax review first',409)
 if(name==='tax.report.deliver'){
  need(p.confirm==='yes','Confirm delivery of this reviewed tax packet to the named accountant/filing recipients')
  const out:TaxDelivery[]=[]
  for(const o of report.obligations.filter(o=>!p.jurisdictionId||o.jurisdiction.id===p.jurisdictionId)){const previous=data.deliveries.filter(d=>d.reportId===report.id&&d.jurisdictionId===o.jurisdiction.id)
   if(!p.jurisdictionId&&previous.some(d=>d.status==='sent'))continue
   need(!previous.some(d=>['pending','sending','sent'].includes(d.status)),'A packet is pending, uncertain, or already delivered for this levy. Check its saved delivery record.',409)
   // Failed/uncertain mail is never retried silently: a person explicitly requests another attempt.
   if(previous.length)need(p.checkedProvider==='yes','Check previous delivery with the mail provider before requesting another send',409)
   const row:TaxDelivery={id:newId(),reportId:report.id,jurisdictionId:o.jurisdiction.id,email:o.jurisdiction.recipient,partner:o.jurisdiction.partner,status:'pending',at:c.now,detail:null,digest:await sha(JSON.stringify({reportId:report.id,revision:report.revision,obligation:o,sources:report.sources,rules:report.rules}))}
   saveDelivery(c,row);out.push(row)
  }
  need(out.length,'All selected tax packets have already been sent',409);return out
 }
 const jurisdictionId=text(p.jurisdictionId,'jurisdiction'),o=report.obligations.find(o=>o.jurisdiction.id===jurisdictionId);need(o,'This review has no obligation for that jurisdiction',404)
 const kind=text(p.kind,'evidence type');need(kind==='acknowledgement'||kind==='rejection'||kind==='payment','Choose acknowledgement, rejection or payment')
 need(p.confirm==='yes','Confirm that a human checked the external acknowledgement, rejection or bank payment document')
 need(data.deliveries.some(d=>d.reportId===report.id&&d.jurisdictionId===jurisdictionId&&d.status==='sent'),'Deliver this approved packet before recording external filing evidence',409)
 const reference=text(p.reference,'external evidence reference',300),effectiveDate=date(p.date,'external evidence date'),document=text(p.document,'external document details and custody location',12000)
 const sourceKey=report.propertyId+':'+jurisdictionId+':'+kind+':'+reference
 need(!data.evidence.some(e=>e.jurisdictionId===jurisdictionId&&e.kind===kind&&e.reference===reference),'This evidence reference has already been recorded',409)
 const amount=kind==='payment'?integer(Number(p.amountCents),'paid USD cents',1,Math.max(0,o.hostCents-paid(data,report.id,jurisdictionId))):0
 if(kind==='payment')need(data.evidence.filter(e=>e.reportId===report.id&&e.jurisdictionId===jurisdictionId&&e.kind!=='payment').at(-1)?.kind==='acknowledgement','Record the externally acknowledged filing before payment evidence',409)
 const row:TaxEvidence={id:newId(),reportId:report.id,jurisdictionId,kind,reference,document,date:effectiveDate,amountCents:amount,by:c.actor.id,at:c.now,ledgerIds:[]}
 if(kind==='payment'){
  let remaining=amount,skip=paid(data,report.id,jurisdictionId);const journals=await contextJournals(c)
  for(const line of o.lines.filter(l=>l.hostCents>0)){
   const available=Math.max(0,line.hostCents-skip);skip=Math.max(0,skip-line.hostCents);const allocated=Math.min(available,remaining);if(!allocated)continue
   const original=journals.find(j=>j.id===line.ledgerId);need(original,'Tax source ledger entry not found',409)
   const j=await post(c,{sourceKey:`tax-payment:${row.id}:${line.id}`,propertyId:report.propertyId,bookingId:line.bookingId,ownerKey:original.ownerKey,legalEntity:original.legalEntity,effectiveDate,sourceType:'lodging-tax-payment',sourceId:row.id,sourceRevision:row.id,lines:[debit('taxes',allocated),credit('cash',allocated)]});row.ledgerIds.push(j.id);remaining-=allocated;if(!remaining)break
  }
  need(remaining===0,'Payment does not reconcile to the reviewed host liability',409)
 }
 c.queries.push(query('INSERT INTO cb_tax_evidence(id,report_id,jurisdiction_id,source_key,data) VALUES(?,?,?,?,?)',row.id,row.reportId,row.jurisdictionId,sourceKey,JSON.stringify(row)));scope(c,{...row,propertyId:report.propertyId},kind==='rejection'?'rejected':'completed');return row
}
