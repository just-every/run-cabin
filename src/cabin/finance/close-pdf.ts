import type { Statement } from '../model'
import { accounts } from '../ledger/types'
import { usd } from './presentation'
/** Readable frozen documents keep settlement coverage separate from payable movements. */
export function closePdf(s:Statement,line:(text:string,size?:number)=>void){
 const c=s.close!;line('Monthly ledger reconciliation',14)
 line(`Opening payable: ${usd(c.openingCents)} | Movement: ${usd(c.movementCents)} | Closing: ${usd(c.closingCents)}`)
 line(`Reserve payable: ${usd(c.reservesCents)} | Refunds: ${usd(c.refundsCents)} | Recorded distributions: ${usd(c.distributionsCents)}`)
 line(`Collected tax responsibility: ${usd(s.taxCents??0)}`)
 line(`Effective-date basis | Source cutoff ${c.cutoff}`,9)
 if(c.adjustmentOf)line(`Supplement to frozen statement ${c.adjustmentOf}`,9)
 for(const id of c.adjustsStatementIds)line(`Adjustment to prior frozen statement ${id}`,9)
 line('Received settlements',14)
 for(const p of c.receipts){
  line(`${p.source} | Reservation ${p.reference} | Batch ${p.payoutId}`,10)
  line(`Gross ${usd(p.grossCents)} | Fees ${usd(p.feeCents)} | Net ${usd(p.netCents)}`,10)
  line(`Source: ${p.evidence} | Receipt ${p.id}`,8)
 }
 if(!c.receipts.length)line('No new settlement receipts in this close.')
 line('Owner payable activity',14)
 for(const j of c.journals){
  const amount=j.lines.filter(l=>l.account==='ownerLiability').reduce((n,l)=>n+l.creditCents-l.debitCents,0)
  line(`${j.effectiveDate} | ${j.sourceType} | Owner movement ${usd(amount)}`,11)
  line(`Journal ${j.id} | Source ${j.sourceId}`,8)
  if(j.bookingId)line(`Reservation ${j.bookingId}`,8)
  if(j.reversalOf)line(`Reverses ${j.reversalOf}`,8)
  if(j.correctionOf)line(`Corrects ${j.correctionOf}`,8)
  for(const leg of j.lines)line(`${accounts[leg.account]}: debit ${usd(leg.debitCents)}; credit ${usd(leg.creditCents)}`,9)
 }
}
