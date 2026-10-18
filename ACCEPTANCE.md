# Target acceptance

Target: **16 October 2026** · US vacation-rental PMS and channel manager · **USD**. This replaces the former first-release exclusions; the complete target is [CONTRACT.md](CONTRACT.md). The existing bullet-list acceptance form is retained, expanded to one journey per stable clause.

Statuses use the same audited implementation baseline and definitions as the contract. A done entry is a narrow implemented behavior with an exercising test; partial entries identify exactly what exists. Missing entries are build work, not skipped acceptance. All journeys must run through the real app, documented API, shared CLI or provider boundary with permissioned data; network/paid-edge test doubles do not establish production provider acceptance. Do not enable real guest sends, charges, access changes, filings or payouts without the explicitly authorized integration and human controls.

For browser journeys use realistic US properties, guests, owners and USD amounts at 1440 and 390 pixels; test property-local time zones, permitted roles and failure recovery. Native journeys require both iOS and Android. Report only actually observed outcomes; provider submission, acknowledgement, delivery, physical readiness and final financial closure are separate evidence.

## Portfolio, authority and the existing approval foundation

- **PROPERTY-001 — A usable vacation-rental property register · partial.** Create two US properties with different time zones and owners through the property editor; amend one agreement and show that existing bookings retain their original terms while new quotes use the new terms.
  Current evidence: `src/cabin/people.ts`; `src/cabin/model.ts`; `tests/cabin.test.mjs:17`. Remaining: Only names, owner contact and a fixed commission are implemented; property content, time zones and versioned management agreements are absent.

- **AUTH-001 — Current native authority on every private door · done.** Use signed-out, owner, manager and two cleaner sessions against state and mutation routes; reject a cross-origin POST, cleaner financial access, another cleaner’s photo and a revoked grant.
  Current evidence: `src/cabin/credentials.ts`; `src/cabin/storage.ts`; `src/cabin/domain.ts`; `src/cabin/http.ts`; `tests/cabin.test.mjs:17`; `tests/cabin.test.mjs:67`.

- **AUTH-002 — PMS roles and property-specific permissions · missing.** Invite each role from team settings; use its session to perform an allowed action and attempt the same action on another property, statement, identity document and credential; revoke a role during a queued job and verify execution is refused.
  Current evidence: none; the described acceptance journey is missing.

- **CONTROL-001 — Exact human approval and immutable publication · done.** Prepare competing revisions through the command API, approve one, then submit the stale and duplicate approvals; change booking/property terms and prove the outdated turnover or statement cannot publish.
  Current evidence: `src/cabin/model.ts`; `src/cabin/storage.ts`; `src/cabin/calendars.ts`; `src/cabin/turnovers.ts`; `src/cabin/statements.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55`; `tests/cabin.test.mjs:67`; `tests/cabin.test.mjs:90`.

- **CONTROL-002 — Revocable draft-only bearer access · done.** Issue a key in Agent access; prepare all three draft types through the bearer API, reject their approval commands and a bearer request to a human door, then revoke the key and reject its next context read.
  Current evidence: `src/cabin/credentials.ts`; `src/cabin/http.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:109`.

## Distribution and reservations

- **SYNC-001 — Reviewed calendar files remain honest snapshots · done.** Import two overlapping channel files, inspect the clash and timestamps, approve exact reviews, reimport without duplicates, cancel or remove a UID, test adjacent checkout/check-in, and reject a stale baseline and malformed file.
  Current evidence: `src/cabin/calendar-file.ts`; `src/cabin/calendars.ts`; `src/cabin/ui/calendar.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55`.

- **SYNC-002 — Airbnb two-way channel management · partial.** Authorize an Airbnb test listing from Connections; book, extend and cancel through Airbnb, change a rate and close dates in Cabin, and verify both systems and their acknowledgement history agree without duplicate reservations. Several accounts and co-hosting: SYNC-010.
  Current evidence: `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/calendars.ts`; `tests/cabin.test.mjs:143`; `tests/cabin.test.mjs:178`. Remaining: Live iCal both ways: Cabin polls the listing's Airbnb calendar link on a 15–60 minute schedule and publishes a per-channel export link. No partner API, rates, restrictions, acknowledgements or co-host grants.

- **SYNC-003 — Vrbo two-way channel management · partial.** Connect a Vrbo listing, complete and alter a reservation at the channel, close inventory and change pricing in Cabin, cancel the stay and reconcile channel acknowledgements, payment responsibility and final availability. Several accounts: SYNC-010.
  Current evidence: `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/inventory.ts`; `tests/cabin.test.mjs:143`; `tests/cabin.test.mjs:178`. Remaining: Vrbo calendar links are polled and Vrbo gets its own export link; Vrbo requests are checked in Cabin. No partner API, reservation lifecycle, rates, fees or acknowledgements.

- **SYNC-004 — Booking.com two-way channel management · partial.** Map a Booking.com room/rate plan; reserve, amend and cancel externally, update Cabin availability/rate restrictions, and compare reservation identity, collection method and accepted channel state. A Payments by Booking.com reservation passes its virtual card to PAY-005, and a property-collect reservation passes its guest card to PAY-006, whose acceptance journeys prove the charges.
  Current evidence: `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/calendars.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:143`. Remaining: Booking.com calendar links both ways (its feed marks every closed night alike, so they import as blocks); connectivity, rate plans, collection-method tracking and live acknowledgements do not exist.

- **SYNC-005 — Listing content and distribution · missing.** Preview and publish one content revision to each named OTA and one Google Vacation Rentals listing; inspect accepted and rejected fields, keep an intentional channel override, and follow a Google referral to the correctly priced direct stay.
  Current evidence: none; the described acceptance journey is missing.

