import { type Context, type Statement, type StatementLine, type Property, need, newId, sha } from '../model'
import { allocationTerms } from '../properties/terms'
/** Statements consume frozen allocations; saving richer terms must never quietly use the legacy gross-only formula. */
export async function allocatedStatement(c:Context,p:Record<string,unknown>,prop:Property,month:string):Promise<Statement|undefined>{
 const payouts=c.data.payouts.filter(r=>r.propertyId===prop.id&&r.date.startsWith(month)&&!r.statementId)
 if(!payouts.some(r=>r.bookingId&&allocationTerms(c.data,c.data.bookings.find(b=>b.id===r.bookingId)!).allocation))return undefined
 need(p.expenses===undefined||Array.isArray(p.expenses)&&!p.expenses.length,'Add evidenced costs through Shared invoice approval; do not enter the same cost twice.',409)
 const allocations=c.data.financialAllocations.filter(a=>a.propertyId===prop.id&&a.status==='approved'&&(a.kind==='cost'?a.period===month:a.kind==='revenue'&&a.sourceIds.some(id=>payouts.some(p=>p.id===id))))
 const revenue=allocations.filter(a=>a.kind==='revenue'),ids=revenue.flatMap(a=>a.sourceIds)
 need(payouts.length&&payouts.every(p=>p.match==='matched'&&ids.filter(id=>id===p.id).length===1)&&ids.every(id=>payouts.some(p=>p.id===id)),'Approve exact revenue allocations for every matched payout in this month before preparing its statement.',409)
 const lines:StatementLine[]=allocations.flatMap(a=>a.parts.flatMap(part=>[
  ...(part.grossCents?[{description:`${part.ownerName} · receipts · allocation ${a.id}`,amountCents:part.grossCents,category:'gross' as const,bookingId:a.bookingId||undefined,managementAgreementId:a.agreementId,commissionBps:a.terms.commissionBps}]:[]),
  ...(part.channelFeeCents?[{description:`${part.ownerName} · channel fees`,amountCents:-part.channelFeeCents,category:'channelFee' as const}]:[]),
  ...(part.expenseCents?[{description:`${part.ownerName} · ${a.description} · invoice ${a.sourceIds.join(', ')}`,amountCents:-part.expenseCents,category:'expense' as const}]:[])
 ]))
 const sum=(key:'grossCents'|'channelFeeCents'|'managementFeeCents'|'taxCents'|'reserveCents'|'expenseCents'|'payableCents')=>allocations.reduce((n,a)=>n+a.parts.reduce((n,part)=>n+part[key],0),0)
 const owners=new Map<string,{name:string;email:string;payableCents:number;reserveCents:number}>()
 for(const a of allocations)for(const part of a.parts){const prior=owners.get(part.ownerEmail)??{name:part.ownerName,email:part.ownerEmail,payableCents:0,reserveCents:0};prior.payableCents+=part.payableCents;prior.reserveCents+=part.reserveCents;owners.set(part.ownerEmail,prior)}
 const terms=revenue[0].terms
 return {id:newId(),revision:newId(),propertyId:prop.id,propertyRevision:prop.revision,propertyName:prop.name,ownerName:terms.ownerName,ownerEmail:terms.ownerEmail,month,source:'allocated',lines,payoutIds:payouts.map(p=>p.id),allocationIds:allocations.map(a=>a.id),sourceBaseline:await sha(JSON.stringify({payouts,allocations})),channelFeeCents:sum('channelFeeCents'),settlementCents:sum('grossCents')-sum('channelFeeCents'),expenseCents:sum('expenseCents'),commissionBps:terms.commissionBps,grossCents:sum('grossCents'),managementFeeCents:sum('managementFeeCents'),taxCents:sum('taxCents'),reserveCents:sum('reserveCents'),ownerAllocations:[...owners.values()],netCents:sum('payableCents'),status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
}
export async function approveAllocatedStatement(c:Context,row:Statement){
 const payouts=c.data.payouts.filter(p=>p.propertyId===row.propertyId&&p.date.startsWith(row.month)&&!p.statementId)
 const allocations=c.data.financialAllocations.filter(a=>row.allocationIds?.includes(a.id))
 need(allocations.every(a=>a.status==='approved')&&await sha(JSON.stringify({payouts,allocations}))===row.sourceBaseline,'Payouts or allocations changed; prepare a fresh statement.',409)
 for(const payout of payouts)payout.statementId=row.id
}
