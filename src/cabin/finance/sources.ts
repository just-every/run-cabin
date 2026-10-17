import { need } from '../model'
import { stripe, type StripeEnv } from '../direct/stripe'
import { payoutRows, sumCents, type PayoutRow } from './csv'

export interface SourceLine {
 source: 'airbnb' | 'vrbo' | 'stripe'; externalId: string; payoutId: string; reference: string;
 start: string | null; end: string | null; guestName: string; date: string;
 grossCents: number; feeCents: number; netCents: number; currency: 'USD'; paymentId?: string;
}

const airbnbFee = ['Host service fee', 'Host fee', 'Service fee']
const vrboFees = [['Commission', 'Base commission'], ['Processing fee', 'Payment processing fee'], ['VAT on commission']]
const payoutIds = ['Payout ID', 'Payout reference']
const lower = (value: string) => value.toLowerCase().replace(/[ _-]+/g, ' ').trim()

function fees(row: PayoutRow, groups: string[][]): number | null {
 const values = groups.map(names => row.money(names)).filter((amount): amount is number => amount !== null)
 return values.length ? sumCents(values) : null
}

/** feeCents is an expense (negative for returned fees). Never apply a fee percentage.
 * Both provider display conventions (expense-positive and signed deduction) are
 * accepted only when the explicit gross/net reconcile. Missing gross or net can
 * be derived from explicit expense-positive fees, never from a guessed fee rate.
 */
function reconcile(row: PayoutRow, gross: number | null, fee: number | null, net: number | null) {
 if (gross !== null && net !== null) {
  const delta = sumCents([gross, -net])
  if (fee === null && delta !== 0) row.error('gross and net differ but no explicit owner fees are present. Export owner fee columns so taxes or other deductions are not misclassified as fees.')
  if (fee !== null && delta !== fee && delta !== -fee) row.error('gross minus fees does not equal net. Export payment-level gross, owner fees and net; tax, deposits or booking totals may use a different basis.')
  return { grossCents: gross, feeCents: delta, netCents: net }
 }
 if (fee === null || (gross === null && net === null)) row.error('include gross and net amounts, or one of them plus explicit owner fee columns. Fees cannot be estimated.')
 return { grossCents: gross ?? sumCents([net!, fee]), feeCents: fee, netCents: net ?? sumCents([gross!, -fee]) }
}

function stayDates(row: PayoutRow) {
 const start = row.date(['Start date', 'Arrival', 'Arrival date', 'Check-in', 'Check in', 'Check-in date'])
 let end = row.date(['End date', 'Departure', 'Departure date', 'Check-out', 'Check out', 'Check-out date'])
 const nights = row.text(['Nights', 'Number of nights'])
 if (nights) {
  if (!/^\d+$/.test(nights) || !Number.isSafeInteger(Number(nights)) || Number(nights) <= 0 || Number(nights) > 3660) row.error('nights must be a positive whole number of at most 3660.')
  if (start) {
   const until = new Date(`${start}T00:00:00Z`); until.setUTCDate(until.getUTCDate() + Number(nights))
   const derived = until.toISOString().slice(0, 10)
   if (end && end !== derived) row.error('stay dates disagree with the number of nights.')
   end = derived
  }
 }
 if (start && end && end <= start) row.error('check-out must be after check-in.')
 return { start, end }
}

function usd(row: PayoutRow) {
 const values = row.entries(['Currency', 'Payout currency', 'Payment currency'])
 if (!values.length || values.some(([, value]) => value.toUpperCase() !== 'USD')) row.error('only explicit USD payment and payout currencies are supported; include Currency in the export.')
}

/** Supported English/US transaction exports, not bank-deposit summary exports:
 * Airbnb: Type, Confirmation code, Date, Currency, Gross earnings, Host service
 * fee/Host fee/Service fee, Amount/Paid out. Arrival/Departure or Start/End date
 * and Nights are optional. Payout summary rows are excluded to prevent doubling.
 * Vrbo: Reservation ID/number, Payment/Disbursement date, Currency, gross (Rental
 * amount/Total amount/Gross booking amount), owner Commission/Processing fee/
 * Service fee, net (Net amount/Payout amount). Also native payment-history rows:
 * RefID, Your Revenue or Paid By Guest minus guest Service Fee, Commission,
 * Payment Processing Fee, Payable To You/Deposit Amount/Payout. The native guest
 * Service Fee is excluded from owner gross and owner fees. Extra deductions must
 * reconcile; unsupported adjustments are rejected instead of being dropped.
 * Blank cells are missing, not zero. No headerless, localized or FX exports.
 * payoutId is empty when the provider export supplies no batch identifier.
 */