- **SYNC-006 — Inventory holds, measured closure latency and double-booking prevention · partial.** Race a direct checkout and a channel reservation for one unit/night through public booking/channel doors; prove only one Cabin allocation commits, record commit and acknowledgement timestamps for Airbnb, Vrbo and Booking.com and show each closure acknowledged within 2 minutes and the export feed updated within 60 seconds. Hold one provider’s acknowledgement past 2 minutes in its test harness and verify the Connections breach alert, assigned exception and stop-sell. A deliberately late OTA conflict is assigned for recovery with both original reservations retained.
    Current evidence: `src/cabin/inventory.ts`; `src/cabin/storage.ts`; `src/cabin/ical-export.ts`; `src/cabin/ui/calendar-grid.ts`; `tests/cabin.test.mjs:143`; `tests/cabin.test.mjs:178`. Remaining: Every stay, hold and block takes its unit/nights; overlapping and concurrent requests cannot both hold a night (version-guarded commits) and export links reflect each change on the next read. No API channel submission or acknowledgement timing, breach alerts, stop-sell or recovery cases; polled iCal collisions are kept and shown, not assigned.

- **SYNC-007 — Inspectable sync failures and safe recovery · partial.** From Connections revoke authorization, deliver duplicate/out-of-order events, throttle a push and lose its response; restart Cabin, reconnect and reconcile against the provider, preserving one reservation and the newest accepted prices with every unresolved exception visible.
  Current evidence: `src/cabin/channels.ts`; `src/cabin/ui/channels.ts`; `tests/cabin.test.mjs:143`. Remaining: Each calendar link shows last success, last change, next poll and its error; a failed read goes stale, keeps its nights and recovers on the next good read. No provider events, throttling, uncertain-write reconciliation or assigned exceptions.

- **SYNC-008 — Inquiries, booking requests, special offers and alterations · partial.** On an Airbnb test listing send an inquiry and see it as Inquiry; pre-approve it, withdraw the pre-approval and re-send it as a special offer with a custom price, and verify the guest-side offer and channel acknowledgement. Decline one request to book and let another expire after 24 hours, verifying the recorded expiry and unchanged inventory. Accept a guest alteration that moves dates and confirm inventory, price and downstream tasks update. Auto-pre-approve an inquiry that meets saved criteria and route one that does not to a person. Repeat a request flow on Vrbo and on Booking.com. Every outcome is acknowledged by the channel. Deliver a Vrbo request to book for nights already held by an Airbnb reservation with automatic decline enabled and verify Cabin declines it at Vrbo, names the overlapping Airbnb reservation and leaves inventory unchanged; with automatic decline off, verify the same request routes to a person with the overlap shown.
  Current evidence: `src/cabin/inventory.ts`; `src/cabin/ui/requests.ts`; `tests/cabin.test.mjs:178`. Remaining: Requests taken in Cabin are declined with the overlapping reservation named, or held; no inquiry states, channel deadlines, offers, alterations or channel-side answers (partner APIs).

- **SYNC-009 — Automatic iCal sync for channels without an API · partial.** Connect an external iCal URL served by a test host; add a block there and verify Cabin applies it within the configured polling interval and then refuses a direct booking for those nights. Create a Cabin direct reservation and fetch the unit’s export URL to find it within 60 seconds; regenerate the export URL and confirm the old one returns 404. Make the external feed unreachable, then malformed, and verify the stale state, alert, assigned exception and retained blocks; restore it and verify recovery and fresh timestamps.
  Current evidence: `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/calendar-file.ts`; `src/server.ts`; `src/cabin/ui/channels.ts`; `tests/cabin.test.mjs:143`. Remaining: URL connections polled by Cron every 15–60 minutes, applied changes, per-unit secret export links with revocation, last fetch/change/next poll, stale state that keeps its nights and a calendar-page alert all exist. No assigned exception (Cabin has no exception assignment yet). Unavailable on RER Managed until its provider relay.

- **SYNC-010 — Multiple connected accounts per channel and Airbnb co-hosting · missing.** From Connections authorize two Airbnb host accounts (the second with a listing on which the manager is a full-access co-host after the owner’s account authorizes) and two Vrbo accounts, each with its own nickname; map one listing under each account. Book, message and post a host review on a listing in every account and confirm each reservation, thread, review and payout carries its owning account. Try to map one listing under both Airbnb accounts and confirm refusal. Revoke one Airbnb account: verify only its listings are stop-sold with a SYNC-007 exception while a booking and rate change on the other Airbnb account and both Vrbo accounts still exchange and acknowledge normally; reauthorize and confirm recovery without duplicate reservations.
  Current evidence: none; the described acceptance journey is missing.

- **RES-001 — Portfolio calendar with operational context · partial.** Open the calendar for a realistic 20-home portfolio; filter by property/channel, inspect an overlapping stay, unpaid arrival, owner block and unready turnover, and follow each to its source record on desktop and phone.
  Current evidence: `src/cabin/ui/calendar-grid.ts`; `src/cabin/ui/calendar.ts`; `tests/cabin.test.mjs:143`; `tests/cabin.test.mjs:178`. Remaining: A two-week homes-by-days grid with one row per channel, channel-coloured stays, blocks, closed nights and collisions at 1440 and 390. No day/month views, filters, payment, readiness or drill-down to a reservation record.

- **RES-002 — Complete reservation lifecycle · partial.** Create a phone reservation, extend it, move units, cancel under its saved policy and inspect downstream calendar, balance, queued messages, cleaning and lock changes; repeat with a channel amendment and duplicate event.
  Current evidence: `src/cabin/calendars.ts`; `src/cabin/model.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55`. Remaining: Only approved snapshot changes/cancellations exist; native selling and connected downstream lifecycle are absent.

