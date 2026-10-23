import { type Context,owner,need,text,newId,sha } from '../../model'
import { hasAction,requireProperty } from '../../permissions/policy'
import { parsePayoutCsv } from '../sources'
import { post } from '../../ledger/store'
import { debit,credit } from '../../ledger/types'
import { bankData } from '../banking/store'
import { financialCases,saveCase } from './store'
import { caseEvidence } from './evidence'
import type { FinancialCase } from './types'
export async function financialCaseCommand(c:Context,name:string,p:Record<string,unknown>){
 if(!name.startsWith('financeCase.'))return undefined
 owner(c.actor);need(!c.actor.isAgent&&hasAction(c.actor,name)&&hasAction(c.actor,'finance:read'),'Current financial authority is required',403)
 const all=await financialCases(c.db)
 if(name==='financeCase.open'){
  const booking=c.data.bookings.find(b=>b.id===p.bookingId);need(booking,'Reservation not found',404);requireProperty(c.actor,booking.propertyId)
  need(!all.some(r=>r.bookingId===booking.id),'This reservation already has a financial exception case',409)
  const row:FinancialCase={agreement:structuredClone(booking.managementTerms),id:newId(),revision:newId(),propertyId:booking.propertyId,bookingId:booking.id,createdAt:c.now,createdBy:c.actor.id,reason:text(p.reason,'financial discrepancy',1000),status:'investigating',requests:[],proposals:[],history:[{at:c.now,by:c.actor.id,action:'Opened source investigation'}]}
  await caseEvidence(c,row);return saveCase(c,row)
 }
 const row=all.find(r=>r.id===p.id);need(row,'Financial case not found',404);requireProperty(c.actor,row.propertyId)
 need(row.revision===p.revision,'Case changed. Review the current revision.',409)
 const evidence=await caseEvidence(c,row)
 if(name==='financeCase.review'){
  // A fresh review retires any old proposal, including authority imported in an archive.
  for(const proposal of row.proposals.filter(p=>p.status==='proposed')){proposal.status='rejected';proposal.decisionBy=c.actor.id;proposal.decisionAt=c.now;proposal.decisionReason='Sources reviewed again; new exact approval required'}
  row.restorePaused=false;row.status=row.requests.some(r=>!r.evidenceId)?'awaiting_records':'investigating'
 }else{
  need(!row.restorePaused,'Restored case history is inactive. Review current sources before new work.',409)
  if(name==='financeCase.request'){
   need(['settlement','fee','refund','bank'].includes(String(p.kind)),'Choose the missing source record')
   row.requests.push({id:newId(),kind:p.kind as FinancialCase['requests'][number]['kind'],detail:text(p.detail,'record to obtain and responsible follow-up',1000),requestedBy:c.actor.id,at:c.now});row.status='awaiting_records'
  }else if(name==='financeCase.obtain'){
   const request=row.requests.find(r=>r.id===p.requestId);need(request&&!request.evidenceId,'Open record request not found',409)
   const id=text(p.evidenceId,'imported source id'),bank=await bankData(c.db)
   const source=request.kind==='bank'?bank.statements.find(s=>s.id===id&&s.propertyId===row.propertyId&&s.transactions.length):row.proposals.find(v=>v.id===id&&v.status==='approved')??evidence.payouts.find(v=>v.id===id&&(request.kind!=='refund'||v.grossCents<0))
   need(source,'Obtain the record through payout import, approved source correction or bank-statement import first',409)
   const amounts='source'in source&&typeof source.source==='object'?source.source:source
   if(request.kind==='fee')need('feeCents'in amounts&&amounts.feeCents!==0,'This record supplies no missing fee; keep pursuing the explicit provider record',409)
   if(request.kind==='refund')need('grossCents'in amounts&&amounts.grossCents<0,'This record is not a refund settlement',409)
   request.evidenceId=id;request.resolvedBy=c.actor.id
   row.status=row.requests.some(r=>!r.evidenceId)?'awaiting_records':'investigating'
  }else if(name==='financeCase.propose'){
   need(evidence.sourceState==='available','The reservation moved or is unavailable. Reconcile its scope before proposing a correction.',409)
   need(!row.proposals.some(v=>v.status==='proposed'),'Approve or reject the existing proposal first',409)
   const payout=evidence.payouts.find(v=>v.id===p.payoutId);need(payout,'Matched settlement source not found',404)
   const original=evidence.journals.find(j=>j.sourceKey==='payout:'+payout.id)
   need(original&&original.lines.every(l=>['cash','ownerLiability','channelFees'].includes(l.account))&&!evidence.journals.some(j=>j.reversalOf===original.id),'This source needs accountant review: no unreversed native payout journal exists',409)
   need(!evidence.agreement?.allocation&&!c.data.financialAllocations.some(a=>a.bookingId===row.bookingId),'Allocated receipts need their FIN-003 correction workflow; do not replace an allocated posting',409)
   const proof=text(p.evidence,'retained provider record reference',500),csv=text(p.csv,'corrected provider CSV',2_000_000),lines=parsePayoutCsv(payout.source,csv,proof)
   need(lines.length===1,'Propose exactly one identified settlement correction')
   const source=lines[0]
   need(source.externalId===payout.externalId&&source.reference===payout.reference&&source.payoutId===payout.payoutId,'The corrected provider row must identify the same transaction, reservation and payout',409)
   need(source.grossCents!==payout.grossCents||source.feeCents!==payout.feeCents||source.netCents!==payout.netCents,'The provider evidence has no changed amount',409)
   need(p.baseline===evidence.digest,'Source evidence changed. Review it before proposing.',409)
   row.proposals.push({id:newId(),status:'proposed',payoutId:payout.id,originalJournalId:original.id,source,csv,evidence:proof,sourceDigest:await sha(csv.replace(/\r\n?/g,'\n')),baseline:evidence.digest,effectiveDate:text(p.effectiveDate,'open correction date',10),why:text(p.why,'source-grounded explanation',1000),proposedBy:c.actor.id,at:c.now});row.status='proposed'
  }else if(name==='financeCase.reject'||name==='financeCase.approve'){
   const proposal=row.proposals.find(v=>v.id===p.proposalId&&v.status==='proposed');need(proposal,'Pending correction not found',409)
   if(name==='financeCase.approve'){
    need(evidence.sourceState==='available','The reservation moved or is unavailable. Reconcile its scope before approving a correction.',409)
    // Conservative default: installation owner approves this exact local posting only.
    owner(c.actor);need(p.confirm==='yes','Explicit approval of this exact correction is required')
    need(proposal.baseline===evidence.digest,'Reservation, settlement, bank, agreement or statement evidence changed. Reject and propose again.',409)
    const original=evidence.journals.find(j=>j.id===proposal.originalJournalId)!;need(!evidence.journals.some(j=>j.reversalOf===original.id),'The source journal was already reversed',409)
    const reversed=await post(c,{...original,sourceKey:'reversal:'+original.id,sourceType:'correction',sourceId:original.id,sourceRevision:original.id,effectiveDate:proposal.effectiveDate,reversalOf:original.id,lines:original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents}))})
    const {grossCents:g,feeCents:f,netCents:n}=proposal.source
    const signed=(account:'cash'|'ownerLiability',amount:number,dr:boolean)=>amount===0?[]:[(amount>0===dr?debit:credit)(account,Math.abs(amount))]
    const corrected=await post(c,{sourceKey:'financial-correction:'+proposal.id,propertyId:original.propertyId,bookingId:original.bookingId,ownerKey:original.ownerKey,legalEntity:original.legalEntity,settlement:{grossCents:g,feeCents:f,netCents:n},sourceType:'settlement-correction',sourceId:proposal.id,sourceRevision:proposal.sourceDigest,effectiveDate:proposal.effectiveDate,correctionOf:original.id,lines:[...signed('cash',n,true),...signed('ownerLiability',g,false),...signed('ownerLiability',f,true)]})
    proposal.journalIds=[reversed.id,corrected.id];proposal.status='approved';row.status='corrected'
    c.data.approvals.push({id:newId(),kind:'financial-correction',recordId:proposal.id,revision:proposal.baseline,actorId:c.actor.id,at:c.now})
   }else{proposal.status='rejected';row.status='investigating'}
   proposal.decisionBy=c.actor.id;proposal.decisionAt=c.now;proposal.decisionReason=text(p.reason,'decision reason',1000)
  }else need(false,'Unknown financial case command',404)
 }
 row.history.push({at:c.now,by:c.actor.id,action:name.slice('financeCase.'.length),reference:typeof p.proposalId==='string'?p.proposalId:undefined});row.revision=newId()
 return saveCase(c,row)
}
