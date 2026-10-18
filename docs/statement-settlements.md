# Reviewed Booking.com and Stripe settlements

`payout.import` accepts `source: "booking.com"` and `source: "stripe"` alongside
the existing Airbnb and Vrbo exports. A manager supplies the selected
`propertyId`, the CSV text as `csv`, and a required `evidenceReference` of up to
500 characters. The reference should identify the retained provider statement,
report or accounting document, including the provider account and reporting
period. Keep the original evidence available for review; the reference is saved
with each new transaction. Do not put credentials or private download tokens in
the reference.

These are accountant-prepared transaction rows copied from genuine provider
evidence. They are not adapters for every native export format, and importing
them does not establish a live channel connection, bank reconciliation or a
provider acknowledgement. The existing `payout.stripe` command separately reads
Stripe test-mode automatic payouts; CSV import makes no live API request.

## CSV columns

Use one row per reservation payment or refund, never a payout summary plus its
component transactions. A multi-stay payout uses the same Payout ID on separate
rows, each with its own genuine provider Transaction ID and stay reference.

| Column | Required value |
| --- | --- |
| Transaction ID | Stable provider transaction ID. Stripe requires its balance transaction `txn_…` ID, rather than a charge, refund or payment intent ID. |
| Payout ID | Actual provider batch/payout reference. Stripe requires its `po_…` ID. Unallocated transactions cannot be assigned an invented batch. |
| Reservation ID | Booking.com reservation reference. For Stripe, a direct stay reference is required when Payment intent ID is absent. |
| Payment intent ID | Optional Stripe `pi_…` ID copied from provider evidence. Used first to find the linked direct stay. Leave blank for Booking.com. |
| Date | Actual settlement/payout date, in `YYYY-MM-DD` or US `M/D/YYYY`. |
| Start date, End date | Stay check-in and check-out dates from evidence. Supply both, or leave both blank if absent. Checkout must follow check-in. |
| Type | `payment`, `reservation`, `charge` or `refund`. |
| Currency | Explicit `USD`. Optional Payment currency and Payout currency, if present, must also be USD. |
| Gross amount | Explicit transaction gross in USD decimals with at most two decimal places. |
| Fee amount | Explicit owner fees in USD decimals. Use positive expenses and negative returned fees; zero must be explicit. |
| Net amount | Explicit transaction net in USD decimals. Gross minus fees must equal net exactly. |
| Guest name | Optional name from the evidence. |

Headers are insensitive to case and spaces/underscores/hyphens. The parser also
accepts Payout reference, Reservation number / Reservation reference,
Payment intent, Payout date / Settlement date, Check-in / Arrival date,
Check-out / Departure date, Transaction type, Gross, Fees / Fee, Net and Guest
as corresponding column aliases. Multiple aliases with conflicting values are
refused. Quote cells containing commas, quotes or newlines.

Payment rows require positive gross and nonnegative fees and net. Refund rows
require negative gross and nonpositive net; fees may be positive charged fees
or negative returned fees, provided the exact equation holds. Missing amounts,
fractional cents, FX rows, ambiguous dates, deposits, taxes and unassigned
adjustments are refused. No fees, missing amounts or payouts are estimated.

## Matching and repeat imports

Booking.com matches only Booking.com stays. Stripe first uses an exact payment
intent link to a direct stay; a link to another home is refused. Without a saved
payment intent link, matching uses the existing reservation reference or exact
stay dates within the selected home and source channel. More than one candidate
stays unmatched for manager review. Names and dollar amounts do not choose a
stay. `payout.match` can resolve an unmatched row within the same constraints.

Transaction identity is independent of amounts, dates, payout batch and row
order. Duplicate transaction IDs within a CSV are refused. Reimporting identical
rows returns the saved rows as duplicates without changing them. Changed saved
amounts, references, batches, dates, payment intent IDs or other retained row
details are refused; use a separately identified, source-backed correction
rather than rewriting an existing line. A changed evidence reference on an
already documented CSV row is also refused. Legacy lines without an evidence
reference keep their original record when recognized as duplicates.

Stripe CSV and API imports share the same `txn_…` external identity. If their
details differ, import is refused for reconciliation instead of creating a
second payment. This can occur when the reviewed CSV includes stay dates or a
guest name absent from the API response. Original records and any frozen
statement remain unchanged.