- **RES-003 — Owner stays and maintenance blocks · partial.** Book an owner stay through the owner portal, request overlapping maintenance, reject an occupied overlap, and cancel the owner stay; verify all channels, calendar, cleaning tasks and owner-use expense allocations.
  Current evidence: `src/cabin/inventory.ts`; `src/cabin/ui/requests.ts`; `tests/cabin.test.mjs:178`. Remaining: Managers block nights with a reason; blocks hold inventory, publish to every channel's export link and can be removed. No owner portal, billable owner-use rules or readiness tasks.

- **RES-004 — Stay rules, fees and cancellation policies · missing.** Price boundary-date, gap-night, last-minute and extra-guest stays through direct checkout and each OTA adapter; prove an invalid stay cannot book, valid totals agree with the breakdown, and an old reservation retains its saved cancellation policy.
  Current evidence: none; the described acceptance journey is missing.

- **RES-005 — Linked rooms and whole-property inventory · missing.** Link two rooms and their whole-home listing, sell a room via an OTA and attempt a whole-home direct booking; then cancel and sell the whole home, proving both room listings close and all channel acknowledgements reconcile.
  Current evidence: none; the described acceptance journey is missing.

- **RES-006 — Quotes and conversion to a reserved stay · missing.** Send a quote from Reservations, accept its link as a guest, complete checkout once and inspect the resulting booking; expire a rival quote and attempt acceptance after a rate or availability change without silently charging obsolete terms.
  Current evidence: none; the described acceptance journey is missing.

## Revenue and direct bookings

- **PRICE-001 — Revenue planner and dynamic pricing connections · missing.** Connect and exercise PriceLabs, Wheelhouse and Beyond separately; import a daily plan, override one night, reject a below-floor rate, simulate stale provider data and publish valid prices to all three OTAs with acknowledgements.
  Current evidence: none; the described acceptance journey is missing.

- **PRICE-002 — Per-channel markups and length-of-stay discounts · missing.** Configure a +15% Booking.com markup that includes the cleaning fee and a fixed $20-a-night Vrbo markdown that excludes fees; publish and verify each channel’s acknowledged nightly price and fees, then book on each and reconcile the payout to the expected figures. Set weekly and monthly discounts and quote 7-night and 28-night stays on direct, Airbnb and Booking.com (as a rate plan), verifying each discounted total. Set a discount that would cross the floor and verify the floor holds and the conflict is shown.
  Current evidence: none; the described acceptance journey is missing.

- **PRICE-003 — One rate sent to every channel · missing.** With no channel adjustments, publish 60 nights of rates and a cleaning fee for a listing connected to all three OTAs and the direct site; read back each channel’s accepted nightly price and fee and verify all four agree for every night. Edit one night’s price in a channel’s test extranet and verify Cabin flags the drift and restores parity on republish. Add a PRICE-002 Booking.com markup and verify the difference is shown as deliberate, not as drift.
  Current evidence: none; the described acceptance journey is missing.

- **WEB-001 — Branded direct-booking website · missing.** Publish a two-property site on a test custom domain, edit a property page, search real available dates at 1440 and 390 pixels and complete a guest booking with the exact advertised total and terms. For a property that requires a rental agreement, ID check and damage deposit, complete checkout once and verify the Stripe payment, signed agreement, verification outcome and deposit hold all attach to the one reservation before it is confirmed.
  Current evidence: none; the described acceptance journey is missing.

- **WEB-002 — Embeddable booking engine · missing.** Install the widget on an allowed external site and WordPress page, complete a stay and verify one reservation; refuse an unapproved origin and an attempt to query private reservation/guest records.
  Current evidence: none; the described acceptance journey is missing.

- **WEB-003 — Signed rental agreements · done.** Book with a required agreement, sign through the guest link, download the saved signed version, then amend dates/terms and verify renewed consent is requested and the original signature is preserved.
  Current evidence: none; the described acceptance journey is missing.

- **WEB-004 — Guest identity verification · missing.** Complete and fail partner verification from the guest check-in link, route one case for human review, confirm staff access limits and retention/erasure behavior, and prove door codes do not release while a required verification remains unresolved.
  Current evidence: none; the described acceptance journey is missing.

- **WEB-005 — Promotions, upsells and gap-night offers · missing.** Send a gap-night extension and paid early-arrival offer, accept one through the guest portal, reject an ineligible coupon and an offer that conflicts with cleaning, and reconcile payment, access, channels and the owner statement.
  Current evidence: none; the described acceptance journey is missing.

## Guest payments and service

- **PAY-001 — Processor-backed USD checkout and manual payments · missing.** Book through the public site with successful, declined and authentication-required cards plus pending/returned ACH in the processor test environment; replay payment callbacks and prove one correct reservation balance and no raw payment credentials in reads, exports or logs.
  Current evidence: none; the described acceptance journey is missing.

- **PAY-002 — Scheduled collection and payment follow-up · missing.** Configure a deposit and pre-arrival balance in Payments, advance the schedule, fail one collection, resolve its reminder and change/cancel the stay before the next charge; inspect processor records and Cabin’s durable job outcomes after restart. Virtual-card collection: PAY-005; property-collect guest cards: PAY-006.
  Current evidence: none; the described acceptance journey is missing.

- **PAY-003 — Damage deposits, refunds and cancellation settlement · missing.** Authorize a damage deposit, approve an evidenced partial claim, release the remainder, issue a partial rent refund and cancel a second stay; replay each event and verify processor balances, guest receipts, tax adjustments and owner liabilities match once. Check out a third stay with no claim and verify its hold is released automatically within the configured post-checkout window; for a stay longer than a card authorization lasts, verify the hold is renewed or flagged before it expires.
  Current evidence: none; the described acceptance journey is missing.

- **PAY-004 — Protection partners and chargeback casework · missing.** Enroll an eligible stay, decline an ineligible one with its reason, open a damage/chargeback case, approve its evidence packet and follow the provider’s accepted/rejected outcome through reservation and owner adjustments.
  Current evidence: none; the described acceptance journey is missing.

