import { type Context, manager, need, text, integer, newId, approve } from '../model'
import { managementFor } from '../properties/terms'
import { day } from '../direct/rules'
import { modelFor, costParts, splitCents } from './allocation-calculation'
import { post } from '../ledger/store'
import { debit, credit } from '../ledger/types'
import { sha } from '../model'
import type { SharedCost, FinancialAllocation } from './allocation-types'
export async function costCommand(c:Context,name:string,p:Record<string,unknown>){
 manager(c.actor)
 if(name==='cost.prepare'){
  const shares=typeof p.shares==='string'?p.shares.split(/\r?\n/).filter(v=>v.trim()).map(v=>{const [propertyId,bps,...extra]=v.split(',');need(!extra.length,'Shared costs use property ID,basis points');return {propertyId:propertyId.trim(),bps:Number(bps)}}):p.shares
  need(Array.isArray(shares)&&shares.length>0&&shares.length<=40,'Choose the homes sharing this invoice')
  need(shares.every(s=>c.data.properties.some(home=>home.id===s.propertyId)&&Number.isSafeInteger(s.bps)&&s.bps>0)&&shares.reduce((n,s)=>n+s.bps,0)===10000&&new Set(shares.map(s=>s.propertyId)).size===shares.length,'Unique property shares must total 10,000 basis points')
  need(['repair','passThrough','tax'].includes(String(p.category)),'Choose repair, pass-through or tax')
  const invoice=text(p.invoice,'invoice reference',200)
  need(!c.data.sharedCosts.some(r=>r.invoice.toLowerCase()===invoice.toLowerCase()&&r.status==='approved'),'This invoice is already approved',409)
  const row:SharedCost={id:newId(),revision:newId(),propertyId:shares[0].propertyId,date:day(p.date),description:text(p.description,'expense description',500),invoice,evidence:text(p.evidence,'attached invoice text and evidence',20000),agreementIds:shares.map(s=>managementFor(c.data,s.propertyId,day(p.date)).id),category:p.category as SharedCost['category'],shares,amountCents:integer(Number(p.amountCents),'invoice cents',1,100_000_000),status:'draft',preparedAt:c.now,preparedBy:c.actor.id}
  for(const share of row.shares)need(modelFor(managementFor(c.data,share.propertyId,row.date)).mapping.reviewedBy,'Every home needs accountant-reviewed allocation terms for the invoice date.',409)
  c.data.sharedCosts.push(row);c.entityId=row.id;return row
 }
 need(name==='cost.approve','Unknown expense command',404)
 const row=c.data.sharedCosts.find(r=>r.id===p.id);need(row,'Invoice not found',404)
 need(!c.data.sharedCosts.some(r=>r.id!==row.id&&r.invoice.toLowerCase()===row.invoice.toLowerCase()&&r.status==='approved'),'This invoice is already approved',409)
 // Approval binds the agreement versions reviewed at preparation, including every shared home.
 need(JSON.stringify(row.agreementIds)===JSON.stringify(p.agreementIds)&&JSON.stringify(p.agreementIds)===JSON.stringify(row.shares.map(s=>managementFor(c.data,s.propertyId,row.date).id)),'Review the current agreements for every shared home before approving.',409)
 approve(c,'shared-cost',row,p.revision)
 const amounts=splitCents(row.amountCents,row.shares.map(s=>s.bps))
 for(const [i,share] of row.shares.entries()){
  const terms=managementFor(c.data,share.propertyId,row.date),model=modelFor(terms),managerBears=row.category==='passThrough'?model.passThrough==='manager':row.category==='tax'?model.taxExpense==='manager':false
  const allocation:FinancialAllocation={id:newId(),revision:newId(),propertyId:share.propertyId,bookingId:'',period:row.date.slice(0,7),agreementId:terms.id,terms:structuredClone(terms),kind:'cost',sourceIds:[row.id],baseline:row.revision,description:row.description,evidence:row.evidence,totalCents:amounts[i],rentCents:0,passThroughCents:0,taxCents:0,managerCostCents:managerBears?amounts[i]:0,parts:costParts(terms,managerBears?0:amounts[i]),status:'approved',preparedAt:c.now,preparedBy:c.actor.id,approval:row.approval}
  c.data.financialAllocations.push(allocation)
  const portions=managerBears?[{ownerEmail:terms.ownerEmail,amount:amounts[i],manager:true}]:allocation.parts.map(o=>({ownerEmail:o.ownerEmail,amount:o.expenseCents,manager:false}))
  for(const [j,part] of portions.entries())if(part.amount)await post(c,{sourceKey:`shared-cost:${row.id}:${i}:${j}`,propertyId:share.propertyId,bookingId:'',effectiveDate:row.date,sourceType:'agreement-expense',sourceId:allocation.id,sourceRevision:allocation.revision,ownerKey:await sha(part.ownerEmail.toLowerCase()),lines:[debit(part.manager?'managerExpenses':'ownerLiability',part.amount),credit('vendorPayable',part.amount)]})
 }
 c.entityId=row.id;return row
}
