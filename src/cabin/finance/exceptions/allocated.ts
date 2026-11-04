import { type Context, need, newId, sha } from '../../model'
import { debit, credit } from '../../ledger/types'
import { revenueParts } from '../allocation-calculation'
import { revenuePostings } from '../allocation-commands'
import type { SourceLine } from '../sources'
import type { caseEvidence } from './evidence'
import type { FinancialCase } from './types'

type Evidence=Awaited<ReturnType<typeof caseEvidence>>
/** A missing fee replaces the entire frozen revenue group, never its terms or tax basis. */
export async function allocatedFeePlan(c:Context,e:Evidence,payout:Evidence['payouts'][number],source:SourceLine,id:string,sourceDigest:string,effectiveDate:string):Promise<Pick<FinancialCase['proposals'][number],'journalGroup'|'allocation'>>{
 if(!e.agreement?.allocation&&!e.allocations.length)return {}
 const revenues=e.allocations.filter(a=>a.kind==='revenue'&&a.status==='approved')
 need(revenues.length===1,'Review the single original approved revenue allocation before correcting an allocated receipt',409)
 const original=revenues[0]
 need(!original.correctionOf&&original.sourceIds.includes(payout.id)&&original.propertyId===payout.propertyId&&JSON.stringify(original.terms)===JSON.stringify(e.agreement),'The original frozen allocation agreement and settlement scope must be unchanged',409)
 need(payout.grossCents>0&&payout.feeCents===0&&source.grossCents===payout.grossCents&&source.feeCents>0&&source.netCents>=0&&source.netCents===source.grossCents-source.feeCents&&source.date===payout.date&&source.start===payout.start&&source.end===payout.end,'Allocated corrections support only an explicit missing fee with unchanged gross, dates and tax basis',409)
 need(e.payouts.length===original.sourceIds.length&&new Set(original.sourceIds).size===original.sourceIds.length&&e.payouts.every(p=>original.sourceIds.includes(p.id)&&p.match==='matched'&&p.grossCents>0),'Review the complete unchanged settlement group; refunds and added receipts need separate accounting review',409)
 const primary=await sha(original.terms.ownerEmail.toLowerCase())
 const payouts=original.sourceIds.map(id=>{
  const p=e.payouts.find(p=>p.id===id)!,j=e.journals.find(j=>j.sourceKey==='payout:'+id)
  need(j&&j.sourceType==='payout'&&j.ownerKey===primary&&j.lines.every(l=>['cash','ownerLiability','channelFees'].includes(l.account)),'The entire allocation needs native cash settlement postings in its original owner scope',409)
  return {p,j}
 })
 const expected=await revenuePostings(original,effectiveDate),actual=e.journals.filter(j=>j.sourceType==='agreement-allocation'&&j.sourceId===original.id)
 const entity=payouts[0].j.legalEntity
 need(actual.length===expected.length&&expected.every(input=>actual.some(j=>j.sourceKey===input.sourceKey&&j.sourceRevision===original.revision&&j.ownerKey===input.ownerKey&&JSON.stringify(j.lines)===JSON.stringify(input.lines.filter(l=>l.debitCents||l.creditCents)))),'The complete original allocation journal group must match its frozen calculation',409)
 const group=[...payouts.map(v=>v.j),...actual]
 need(group.every(j=>j.propertyId===original.propertyId&&j.bookingId===original.bookingId&&j.legalEntity===entity&&!e.journals.some(r=>r.reversalOf===j.id||r.correctionOf===j.id))&&e.ledgerSetting?.legalEntity===entity,'Affected journals must be unreversed in the unchanged home and legal entity',409)
 const fees=e.payouts.reduce((n,p)=>n+(p.id===payout.id?source.feeCents:p.feeCents),0)
 const allocation={...structuredClone(original),id:newId(),revision:newId(),correctionOf:original.id,status:'draft' as const,approval:undefined,baseline:e.digest,description:'Missing fee correction of allocation '+original.id,evidence:original.evidence+'; financial correction '+id,preparedAt:c.now,preparedBy:c.actor.id,parts:revenueParts(original.terms,original.totalCents,fees,original.rentCents,original.passThroughCents,original.taxCents)}
 const replacements=await revenuePostings(allocation,effectiveDate)
 const journalGroup:NonNullable<FinancialCase['proposals'][number]['journalGroup']>=payouts.map(({p,j},i)=>{
  const amounts=p.id===payout.id?source:p,{grossCents:g,feeCents:f,netCents:n}=amounts
  return {originalJournalId:j.id,replacement:{sourceKey:`financial-correction:${id}:${i}`,propertyId:j.propertyId,bookingId:j.bookingId,ownerKey:j.ownerKey,legalEntity:j.legalEntity,sourceType:'settlement-correction',sourceId:id,sourceRevision:sourceDigest,effectiveDate,correctionOf:j.id,settlement:{grossCents:g,feeCents:f,netCents:n},lines:[debit('cash',n),credit('ownerLiability',g),...(f?[debit('ownerLiability',f)]:[])]}}
 })
 for(const [i,input] of replacements.entries())journalGroup.push({originalJournalId:actual.find(j=>j.sourceKey===expected[i].sourceKey)!.id,replacement:{...input,legalEntity:entity,correctionOf:actual.find(j=>j.sourceKey===expected[i].sourceKey)!.id}})
 return {allocation,journalGroup}
}