- **PAY-005 — Booking.com virtual credit cards · missing.** Receive three Booking.com test reservations carrying VCCs with set loaded amounts and activation dates. On the first, attempt a charge before activation and confirm refusal with no processor charge; advance to activation and verify exactly the loaded amount is charged once, including after a replayed callback and a rerun job, and that no full card number appears in reads, exports or logs. Let the second VCC expire and move the third stay earlier so its activation date falls after the new check-in; verify both become assigned exceptions with no charge. Reconcile the charged amount to its reservation, Booking.com payout and owner statement line.
  Current evidence: none; the described acceptance journey is missing.

- **PAY-006 — Booking.com property-collect guest cards · missing.** Receive three property-collect Booking.com test reservations through the connection and confirm no full card number or security code appears in any read, export, log or archive. On the first, verify the deposit and balance each charge on schedule exactly once, including after a replayed callback and a rerun job. On the second, decline the card, report it invalid from the reservation and repeat the report; verify a single report, Booking.com’s acknowledgement, and the guest deadline with an assigned exception. Deliver an updated card from Booking.com and verify the failed charge retries once and the schedule resumes. Leave the third reservation’s declined card un-updated past its deadline; verify the penalty-free cancellation is offered, confirmed by a human and acknowledged by Booking.com, that inventory reopens and that no further charge is attempted. Reconcile the collected amounts and the Booking.com commission invoice to each reservation and its owner statement line.
  Current evidence: none; the described acceptance journey is missing.

- **GUEST-001 — Guest profiles and repeat-stay context · missing.** Receive the same guest on two channels, review a suggested merge, record a preference and opt-out, book a return stay and undo a mistaken merge; verify the right history follows each person and role-limited reads remain private.
  Current evidence: none; the described acceptance journey is missing.

- **MESSAGE-001 — Unified channel, SMS, email and WhatsApp inbox · missing.** Receive and reply on all three OTA channels, email, SMS and WhatsApp through the inbox; attach the correct reservation, replay an inbound event and simulate a rejected/outage send, proving one visible message and an assigned delivery failure without false delivery claims. Have one guest write about the same stay on Airbnb, then by SMS and by email, and verify all three appear in order in one thread for that guest, with each reply sent on the channel its message came from.
  Current evidence: none; the described acceptance journey is missing.

- **MESSAGE-002 — Team routing and response accountability · missing.** Route an after-hours access thread, add an internal note, have two staff attempt replies and hand the issue to the next shift; miss its response deadline and confirm escalation reaches an assigned manager with the full context.
  Current evidence: none; the described acceptance journey is missing.

- **MESSAGE-003 — Lifecycle messaging and post-stay follow-up · missing.** Book, modify and cancel stays with scheduled templates; advance due times and verify each eligible message arrives through its chosen channel once, canceled or opted-out sends stay suppressed, withheld codes remain private and failed sends escalate. Verify each scheduled message is submitted to its provider within 5 minutes of its due time, including one that falls due while Cabin is restarting.
  Current evidence: none; the described acceptance journey is missing.

- **MESSAGE-004 — Source-grounded AI replies with controlled sending · missing.** Ask the inbox assistant a supported check-in question, an undocumented amenity question and a compensation request; inspect sources, edit a draft, enable a narrow automatic rule and prove unsupported or unauthorized promises route to a human without being sent. Leave an assistant draft unapproved past the time its reply was due and verify nothing is sent; approve it and verify exactly the approved text is sent once.
  Current evidence: none; the described acceptance journey is missing.

- **GUEST-002 — Guest check-in and stay portal · missing.** Open a guest link on a phone, finish pre-arrival tasks, view the correctly timed code and report an issue; use another reservation’s ID, an expired link and a canceled stay and confirm private details and access are refused.
  Current evidence: none; the described acceptance journey is missing.

- **GUEST-003 — Reviews and consented repeat-guest marketing · missing.** Complete a stay, deliver one eligible review request, receive a negative response and assign recovery, approve a channel review reply, sync a consented Mailchimp segment and verify an opt-out removes the guest before the next campaign. Schedule an approved review reply and a post-stay thank-you and verify each is posted or sent once at its scheduled time and recorded on acknowledgement.
  Current evidence: none; the described acceptance journey is missing.

- **GUEST-004 — Automated host reviews of Airbnb guests · missing.** Check out three Airbnb test stays: one receives a templated review after the configured delay and Airbnb accepts it; one has automation stopped and stays in the queue until a person writes and submits it; one already reviewed by hand is not overwritten. Refuse one post in the provider test harness and verify the assigned task, and confirm no post is attempted after the window closes.
  Current evidence: none; the described acceptance journey is missing.

## Property operations and access

- **OPS-001 — Reservation-triggered turnover dispatch · partial.** Confirm, extend and cancel a stay through reservation doors, inspect generated tasks, have a cleaner decline and a backup accept, and verify deadlines, changed instructions and cancellation propagate with no duplicate payable turnover. Then give one cleaner two same-day turnovers that cannot both be reached within their windows given travel time, and a third job beyond the cleaner’s daily capacity; verify each is routed to a backup or flagged to a manager with the reason shown.
    Current evidence: `src/cabin/turnovers.ts`; `tests/cabin.test.mjs:67`. Remaining: Manual drafts reference an approved booking and cleaner; automatic triggers, acceptance, reassignment, capacity/travel-time routing and escalation are absent.

- **EVIDENCE-001 — Private immutable cleaner completion evidence · done.** Complete a job through the cleaner command/photo doors; reject missing checks, malformed images, another cleaner and a duplicate completion, then retrieve the original photo only with an authorized session.
  Current evidence: `src/cabin/turnovers.ts`; `src/cabin/photos.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:67`.

