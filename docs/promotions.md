# Promotions and paid stay supplements (WEB-005)

Use **Direct bookings → Promotions and paid stay offers**. The owner approves each home’s contribution, inventory, coupon, tax and refund policy. Managers prepare exact offers, approve their email, inspect the private guest page and approve any refund. Hosted provider acceptance is assessed in CONTRACT.md.

The implementation extends an existing priced reservation. It supports paid gap-night extensions, early arrival, late departure and extras; home/date/channel/length-scoped coupons on new direct quotes and supplements; and the existing separate private returning-guest booking rates in `guests/offers.ts`. A supplement never creates a second guest stay or rewrites the original Stripe charge or signed checkout quote.

## Persistent records and authorization

`cb_records` contains `promotionPolicies` and `promotionOffers`. The promotion store reads those kinds directly; they do not need additions to `Data` or `kinds`. All writes use Cabin's actual `mutate` transaction and global version fence. Stripe requests, private-link signatures, submitted checkout claims, provider identifiers, accepted terms, inventory holds and refund outcomes survive restart. There is no application mock or in-memory payment state.

Only the owner configures a home policy. Human owners/managers create and approve exact offers and refunds. Cleaners and bearer agents receive no promotion state or authority. Private links contain a random token; only its SHA-256 hash and a sealed copy are stored. The guest signs the exact offer and authorizes one hosted Stripe card payment. Links expire, reject cancelled offers, and stop working after guest erasure or restore. Restored records require the integration export scrub and remain inactive.

## Public command contract

Send commands to the existing `/api/cabin/command` transport.

| Command | Input |
| --- | --- |
| `promotion.configure` | `propertyId`, existing `revision` if updating, `enabled: "yes"`, `minimumNetCents`, `providerFeeReserveCents`, `stock`, `refundRetainedBps`, `refundDeadlineHours`, `taxBps`, `coupons`, `confirm: "yes"` |
| `promotion.create` | `bookingId`, `bookingRevision`, `kind: "gap" / "early" / "late" / "extra"`, `title`, `description`, `baseCents`, `costCents`, ISO `expiresAt`; `end` for gap, `time` for early/late; optional `coupon`, `quantity` |
| `promotion.send` | Exact `id`, `revision`, `confirm: "yes"` |
| `promotion.cancel` | Exact `id`, `revision`, `confirm: "yes"`, `reason` |
| `promotion.reconcile` | `id` |
| `promotion.refund` | Exact refund-due offer `id`, `revision`, `confirm: "yes"` |

Coupon entries are `{code,bps,from,until,minNights,repeatOnly,channels}`. Their home is the containing policy. They discount the supplement’s pretax price or a new direct booking’s rent before its saved tax lines. Public bookings reject returning-only coupon codes; the private verified returning-rate workflow covers those guests. Rates do not stack. Owner allocation and minimum contribution are rechecked at checkout. A repeat-only coupon requires another completed stay at the same home in the reviewed guest group. No code is inferred from an email address.

`/offers/<token>` is the private guest page. HTML forms and JSON POSTs support `action: "accept"` with `signature` and `consent: "yes"`, and `action: "refresh"`. POSTs require the application Origin. Guests do not receive an operator session, full guest profile or door capability from an offer link.

The caller of `promotionGuestPanel(env,bookingId)` must already have authenticated that original stay. Both original guest portals show current private offer links. Human operators release a preview through an authenticated, audited door. `promotionState` strips the sealed token and token hash before returning staff state.

## Checks and downstream behavior

Before sending and again before opening checkout, Cabin checks the live original reservation revision, guest email verification, explicit home-specific offers consent, coupon scope, actual calendar inventory, outstanding extra stock, active owner policy, accountant-reviewed frozen owner allocation, ledger period and incremental net contribution. Net contribution includes approved service cost and the owner's processor-fee budget. The latter is a conservative budget, not a fabricated actual fee; actual imported provider fees are posted separately.

The cleaner check uses the actual dispatch planner on a cloned proposed reservation and every affected preceding/current turnover. A cleaner, approved route, duration, daily capacity and feasible work window must exist. Early access that would shorten cleaning below its required window is rejected. Extra stock is held by property and exact extra title across overlapping dates. Titles therefore identify the host's stock item; pricing is an explicitly approved aggregate amount for the stated quantity.

