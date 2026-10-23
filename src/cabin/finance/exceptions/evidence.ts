import { type Context,sha } from '../../model'
import { contextJournals } from '../../ledger/store'
import { bankData } from '../banking/store'
import { net } from '../banking/reconciliation'
import type { FinancialCase } from './types'
/** Source ids and integer amounts are retained; a missing record never supplies an amount. */
export async function caseEvidence(c:Context,row:Pick<FinancialCase,'propertyId'|'bookingId'|'agreement'>){
 const booking=c.data.bookings.find(b=>b.id===row.bookingId)
 const sourceState=!booking?'missing':booking.propertyId!==row.propertyId?'moved':'available'
 const payouts=c.data.payouts.filter(p=>p.bookingId===row.bookingId&&p.propertyId===row.propertyId)
 const journals=(await contextJournals(c)).filter(j=>j.bookingId===row.bookingId&&j.propertyId===row.propertyId)
 const bank=await bankData(c.db),assignments=bank.assignments.filter(a=>journals.some(j=>j.id===a.journalId)),matches=bank.matches.filter(m=>journals.some(j=>j.id===m.journalId))
 const statements=c.data.statements.filter(s=>s.propertyId===row.propertyId&&s.status==='approved'&&s.close?.journals.some(j=>j.bookingId===row.bookingId))
 const bankStatements=bank.statements.filter(s=>matches.some(m=>m.statementId===s.id))
 const distribution=journals.filter(j=>j.sourceType==='distribution'&&!journals.some(r=>r.reversalOf===j.id))
 // Read-only payment balances are projections, never part of saved revision equality.
 const reservation=booking?structuredClone(booking):null;if(reservation)delete (reservation as any).reservationBalance
 const result={sourceState,booking:reservation,property:c.data.properties.find(p=>p.id===row.propertyId),ledgerSetting:c.data.ledgerSettings.find(s=>s.propertyId===row.propertyId),allocations:c.data.financialAllocations.filter(a=>a.bookingId===row.bookingId),agreement:row.agreement??(booking?.propertyId===row.propertyId?booking.managementTerms:undefined),payouts,journals,assignments,matches,bankStatements,statements,
  payableCents:journals.reduce((n,j)=>n-net(j,'ownerLiability'),0),
  recordedDistributionCents:distribution.reduce((n,j)=>n-net(j,'cash'),0),
  bankMatchedDistributionCents:distribution.filter(j=>matches.some(m=>m.journalId===j.id)).reduce((n,j)=>n-net(j,'cash'),0),
  unmatchedCashJournalIds:journals.filter(j=>net(j,'cash')!==0&&!matches.some(m=>m.journalId===j.id)).map(j=>j.id)}
 return {...result,digest:await sha(JSON.stringify(result))}
}