- **OPS-002 — Cleaner mobile work with reliable uploads · done.** On a phone accept an assigned job, capture required checklist photos and an issue, lose connectivity, then reconnect after a booking edit; retain the draft, request review of stale work and complete only the current approved task.
  Current evidence: `src/cabin/ui/turnovers.ts`; `src/cabin/turnovers.ts`; `public/cabin.css`; `tests/cabin.test.mjs:67`. Remaining: Online checklist/caption and one private photo exist; native/offline capture, multiple required photos and acceptance are missing.

- **OPS-003 — Readiness is verified before arrival · partial.** Open an arrival with completed cleaning but failed lock and maintenance checks and a failed restock item; verify it stays unready, resolve the tasks and restock and attest the item, obtain inspector acceptance and show the manager and guest-service team the final readiness state and evidence.
    Current evidence: `src/cabin/turnovers.ts`; `src/cabin/ui/turnovers.ts`; `tests/cabin.test.mjs:67`. Remaining: Cleaner photo completion is visible; cross-team readiness, supply/restock items, inspections and arrival gates are absent.

- **OPS-004 — Maintenance, inspections and work-order expenses · missing.** Report a broken appliance, approve a vendor quote, block the unit, receive invoice/photos and inspect completion; reopen for guests, reconcile the owner expense and advance a recurring inspection without duplicate tasks. From a turnover, have the cleaner report a broken patio light with a photo and verify a maintenance task is created with that photo, linked to the turnover and property, assigned to the property’s maintenance person and notified to them.
  Current evidence: none; the described acceptance journey is missing.

- **OPS-005 — Stay-bound smart-lock automation · missing.** Connect each named lock family, directly or through the bridge; for each, provision and verify a stay code, extend then cancel the booking and observe expiry/revocation at the device or provider test harness. Route a low-battery/offline lock to a person before arrival. Confirm a reservation through a channel and verify its code is provisioned with no staff action, shown as active only once the provider or device confirms it, and sent to the guest only after release rules pass; a stay with an unresolved payment or ID check keeps its code unsent.
    Current evidence: none; the described acceptance journey is missing.

- **OPS-006 — Breezeway specialist operations handoff · missing.** Connect Breezeway, amend a reservation, accept and complete its turnover externally, return photos and an issue, then replay events and disconnect the adapter; verify one owned task and cost with visible unresolved readiness.
  Current evidence: none; the described acceptance journey is missing.

- **OPS-007 — Hub-dependent and offline-PIN locks · missing.** Connect an Igloohome lock in offline mode and a Schlage Sense through its hub; verify the hub requirement is stated before enablement. Provision an offline time-bound PIN, confirm it is labelled unverifiable, then cancel the stay and verify the fallback task. Take the hub offline before an arrival and verify the assigned case and that code delivery waits for release rules.
  Current evidence: none; the described acceptance journey is missing.

- **OPS-008 — A day board of departures, arrivals and readiness · partial.** Seed five homes with Saturday departures and arrivals across Airbnb, Vrbo and Booking.com. At 1440 and 390 pixels open Saturday’s board and verify one home shows Checked out with its actual time and source, one shows an arriving guest’s name, channel and time, one shows its assigned cleaner, one shows an active door code without revealing it to a cleaner session, and a declined overlapping Vrbo request shows its reason. Leave one turnover unaccepted and verify the summary reads 4 of 5 ready and names that home; complete and attest it and verify the summary reads all five homes ready.
  Current evidence: `src/cabin/ui/turnovers.ts`; `src/cabin/ui/calendar.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:67`. Remaining: Bookings per channel with guest names and arrival times (from the feed or entered by a manager) and each cleaner's assigned turnovers are listed separately; no day board, actual checkout times, door-code state or portfolio readiness summary exist.

## US money, owner accounting and reporting

- **FIN-001 — Reservation-linked USD trust subledgers · missing.** Through reservation, payment and accounting doors record a deposit, earned stay, channel fee, tax, refund and owner expense; drill each balance to source transactions and prove debits equal credits before and after a period-close correction.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-002 — Payout reconciliation per reservation · missing.** Import or receive each named provider’s settlement with multiple stays across two connected accounts of one channel, a charged Booking.com virtual card, a property-collect Booking.com charge with its commission invoice, a partial refund and a missing payout; reconcile a real bank receipt through the accounting view, retain the unmatched item and close it only after the missing external record arrives.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-003 — Management agreements and expense allocation · partial.** Configure two different owner agreements, post reservation revenue and a shared repair, amend terms for a later stay, then inspect exact owner splits, fees, reserve and invoice evidence without rewriting the earlier allocation.
  Current evidence: `src/cabin/people.ts`; `src/cabin/statements.ts`; `tests/cabin.test.mjs:90`. Remaining: Fixed property commission and manually supplied signed lines exist; agreement models and derived allocation rules are absent.

- **FIN-004 — Reconciled frozen owner statements and monthly delivery · partial.** Run month-end with a missing payout, resolve its exception, review and approve the USD statement, deliver it once to the owner portal/email and compare every line to the ledger; verify every Airbnb, Vrbo, Booking.com and Stripe payout received for the month appears on its owner’s statement split to the stays it paid, with none omitted or counted twice; later amend property terms and correct a posted item without changing the original safe CSV/PDF.
  Current evidence: `src/cabin/statements.ts`; `src/cabin/ui/statements.ts`; `tests/cabin.test.mjs:90`. Remaining: Manual AUD statement arithmetic, exact approval, frozen details and formula-safe CSV ship. USD, reconciliation, PDF, scheduled generation/delivery and owner access are missing.

