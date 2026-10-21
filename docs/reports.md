# Portfolio reports

Open **Reports** in the manager workspace (`/app/reports`). These are live reads of saved Cabin records, with their revision and generation cutoff shown. Reports reuse the existing human owner/manager authority. Rental-owner portal sessions, field staff and agent credentials cannot open this manager reporting door. Source links retain the same authority as their original pages.

Choose an inclusive start, exclusive end, home, rental owner and channel. All matching rows remain available in the page and in **Download complete report (CSV)** and **Download complete report (JSON)**. JSON is also available at `/api/cabin/reports.json`; CSV at `/api/cabin/reports.csv`, using the page's query parameters. There is no row cap. An empty selection says so; invalid filters are refused. A concurrent data revision causes a retryable refusal rather than mixing cutoffs.

## Inventory, rates and pace

Nights are property-local calendar dates; checkout releases its date's night, including across DST. Occupancy divides distinct confirmed guest nights by selected home calendar nights less distinct blocked nights. Owner, maintenance (including work-order inventory), and opaque other blocks are shown separately, with links to every blocked-night source. Overlapping blocks count once, in owner, maintenance, other precedence. Colliding stays count once per home for occupancy and produce exceptions. Channel/owner filters select the guest cohort while retaining the selected homes' blocked-inventory denominator.

ADR divides known rental cents by priced guest nights; RevPAR divides the same rental cents by available nights. Both exclude fees and taxes. Missing rental prices produce exceptions and remain unavailable on source rows; their nights are excluded from ADR's priced-night denominator. Zero-priced stays with a saved price do count. Split-stay rental cents are allocated by calendar night; integer-cent remainders go to the earliest nights, so adjacent periods reconcile exactly.

Stay-date mode selects stays overlapping the window. Booking-date mode selects the cohort whose first saved reservation revision was recorded within the window in that home's time zone; a later amendment does not change that booking date. Its occupancy still covers only nights within the selected window. Booking pace groups this cohort by first booking date and shows full booked nights, known rent and ended bookings. It describes current saved history rather than an unavailable historical inventory snapshot. Cancellations/no-shows remain source rows and contribute no occupied nights.

## Accounting and owner performance

Financial rows use immutable journal effective dates within the window, independently of the reservation date cohort. Every journal and leg is included in downloads, including non-revenue movements. Amounts are integer USD cents.

- Cash gross comprises recorded trust-cash receipts (including advances) and payout fees. Cash net subtracts recorded paid refunds, channel fees and owner expenses; a payable-only commission or cleaning invoice has no cash cost. Distributions, tax remittance and non-cash damage authorizations remain visible journal movements and do not become revenue or operating costs.
- Accrual gross comprises posted earning/owner-revenue events (`earn`, `direct-payment`, and channel payouts without a separate earning/direct-payment journal). Net deducts posted refunds, fees, management commissions and owner expenses, including approved vendor payables. Contractual receivable/advance journals do not themselves assert earned revenue. Payout transfer journals do not duplicate a separately recorded earning event. Reversals retain the original event family and invert its contribution.
- Contracted rent and accounting revenue are shown separately. An unposted earning remains an exception; the report does not manufacture a journal to fill it. Processor funds are not a trust-bank receipt. A refund's source and returned fees retain their signs.
- Owner performance groups the same financial source contributions by immutable owner reference. Net contribution differs from owner-liability movement and from trust-cash movement; all three are labelled. Historical journals retain their original owner after a property transfer.
- Recorded cleaning cost includes owner-use cleaning journals and approved work-order costs whose asset is `Cleaning`. Unrecorded costs are unavailable, not an asserted free cleaning. Cash excludes unpaid invoices; accrual includes their recorded owner payable.

## Exceptions and operations

Unpriced reservations, missing settlement evidence, unmatched payouts, positive posted receivables, unposted earnings, source conflicts and inventory collisions stay visible with source links. A receipt does not claim final provider or bank reconciliation. Calendar connection status and last successful read are shown separately from the local report cutoff; no connection means freshness is unknown.

Readiness uses the existing evidence-based readiness reader for each selected arrival. Turnover windows, work-order due dates and guest-message service deadlines include their saved state and source link; overdue outstanding work is marked using the home's local time (or the saved UTC instant for message deadlines). A historical report is a view of current saved readiness, not an invented historical attestation.

REPORT-002's saved/scheduled reports and AGENT-005's report citations must reuse these definitions, permitted sources and explicit cutoff. INTERFACE-001 owns its separately stated portfolio scale/performance proof; this report does not claim that clause's scale journey.

## Acceptance proof

`tests/finance.test.mjs` — `REPORT-001: filtered mixed-channel reports reconcile occupancy, bases, exceptions and complete exports to permitted sources` proves:

- Mixed-channel reservations, owner/maintenance blocks, cancelled/unknown-price stays, occupancy denominator, ADR/RevPAR and exact split-month/DST rental allocation.
- Booking cohorts/pace, channel mix, owner filters, gross/net, cash/accrual, refunds, cleaning payables, collection/settlement exceptions, readiness and service deadlines.
- Public source reads and all matching CSV/JSON rows, including 128 payout rows, immutable journal legs, reversals, restart and unauthorized/revoked access refusal.

`tests/readiness-browser.test.mjs` — `REPORT-001: desktop and phone reports filter, explain denominators, drill to sources and download complete totals` proves the real manager HTML at 1440 and 390: filter controls, definitions, complete CSV bytes/totals, source drill-down, cash and booking-date selection, and an empty owner/channel intersection.
