import { type Context,type Statement,manager,need,text,newId,sha,property,query } from '../model'
import { contextJournals } from '../ledger/store'
import { accounts } from '../ledger/types'
import { allocationTerms } from '../properties/terms'
import { splitCents } from './allocation-calculation'
import type { MonthClose } from './close-types'
const net=(j:MonthClose['journals'][number],account:string)=>j.lines.filter(l=>l.account===account).reduce((n,l)=>n+l.creditCents-l.debitCents,0)
export const nextMonth=(month:string)=>{const date=new Date(month+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,7)}
export function closeMonth(value:unknown){const m=text(value,'statement month',7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(m),'Use a YYYY-MM month');return m}
/** One close is a frozen, owner-scoped selection of immutable journals, never a second accounting system. */
export async function closeSnapshot(c:Context,propertyId:string,month:string,email:string,adjustmentOf?:string){
 need(c.data.ledgerSettings.some(s=>s.propertyId===propertyId),'Configure this home’s ledger legal entity before closing.',409)
 const ownerKey=await sha(email.toLowerCase()),all=(await contextJournals(c)).filter(j=>j.propertyId===propertyId&&j.ownerKey===ownerKey),from=month+'-01',until=nextMonth(month)+'-01'
 const prior=c.data.statements.filter(s=>s.propertyId===propertyId&&s.ownerEmail===email&&s.month===month&&s.status==='approved'&&s.source!=='recovery')
 need(prior.every(s=>s.close),'This month already has a legacy frozen statement. Use a later open period for corrections.',409)
 const latest=prior.at(-1)
 need(!latest&&!adjustmentOf||latest?.id===adjustmentOf,'An approved month needs a linked supplement to its latest statement.',409)
 const payouts=c.data.payouts.filter(p=>p.date>=from&&p.date<until&&(p.propertyId===propertyId||!p.propertyId))
 need(payouts.every(p=>p.propertyId===propertyId&&p.match==='matched'&&p.bookingId),'Resolve every unmatched or unassigned payout before closing this month.',409)
 const ledger=await contextJournals(c)
 for(const p of payouts)need(ledger.some(j=>j.sourceKey==='payout:'+p.id),'A received payout has no trust posting. Configure the ledger and reconcile it before closing.',409)
 const missing=c.data.bookings.filter(b=>b.propertyId===propertyId&&b.status==='confirmed'&&b.kind!=='block'&&b.channel!=='ical'&&b.end.slice(0,10)>=from&&b.end.slice(0,10)<until&&!c.data.payouts.some(p=>p.bookingId===b.id&&p.match==='matched')&&!ledger.some(j=>j.bookingId===b.id&&j.lines.some(l=>l.account==='cash'&&l.debitCents>0)))
 need(!missing.length,`Missing settlement evidence for ${missing.map(b=>b.uid).join(', ')}. Import the actual provider record or reconcile a documented manual receipt.`,409)
 const receipts=payouts.flatMap(p=>{
  const b=c.data.bookings.find(b=>b.id===p.bookingId)!;need(b,'A payout’s reservation is missing.',409)
  const terms=allocationTerms(c.data,b),owners=terms.allocation?.owners??[{name:terms.ownerName,email:terms.ownerEmail,bps:10000}],index=owners.findIndex(o=>o.email.toLowerCase()===email)
  if(index<0)return []
  const shares=owners.map(o=>o.bps),grossCents=splitCents(p.grossCents,shares)[index],feeCents=splitCents(p.feeCents,shares)[index]
  return [{id:p.id,source:p.source,reference:p.reference,payoutId:p.payoutId,bookingId:b.id,grossCents,feeCents,netCents:grossCents-feeCents,evidence:p.evidenceReference??p.externalId}]
 })
 const accounted=new Set(prior.flatMap(s=>s.close!.journals.map(j=>j.id))),receiptIds=new Set(prior.flatMap(s=>s.close!.receipts.map(p=>p.id)))
 const period=all.filter(j=>j.effectiveDate>=from&&j.effectiveDate<until),journals=period.filter(j=>!accounted.has(j.id))
 const openingCents=latest?.netCents??all.filter(j=>j.effectiveDate<from).reduce((n,j)=>n+net(j,'ownerLiability'),0),movementCents=journals.reduce((n,j)=>n+net(j,'ownerLiability'),0)
 const beforeUntil=all.filter(j=>j.effectiveDate<until),closingCents=beforeUntil.reduce((n,j)=>n+net(j,'ownerLiability'),0)
 need(openingCents+movementCents===closingCents,'Earlier-period journals changed after release. Review a linked correction before this close.',409)
 const family=(j:typeof ledger[number])=>{const original=j.reversalOf?ledger.find(o=>o.id===j.reversalOf):undefined;return original?.sourceType??j.sourceType}
 const refund=(j:typeof ledger[number])=>{const original=j.reversalOf?ledger.find(o=>o.id===j.reversalOf):j;return family(j).includes('refund')||(original?.settlement?original.settlement.grossCents<0:family(j)==='payout'&&c.data.payouts.some(p=>p.id===original?.sourceId&&p.grossCents<0))}
 const priorSources=c.data.statements.filter(s=>s.status==='approved'&&s.close&&s.propertyId===propertyId&&s.ownerEmail===email)
 const correctionIds=new Set(journals.flatMap(j=>[j.reversalOf,j.correctionOf].filter(Boolean)))
 const close:MonthClose={openingCents,movementCents,closingCents,reservesCents:beforeUntil.reduce((n,j)=>n+net(j,'ownerReserves'),0),refundsCents:-journals.filter(j=>refund(j)).reduce((n,j)=>n+net(j,'ownerLiability'),0),distributionsCents:-journals.filter(j=>family(j)==='distribution').reduce((n,j)=>n+net(j,'ownerLiability'),0),basis:'effective-date',cutoff:c.now,journals:structuredClone(journals),receipts:receipts.filter(p=>!receiptIds.has(p.id)),adjustmentOf,adjustsStatementIds:priorSources.filter(s=>s.close!.journals.some(j=>correctionIds.has(j.id))).map(s=>s.id)}
 // A wall-clock cutoff is presentation, not part of exact source equality.
 const baseline=await sha(JSON.stringify({...close,cutoff:'',terms:c.data.managementTerms.filter(t=>t.propertyId===propertyId),propertyRevision:property(c,propertyId).revision,payouts:payouts.map(({statementId:_,...p})=>p)}))
 return {close,baseline}
}
export async function prepareClose(c:Context,p:Record<string,unknown>){
 manager(c.actor);const prop=property(c,p.propertyId),month=closeMonth(p.month),email=String(p.statementOwnerEmail||prop.ownerEmail).trim().toLowerCase()
 need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a statement owner email')
 const {close,baseline}=await closeSnapshot(c,prop.id,month,email,p.adjustmentOf?text(p.adjustmentOf,'original statement'):undefined)
 need(close.journals.length||close.openingCents||close.receipts.length,'No posted owner activity or opening balance exists for this close.',409)
 const owners=c.data.managementTerms.filter(t=>t.propertyId===prop.id).flatMap(t=>t.allocation?.owners??[{name:t.ownerName,email:t.ownerEmail,bps:10000}]),ownerName=owners.find(o=>o.email.toLowerCase()===email)?.name??(email===prop.ownerEmail?prop.ownerName:email)
 const all=await contextJournals(c),expense=(j:typeof all[number])=>{const original=j.reversalOf?all.find(o=>o.id===j.reversalOf):undefined;return ['expense','maintenance-expense','agreement-expense','owner-use-cleaning'].includes(original?.sourceType??j.sourceType)}
 const row:Statement={id:newId(),revision:newId(),propertyId:prop.id,propertyRevision:prop.revision,propertyName:prop.name,ownerName,ownerEmail:email,month,source:'ledger',close,sourceBaseline:baseline,payoutIds:close.receipts.map(p=>p.id),lines:close.journals.map(j=>({description:`${j.effectiveDate} · ${j.sourceType} · ${j.sourceId} · journal ${j.id}${j.reversalOf?' · reverses '+j.reversalOf:''}${j.correctionOf?' · corrects '+j.correctionOf:''} · ${j.lines.map(l=>`${accounts[l.account]} D${l.debitCents} C${l.creditCents}`).join('; ')}`,amountCents:net(j,'ownerLiability'),bookingId:j.bookingId})),grossCents:close.receipts.reduce((n,p)=>n+p.grossCents,0),channelFeeCents:close.receipts.reduce((n,p)=>n+p.feeCents,0),expenseCents:-close.journals.filter(j=>expense(j)).reduce((n,j)=>n+net(j,'ownerLiability'),0),managementFeeCents:close.journals.reduce((n,j)=>n+net(j,'managerRevenue'),0),taxCents:close.journals.reduce((n,j)=>n+net(j,'taxes'),0),reserveCents:close.reservesCents,commissionBps:prop.commissionBps,netCents:close.closingCents,status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
 c.data.statements.push(row);c.entityId=row.id;return row
}
export async function approveClose(c:Context,row:Statement){
 const latest=await closeSnapshot(c,row.propertyId,row.month,row.ownerEmail,row.close?.adjustmentOf)
 need(latest.baseline===row.sourceBaseline,'Ledger, receipts or agreement sources changed. Prepare and review a new close.',409)
 for(const p of c.data.payouts.filter(p=>row.payoutIds?.includes(p.id)))if(!p.statementId)p.statementId=row.id
 if(property(c,row.propertyId).ownerEmail.toLowerCase()!==row.ownerEmail)c.queries.push(query('INSERT INTO cb_owner_statement_grants(statement_id,email,granted_at,granted_by,reason) VALUES(?,?,?,?,?) ON CONFLICT(statement_id,email) DO NOTHING',row.id,row.ownerEmail,c.now,c.actor.id,'Exact approval of this owner’s reconciled monthly close'))
}