export function parsePayoutCsv(source: 'airbnb' | 'vrbo', csv: string): SourceLine[] {
 need(source === 'airbnb' || source === 'vrbo', 'Choose Airbnb or Vrbo for a payout CSV.')
 const lines: SourceLine[] = [], seen = new Set<string>()
 for (const row of payoutRows(csv)) {
  const reference = row.text(source === 'airbnb' ? ['Confirmation code', 'Confirmation number'] : ['Reservation ID', 'Reservation number'])
  const type = lower(row.text(source === 'airbnb' ? ['Type'] : ['Payment type', 'Transaction type', 'Type'], source === 'airbnb'))
  if (source === 'airbnb' && type === 'payout') {
   if (reference) row.error('a payout summary cannot also contain a reservation confirmation code.')
   usd(row)
   continue
  }
  if (!reference) row.error(`missing ${source === 'airbnb' ? 'Confirmation code' : 'Reservation ID / Reservation number'}; summary and unassigned adjustment rows cannot be imported as reservations.`)
  const supported = source === 'airbnb' ? ['reservation', 'refund', 'reservation refund'] : ['', 'reservation', 'payment', 'rent', 'rent payment', 'rental payment', 'reservation payment', 'refund', 'refund payment', 'partial refund']
  if (!supported.includes(type)) row.error(`unsupported transaction type. Export reservation payments and refunds separately from adjustments, taxes and deposits.`)
  usd(row)
  const date = row.date(source === 'airbnb' ? ['Date', 'Payout date'] : ['Disbursement date', 'Payout date']) || row.date(['Payment date', 'Date'], true)!
  const payoutId = row.text(payoutIds) || (source === 'airbnb' ? row.text(['Reference code']) : '')
  let gross: number | null, fee: number | null, net: number | null
  if (source === 'airbnb') {
   gross = row.money(['Gross earnings', 'Gross amount'])
   fee = row.money(airbnbFee)
   net = row.money(['Amount', 'Paid out', 'Net amount'])
  } else {
   const native = row.has('Paid By Guest', 'Your Revenue')
   gross = row.money(['Your Revenue', 'Gross booking amount', 'Rental amount', 'Total amount'])
   if (native) {
    const paid = row.money(['Paid By Guest']), service = row.money(['Service fee'])
    if (paid !== null && service !== null) {
     const ownerGross = sumCents([paid, -service])
     if (gross !== null && gross !== ownerGross) row.error('Your Revenue does not equal Paid By Guest minus the guest Service Fee; export transaction-level amounts.')
     gross = ownerGross
    }
   }
   fee = fees(row, native ? vrboFees : [...vrboFees, ['Service fee']])
   net = row.money(['Net amount', 'Payout amount', 'Payable to you', 'Payout', 'Deposit amount'])
   if (gross === null || net === null) row.error('Vrbo requires explicit payment-level gross/Your Revenue and net/Payout. Fee sign conventions cannot establish missing payment amounts unambiguously.')
  }
  const amounts = reconcile(row, gross, fee, net)
  if (type.includes('refund') && amounts.grossCents >= 0) row.error('refunds must have a negative gross amount; do not import unsigned refund totals.')
  const transactionId = row.text(['Transaction ID', 'RefID', 'Reference ID'])
  // Amounts are mutable evidence, not identity: reimports must detect corrections.
  // Same-date/batch split payments require distinct provider transaction IDs.
  const externalId = `${source}:${JSON.stringify(transactionId ? ['transaction', transactionId] : ['reservation', reference, type, date, payoutId])}`
  if (seen.has(externalId)) row.error('duplicate or indistinguishable payment. Include provider transaction IDs or payout IDs to distinguish equal split payments.')
  seen.add(externalId)
  lines.push({ source, externalId, payoutId, reference, ...stayDates(row), guestName: row.text(['Guest', 'Guest name', 'Traveler name']), date, ...amounts, currency: 'USD' })
 }
 need(lines.length > 0, 'The CSV contains no supported reservation payments or refunds.')
 return lines
}

