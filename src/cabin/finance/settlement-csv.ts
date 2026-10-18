import { need, text } from '../model'
import { payoutRows, sumCents } from './csv'
import type { SourceLine } from './sources'

/** Accountant-reviewed rows copied from retained provider evidence, not a native
 * report adapter or proof of a live provider connection. Each row is one settled
 * reservation transaction, with its actual batch and explicit USD amounts.
 */
export function parseSettlementCsv(source: 'booking.com' | 'stripe', csv: string, evidence?: string): SourceLine[] {
 const evidenceReference = text(evidence, 'provider settlement evidence reference', 500)
 const seen = new Set<string>()
 const lines = payoutRows(csv).map(row => {
  const transactionId = row.text(['Transaction ID'], true)
  const payoutId = row.text(['Payout ID', 'Payout reference'], true)
  const reservation = row.text(['Reservation ID', 'Reservation number', 'Reservation reference'])
  const paymentId = row.text(['Payment intent ID', 'Payment intent'])
  if ([transactionId, payoutId, reservation, paymentId].some(value => value.length > 200)) row.error('provider identifiers must be at most 200 characters.')
  if (source === 'stripe') {
   if (!/^txn_[A-Za-z0-9]+$/.test(transactionId)) row.error('Stripe Transaction ID must be the provider balance transaction ID (txn_…), not a charge or payment intent ID.')
   if (!/^po_[A-Za-z0-9]+$/.test(payoutId)) row.error('Stripe Payout ID must be the provider payout ID (po_…).')
   if (paymentId && !/^pi_[A-Za-z0-9]+$/.test(paymentId)) row.error('Stripe Payment intent ID must be a provider pi_… identifier.')
  } else if (paymentId) row.error('Payment intent ID is supported only for Stripe settlements.')
  const reference = source === 'stripe' ? paymentId || reservation : reservation
  if (!reference) row.error('include a Reservation ID or, for Stripe, a Payment intent ID. Unassigned batch totals cannot be imported.')
  const currencies = row.entries(['Currency', 'Payout currency', 'Payment currency'])
  if (!currencies.length || currencies.some(([, value]) => value.toUpperCase() !== 'USD')) row.error('only explicit USD settlement and payment currencies are supported.')
  const date = row.date(['Date', 'Payout date', 'Settlement date'], true)!
  const start = row.date(['Start date', 'Check-in', 'Arrival date'])
  const end = row.date(['End date', 'Check-out', 'Departure date'])
  if (!!start !== !!end || (start && end && end <= start)) row.error('provide both stay dates with check-out after check-in, or leave both blank when the provider evidence has no stay dates.')
  const type = row.text(['Type', 'Transaction type'], true).toLowerCase()
  if (!['payment', 'reservation', 'charge', 'refund'].includes(type)) row.error('Type must be payment, reservation, charge or refund; taxes, deposits and unassigned adjustments need separate evidence.')
  const grossCents = row.money(['Gross amount', 'Gross'], true)!
  const feeCents = row.money(['Fee amount', 'Fees', 'Fee'], true)!
  const netCents = row.money(['Net amount', 'Net'], true)!
  if (sumCents([grossCents, -feeCents]) !== netCents) row.error('gross minus explicit fees must equal net exactly. Use expense-positive fees and negative returned fees; no amounts are inferred.')
  if (type === 'refund') {
   if (grossCents >= 0 || netCents > 0) row.error('refunds require negative gross and nonpositive net with exact fee reconciliation.')
  } else if (grossCents <= 0 || feeCents < 0 || netCents < 0) row.error('payments require positive gross and nonnegative fees and net; signed reversals must be explicit refunds.')
  // Keep Stripe's API identity so importing the same evidence through both doors
  // cannot create a second payment. Batch, dates and money never define identity.
  const externalId = source === 'stripe' ? transactionId : `${source}:${JSON.stringify(['transaction', transactionId])}`
  if (seen.has(externalId)) row.error('duplicate provider Transaction ID; each transaction may appear only once in an import.')
  seen.add(externalId)
  return { source, externalId, transactionId, payoutId, reference, start, end,
   guestName: row.text(['Guest name', 'Guest']), date, grossCents, feeCents, netCents,
   currency: 'USD' as const, evidenceReference, ...(paymentId ? { paymentId } : {}) }
 })
 need(lines.length > 0, 'The CSV contains no supported settlement transactions.')
 return lines
}
