# Cabin homepage claims → code (run-site gate table)

Branch `br/style` on just-every/run-cabin, 17 Oct 2026; rows 1, 8, 11, 12, 13 and 14 updated on `main` by the calendar and channels area, 17 Oct 2026. Direct booking rows 18–23, 25, 51 and 52 updated 17 October 2026. Every capability the homepage states, in page order, with the code that backs it today, **partial** (a narrower version exists, named), or **contract** (contract, not yet in code), with the target-contract clause that carries it. The copy is the design desk's (owner-accepted, 16 Oct 2026) and is not watered down; this table is what the run-site gate reads before any deploy.

Note on "the contract": `CONTRACT.md` on `main` (17082d6, "Target contract: US vacation-rental PMS and channel manager") **is** the new contract this brief describes: a US PMS with channel manager replacing Guesty, Hostaway, OwnerRez and Lodgify. Its own audit table scores today's code against each clause; the statuses below agree with it. Under the owner's 17 Oct rule (platform/SEED-HOMEPAGE-PROCESS.md, principle 12) a core-feature claim may be backed by a contract clause and is a build priority to ship within about a week.

Status key: **code** = exists and runs today; **partial** = a narrower version exists; **contract** = contract, not yet in code.

| # | Section | Claim on the page | Status | Code path, or contract clause |
|---|---|---|---|---|
| 1 | Hero | "syncs Airbnb, Vrbo and Booking.com" | code | Live iCal both ways for all three: each home polls its Airbnb, Vrbo and Booking.com calendar links on a 15–60 minute Cron and shows last-synced time and errors (`src/cabin/channels.ts`, `src/cabin/ui/channels.ts`, `src/server.ts` `scheduled`); each home publishes its own Cabin export link per channel (`src/cabin/ical-export.ts`). Channel partner APIs (SYNC-002–004) are later and the page says so. On RER Managed, links show "not available yet" until its provider relay. `tests/cabin.test.mjs` (line 143). |
| 2 | Hero | "answers your guests" | contract | No messaging in `src/cabin`. MESSAGE-001, MESSAGE-004. |
| 3 | Hero | "sends the cleaner" | partial | Turnovers prepared from an approved booking and assigned to a cleaner by a person or an agent draft: `src/cabin/turnovers.ts`, `src/cabin/ui/turnovers.ts`. Not triggered by the reservation. OPS-001. |
| 4 | Hero | "and the door code" | contract | No lock or access-code code. OPS-005. |
| 5 | Hero | "turns every payout into an owner statement" | partial | Owner statements from entered lines, commission applied, approved and frozen, CSV export: `src/cabin/statements.ts`, `src/cabin/ui/statements.ts`. No payout import. FIN-002, FIN-004. |
| 6 | Hero | "100% free, open source alternative to Guesty, Hostaway and OwnerRez" | code (free, open source) | `LICENSE` (MIT); nothing charges. "Alternative to" rests on the target contract as a whole (BOUNDARY-001). |
| 7 | Hero tags | Ready ✓ · Pine Ridge Cabin; Checked out 10:00 am · Sandy Shores | partial | Completed turnover with checklist and photo: `src/cabin/turnovers.ts` (`turnover.complete`), `src/cabin/photos.ts`. No checkout event or readiness state. OPS-003, RES-002. |
| 8 | Hero tags | Guest arriving 4 pm · Airbnb · Lake Loft | code | Each stay carries a guest name and arrival time from the feed ("Reserved - Name") or entered by a manager (`booking.details`, `src/cabin/inventory.ts`); the calendar grid bar and "Arrivals in the next two weeks" show guest, time, channel and home (`src/cabin/ui/calendar-grid.ts`, `src/cabin/ui/requests.ts`). OPS-008 day board remains contract. |
| 9 | Hero tags | Door code 4417 active | contract | OPS-005. |
| 10 | Hero tags | Cleaning · Luis · Desert Casita | code | Assigned turnover visible to its cleaner: `src/cabin/turnovers.ts`, `src/cabin/domain.ts`. (No scheduled time window.) |
| 11 | Hero tags | Vrbo request declined · overlaps Airbnb | code | A request for held nights is declined with the overlapping stay named, e.g. "Overlaps Airbnb stay Oct 17 → Oct 20", recorded and shown under Recent requests (`src/cabin/inventory.ts` `reservation.request`, `src/cabin/ui/requests.ts`). Requests are taken in Cabin; answering them inside Vrbo needs its partner API (SYNC-008, later). `tests/cabin.test.mjs` (line 178). |
| 12 | Channels | "connects to Airbnb, Vrbo and Booking.com both ways" | code | As row 1: calendar links in and Cabin's export links out for Airbnb, Vrbo and Booking.com (`src/cabin/channels.ts`, `src/cabin/ical-export.ts`). Partner APIs later. |
| 13 | Channels | "Book a night anywhere and it closes everywhere" / "No double bookings" | code | Every stay, hold and block takes its nights; each channel's export link lists every night held elsewhere (other channels and direct bookings) on its next read, and overlapping or concurrent requests are never both accepted (`src/cabin/inventory.ts`, `src/cabin/storage.ts` version guard, `src/cabin/ical-export.ts`). Caveat stated on the page: links are polled every 15–60 minutes, so a channel can sell a night before it hears; such a collision is kept and shown in red. Closing within seconds needs partner APIs (SYNC-006, later). `tests/cabin.test.mjs` (lines 143, 178). |
| 14 | Channels | Calendar card: three channels, bars, blocked row | code | Homes-by-days grid with one row per channel (Airbnb, Vrbo, Booking.com, Direct), channel-coloured bars, Blocked bars and hatched Closed rows for nights held elsewhere, at 1440 and a scrolling 390 layout (`src/cabin/ui/calendar-grid.ts`, `public/cabin.css`). |
| 15 | Guest inbox | "Airbnb, Vrbo, Booking.com, text and email in one thread per guest" | contract | MESSAGE-001. |
| 16 | Guest inbox | "Scheduled messages go out on time" | contract | MESSAGE-003. |
| 17 | Guest inbox | "drafted replies wait for your nod" | contract | MESSAGE-004. (The draft-then-approve pattern exists for calendars, turnovers and statements: `src/cabin/model.ts` `approve`.) |
| 18 | Direct bookings | "Your own booking site" / "Guests book you directly" | code | Public per-home booking pages and published-home directory on the install: `src/cabin/direct/http.ts`, `public-ui.ts`; availability uses the shared channel calendar. Branded custom-domain galleries, search and embeds remain open (WEB-001/002). |
| 19 | Direct bookings | "pay with Stripe" | code | Stripe-hosted card checkout in real Stripe test mode, server-verified payment before confirmation: `src/cabin/direct/stripe.ts`, `checkout.ts`, `payments.ts`; `tests/direct.test.mjs`. Live mode and ACH remain open (PAY-001). |
| 20 | Direct bookings | "rental agreement" | code | Guest reviews and signs the versioned home agreement; exact signed text, price, name, consent, timestamp and SHA-256 retained on stay and downloadable by guest/staff: `src/cabin/direct/checkout.ts`, `public-ui.ts`. Amendments remain open (WEB-003). |
| 21 | Direct bookings | "ID check" | code | Required Stripe Identity test-mode sessions and provider-state reconciliation; no ID images retained and no confirmation until verified: `src/cabin/direct/stripe.ts`, `payments.ts`. No runtime fixture fallback; manual-review controls remain open (WEB-004). |
| 22 | Direct bookings | "damage deposit happen at checkout" | code | Separate Stripe manual-capture authorization on the saved test card after rent payment, required before confirmation; expiry and errors visible: `src/cabin/direct/payments.ts`. PAY-003 remains partial for broader refunds and renewals. |
| 23 | Direct bookings | Lodging tax line (ME 9%) | code | Each configured state/county lodging tax is itemized at its basis-point rate and collected with rent and fees: `src/cabin/direct/rules.ts`, `public-ui.ts`, `stripe.ts`; Maine 9% covered. FIN-008 filing/remittance integration remains open. |
| 24 | Pricing | "Connect PriceLabs or Wheelhouse" | contract | PRICE-001. |
| 25 | Pricing | "set minimum nights, gap rules and fees" | code | Per-home minimum/maximum nights, orphan-gap rule, cleaning and per-extra-guest fees; rejected requests give the reason and cannot allocate nights: `src/cabin/direct/rules.ts`, `admin.ts`; `tests/direct.test.mjs`. RES-004 broader seasonal/channel restrictions and WEB-005 offers remain open. |
| 26 | Pricing | "every channel gets the same price" | contract | PRICE-002, SYNC-002–004. |
| 27 | Interlude | "All five homes ready for Saturday" | partial | Completed turnovers per home (row 7); no portfolio readiness view. OPS-003. |
| 28 | Turnovers | "Every reservation creates its turnover" | partial | As row 3. OPS-001. |
| 29 | Turnovers | "and its door code" | contract | OPS-005. |
| 30 | Turnovers | "Cleaners get the checklist on their phone" | code | Responsive cleaner view of only their own jobs: `src/cabin/ui/turnovers.ts`, `src/cabin/domain.ts`, `public/cabin.css`. |
| 31 | Turnovers | "photos come back when the home is ready" | partial | One photo (JPEG or PNG up to 256 KB) per completed job, private: `src/cabin/photos.ts`, `src/cabin/turnovers.ts`. The card's "Photos 12 / 12" needs several photos. OPS-002. |
| 32 | Turnovers | Checklist items ticked on the card | code | Every approved item must be ticked to complete: `src/cabin/turnovers.ts`. |
| 33 | Turnovers | "Patio light out · task added for Dale" | contract | OPS-004. |
| 34 | Stay recovery | "Cabin rebooks the turnover" | contract | AGENT-001. |
| 35 | Stay recovery | "resets the door code" | contract | AGENT-001, OPS-005. |
| 36 | Stay recovery | "offers the credit you approved" (within your $100 limit) | contract | AGENT-003, AGENT-006. |
| 37 | Stay recovery | "confirms the home is ready" | partial | Photo-evidenced completion (row 7). AGENT-001, OPS-003. |
| 38 | Stay recovery | "Owner balance updated −$75.00" | contract | FIN-001. |
| 39 | Owner statements | "Airbnb, Vrbo and Stripe payouts match to their stays" | contract | FIN-002. |
| 40 | Owner statements | "Owners get a statement" | partial | Approved frozen statement and CSV for owners and managers to download: `src/cabin/statements.ts`. No delivery to owners. FIN-004. |
| 41 | Owner statements | "and a portal" | contract | FIN-005. |
| 42 | Owner statements | "the books sync to QuickBooks" | contract | FIN-007. |
| 43 | Owner statements | Statement card arithmetic (gross, fees, management 20%, payout) | partial | Commission applied with integer half-up maths to entered lines: `src/cabin/statements.ts`. Channel fees are entered lines, not imported. FIN-003. |
| 44 | Move in | "Move from Guesty, Hostaway or OwnerRez" | contract | Only Cabin's own five-column property-register CSV: `src/cabin/movein/`. MIGRATE-002, MIGRATE-003, MIGRATE-004. |
| 45 | Move in | "with your listings" | partial | Homes with owner and commission from the register CSV, previewed, approved, journalled, undoable: `src/cabin/movein/index.ts`, `src/cabin/movein/csv.ts`. MIGRATE-001. |
| 46 | Move in | "reservations, guests and owner balances" | contract | MIGRATE-002–004, MIGRATE-007. |
| 47 | Move in | "Channels reconnect to the same listings" | contract | SYNC-002–004, MIGRATE-003. |
| 48 | Ownership | "Run Cabin on your own computer or server" (five commands) | code | `rer install`, `rer setup`, `rer dev` via `@runeditrun/rer` 0.2.38 (`package.json`, `scripts/installer/local.mjs`); `rer deploy` for a server. |
| 49 | Ownership | "keep every booking, guest and payout" / "Your guests, your data" | code | Local D1 database and private photos in the installation: `src/cabin/storage.ts`, `src/cabin/photos.ts`. (Guest and payout records themselves are contract: GUEST-001, FIN-002.) |
| 50 | Ownership | "Export everything, any time" | code | `rer export` / `rer import` with the archive policy: `src/cabin/archive-policy.mjs`, `tests/archive.test.mjs`. |
| 51 | Quiet details | Damage deposits: "Held on the card, released after checkout" | code | Test-card deposit held separately, released by the five-minute job after the configured post-checkout window, or captured by staff after checkout with amount, reason and evidence; provider idempotency and refresh reconciliation: `src/cabin/direct/payments.ts`. Early authorization expiry is flagged for a person, not silently renewed (PAY-003). |
| 52 | Quiet details | Lodging tax: "Collected and filed by state and county" | partial | Configured state/county levies are separately itemized and collected; managers record separate filing/remittance confirmation references on each paid stay (`src/cabin/direct/admin.ts`, `ui/direct.ts`). Cabin does not yet file or remit through a tax provider. FIN-008 remains partial; no filing-provider account is configured. |
| 53 | Quiet details | Owner portal: "Owners see stays and statements any time" | contract | FIN-005. |
| 54 | Quiet details | Maintenance: "Broken things become tasks with photos" | contract | OPS-004. |
| 55 | Quiet details | Review replies: "Thank-yous and replies sent on schedule" | contract | GUEST-003, MESSAGE-003. |
| 56 | Quiet details | Activity log: "Every change, message and payout, recorded" | partial | Domain and credential events and every approval with actor and revision: `src/cabin/storage.ts`, `src/cabin/model.ts` (`approve`), approval history in `src/cabin/ui/admin.ts`. No messages or payouts to record yet. AUDIT-001. |
| 57 | Closing | "Open source vacation rental software for hosts and managers" / "Free and open source, MIT licensed" | code | `LICENSE`, `src/cabin/`. |
| 58 | Footer, actions | "Try the demo" | — | No hosted demo exists (demo.run-cabin.com does not resolve, 17 Oct 2026), so the link opens `/run`. |

## Totals

| Status | Rows | Count |
|---|---|---|
| code | 1, 6, 8, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 25, 30, 32, 48, 49, 50, 51, 57 | 22 |
| partial | 3, 5, 7, 27, 28, 31, 37, 40, 43, 45, 52, 56 | 12 |
| contract | 2, 4, 9, 15, 16, 17, 24, 26, 29, 33, 34, 35, 36, 38, 39, 41, 42, 44, 46, 47, 53, 54, 55 | 23 |
| link (not a claim) | 58 | 1 |

57 claims: 22 code, 12 partial, 23 contract. Every contract row names a clause in `CONTRACT.md` on `main`; nothing on the page is outside the contract.

## Build priorities the page creates (nearest first)

Reservation-triggered turnovers with several photos (OPS-001, OPS-002); payout import into statements (FIN-002); owner portal and statement delivery (FIN-004, FIN-005); move-in from Hostaway, Guesty and OwnerRez (MIGRATE-002–004); then messaging, locks and pricing connections. Direct-booking follow-on work includes live payments/ACH, embeds, agreement amendments and tax filing/remittance integration.