- **FIN-005 — Rental-owner portal and personal stays · missing.** Invite two unrelated rental owners, show each its statements and performance, approve an expense and request an owner stay; try cross-owner URLs/exports and transfer ownership, verifying historical and future access follow the grants.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-006 — Trust accounts, bank reconciliation and approved ACH distributions · missing.** Reconcile two trust accounts and their owner liabilities, approve a distribution, reject one that would use another owner’s funds, and follow a returned ACH through bank evidence, restored liability and corrected owner statement.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-007 — QuickBooks Online accounting synchronization · missing.** Authorize a QuickBooks Online test company, map accounts, sync a month including a refund and expense, reconcile totals, repeat the batch and handle an externally edited or rejected transaction without duplication.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-008 — US occupancy, lodging and sales-tax obligations · missing.** Book direct and OTA stays in two US jurisdictions with mixed collection responsibility and an exemption, refund one, approve a filing/remittance through the selected partner and reconcile acknowledgements, payments and remaining liability to the ledger. Quote a direct stay at a Maine property and verify checkout shows the state lodging-tax line at the configured 9% rate; for a stay where both a state and a county tax apply, verify each is collected, filed and reconciled separately.
  Current evidence: none; the described acceptance journey is missing.

- **FIN-009 — US owner and contractor tax reporting · missing.** From year-end reporting prepare owner and cleaner/vendor 1099 records, review exclusions/adjustments, submit a partner test filing, correct a rejection and download the accepted export without leaking tax IDs to service staff or ordinary archives.
  Current evidence: none; the described acceptance journey is missing.

- **REPORT-001 — Operational, revenue and owner performance reports · missing.** Use a mixed-channel month with owner blocks, refunds and incomplete payouts; filter a portfolio report, explain its occupancy denominator and accounting basis, and reconcile exported totals and drill-downs to reservations and ledger records.
  Current evidence: none; the described acceptance journey is missing.

- **REPORT-002 — Saved reports and scheduled sharing · missing.** Schedule two owner reports and a manager digest, revoke one owner before run time, advance the schedule and inspect artifacts/delivery history; verify unauthorized delivery is refused and a failed send is assigned for resolution.
  Current evidence: none; the described acceptance journey is missing.

## Integrations, migration, mobility and durable custody

