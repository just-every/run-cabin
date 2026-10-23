import { type Context,need,sha } from '../../model'
import { contextJournals } from '../../ledger/store'
import { bankData } from '../banking/store'
import { net } from '../banking/reconciliation'
import type { FinancialCase } from './types'
/** Source ids and integer amounts are retained; a missing record never supplies an amount. */
export async function caseEvidence(c:Context,row:Pick<FinancialCase,'propertyId'|'bookingId'>){
 const booking=c.data.bookings.find(b=>b.id===row.bookingId&&b.propertyId===row.propertyId);need(booking,'Reservation not found',404)
 const payouts=c.data.payouts.filter(p=>p.bookingId===booking.id&&p.propertyId===row.propertyId)
 const journals=(await contextJournals(c)).filter(j=>j.bookingId===booking.id&&j.propertyId===row.propertyId)
 const bank=await bankData(c.db),assignments=bank.assignments.filter(a=>journals.some(j=>j.id===a.journalId)),matches=bank.matches.filter(m=>journals.some(j=>j.id===m.journalId))
 const statements=c.data.statements.filter(s=>s.propertyId===row.propertyId&&s.status==='approved'&&s.close?.journals.some(j=>j.bookingId===booking.id))
 const bankStatements=bank.statements.filter(s=>matches.some(m=>m.statementId===s.id))
 const distribution=journals.filter(j=>j.sourceType==='distribution'&&!journals.some(r=>r.reversalOf===j.id))
 // Read-only payment balances are projections, never part of saved revision equality.
 const reservation=structuredClone(booking);delete (reservation as any).reservationBalance
 const result={booking:reservation,property:c.data.properties.find(p=>p.id===row.propertyId),ledgerSetting:c.data.ledgerSettings.find(s=>s.propertyId===row.propertyId),agreement:booking.managementTerms,payouts,journals,assignments,matches,bankStatements,statements,
  payableCents:journals.reduce((n,j)=>n-net(j,'ownerLiability'),0),
  recordedDistributionCents:distribution.reduce((n,j)=>n-net(j,'cash'),0),
  bankMatchedDistributionCents:distribution.filter(j=>matches.some(m=>m.journalId===j.id)).reduce((n,j)=>n-net(j,'cash'),0),
  unmatchedCashJournalIds:journals.filter(j=>net(j,'cash')!==0&&!matches.some(m=>m.journalId===j.id)).map(j=>j.id)}
 return {...result,digest:await sha(JSON.stringify(result))}
}