Sending a gap offer creates a real calendar block for just the additional nights. The block prevents other Cabin reservations and appears in calendar exports. Acceptance removes that block and changes the original stay. Its price, reservation history, turnover date/window, guest access interval, lock work, guest schedules and direct-stay deposit timing follow the amendment. Extras also create a real fulfillment task. Changed cleaner windows require fresh cleaner acceptance under the existing dispatch policy. Existing required rental agreements follow their normal amendment/re-signing gate; signing a supplement does not bypass that gate.

Payment reconciliation reads Stripe's actual session and expanded succeeded PaymentIntent, verifying the amount, currency, offer and original booking. Replayed reconciliation does not apply the amendment or ledger a second time. Interrupted session creation is found by provider metadata; an absent result remains explicitly uncertain and is not blindly submitted again. Payment is checked against eligibility once more before applying; if the service became unavailable, the received funds are recorded as guest credit and a full refund is due instead of granting unavailable inventory.

Supplemental payments post processor funds, tax, commission, reserve, service-cost payable and each frozen owner's payable. Actual-evidence Stripe payout imports match the supplemental PaymentIntent to the original stay and transfer processor funds into bank cash, with real fees allocated to the frozen owners. The original reservation balance includes confirmed supplemental receipts less confirmed refunds. Ledger monthly closes therefore include the supplemental owner movements without inventing a bank settlement.

Unpaid expiration/cancellation releases the calendar block. An open Stripe checkout retains its block until Stripe confirms payment or expiration; the scheduled sweep closes expired/withdrawn sessions and reconciles uncertain requests. An accepted offer can be cancelled against its exact applied stay revision. It restores the prior dates/access and applies the signed refund deadline/retention policy. Ending the whole reservation makes its applied supplements refund-due under their separate accepted policies. Refund approval is explicit; uncertain submissions are read from Stripe rather than repeated. Refunds preserve the original owner scopes and allocate every cent of the actual refunded amount. Retention is still a guest charge. Guest erasure revokes private links and scrubs operational contact/signature copies without creating a refund by itself.

## Product behavior and checks

The owner policy and offer forms use ordinary fields, percentages and USD amounts. Each exact offer displays its guest terms, expiry, price, discount, tax, contribution and mail outcome. A guest signs the supplement and pays through Stripe; refresh reconciles provider acceptance. Accepted terms and receipts remain separate from the original signed quote and charge. Layered offers cancel in reverse dependency order, preserving unrelated state. The original reservation cannot be silently repriced or moved while accepted supplements remain unsettled. Changed work requires the cleaner’s fresh acceptance.

The public-route tests cover signed gap, early/late and extra acceptance; restart and replay; timed access, cleaner plans, reservation balances and original-stay fulfillment; exact owner liabilities and source-backed settlement/statement allocation; refund policy; native coupon checkout; invalid coupon, cleaning conflict, stock, expiry, consent and staff restrictions. The established direct booking, reservation, inbox, guest, ledger, finance, security and archive tests exercise their affected boundaries. Browser journeys use the native owner controls and private guest page at 1440 and 390.

Calendar exports carry updated dates; live OTA acknowledgement and device-confirmed entry remain their separate SYNC and OPS prerequisites. A recorded tax liability or statement does not file tax or execute an owner payout. Provider-uncertain checkouts retain their inventory until a terminal provider outcome is read, with an explicit operator exception; they are never resubmitted blindly.

## Hosted acceptance boundary

The sd-cabin-c17 installation exercised a USD 218.00 gap-night extension and a USD 54.50 early-arrival supplement with actual Stripe test-card payments. The guest signed each offer, the original reservation’s dates/price/balance changed, access windows and accepted cleaner work followed, and all three channel export feeds reflected the extension. The actual cleaner planner refused an 11:00 arrival and accepted 13:00. Both supplements were then cancelled through the operator forms and refunded by Stripe, restoring the original stay. Guest offer, payment and refund mail reached the real QA mailbox with SPF, DKIM and DMARC passing. Changed operator, guest, calendar and cleaner screens were used at 1440 and 390.

WEB-005 remains **partial**. Monthly close correctly refused the phone-created original stays because their source settlement records were missing. This round did not fabricate manual receipts or bank settlements to bypass that refusal. The supplied Stripe test account is Australian and settles AUD; complete USD settlement/owner-statement acceptance still needs eligible source payout and bank evidence. Route tests exercise the statement allocation using fakes only at the Stripe network boundary; that is not hosted payout proof. Live channel/device acknowledgement also retains the existing SYNC and OPS account dependencies. [remaining-dependencies.md](remaining-dependencies.md) lists every remaining partial/missing clause.
