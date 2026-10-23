import { requireOriginalSettlementSources } from './exceptions/source-guards'
import { type Context, type Booking, manager, need, text, integer, exact, newId, sha, approve } from '../model'
import { allocationTerms } from '../properties/terms'
import { day } from '../direct/rules'
import { modelFor, revenueParts } from './allocation-calculation'
import { post, contextJournals } from '../ledger/store'
import { debit, credit } from '../ledger/types'
import type { FinancialAllocation } from './allocation-types'
import { costCommand } from './cost-commands'
const money=(v:unknown,label:string)=>integer(Number(v??0),label,0,100_000_000)
function sources(c:Context,b:Booking){return c.data.payouts.filter(p=>p.bookingId===b.id&&p.match==='matched')}
async function baseline(c:Context,b:Booking){return sha(JSON.stringify({booking:b,payouts:sources(c,b)}))}
/** The original settlement credits its frozen primary owner. Reclassify only, never invent cash. */
async function postRevenue(c:Context,row:FinancialAllocation){
 const net=row.parts.reduce((n,p)=>n+p.grossCents-p.channelFeeCents,0),effectiveDate=day(c.now.slice(0,10))
 if(net)await post(c,{sourceKey:'allocation:'+row.id+':source',propertyId:row.propertyId,bookingId:row.bookingId,effectiveDate,sourceType:'agreement-allocation',sourceId:row.id,sourceRevision:row.revision,ownerKey:await sha(row.terms.ownerEmail.toLowerCase()),lines:[debit('ownerLiability',net),credit('allocationClearing',net-row.taxCents),...(row.taxReceivableCents?[credit('receivable',row.taxReceivableCents)]:[]),...(row.taxCents-(row.taxReceivableCents??0)?[credit('taxes',row.taxCents-(row.taxReceivableCents??0))]:[])]})
 for(const [i,p] of row.parts.entries()){
  const lines=[debit('allocationClearing',p.grossCents-p.channelFeeCents-p.taxCents),...(p.payableCents?[p.payableCents>0?credit('ownerLiability',p.payableCents):debit('ownerLiability',-p.payableCents)]:[]),...(p.managementFeeCents?[credit('managerRevenue',p.managementFeeCents)]:[]),...(p.reserveCents?[credit('ownerReserves',p.reserveCents)]:[])]
  if(lines.some(l=>l.debitCents||l.creditCents))await post(c,{sourceKey:`allocation:${row.id}:${i}`,propertyId:row.propertyId,bookingId:row.bookingId,effectiveDate,sourceType:'agreement-allocation',sourceId:row.id,sourceRevision:row.revision,ownerKey:await sha(p.ownerEmail),lines})
 }
}
export async function allocationCommand(c:Context,name:string,p:Record<string,unknown>){
 if(name.startsWith('cost.'))return costCommand(c,name,p)
 if(!name.startsWith('allocation.'))return undefined
 manager(c.actor)
 if(name==='allocation.prepare'){
  const booking=c.data.bookings.find(b=>b.id===p.bookingId&&b.status==='confirmed'&&b.kind!=='block');need(booking,'Choose a confirmed guest stay',404)
  need(!c.data.financialAllocations.some(a=>a.bookingId===booking.id&&a.kind==='revenue'&&a.status==='approved'),'This stay already has a frozen revenue allocation. Earlier allocations cannot be rewritten.',409)
  const payouts=sources(c,booking);need(payouts.length,'Import and match the reservation’s settled receipts before allocating.',409)
  await requireOriginalSettlementSources(c,payouts.map(p=>p.id))
  const terms=allocationTerms(c.data,booking);need(modelFor(terms).mapping.reviewedBy,'Save an accountant-reviewed allocation model in this stay’s management agreement before allocating.',409)
  const gross=payouts.reduce((n,p)=>n+p.grossCents,0),fees=payouts.reduce((n,p)=>n+p.feeCents,0)
  need(gross>0&&fees>=0&&gross>=fees,'Resolve refunds or negative settlement exceptions before allocating this stay.',409)
  const rent=money(p.rentCents,'rent cents'),passThrough=money(p.passThroughCents,'pass-through receipts cents'),tax=money(p.taxCents,'collected tax cents')
  const postedTax=(await contextJournals(c)).filter(j=>j.bookingId===booking.id&&['tax','lodging-tax','lodging-tax-adjustment'].includes(j.sourceType)).flatMap(j=>j.lines).filter(l=>l.account==='receivable').reduce((n,l)=>n+l.debitCents-l.creditCents,0)
  need(postedTax>=0&&postedTax<=tax,'Existing tax postings exceed the collected tax breakdown. Reconcile the tax evidence before allocation.',409)
  const row:FinancialAllocation={id:newId(),revision:newId(),propertyId:booking.propertyId,bookingId:booking.id,period:booking.start.slice(0,7),agreementId:terms.id,terms:structuredClone(terms),kind:'revenue',sourceIds:payouts.map(p=>p.id),baseline:await baseline(c,booking),description:'Matched reservation receipts',evidence:text(p.evidence,'receipt breakdown source / evidence',10000),totalCents:gross,rentCents:rent,passThroughCents:passThrough,taxCents:tax,taxReceivableCents:postedTax,managerCostCents:0,parts:revenueParts(terms,gross,fees,rent,passThrough,tax),status:'draft',preparedAt:c.now,preparedBy:c.actor.id}
  c.data.financialAllocations.push(row);c.entityId=row.id;return row
 }
 need(name==='allocation.approve','Unknown allocation command',404)
 const row=c.data.financialAllocations.find(a=>a.id===p.id);need(row&&row.kind==='revenue','Revenue allocation not found',404);exact(row,p.revision)
 const booking=c.data.bookings.find(b=>b.id===row.bookingId);need(booking&&await baseline(c,booking)===row.baseline,'Reservation or receipts changed. Prepare the allocation again.',409)
 need(!c.data.financialAllocations.some(a=>a.id!==row.id&&a.bookingId===row.bookingId&&a.kind==='revenue'&&a.status==='approved'),'This stay already has an approved allocation',409)
 await requireOriginalSettlementSources(c,row.sourceIds)
 approve(c,'financial-allocation',row,p.revision);await postRevenue(c,row);c.entityId=row.id;return row
}