function objectId(value: unknown, label: string): string {
 need(typeof value === 'string' && /^[A-Za-z0-9_]+$/.test(value), `Stripe returned an invalid ${label}.`, 502)
 return value
}

async function* stripePages(env: StripeEnv, path: string, fields: Record<string, string>) {
 let cursor = ''
 const seen = new Set<string>()
 while (true) {
  const result = await stripe(env, path, 'GET', { ...fields, limit: '100', ...(cursor ? { starting_after: cursor } : {}) })
  need(Array.isArray(result.data) && typeof result.has_more === 'boolean', 'Stripe returned an invalid paginated payout response.', 502)
  for (const item of result.data) {
   need(item && typeof item === 'object' && item.livemode !== true, 'Stripe returned a live-mode or invalid payout record.', 502)
   const id = objectId(item.id, 'record ID')
   need(!seen.has(id), 'Stripe returned a repeated record while paginating payouts. Try again after checking the payout in Stripe.', 502)
   seen.add(id)
   yield item
  }
  if (!result.has_more) return
  need(result.data.length > 0, 'Stripe returned an empty payout page with more pages indicated.', 502)
  cursor = objectId(result.data.at(-1).id, 'pagination cursor')
 }
}

function stripeDate(value: unknown): string {
 need(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402214400, 'Stripe returned an invalid payout date.', 502)
 return new Date(value * 1000).toISOString().slice(0, 10)
}

/** Real test-mode reads only. Stripe cannot attribute manual payouts to charges:
 * https://docs.stripe.com/api/balance_transactions/list#balance_transaction_list-payout
 * Fail rather than attach unassigned balance activity to an invented payout.
 */
export async function stripePayoutLines(env: StripeEnv): Promise<SourceLine[]> {
 const lines: SourceLine[] = [], transactions = new Set<string>()
 for await (const payout of stripePages(env, '/payouts', {})) {
  if (payout.status !== 'paid' || payout.currency !== 'usd') continue
  need(payout.automatic === true, 'Stripe manual payouts have no charge-to-payout attribution. Import an automatic payout; unassigned balance transactions cannot be used as settlement evidence.', 400)
  const payoutId = objectId(payout.id, 'payout ID'), date = stripeDate(payout.arrival_date)
  for await (const tx of stripePages(env, '/balance_transactions', { payout: payoutId, 'expand[0]': 'data.source' })) {
   if (!['charge', 'payment', 'refund', 'payment_refund'].includes(tx.type)) continue
   need(tx.currency === 'usd', 'Only USD Stripe settlement transactions can be imported.', 400)
   need([tx.amount, tx.fee, tx.net].every(Number.isSafeInteger) && sumCents([tx.amount, -tx.fee]) === tx.net, 'Stripe returned settlement amounts that do not reconcile in integer cents.', 502)
   need(!transactions.has(tx.id), 'Stripe attributed the same balance transaction to multiple payouts. Reconcile the payouts in Stripe before importing.', 502)
   transactions.add(tx.id)
   const payment = tx.source
   need(payment && typeof payment === 'object' && payment.livemode !== true && !payment.deleted, 'Stripe did not expand the settlement payment source. Check payout permissions and retry.', 502)
   const sourceId = objectId(payment.id, 'payment source ID')
   const intent = payment.payment_intent
   const paymentId = typeof intent === 'string' ? objectId(intent, 'payment intent ID') : intent ? objectId(intent.id, 'payment intent ID') : undefined
   need(!intent || typeof intent !== 'object' || intent.livemode !== true, 'Stripe returned a live-mode payment intent.', 502)
   const reference = paymentId || sourceId
   lines.push({ source: 'stripe', externalId: tx.id, payoutId, reference, start: null, end: null, guestName: payment.billing_details?.name || '', date, grossCents: tx.amount, feeCents: tx.fee, netCents: tx.net, currency: 'USD', ...(paymentId ? { paymentId } : {}) })
  }
 }
 need(lines.length > 0, 'No paid automatic USD payouts with supported settlement transactions are available. Payments may still be pending or settle in another currency. Wait for a paid automatic USD payout; currency conversion and unassigned balance transactions cannot be imported.', 409)
 return lines
}