- **API-001 — Documented API, webhooks and Zapier automation · partial.** Create/read a reservation through documented API credentials, consume a signed webhook in Zapier, repeat a mutation and replay a delivered event; revoke credentials and show private/financial actions and stale queued jobs are refused.
  Current evidence: `src/cabin/http.ts`; `docs/commands.md`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:109`. Remaining: Session commands and draft-only bearer API exist; booking/finance APIs, event webhooks, scoped app grants and Zapier do not.

- **MIGRATE-001 — Reviewed property-register move-in · partial.** Use Move in to preview/apply the documented CSV, reject a changed fingerprint, inspect the durable job, edit one imported property and undo; retain that native edit with its disposition, then erase another imported property and verify source retirement.
  Current evidence: `src/cabin/movein/index.ts`; `src/cabin/movein/csv.ts`; `src/cabin/movein/targets.ts`; `docs/move-in.md`; `tests/cabin.test.mjs:124`; `tests/archive.test.mjs:27`. Remaining: Basic inert preview, apply, journal, guarded undo and erasure round-trip are tested. All documented collision, resume and dependency cases are not independently exercised.

- **MIGRATE-002 — Migration from Guesty · missing.** Upload a permissioned Guesty export or connect a test account in Move in; preview each record family and balance, fix one mapping, apply without guest sends/charges and reconcile source counts and financial totals with the resulting Cabin records. Include listings from two Airbnb accounts, one co-hosted, and confirm after reauthorization that each listing maps to its own connected account.
  Current evidence: none; the described acceptance journey is missing.

- **MIGRATE-003 — Migration from Hostaway · missing.** Import a permissioned Hostaway dataset through Move in with a modified stay, archived thread and unpaid owner balance; reconcile records/totals, then deliver the same stay’s live channel event and prove it updates rather than duplicates the booking. Use listings from two Vrbo accounts and confirm each maps to, and receives live events through, its own connected account.
  Current evidence: none; the described acceptance journey is missing.

- **MIGRATE-004 — Migration from OwnerRez · missing.** Preview and apply a permissioned OwnerRez export including a signed agreement, future installment and owner statement; compare source records and balances, reconnect payment/channel authority and verify no historical collection or message is replayed.
  Current evidence: none; the described acceptance journey is missing.

- **MIGRATE-005 — Migration from Lodgify · missing.** Import a permissioned Lodgify dataset from Move in, reconcile a future stay and historical refund, retrieve its original agreement and media, preview website redirects and verify the migrated guest can reach the correct reservation without being charged again.
  Current evidence: none; the described acceptance journey is missing.

- **MIGRATE-006 — Switching from Hospitable and Breezeway operations · missing.** Run separate permissioned Hospitable and Breezeway imports, compare upcoming tasks, guest threads and balances, then enable one new reservation event and prove one active task/message workflow with required readiness rechecks.
  Current evidence: none; the described acceptance journey is missing.

- **MIGRATE-007 — CSV history, cutover rehearsal and accountable go-live · missing.** Import a reservation CSV, rehearse migration of a 20-home portfolio, resolve mismatched counts and a changed opening balance, then perform a controlled cutover and rollback while a new booking arrives; retain that booking and prove one active sender/collector. After cutover verify each Airbnb, Vrbo and Booking.com connection is attached to the same channel listing ID it had before the move, with its reviews, ratings and future reservations intact and no new listing created.
  Current evidence: none; the described acceptance journey is missing.

- **MOBILE-001 — Native manager and field-team apps · missing.** On iOS and Android as manager, cleaner and rental owner, handle a changed arrival, reply to a guest, complete an evidenced task and open a statement; test offline conflict, push acknowledgement and grant revocation while offline/reconnecting.
  Current evidence: none; the described acceptance journey is missing.

- **INTERFACE-001 — Responsive accessible and honest operations · partial.** At 1440 and 390 pixels, use realistic properties/stays through calendar review, cleaner photo completion and statement download; exercise keyboard/error recovery and the full target booking/inbox journey. Seed an installation with 40 properties and three years of history at the stated volumes; measure calendar, inbox search and report timings against the stated limits and verify paginated lists and exports return every row with counts and totals matching the source records.
    Current evidence: `src/cabin/ui/index.ts`; `src/cabin/ui/calendar.ts`; `src/cabin/ui/turnovers.ts`; `src/cabin/ui/statements.ts`; `public/cabin.css`; `tests/cabin.test.mjs`. Remaining: Responsive forms and server errors exist. Full browser accessibility, the 40-property/three-year scale proof, native workflows and paid-provider cost disclosure are not established.

- **DATA-001 — Complete portable product records and safe restore · partial.** Use the public rer export/import commands to round-trip a populated installation, compare all record families/media and totals, reject damaged or populated restores and verify restored jobs/connections remain inactive until the new owner reauthorizes them.
  Current evidence: `src/cabin/archive-policy.mjs`; `scripts/installer/local.mjs`; `tests/archive.test.mjs:27`. Remaining: Current operational records/photos, approvals and move-in custody round-trip with excluded bearer keys. Future PMS records and inactive provider-job restore are not implemented.

- **DATA-002 — Erasure, retention and later-journal fencing · partial.** Erase a property/guest with photos, threads and source files, verify all public/private read and queued-action doors, inspect retained legal records and anonymized audit, then attempt old restore with the later journal and confirm refusal without partial writes.
  Current evidence: `src/cabin/privacy.ts`; `src/cabin/movein/targets.ts`; `src/cabin/archive-policy.mjs`; `tests/archive.test.mjs:27`. Remaining: Property cascade/source retirement and later-journal refusal are exercised. Member erasure refuses used/invited grants; broad guest/operator erasure, retention holds and completion receipts need work.

- **DATA-003 — Every booking, guest and payout stays in the owner’s installation · partial.** Run a populated installation through a channel booking, a guest conversation, a payout import and a cleaner photo with every outbound network request recorded; verify each resulting record is in the owner’s database or file storage and that the only outbound requests went to the connected providers named in Connections. Disconnect one provider and verify no further data reaches it.
  Current evidence: `src/cabin/storage.ts`; `src/cabin/photos.ts`; `tests/archive.test.mjs`. Remaining: Today’s properties, calendar bookings, turnovers, photos and statements live in the installation’s own D1 storage; guest, message and payout records do not exist yet, and no test records outbound requests to show nothing else leaves.

- **AUDIT-001 — Permanent attributable business and automation history · partial.** Follow a stay from booking through task, message, lock, refund and owner statement; export its human/agent/provider history, erase the guest and verify useful anonymized attribution remains without secrets or personal message bodies.
  Current evidence: `src/cabin/storage.ts`; `src/cabin/credentials.ts`; `src/cabin/movein/index.ts`; `migrations/core/0015_cabin.sql`; `tests/cabin.test.mjs:31`; `tests/archive.test.mjs:27`. Remaining: Domain/credential events, independent approvals and import journals exist; comprehensive provider/read history, anonymization guarantees and search/export are incomplete. The state read shows only the latest 100 events.

- **SECURITY-001 — Provider custody and declared external data · partial.** Enable, rotate and revoke a provider connection, submit forged events and adversarial guest text, inspect role-limited API/export/log/agent outputs and prove revoked queued actions stop while historical evidence remains readable.
  Current evidence: `src/cabin/credentials.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:17`; `tests/cabin.test.mjs:109`. Remaining: Hashed revocable draft keys and private cleaner data exist; OTA/payment/lock custody, signed provider events and broader sensitive-data policies are missing.

- **HTTP-001 — Real Worker health and document dispatch · done.** Run the emitted Worker on migrated local storage; request /health, the installed homepage and unknown document/API paths, verifying successful health/branding and true 404s.
  Current evidence: `src/server.ts`; `src/base/deployment-health.ts`; `tests/runtime.mjs`.

- **RUNTIME-001 — Owner-run lifecycle and durable background work · partial.** Start a fresh source checkout with rer dev, sign in and complete a product job, stop/restart and recover durable state; interrupt each external job before/after provider acceptance and prove reconciliation prevents duplicate charges, sends or unlocks. Run the homepage’s `rer install` and `rer setup`, then `rer dev`, on a clean macOS and a clean Linux machine to a signed-in installation, then `rer deploy` the same source to an owner-controlled Cloudflare account and sign in there.
  Current evidence: `scripts/installer/local.mjs`; `OPERATIONS.json`; `SEED-COMMAND-CONTRACT.md`; `tests/launch.test.mjs:10`; `tests/runtime.mjs`; `tests/archive.test.mjs:27`. Remaining: Local lifecycle/health and operational archive paths exist; external product jobs and remote/provider acceptance are unimplemented. CI is not proof of hosted connectivity.

## Public hosted demo

- **SITE-002 — Hosted vacation-rental demo · partial.** From the homepage’s Try the demo at 1440 and 390 pixels, start a signed-out visitor session with no install or contact details and use the seeded US rental business: approve a calendar review, complete a turnover with photos and approve a USD owner statement. Verify a second visitor cannot see those changes; trigger the host’s scheduled expiry through its test boundary, reject reads from the expired session and start a fresh sample session. Check that visitor changes and typed contact details are gone from storage, logs and backups, that no real guest data was seeded and no real message, charge, payout or lock/provider action left the sandbox. Verify the public hostname and homepage link work, and a fresh owner installation is empty.
  Current evidence: `src/demo.ts`; `src/cabin/demo/`; `src/modules/demo/`; `deploy-demo.json`; `.github/workflows/run-demo.yml`; `src/site/shell/links.ts`; `tests/demo.test.mjs`. Remaining: Seeded rental data, effect suppression, deployment wiring and a direct demo link exist; the public hosted journey, scheduled expiry and storage/log/backup erasure are not established by the seed tests.

## Push further: agents complete the stay’s job

- **AGENT-001 — Recover a disrupted stay through verified readiness · partial.** Cancel the cleaner shortly before an arrival, then report a failed lock as the guest. From the recovery case approve a budget and relocation/compensation choice; verify backup acceptance, completed evidence, new code state, guest confirmation and corrected owner net. Stop/restart midway and exercise denied approval; no step or unresolved balance may be silently skipped.
  Current evidence: `src/cabin/http.ts`; `src/cabin/turnovers.ts`; `tests/cabin.test.mjs:67`; `tests/cabin.test.mjs:109`. Remaining: Bearer-prepared turnover drafts and human completion evidence are foundations only; no recovery agent, automatic dispatch, relocation, compensation, locks or financial closure exists.

- **AGENT-002 — Close reservation-to-owner financial exceptions · partial.** Create a stay with split payout, missing channel fee and later refund; inspect the agent’s evidence, obtain the missing record, reject one proposed correction, approve the right adjustment and verify the ledger, frozen statement adjustment and actual owner distribution settle to the same net.
  Current evidence: `src/cabin/statements.ts`; `src/cabin/http.ts`; `tests/cabin.test.mjs:90`; `tests/cabin.test.mjs:109`. Remaining: Agents can prepare manual statement drafts for exact human approval; settlement matching, record pursuit, correcting postings and payout closure are absent.

- **AGENT-003 — Resolve guest issues through accepted field work · missing.** Report an access failure and leaking appliance through the guest portal/inbox; approve dispatch, decline one vendor, complete inspected work and obtain guest confirmation plus a recurrence check. Send an emergency report and verify immediate human escalation without automated safety claims.
  Current evidence: none; the described acceptance journey is missing.

- **AGENT-004 — Optimize profitable occupancy without breaking readiness · missing.** Show an orphan-night opportunity that conflicts with cleaning, reject it, then approve a feasible bounded offer; verify the accepted channel prices, one guest purchase, changed operational/access windows and realized owner net against the agent’s forecast.
  Current evidence: none; the described acceptance journey is missing.

- **AGENT-005 — Source-linked portfolio questions and actionable follow-up · missing.** Ask why one property’s owner net fell and which arrivals are at risk; follow the cited records to matching reports, approve an assigned investigation, and ask as an unrelated owner and during a stale provider read to verify scope and explicit uncertainty.
  Current evidence: none; the described acceptance journey is missing.

- **AGENT-006 — Bounded action authority and durable agent cases · partial.** In a recovery case approve a specific vendor/payment limit, change the recipient or booking, and reject the stale action; exceed a budget, inject guest instructions and revoke the agent during an uncertain provider response. Inspect the case after restart for no unauthorized effect and an explicit unresolved outcome. Set a $100 guest-credit limit for stay recovery; verify the agent offers a $75 credit within it without asking again and posts it to the owner balance through FIN-001, and that a $150 credit routes to a person unsent.
  Current evidence: `src/cabin/model.ts`; `src/cabin/credentials.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:109`; `tests/cabin.test.mjs:55`. Remaining: Current agents are strictly draft-only with human revision approval. Expanded tool grants, budgets, durable cases and external-action reconciliation do not exist.

## Honest boundaries and partner obligations

- **BOUNDARY-001 — A separate complete vacation-rental product with named partners · missing.** Use Connections/onboarding to inspect each required approval/configuration and its responsible party; attempt activation without approval, complete the documented partner setup and run a booking through externally acknowledged service, tax/payment outcomes and human readiness. Disconnected features remain visibly incomplete, never replaced by simulated success.
  Current evidence: none; the described acceptance journey is missing.

- **OPEN-001 — Free and open source under the MIT licence · partial.** Verify the repository’s `LICENSE` is the MIT licence and the package declares MIT; install from the public source with no account or key from the Cabin authors and reach every product area with 40 properties and 25 staff without a payment, upgrade or licence prompt; enable a paid provider and verify its cost is shown as the provider’s before activation.
  Current evidence: `LICENSE`; `package.json`; `tests/launch.test.mjs`. Remaining: The repository and package are MIT and nothing charges, and a fresh public clone installs; no test checks the licence or every product area for paid gates at 40 properties and 25 staff, and provider-cost disclosure (INTERFACE-001) is not built.

## Build and evidence discipline

**89 clauses: 6 done · 53 partial · 30 missing.** IDs and statuses correspond one-to-one with the contract’s final table. No new target capability is treated as accepted merely because a neighboring foundation is done.

Current public-door checks are `pnpm run test:cabin` (native authority, snapshot reconciliation, cleaner evidence, statement arithmetic, bearer limits and basic move-in), `pnpm run test:archive` (local CLI round-trip, damaged/populated refusal and later-journal erasure), `pnpm run test:runtime` after the real build (health, installed homepage and 404s), and `pnpm run test:launch` (fresh-clone rer dev launch). They are implementation tests, not a complete target suite. Run the tests relevant to changed behavior; the CI push matrix in `verification.json` is the full wall. Preserve existing checks; document work must not weaken them.

Use `rer dev` and `rer dev --stop` for product use; preserve [the shared command contract](SEED-COMMAND-CONTRACT.md), [local operation instructions](RUN-LOCALLY.md) and [current domain command documentation](docs/commands.md). The older docs describe current snapshot/AUD behavior; the target requirements above control future build scope. Before any status upgrade, retain the named public-door result and any needed actual provider/human outcome. A status upgrade requires implementation and evidence, not a broader promise.
