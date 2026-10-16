# Cabin target contract

Target approved **16 October 2026** · US first buyer: an owner or manager of **3–40 vacation rentals**, operating in **USD**.

Cabin is a vacation-rental property management system (PMS) with a channel manager: sell stays across Airbnb, Vrbo, Booking.com and a host’s own website; service guests; keep homes ready and accessible; collect and reconcile payments; and close the owner’s books. A buyer switching from Guesty, Hostaway, OwnerRez or Lodgify must be able to run that complete business in Cabin. Hospitable and Breezeway set additional expectations for smaller-host automation and field operations. Snapshot review, cleaner photos and statement approval remain valuable parts of this larger reservation lifecycle.

This is the product to build towards. Current implementation is deliberately measured separately at the end. It replaces the old snapshot-only, AUD and no-payments/no-messaging target exclusions. It does not change the approved homepage, interface or behavior in this documents-only round. Existing `seed.json`, command examples and UI descriptions describe the implementation edition and are not evidence that the new target is complete.

The scope follows the owner-approved category review, with capability research from the official [Guesty feature catalog](https://www.guesty.com/features/), [Hostaway feature catalog](https://www.hostaway.com/features/), [OwnerRez product catalog](https://www.ownerrez.com/features/) and [Lodgify platform](https://www.lodgify.com/). These establish category breadth, not Cabin connectivity or commercial partnership. The normative behaviors and acceptance journeys below are Cabin requirements; they are not claims that each vendor has every behavior.

Each `AREA-NNN` identifier is stable. Every clause states a buyer behavior and acceptance evidence through a product, command or provider door. [ACCEPTANCE.md](ACCEPTANCE.md) is the matching build plan. Provider-edge tests may isolate paid/network services, but a passing local fake does not establish channel approval, production payment/remittance, physical lock operation or guest receipt. Required live/provider acceptance remains open until actually exercised.

## Portfolio, authority and the existing approval foundation

### PROPERTY-001 — A usable vacation-rental property register.

An operator maintains properties, units, addresses, local time zones, owners and management agreements, occupancy limits, amenities, photos, house rules, check-in/out times, emergency contacts and channel listing IDs. Effective-dated terms preserve the agreement used for each reservation and owner allocation.

**Acceptance evidence:** Create two US properties with different time zones and owners through the property editor; amend one agreement and show that existing bookings retain their original terms while new quotes use the new terms.

### AUTH-001 — Current native authority on every private door.

Native sessions guard private documents, state, commands, photos and statement downloads. Only the installation owner grants manager or cleaner access. Cleaners see only assigned published jobs and redacted associated booking/property data. Revocation applies on the next request and mutation authority is fenced at commit; human POSTs require the installation Origin.

**Acceptance evidence:** Use signed-out, owner, manager and two cleaner sessions against state and mutation routes; reject a cross-origin POST, cleaner financial access, another cleaner’s photo and a revoked grant.

### AUTH-002 — PMS roles and property-specific permissions.

Installation administration is separate from rental ownership. Portfolio managers, reservation staff, guest-service staff, accountants, inspectors, cleaners, maintenance vendors and rental owners receive explicit property and action scopes. Owners see only their interests; service staff receive necessary access instructions without guest identity documents or owner banking details. Offboarding revokes app, API and device access.

**Acceptance evidence:** Invite each role from team settings; use its session to perform an allowed action and attempt the same action on another property, statement, identity document and credential; revoke a role during a queued job and verify execution is refused.

### CONTROL-001 — Exact human approval and immutable publication.

Calendar snapshot, turnover and operational statement drafts do not publish themselves. A manager approves the exact immutable revision with actor and time recorded. Changed calendar baselines, booking revisions, cleaner authority or property terms invalidate stale approval. Duplicate approval and duplicate completion cannot overwrite the published record.

**Acceptance evidence:** Prepare competing revisions through the command API, approve one, then submit the stale and duplicate approvals; change booking/property terms and prove the outdated turnover or statement cannot publish.

### CONTROL-002 — Revocable draft-only bearer access.

The existing bearer door can prepare only calendar, turnover and statement drafts. It cannot approve, finish work, invite users, change grants, erase records or apply imports. Bearer and native-session doors are distinct. Keys are shown once, stored hashed, owner-version bound, expiring and immediately revocable. Broader agent execution requires the separate scoped controls in AGENT-006.

**Acceptance evidence:** Issue a key in Agent access; prepare all three draft types through the bearer API, reject their approval commands and a bearer request to a human door, then revoke the key and reject its next context read.

## Distribution and reservations

### SYNC-001 — Reviewed calendar files remain honest snapshots.

Airbnb and Booking.com iCal snapshots retain import and approval times, reconcile by property/channel/UID and list additions, changes, cancellation, disappearance and overlaps before exact approval. Checkout is end-exclusive. Malformed or unsupported calendar constructs are refused. File review remains available for migration and diagnosis; its dates never constitute a live channel acknowledgement or a double-booking guarantee. Scheduled automatic iCal exchange for channels without an API is SYNC-009.

**Acceptance evidence:** Import two overlapping channel files, inspect the clash and timestamps, approve exact reviews, reimport without duplicates, cancel or remove a UID, test adjacent checkout/check-in, and reject a stale baseline and malformed file.

### SYNC-002 — Airbnb two-way channel management.

Through an approved Airbnb API or contracted channel partner, Cabin receives reservations, modifications and cancellations and sends rates, availability and restrictions for mapped listings. It retains provider IDs, revisions and acknowledgements; authorization failures and channel constraints remain visible. Listing connection is proven before a manager enables selling. Several Airbnb host accounts, including co-hosted listings, connect side by side under SYNC-010. Inquiries, requests to book, pre-approvals, special offers and alteration requests are SYNC-008.

**Acceptance evidence:** Authorize an Airbnb test listing from Connections; book, extend and cancel through Airbnb, change a rate and close dates in Cabin, and verify both systems and their acknowledgement history agree without duplicate reservations.

### SYNC-003 — Vrbo two-way channel management.

An approved Vrbo API or channel partner connection exchanges reservation lifecycle, live availability, rates, fees and supported stay restrictions. Account/listing mapping, payment-collection responsibility, acknowledgements and rejected fields are explicit; a failed connection cannot be labeled synchronized. Several Vrbo accounts connect side by side under SYNC-010.

**Acceptance evidence:** Connect a Vrbo listing, complete and alter a reservation at the channel, close inventory and change pricing in Cabin, cancel the stay and reconcile channel acknowledgements, payment responsibility and final availability.

### SYNC-004 — Booking.com two-way channel management.

An approved Booking.com connectivity connection receives bookings, guest/date changes and cancellations, and publishes room/rate-plan availability, prices and restrictions. It tracks channel-versus-property collection and actionable channel rejections. Payments by Booking.com virtual credit cards are charged and reconciled under PAY-005, property-collect guest cards are charged, reported invalid and followed up under PAY-006, and several Booking.com property accounts connect side by side under SYNC-010.

**Acceptance evidence:** Map a Booking.com room/rate plan; reserve, amend and cancel externally, update Cabin availability/rate restrictions, and compare reservation identity, collection method and accepted channel state. A Payments by Booking.com reservation passes its virtual card to PAY-005, and a property-collect reservation passes its guest card to PAY-006, whose acceptance journeys prove the charges.

### SYNC-005 — Listing content and distribution.

A manager publishes property descriptions, photos, amenities, occupancy, house rules and supported fees from the property record to Airbnb, Vrbo and Booking.com. Channel-specific overrides, validation and review previews prevent accidental replacement of channel-only content. Google Vacation Rentals connects eligible direct-booking listings through approved connectivity with working price/availability landing links.

**Acceptance evidence:** Preview and publish one content revision to each named OTA and one Google Vacation Rentals listing; inspect accepted and rejected fields, keep an intentional channel override, and follow a Google referral to the correctly priced direct stay.

### SYNC-006 — Inventory holds, measured closure latency and double-booking prevention.

Every sale, quote hold, owner block, maintenance closure and imported iCal block uses one durable unit/night inventory allocation. Concurrent Cabin checkouts cannot sell the same inventory. From the commit of any allocation change, Cabin submits the closure or reopening to every connected API channel (Airbnb, Vrbo and Booking.com) within 15 seconds, and each channel’s provider-acknowledged closure must arrive within **2 minutes** of commit; Cabin’s own iCal export feeds (SYNC-009) reflect the change within 60 seconds. Connections shows the measured commit-to-acknowledgement time per channel and change; a breach of the 2-minute maximum, a refused acknowledgement or a disconnected channel raises an alert and an assigned exception and offers stop-sell for the affected inventory. Late channel collisions remain visible and open a recovery case rather than being overwritten.

**Acceptance evidence:** Race a direct checkout and a channel reservation for one unit/night through public booking/channel doors; prove only one Cabin allocation commits, record commit and acknowledgement timestamps for Airbnb, Vrbo and Booking.com and show each closure acknowledged within 2 minutes and the export feed updated within 60 seconds. Hold one provider’s acknowledgement past 2 minutes in its test harness and verify the Connections breach alert, assigned exception and stop-sell. A deliberately late OTA conflict is assigned for recovery with both original reservations retained.

### SYNC-007 — Inspectable sync failures and safe recovery.

Connections expose last successful exchange, lag, pending changes, field errors and provider acknowledgements. Signed/verified provider events are deduplicated and ordered by provider revision. Credential expiry, throttling, outages and uncertain writes survive restart as assigned exceptions; reconciliation reads establish external state before repeating uncertain effects. Reconnection cannot resurrect canceled stays or send stale rates.

**Acceptance evidence:** From Connections revoke authorization, deliver duplicate/out-of-order events, throttle a push and lose its response; restart Cabin, reconnect and reconcile against the provider, preserving one reservation and the newest accepted prices with every unresolved exception visible.

### SYNC-008 — Inquiries, booking requests, special offers and alterations.

Airbnb inquiries arrive as Inquiry-status records linked to their inbox thread, with requested dates, guests and quoted USD price, and hold no inventory. From the thread, staff pre-approve an inquiry, send a special offer with a custom price and terms, withdraw and re-send an offer, accept or decline a request to book inside Airbnb’s 24-hour response window, and accept or decline a guest’s alteration request. Every pending request shows its channel deadline; approaching deadlines escalate through MESSAGE-002 and expiry is recorded, never hidden. Hosts can enable automatic pre-approval per listing against saved criteria (stay rules, guest count, lead time, guest verification and no SYNC-006 conflict); inquiries that miss any criterion route to a person. Vrbo inquiries and booking requests and Booking.com request-to-book flows, where the channel offers them, use the same states and actions. Accepting a request, offer or alteration revalidates price and inventory through SYNC-006 and RES-004 and then updates downstream payments, messages, tasks and access through RES-002. Each outcome is recorded only on the channel’s acknowledgement.

**Acceptance evidence:** On an Airbnb test listing send an inquiry and see it as Inquiry; pre-approve it, withdraw the pre-approval and re-send it as a special offer with a custom price, and verify the guest-side offer and channel acknowledgement. Decline one request to book and let another expire after 24 hours, verifying the recorded expiry and unchanged inventory. Accept a guest alteration that moves dates and confirm inventory, price and downstream tasks update. Auto-pre-approve an inquiry that meets saved criteria and route one that does not to a person. Repeat a request flow on Vrbo and on Booking.com. Every outcome is acknowledged by the channel.

### SYNC-009 — Automatic iCal sync for channels without an API.

For channels with no API connection, such as Furnished Finder, Hipcamp or a partner’s PMS, a manager connects any external iCal URL per unit. Cabin polls each URL on a configurable interval of 15 to 60 minutes (default 15), applies new, changed and removed events as channel blocks that take inventory through SYNC-006, and publishes a per-unit secret iCal export URL listing every Cabin reservation and block, which the manager can regenerate to revoke old links. Each feed shows last successful fetch, last applied change and next poll. An unreachable or malformed feed enters a visible stale state with an alert and assigned exception, keeps its last applied blocks rather than releasing nights, and recovers on the next good fetch. Connections and the listing settings state plainly that iCal sync is polled and does not guarantee against double booking; API channels carry that guarantee. Imported events never trigger guest messages or charges. SYNC-001 remains the manual review path for migration and diagnosis.

**Acceptance evidence:** Connect an external iCal URL served by a test host; add a block there and verify Cabin applies it within the configured polling interval and then refuses a direct booking for those nights. Create a Cabin direct reservation and fetch the unit’s export URL to find it within 60 seconds; regenerate the export URL and confirm the old one returns 404. Make the external feed unreachable, then malformed, and verify the stale state, alert, assigned exception and retained blocks; restore it and verify recovery and fresh timestamps.

### SYNC-010 — Multiple connected accounts per channel and Airbnb co-hosting.

Each channel holds any number of connected accounts in one Cabin installation: several Airbnb host accounts, several Vrbo accounts and several Booking.com property accounts. Each account is authorized, given a manager-chosen nickname, monitored (last exchange, lag, exceptions) and revoked separately in Connections. Every listing, room and rate plan maps to the connected account that owns it, and its reservations, inbox threads (MESSAGE-001), reviews (GUEST-004), payouts (FIN-002) and acknowledgements are attributed to that account. Airbnb listings where the manager is a co-host connect through the co-host’s grant wherever Airbnb gives the co-host full access, after the listing owner’s host account authorizes; Connections shows each co-hosted listing’s granted permissions, and an action the grant lacks is refused with that reason rather than attempted. One account’s authorization failure, expiry or revocation stop-sells only that account’s inventory through SYNC-006 and opens SYNC-007 exceptions for it, while every other account keeps syncing. One listing cannot be mapped under two accounts at once, and moving a listing between accounts is a reviewed remap that keeps its reservation history.

**Acceptance evidence:** From Connections authorize two Airbnb host accounts (the second with a listing on which the manager is a full-access co-host after the owner’s account authorizes) and two Vrbo accounts, each with its own nickname; map one listing under each account. Book, message and post a host review on a listing in every account and confirm each reservation, thread, review and payout carries its owning account. Try to map one listing under both Airbnb accounts and confirm refusal. Revoke one Airbnb account: verify only its listings are stop-sold with a SYNC-007 exception while a booking and rate change on the other Airbnb account and both Vrbo accounts still exchange and acknowledge normally; reauthorize and confirm recovery without duplicate reservations.

### RES-001 — Portfolio calendar with operational context.

Reservation staff use a multi-property day/week/month calendar with channel, guest, payment, owner-block and readiness states. Filters and drill-down show the authoritative reservation, timezone-correct arrival/departure, sync freshness, turnover and open issues. Unavailable reads show stale/unknown state rather than a falsely available night.

**Acceptance evidence:** Open the calendar for a realistic 20-home portfolio; filter by property/channel, inspect an overlapping stay, unpaid arrival, owner block and unready turnover, and follow each to its source record on desktop and phone.

### RES-002 — Complete reservation lifecycle.

Staff create direct, phone and manual reservations, record channel bookings, modify guest/date/unit/price details, handle no-shows and cancellations, and retain policy, source IDs and full revision history. A change recomputes inventory, payment balance, messages, tasks, access and owner allocations; conflicting edits require reconciliation rather than silently replacing another revision.

**Acceptance evidence:** Create a phone reservation, extend it, move units, cancel under its saved policy and inspect downstream calendar, balance, queued messages, cleaning and lock changes; repeat with a channel amendment and duplicate event.

### RES-003 — Owner stays and maintenance blocks.

Managers and permitted rental owners create, edit and cancel personal-stay or maintenance blocks, with reasons and date ranges. Blocks reserve the same inventory as guest stays, publish to channels and affect billable owner-use rules and readiness tasks without inventing guest revenue.

**Acceptance evidence:** Book an owner stay through the owner portal, request overlapping maintenance, reject an occupied overlap, and cancel the owner stay; verify all channels, calendar, cleaning tasks and owner-use expense allocations.

### RES-004 — Stay rules, fees and cancellation policies.

Effective-dated seasonal/day-of-week rates, minimum/maximum nights, orphan-gap rules, arrival/departure restrictions, advance notice, booking windows, preparation buffers, occupancy limits, extra-guest/pet/cleaning fees and cancellation policies govern every quote and channel push. Unsupported channel restrictions are named; inclusive/exclusive fees and taxes are disclosed before commitment. Per-channel markups and weekly/monthly discounts are PRICE-002.

**Acceptance evidence:** Price boundary-date, gap-night, last-minute and extra-guest stays through direct checkout and each OTA adapter; prove an invalid stay cannot book, valid totals agree with the breakdown, and an old reservation retains its saved cancellation policy.

### RES-005 — Linked rooms and whole-property inventory.

Linked listings and interchangeable units express shared physical capacity: selling a room closes an incompatible whole-home listing and selling the whole home closes its rooms. Unit assignment, owner blocks and maintenance use the same constraints across direct and channel inventory.

**Acceptance evidence:** Link two rooms and their whole-home listing, sell a room via an OTA and attempt a whole-home direct booking; then cancel and sell the whole home, proving both room listings close and all channel acknowledgements reconcile.

### RES-006 — Quotes and conversion to a reserved stay.

Staff issue itemized USD quotes with guest counts, fees, taxes, cancellation terms, expiry, optional inventory hold and a secure direct-reservation link. Revisions and accepted terms are retained. Expired quotes release holds; concurrent quote acceptance revalidates price and inventory before payment.

**Acceptance evidence:** Send a quote from Reservations, accept its link as a guest, complete checkout once and inspect the resulting booking; expire a rival quote and attempt acceptance after a rate or availability change without silently charging obsolete terms.

## Revenue and direct bookings

### PRICE-001 — Revenue planner and dynamic pricing connections.

A nightly planner imports market-informed rates and stay restrictions from PriceLabs, Wheelhouse and Beyond through separate named adapters. Hosts choose the active source per listing, set USD floors/ceilings and manual overrides, inspect provenance and preview changes. Daily updates honor saved limits and property rules; unavailable feeds preserve explicit last-known pricing with an alert.

**Acceptance evidence:** Connect and exercise PriceLabs, Wheelhouse and Beyond separately; import a daily plan, override one night, reject a below-floor rate, simulate stale provider data and publish valid prices to all three OTAs with acknowledgements.

### PRICE-002 — Per-channel markups and length-of-stay discounts.

Per listing and per channel, a manager sets a percentage or fixed USD markup or markdown (for example +15% on Booking.com to cover commission, or −$20 a night on Vrbo) and chooses whether cleaning and other fees are included in the adjusted amount. Weekly (7+ nights) and monthly (28+ nights) length-of-stay discounts apply to direct quotes and are published as Airbnb weekly/monthly discounts, Vrbo length-of-stay discounts and Booking.com rate plans or length-of-stay pricing. Adjustments apply after the PRICE-001 rate and before channel push. No markup or discount takes a night below its saved floor, and an unsupported channel combination is named before publication. Each reservation records the base rate, channel adjustment and discount it used, and the rates view shows the expected payout after commission per channel.

**Acceptance evidence:** Configure a +15% Booking.com markup that includes the cleaning fee and a fixed $20-a-night Vrbo markdown that excludes fees; publish and verify each channel’s acknowledged nightly price and fees, then book on each and reconcile the payout to the expected figures. Set weekly and monthly discounts and quote 7-night and 28-night stays on direct, Airbnb and Booking.com (as a rate plan), verifying each discounted total. Set a discount that would cross the floor and verify the floor holds and the conflict is shown.

### WEB-001 — Branded direct-booking website.

Hosts publish a mobile booking website on their custom domain with their branding, property search, galleries, amenities, guide content, policies and live prices/availability. They control pages, SEO metadata, analytics consent and domain portability. Cabin operates the guest booking site as a product feature; this round does not change the owner-approved Cabin homepage.

**Acceptance evidence:** Publish a two-property site on a test custom domain, edit a property page, search real available dates at 1440 and 390 pixels and complete a guest booking with the exact advertised total and terms.

### WEB-002 — Embeddable booking engine.

A documented booking widget and WordPress-compatible embed use the same live search, inventory, price and Stripe checkout as the hosted site. Hosts authorize embedding origins; the embed does not expose staff data or provider secrets. Payment/confirmation return safely to the host’s chosen page with accessibility and mobile support.

**Acceptance evidence:** Install the widget on an allowed external site and WordPress page, complete a stay and verify one reservation; refuse an unapproved origin and an attempt to query private reservation/guest records.

### WEB-003 — Signed rental agreements.

Managers maintain versioned US rental-agreement templates and rules per property. Guests review the exact booking terms and electronically sign; the signed document, signer evidence, time and document version remain attached to the reservation. Amendments requiring renewed agreement are tracked and unresolved signing blocks configured check-in actions.

**Acceptance evidence:** Book with a required agreement, sign through the guest link, download the saved signed version, then amend dates/terms and verify renewed consent is requested and the original signature is preserved.

### WEB-004 — Guest identity verification.

Managers configure risk-based identity verification through Stripe Identity or an approved verification partner, with explicit guest consent, restricted access and a manual review alternative. Cabin retains necessary verification state and provider references while minimizing identity-document copies. Failed or incomplete checks enter an assigned review queue and obey saved access-release policy.

**Acceptance evidence:** Complete and fail partner verification from the guest check-in link, route one case for human review, confirm staff access limits and retention/erasure behavior, and prove door codes do not release while a required verification remains unresolved.

### WEB-005 — Promotions, upsells and gap-night offers.

Hosts offer scoped coupons, repeat-guest rates, paid extras, early check-in, late checkout and gap-night extensions. Eligibility, inventory, cleaner capacity, minimum net contribution, consent and owner allocations are checked before an offer is sent or charged. Acceptance updates the original stay and every downstream system; expiration/cancellation releases inventory and follows the refund policy.

**Acceptance evidence:** Send a gap-night extension and paid early-arrival offer, accept one through the guest portal, reject an ineligible coupon and an offer that conflicts with cleaning, and reconcile payment, access, channels and the owner statement.

## Guest payments and service

### PAY-001 — Processor-backed USD checkout and manual payments.

Stripe checkout collects guest card payments and supported US ACH payments against itemized reservations; hosted/tokenized processor controls keep raw card/bank credentials out of Cabin. Payment success, pending ACH, failed authentication and failure are distinct from a booking hold. Staff record authorized cash/check/manual receipts with provenance, never as invented processor settlements.

**Acceptance evidence:** Book through the public site with successful, declined and authentication-required cards plus pending/returned ACH in the processor test environment; replay payment callbacks and prove one correct reservation balance and no raw payment credentials in reads, exports or logs.

### PAY-002 — Scheduled collection and payment follow-up.

Deposit, installment and balance schedules use the reservation’s policy and authorized payment mandate. Due jobs collect through Stripe, record receipts and chase failed/overdue payments with assigned deadlines. Date changes and cancellation reschedule or suppress future collection; uncertain charges require provider reconciliation before another attempt. Booking.com virtual-card charges are scheduled collection jobs bound by PAY-005’s activation, expiry and loaded-amount limits. A property-collect Booking.com guest card received under PAY-006 is the reservation’s authorized mandate for its saved deposit and balance schedule.

**Acceptance evidence:** Configure a deposit and pre-arrival balance in Payments, advance the schedule, fail one collection, resolve its reminder and change/cancel the stay before the next charge; inspect processor records and Cabin’s durable job outcomes after restart.

### PAY-003 — Damage deposits, refunds and cancellation settlement.

Cabin distinguishes security-deposit authorizations, refundable deposits and rent, tracks authorization expiry and release, and requests approved full/partial refunds through Stripe. Claims require evidence and human approval; canceled/changed stays calculate amounts from saved terms. Duplicate callbacks or repeated operator clicks cannot double-capture, refund or release funds.

**Acceptance evidence:** Authorize a damage deposit, approve an evidenced partial claim, release the remainder, issue a partial rent refund and cancel a second stay; replay each event and verify processor balances, guest receipts, tax adjustments and owner liabilities match once.

### PAY-004 — Protection partners and chargeback casework.

Hosts may connect licensed damage/travel-protection and dispute-support partners, for example Safely or an eligible protection provider, with eligibility, price, coverage/exclusions and guest acceptance recorded. Disputes retain deadlines, signed agreements, communication and work evidence for human-approved submission. Partner acknowledgement is separate from coverage, claim approval or recovered money.

**Acceptance evidence:** Enroll an eligible stay, decline an ineligible one with its reason, open a damage/chargeback case, approve its evidence packet and follow the provider’s accepted/rejected outcome through reservation and owner adjustments.

### PAY-005 — Booking.com virtual credit cards.

When Payments by Booking.com collects a stay, its virtual credit card (VCC) is tokenized straight into Stripe’s vault through the channel connection; Cabin never stores, logs or shows the full card number or security code. Cabin records the VCC token reference with its loaded amount (USD), activation date and expiry date on the reservation. A PAY-002 collection job charges exactly the loaded amount through Stripe, once, on or after the activation date and before expiry. Cabin refuses any charge before activation, after expiry or above the loaded amount, and a replayed callback or repeated job cannot charge twice. An expired or declined VCC, or a stay date change that leaves the activation date out of step with the new dates (the date does not move with the stay), opens an assigned exception with the channel’s deadline rather than charging. A charged VCC posts to the reservation’s trust subledger (FIN-001) and reconciles to the Booking.com payout and the owner line in FIN-002.

**Acceptance evidence:** Receive three Booking.com test reservations carrying VCCs with set loaded amounts and activation dates. On the first, attempt a charge before activation and confirm refusal with no processor charge; advance to activation and verify exactly the loaded amount is charged once, including after a replayed callback and a rerun job, and that no full card number appears in reads, exports or logs. Let the second VCC expire and move the third stay earlier so its activation date falls after the new check-in; verify both become assigned exceptions with no charge. Reconcile the charged amount to its reservation, Booking.com payout and owner statement line.

### PAY-006 — Booking.com property-collect guest cards.

When a Booking.com reservation uses property collect (Booking.com’s hotel-collect model, where the property rather than Booking.com charges the guest), the guest’s card arrives through the channel connection and is tokenized straight into Stripe’s vault; Cabin never stores, logs or shows the full card number or security code, and keeps only the token reference, brand, last four digits and expiry. That token becomes the reservation’s payment mandate, and PAY-002 charges it on the reservation’s saved deposit and balance schedule with the same idempotency and replay protection as every other collection job. A permitted role can report a declined or invalid card to Booking.com from the reservation’s Payments section, once per card: Cabin records the report as made only when Booking.com acknowledges it, and a repeated click or replayed job sends nothing further. After acknowledgement the reservation shows the guest’s deadline to supply new card details as Booking.com states it (normally 24 hours), and an assigned exception escalates before and at that deadline. An updated card from Booking.com is tokenized the same way, replaces the mandate, retries the failed charge and resumes the schedule. If no valid card arrives by the deadline, Cabin offers the penalty-free cancellation Booking.com’s invalid-card process allows; a human confirms it, and Cabin records the cancellation, reopens inventory through SYNC-006 and suppresses future collection only after Booking.com acknowledges it. Collected amounts post to the reservation’s trust subledger (FIN-001) and reconcile in FIN-002, where Booking.com’s commission on a property-collect stay is a payable on Booking.com’s commission invoice to the property, never netted from a payout.

**Acceptance evidence:** Receive three property-collect Booking.com test reservations through the connection and confirm no full card number or security code appears in any read, export, log or archive. On the first, verify the deposit and balance each charge on schedule exactly once, including after a replayed callback and a rerun job. On the second, decline the card, report it invalid from the reservation and repeat the report; verify a single report, Booking.com’s acknowledgement, and the guest deadline with an assigned exception. Deliver an updated card from Booking.com and verify the failed charge retries once and the schedule resumes. Leave the third reservation’s declined card un-updated past its deadline; verify the penalty-free cancellation is offered, confirmed by a human and acknowledged by Booking.com, that inventory reopens and that no further charge is attempted. Reconcile the collected amounts and the Booking.com commission invoice to each reservation and its owner statement line.

### GUEST-001 — Guest profiles and repeat-stay context.

Guest records join channel identities, verified contact details, reservations, communications, consent, preferences and service history without silently merging different people or exposing sensitive notes. Staff can review and undo a duplicate merge, restrict sensitive fields and see the source of each fact; returning guests receive their saved preferences only within consent and property policy.

**Acceptance evidence:** Receive the same guest on two channels, review a suggested merge, record a preference and opt-out, book a return stay and undo a mistaken merge; verify the right history follows each person and role-limited reads remain private.

### MESSAGE-001 — Unified channel, SMS, email and WhatsApp inbox.

Airbnb, Vrbo and Booking.com conversations, guest email, Twilio SMS and WhatsApp join reservation-linked threads with attachments and delivery history. Twilio/SendGrid or the selected Base mail adapter supplies email delivery; provider approval, US messaging registration and consent are implementation work. Inquiry, request-to-book, special-offer and alteration actions (SYNC-008) are taken from the thread. Cabin preserves channel reply rules and distinguishes submitted, provider-accepted, delivered and failed messages.

**Acceptance evidence:** Receive and reply on all three OTA channels, email, SMS and WhatsApp through the inbox; attach the correct reservation, replay an inbound event and simulate a rejected/outage send, proving one visible message and an assigned delivery failure without false delivery claims.

### MESSAGE-002 — Team routing and response accountability.

Templates, internal notes, labels, assignments, collision indicators and property/urgency routing support a guest-service team. Response deadlines, shift coverage and escalation continue until an accountable person accepts the issue; private notes cannot be sent as guest messages. Handover preserves the reservation, open operational tasks and prior promises.

**Acceptance evidence:** Route an after-hours access thread, add an internal note, have two staff attempt replies and hand the issue to the next shift; miss its response deadline and confirm escalation reaches an assigned manager with the full context.

### MESSAGE-003 — Lifecycle messaging and post-stay follow-up.

Hosts configure booking confirmation, payment/signature/ID reminders, pre-arrival instructions, arrival checks, checkout, review requests and repeat-stay follow-up using property-local schedules and event triggers. Conditions withhold access secrets until payment/verification/readiness rules pass. Changes, cancellation, opt-out, channel policy and quiet hours re-evaluate queued messages; sends have deduplication and visible failure handling.

**Acceptance evidence:** Book, modify and cancel stays with scheduled templates; advance due times and verify each eligible message arrives through its chosen channel once, canceled or opted-out sends stay suppressed, withheld codes remain private and failed sends escalate.

### MESSAGE-004 — Source-grounded AI replies with controlled sending.

Reply assistance uses the actual reservation, approved property instructions, guest thread and current operational facts, linking its sources and uncertainty. Humans edit/send drafts by default; opt-in automatic replies are limited by property, topic, confidence, hours and policy. Refunds, relocation, safety assurances and new spending require their own authority; unanswered questions and low confidence notify a person.

**Acceptance evidence:** Ask the inbox assistant a supported check-in question, an undocumented amenity question and a compensation request; inspect sources, edit a draft, enable a narrow automatic rule and prove unsupported or unauthorized promises route to a human without being sent.

### GUEST-002 — Guest check-in and stay portal.

A secure mobile guest portal exposes only the holder’s reservation, payment/verification/signature tasks, arrival instructions, timed access code, house rules, digital guidebook, extras and issue reporting. Expiring/revocable links and verified identity protect access. Updated instructions show their version; access secrets disappear after cancellation/checkout and do not leak through shared/public pages.

**Acceptance evidence:** Open a guest link on a phone, finish pre-arrival tasks, view the correctly timed code and report an issue; use another reservation’s ID, an expired link and a canceled stay and confirm private details and access are refused.

### GUEST-003 — Reviews and consented repeat-guest marketing.

Staff track channel reviews, request post-stay feedback, draft and approve supported public review responses and follow unresolved dissatisfaction into service recovery. Mailchimp receives explicitly consented guest segments for repeat-stay campaigns; opt-outs and deletion propagate. Cabin records campaign/referral attribution without treating review requests or audience export as completed guest recovery. The host’s own reviews of guests are GUEST-004.

**Acceptance evidence:** Complete a stay, deliver one eligible review request, receive a negative response and assign recovery, approve a channel review reply, sync a consented Mailchimp segment and verify an opt-out removes the guest before the next campaign.

### GUEST-004 — Automated host reviews of Airbnb guests.

After each Airbnb checkout Cabin can post the host’s review of the guest from a pool of manager-approved templates, after a configurable delay inside Airbnb’s review window, with configured star ratings and an optional private note. Staff can stop automation for one reservation, for example after a bad stay; that stay enters a review-needed queue showing its deadline. Automation never posts where a review was already written by hand, in Cabin or on Airbnb, and never posts after the window closes. A review is recorded as posted only on Airbnb’s acknowledgement; a refused post becomes an assigned task before the deadline.

**Acceptance evidence:** Check out three Airbnb test stays: one receives a templated review after the configured delay and Airbnb accepts it; one has automation stopped and stays in the queue until a person writes and submits it; one already reviewed by hand is not overwritten. Refuse one post in the provider test harness and verify the assigned task, and confirm no post is attempted after the window closes.

## Property operations and access

### OPS-001 — Reservation-triggered turnover dispatch.

Confirmed reservations, checkout, amendments and cancellations create or revise the appropriate cleaning/inspection tasks exactly once. Managers configure per-property templates, timing, rates and approved teams; cleaners accept or decline, receive reminders, and can be replaced without losing history. Overdue or declined jobs escalate before arrival. Each cleaner or team has a saved daily capacity (jobs and hours) and home base; travel time between consecutive jobs comes from property addresses through a routing provider such as the Google Maps Distance Matrix API, or from manager-entered drive times. An assignment that would exceed capacity or cannot reach the next job within its window is never made silently: it routes to the next eligible backup or is flagged to a manager with the reason.

**Acceptance evidence:** Confirm, extend and cancel a stay through reservation doors, inspect generated tasks, have a cleaner decline and a backup accept, and verify deadlines, changed instructions and cancellation propagate with no duplicate payable turnover. Then give one cleaner two same-day turnovers that cannot both be reached within their windows given travel time, and a third job beyond the cleaner’s daily capacity; verify each is routed to a backup or flagged to a manager with the reason shown.

### EVIDENCE-001 — Private immutable cleaner completion evidence.

Only the assigned currently authorized cleaner completes an approved turnover, once, using every approved checklist item and a valid PNG/JPEG with caption. Cabin checks image structure and keeps persisted private bytes, digest, actor and completion time. A changed booking invalidates stale completion authority; authorized photo retrieval rechecks current permissions.

**Acceptance evidence:** Complete a job through the cleaner command/photo doors; reject missing checks, malformed images, another cleaner and a duplicate completion, then retrieve the original photo only with an authorized session.

### OPS-002 — Cleaner mobile work with reliable uploads.

The cleaner app provides assigned schedules, directions, safe entry instructions, checklists, notes, multiple required work photos and issue reporting. Poor connectivity preserves private local drafts; reconnect reconciles the current assignment and booking revision before completing or uploading. Mobile capture cannot manufacture completion or expose another property’s data.

**Acceptance evidence:** On a phone accept an assigned job, capture required checklist photos and an issue, lose connectivity, then reconnect after a booking edit; retain the draft, request review of stale work and complete only the current approved task.

### OPS-003 — Readiness is verified before arrival.

A per-stay readiness record combines accepted cleaning, maintenance blockers, inspection evidence, supplies and access verification. Per-property supply and restock items (for example linens, toiletries, coffee and paper goods) are readiness items: a failed or short item keeps the arrival unready until it is restocked and attested, or a manager explicitly excepts it. Named people attest physical completion; pending/failed evidence remains unready. Managers see at-risk arrivals, chase overdue work and explicitly approve exceptions with guest impact recorded. A cleaner upload alone cannot certify building safety.

**Acceptance evidence:** Open an arrival with completed cleaning but failed lock and maintenance checks and a failed restock item; verify it stays unready, resolve the tasks and restock and attest the item, obtain inspector acceptance and show the manager and guest-service team the final readiness state and evidence.

### OPS-004 — Maintenance, inspections and work-order expenses.

Managers dispatch corrective work orders and recurring preventive maintenance/inspections with assets, checklists, priority, photos, due dates, vendor acceptance, quotes and attached invoices/expenses. Approval limits govern spend; unavailable units close inventory. Completion requires evidence and inspection when configured, allocates the approved cost to the correct owner and reschedules the next recurrence.

**Acceptance evidence:** Report a broken appliance, approve a vendor quote, block the unit, receive invoice/photos and inspect completion; reopen for guests, reconcile the owner expense and advance a recurring inspection without duplicate tasks.

### OPS-005 — Stay-bound smart-lock automation.

Schlage, Yale, August, Kwikset, RemoteLock, Igloohome, Nuki and Salto locks connect directly or through an approved bridge such as Seam; Connections shows which path each lock uses. Cabin provisions unique stay-bound codes, verifies provider/device state, sends them only when release rules pass, updates windows for changed stays and revokes them on cancellation/checkout. Battery/offline alerts trigger assigned action and a manager-approved backup entry plan; an API acknowledgement alone is not a tested door. Hub-dependent and offline-PIN locks follow OPS-007.

**Acceptance evidence:** Connect each named lock family, directly or through the bridge; for each, provision and verify a stay code, extend then cancel the booking and observe expiry/revocation at the device or provider test harness. Route a low-battery/offline lock to a person before arrival.

### OPS-006 — Breezeway specialist operations handoff.

A host using Breezeway can map properties, reservation events and task types, send authorized work and receive acceptance, completion, photos and issues. Cabin shows the system responsible for each task and avoids duplicate dispatch or expense creation. Disconnects and conflicting updates remain assigned exceptions; imported completion feeds readiness only after required human inspection.

**Acceptance evidence:** Connect Breezeway, amend a reservation, accept and complete its turnover externally, return photos and an issue, then replay events and disconnect the adapter; verify one owned task and cost with visible unresolved readiness.

### OPS-007 — Hub-dependent and offline-PIN locks.

Each connected lock records its connectivity mode: cloud or Wi-Fi, hub-bridged (for example Schlage Sense, Bluetooth Yale and August models, or Nuki through its bridge) or offline (for example Igloohome time-bound PINs). Before enablement Cabin states when a hub is required and then shows the hub’s online state. For an offline-only lock Cabin generates the provider’s time-bound PIN for the stay window, labels it as unverifiable at the device and not revocable early, and requires a manager-approved fallback (a code-change task or lockbox) for cancellations and early checkouts. A hub going offline before arrival opens an assigned case, and code delivery still waits for release rules.

**Acceptance evidence:** Connect an Igloohome lock in offline mode and a Schlage Sense through its hub; verify the hub requirement is stated before enablement. Provision an offline time-bound PIN, confirm it is labelled unverifiable, then cancel the stay and verify the fallback task. Take the hub offline before an arrival and verify the assigned case and that code delivery waits for release rules.

## US money, owner accounting and reporting

### FIN-001 — Reservation-linked USD trust subledgers.

A balanced ledger in integer USD cents separates guest receivables, advance deposits, damage holds, owner liabilities, manager revenue, channel/processor fees, expenses, taxes and cash by legal entity, property, owner and reservation. Entries retain effective/posting dates, sources and correction links. Closed periods use reversing adjustments; owner/client money is never silently netted across unrelated owners.

**Acceptance evidence:** Through reservation, payment and accounting doors record a deposit, earned stay, channel fee, tax, refund and owner expense; drill each balance to source transactions and prove debits equal credits before and after a period-close correction.

### FIN-002 — Payout reconciliation per reservation.

Airbnb, Vrbo, Booking.com and Stripe settlement records reconcile gross bookings, commissions, processor fees, withheld taxes, refunds, disputes, payout batches and bank receipt to each reservation and owner. Split/partial payouts and rounding differences remain explainable exceptions. Each settlement is attributed to the connected channel account that earned it (SYNC-010), and charged Booking.com virtual cards (PAY-005) reconcile to their reservation, Booking.com payout and owner line. Property-collect Booking.com charges (PAY-006) reconcile to their reservation, Stripe payout and owner line, and Booking.com’s commission invoice reconciles line by line to those reservations as a payable, never netted from a payout. Original provider events survive corrections; missing records are pursued until resolved, never filled with invented income.

**Acceptance evidence:** Import or receive each named provider’s settlement with multiple stays across two connected accounts of one channel, a charged Booking.com virtual card, a property-collect Booking.com charge with its commission invoice, a partial refund and a missing payout; reconcile a real bank receipt through the accounting view, retain the unmatched item and close it only after the missing external record arrives.

### FIN-003 — Management agreements and expense allocation.

Effective-dated management models define commission bases, fixed/percentage fees, owner-use cleaning, pass-through costs, taxes, shared costs, reserves and multiple-owner splits. Approved invoices/work-order costs attach to reservations or property periods, with evidence and accountant-reviewed mappings. Staff can explain every owner/manager allocation and its agreement version.

**Acceptance evidence:** Configure two different owner agreements, post reservation revenue and a shared repair, amend terms for a later stay, then inspect exact owner splits, fees, reserve and invoice evidence without rewriting the earlier allocation.

### FIN-004 — Reconciled frozen owner statements and monthly delivery.

Monthly USD owner statements derive from the reconciled ledger and show opening balance, each stay, gross revenue, fees, commissions, tax responsibility, expenses, reserves, refunds, distributions and closing payable. Managers review differences and exact revisions before release; scheduled generation/delivery follows configured approval policy. Approved PDF/CSV and portal versions freeze the terms and totals; corrections issue traceable adjustments rather than rewriting sent statements.

**Acceptance evidence:** Run month-end with a missing payout, resolve its exception, review and approve the USD statement, deliver it once to the owner portal/email and compare every line to the ledger; later amend property terms and correct a posted item without changing the original safe CSV/PDF.

### FIN-005 — Rental-owner portal and personal stays.

Rental owners securely view only their properties, agreed calendar visibility, occupancy/revenue, reconciled statements, invoices, reserves, distributions and open issues. They download records, approve authorized expenses and request personal stays subject to inventory/management rules. Ownership changes retain historical statement access under explicit grants without exposing other owners or guest identity documents.

**Acceptance evidence:** Invite two unrelated rental owners, show each its statements and performance, approve an expense and request an owner stay; try cross-owner URLs/exports and transfer ownership, verifying historical and future access follow the grants.

### FIN-006 — Trust accounts, bank reconciliation and approved ACH distributions.

Accountants manage multiple designated trust/operating cash accounts, import or connect US bank feeds through Plaid or an approved banking partner, and perform bank-to-ledger-to-owner-liability reconciliation. Approved owner/vendor distributions use Stripe or licensed ACH/payout partners with verified payees, reserves and available-funds checks. Pending, settled, failed and returned transfers are distinct; Cabin does not itself custody funds.

**Acceptance evidence:** Reconcile two trust accounts and their owner liabilities, approve a distribution, reject one that would use another owner’s funds, and follow a returned ACH through bank evidence, restored liability and corrected owner statement.

### FIN-007 — QuickBooks Online accounting synchronization.

Cabin provides its own QuickBooks Online connector with accountant-approved mappings for properties/classes, owners/vendors, revenue, deposits, fees, taxes, expenses and settlements. Previewed exports/sync batches retain external IDs, errors and reconciliation totals; duplicates and edits are handled without double posting. Guesty Connect is a migration reference, not an available Cabin connector.

**Acceptance evidence:** Authorize a QuickBooks Online test company, map accounts, sync a month including a refund and expense, reconcile totals, repeat the batch and handle an externally edited or rejected transaction without duplication.

### FIN-008 — US occupancy, lodging and sales-tax obligations.

Property jurisdiction and stay dates drive configured occupancy/lodging and applicable sales-tax rules, exemptions and filing periods. Cabin separates channel-collected/remitted amounts from host liability, adjusts cancellations/refunds and tracks registration, filing and payment evidence. Avalara MyLodgeTax or an approved filing/remittance partner receives reviewed obligations; unsupported jurisdictions remain explicit work items until supported, without removing the tax workflow.

**Acceptance evidence:** Book direct and OTA stays in two US jurisdictions with mixed collection responsibility and an exemption, refund one, approve a filing/remittance through the selected partner and reconcile acknowledgements, payments and remaining liability to the ledger.

### FIN-009 — US owner and contractor tax reporting.

Restricted W-9/payee records, owner and contractor payment histories, filing classifications and accountant adjustments support US 1099 preparation. Managers review totals and recipient details, generate accountant/e-file exports and submit through an authorized filing partner; acceptance, rejection, correction and recipient delivery are tracked. Tax IDs are masked outside the authorized tax workflow.

**Acceptance evidence:** From year-end reporting prepare owner and cleaner/vendor 1099 records, review exclusions/adjustments, submit a partner test filing, correct a rejection and download the accepted export without leaking tax IDs to service staff or ordinary archives.

### REPORT-001 — Operational, revenue and owner performance reports.

Live reports show occupancy with owner/maintenance blocks separated, ADR, RevPAR, booking pace, channel mix, gross/net revenue, cancellations, collection/settlement exceptions, owner performance, cleaning cost and readiness/service deadlines. Filters use property-local dates and explicit cash/accrual or stay/booking-date bases. Totals drill to permitted source records and export without hidden truncation.

**Acceptance evidence:** Use a mixed-channel month with owner blocks, refunds and incomplete payouts; filter a portfolio report, explain its occupancy denominator and accounting basis, and reconcile exported totals and drill-downs to reservations and ledger records.

### REPORT-002 — Saved reports and scheduled sharing.

Managers save report filters and schedule scoped owner/team delivery with period, recipients and format visible. Each run records the exact data cutoff, access scope, generated artifact and delivery outcome; changed access, failed generation or delivery creates assigned follow-up. No recipient receives another owner’s rows through a saved report.

**Acceptance evidence:** Schedule two owner reports and a manager digest, revoke one owner before run time, advance the schedule and inspect artifacts/delivery history; verify unauthorized delivery is refused and a failed send is assigned for resolution.

## Integrations, migration, mobility and durable custody

### API-001 — Documented API, webhooks and Zapier automation.

A versioned scoped API covers property, reservation, availability, messages, work, financial records and exports with pagination and idempotent mutations. Signed outbound webhooks expose lifecycle and financial events with delivery history, bounded retry and replay controls; Zapier uses the same grants and durable events. Third-party access is revocable and cannot bypass approval, payment or property scopes.

**Acceptance evidence:** Create/read a reservation through documented API credentials, consume a signed webhook in Zapier, repeat a mutation and replay a delivered event; revoke credentials and show private/financial actions and stale queued jobs are refused.

### MIGRATE-001 — Reviewed property-register move-in.

The owner can preview a property-register CSV without publishing, inspect normalized rows/refusals and the source fingerprint, approve the exact plan, read a durable journal and safely undo unchanged imported records. Source-byte custody, collision/authority guards and dependency-aware reversal preserve native edits; retained source can be retired on erasure. No import may create users, sell inventory or move funds implicitly.

**Acceptance evidence:** Use Move in to preview/apply the documented CSV, reject a changed fingerprint, inspect the durable job, edit one imported property and undo; retain that native edit with its disposition, then erase another imported property and verify source retirement.

### MIGRATE-002 — Migration from Guesty.

A Guesty-specific export/API adapter maps properties/listings, future and historical reservations, guests, threads/attachments, fees/rules, tasks, owner terms, settlements and opening owner balances into a reviewed move-in plan. Original IDs, field mappings, counts and unsupported data remain visible. Missing source permissions or inaccessible history produce a named remediation/export request rather than silent omission. Channel mappings carry each listing’s owning channel account, including several Airbnb, Vrbo and Booking.com accounts and co-hosted Airbnb listings, so each maps to its SYNC-010 connected account.

**Acceptance evidence:** Upload a permissioned Guesty export or connect a test account in Move in; preview each record family and balance, fix one mapping, apply without guest sends/charges and reconcile source counts and financial totals with the resulting Cabin records. Include listings from two Airbnb accounts, one co-hosted, and confirm after reauthorization that each listing maps to its own connected account.

### MIGRATE-003 — Migration from Hostaway.

A separate Hostaway adapter preserves property/channel IDs, future/history bookings, guest conversations, rate/rule data, operations, payment/settlement history and owner opening balances. The reviewed plan distinguishes migrated history from live channel authority, lists exclusions with retrieval steps and deduplicates later channel events by external identity. Each listing keeps its owning channel account, so a portfolio spread over several Airbnb, Vrbo or Booking.com accounts, including co-hosted Airbnb listings, maps to the matching SYNC-010 connected accounts.

**Acceptance evidence:** Import a permissioned Hostaway dataset through Move in with a modified stay, archived thread and unpaid owner balance; reconcile records/totals, then deliver the same stay’s live channel event and prove it updates rather than duplicates the booking. Use listings from two Vrbo accounts and confirm each maps to, and receives live events through, its own connected account.

### MIGRATE-004 — Migration from OwnerRez.

An OwnerRez adapter imports properties, guest/booking history, quotes, signed rental agreements, message history, payment/deposit records, owner commissions, statements and opening balances. Legacy processor tokens and channel credentials are not assumed transferable: reconnect/consent steps are explicit while historical references and obligations remain intact.

**Acceptance evidence:** Preview and apply a permissioned OwnerRez export including a signed agreement, future installment and owner statement; compare source records and balances, reconnect payment/channel authority and verify no historical collection or message is replayed.

### MIGRATE-005 — Migration from Lodgify.

A Lodgify adapter preserves property content/media, rates, reservations, guest messages, agreements, payments, tasks, owner balances and website/domain redirect requirements. Staff see a complete mapping and missing-artifact report before approval; the guest’s future booking link and terms remain recoverable during website cutover.

**Acceptance evidence:** Import a permissioned Lodgify dataset from Move in, reconcile a future stay and historical refund, retrieve its original agreement and media, preview website redirects and verify the migrated guest can reach the correct reservation without being charged again.

### MIGRATE-006 — Switching from Hospitable and Breezeway operations.

Hospitable migration maps booking, guest-message, automation, pricing, lock and owner-statement history with explicit reconnection of authority. Breezeway migration or continued connection maps properties, checklists, accepted work, photos and unresolved issues. Historical completion does not automatically certify an upcoming stay ready; unsupported fields remain retrieval work with source custody.

**Acceptance evidence:** Run separate permissioned Hospitable and Breezeway imports, compare upcoming tasks, guest threads and balances, then enable one new reservation event and prove one active task/message workflow with required readiness rechecks.

### MIGRATE-007 — CSV history, cutover rehearsal and accountable go-live.

Future and historical reservation CSVs support field mapping, timezone/currency checks and duplicate/conflict review. Migration rehearsals reconcile property/stay/guest counts and opening balances, require human approval of unresolved gaps, and sequence old-PMS shutdown, channel/payment/domain reconnection and live inventory checks. Cutover never runs two charging or messaging schedulers; rollback preserves new bookings and financial evidence.

**Acceptance evidence:** Import a reservation CSV, rehearse migration of a 20-home portfolio, resolve mismatched counts and a changed opening balance, then perform a controlled cutover and rollback while a new booking arrives; retain that booking and prove one active sender/collector.

### MOBILE-001 — Native manager and field-team apps.

US iOS and Android apps provide role-scoped reservation/calendar, inbox, arrival/readiness, cleaner/vendor tasks, camera uploads and actionable push notifications. Offline work is encrypted on device and reconciles revision/authority on reconnect; sign-out or revocation prevents stale data/credentials granting access. The mobile owner portal supports statements and owner stays without exposing staff-only records.

**Acceptance evidence:** On iOS and Android as manager, cleaner and rental owner, handle a changed arrival, reply to a guest, complete an evidenced task and open a statement; test offline conflict, push acknowledgement and grant revocation while offline/reconnecting.

### INTERFACE-001 — Responsive accessible and honest operations.

Desktop and mobile pages expose textual statuses, source freshness, errors, pending work and actionable empty states. Keyboard, labels, focus and screen-reader feedback support WCAG 2.2 AA journeys; failed actions remain visible and do not erase user inputs or masquerade as success. Cabin is proven at the top of its buyer range: 40 properties with three years of history (at least 10,000 reservations, 100,000 guest messages and 15,000 turnover tasks) and 25 staff. At that size the portfolio calendar month view loads in under 2 seconds, inbox search returns in under 1 second, and reports render and export every row with totals matching ledger records. Lists use explicit pagination, never silent truncation; operators see provider/usage costs before enabling paid services.

**Acceptance evidence:** At 1440 and 390 pixels, use realistic properties/stays through calendar review, cleaner photo completion and statement download; exercise keyboard/error recovery and the full target booking/inbox journey. Seed an installation with 40 properties and three years of history at the stated volumes; measure calendar, inbox search and report timings against the stated limits and verify paginated lists and exports return every row with counts and totals matching the source records.

### DATA-001 — Complete portable product records and safe restore.

Owners export versioned structured records, guest/thread history, signed documents, work/photos, reservations, financial ledger, statements, audit and import journals with integrity checks and a documented schema, plus usable CSV/PDF/media downloads. Restore into empty product data validates before commit, preserves evidence and pauses outbound jobs until reconnection/review; secrets, sessions and payment credentials remain installation-local. No old charge, message, payout or access code is replayed.

**Acceptance evidence:** Use the public rer export/import commands to round-trip a populated installation, compare all record families/media and totals, reject damaged or populated restores and verify restored jobs/connections remain inactive until the new owner reauthorizes them.

### DATA-002 — Erasure, retention and later-journal fencing.

An owner can review and erase guest/member/property personal data, attachments and retained import sources, with durable completion evidence and anonymized audit attribution. Legal/accounting retention holds identify exactly what remains, why and until when; no erased contact is reused by automation. Local archive fencing refuses older copies when supplied the later erasure journal. External deliveries, partner records and already downloaded backups require explicit partner/deletion steps; an isolated old backup cannot discover future erasures.

**Acceptance evidence:** Erase a property/guest with photos, threads and source files, verify all public/private read and queued-action doors, inspect retained legal records and anonymized audit, then attempt old restore with the later journal and confirm refusal without partial writes.

### AUDIT-001 — Permanent attributable business and automation history.

Role changes, approvals, reservation revisions, access release, outbound provider actions, financial postings, imports, erasures and agent decisions retain actor/agent, time, scope, source revision and result in a portable audit. Original business events cannot be silently rewritten; sensitive content, access codes and secrets are excluded or minimized. Erasure anonymizes identity references while preserving necessary accounting/action history; operators can search and export it beyond the current view window.

**Acceptance evidence:** Follow a stay from booking through task, message, lock, refund and owner statement; export its human/agent/provider history, erase the guest and verify useful anonymized attribution remains without secrets or personal message bodies.

### SECURITY-001 — Provider custody and declared external data.

Connections use least-privilege grants, encrypted provider credentials, verified inbound signatures and owner-controlled revocation. Secrets, ID images, tax IDs, bank details and door codes are excluded from ordinary views, logs, agent prompts and archives unless explicitly required and separately authorized. Before enablement, each integration declares the destination, purpose, data, authority and costs; AI sees only the scoped facts needed and cannot follow instructions embedded in guest text as authority.

**Acceptance evidence:** Enable, rotate and revoke a provider connection, submit forged events and adversarial guest text, inspect role-limited API/export/log/agent outputs and prove revoked queued actions stop while historical evidence remains readable.

### HTTP-001 — Real Worker health and document dispatch.

Cabin serves its real installed homepage and health response from the built Worker; unknown API/document paths return real 404s. Private product routes retain their native authorization. Health proves the configured app dependencies, not live channel acceptance, physical readiness or delivery to a guest.

**Acceptance evidence:** Run the emitted Worker on migrated local storage; request /health, the installed homepage and unknown document/API paths, verifying successful health/branding and true 404s.

### RUNTIME-001 — Owner-run lifecycle and durable background work.

The shared rer install/setup/dev/build/verify/export/import lifecycle remains usable with native owner authority, real Worker/D1 data and no operational dependence on the author. Production channel/message/payment/lock/report jobs persist due time, claims, attempt and external outcome across restart, with visible errors and safe reconciliation of uncertain effects. Required configuration fails clearly without printing values; provider approvals, contracts, credentials and quotas are tracked prerequisites to enabling each feature.

**Acceptance evidence:** Start a fresh source checkout with rer dev, sign in and complete a product job, stop/restart and recover durable state; interrupt each external job before/after provider acceptance and prove reconciliation prevents duplicate charges, sends or unlocks.

## Push further: agents complete the stay’s job

### AGENT-001 — Recover a disrupted stay through verified readiness.

When a cleaner cancels, a reservation conflicts or a guest reports a problem, a recovery agent correlates actual channel revisions, guest threads, accepted tasks, photos, access events, alternative inventory and balances. It secures an approved replacement cleaner, chases acceptance/completion, provisions and verifies new door codes, and offers approved compensation or an alternative stay. Manager approval binds spend, relocation and guest promises; a person verifies readiness. The case closes only after guest/field confirmation, reconciled channels/access and the final owner balance, or remains explicitly escalated.

**Acceptance evidence:** Cancel the cleaner shortly before an arrival, then report a failed lock as the guest. From the recovery case approve a budget and relocation/compensation choice; verify backup acceptance, completed evidence, new code state, guest confirmation and corrected owner net. Stop/restart midway and exercise denied approval; no step or unresolved balance may be silently skipped.

### AGENT-002 — Close reservation-to-owner financial exceptions.

A reconciliation agent uses source settlement events, bank receipts, reservation revisions, refunds, fees and effective owner agreements to explain discrepancies and seek missing provider records. It proposes correcting entries and statements with source links, follows the exception until balanced and verifies final owner payable/distribution. The owner/accountant approves refunds, postings, period reopening and payouts; unsupported assumptions never become ledger entries.

**Acceptance evidence:** Create a stay with split payout, missing channel fee and later refund; inspect the agent’s evidence, obtain the missing record, reject one proposed correction, approve the right adjustment and verify the ledger, frozen statement adjustment and actual owner distribution settle to the same net.

### AGENT-003 — Resolve guest issues through accepted field work.

An issue agent classifies guest messages against approved property instructions and current stay facts, proposes safe troubleshooting, dispatches approved maintenance/cleaning under manager limits and follows vendor acceptance, inspection and guest confirmation. It checks recurrence after the fix. Safety/emergency cases reach a named human and appropriate emergency-service instructions immediately; the agent never assures structural/physical safety or closes on a drafted reply alone.

**Acceptance evidence:** Report an access failure and leaking appliance through the guest portal/inbox; approve dispatch, decline one vendor, complete inspected work and obtain guest confirmation plus a recurrence check. Send an emergency report and verify immediate human escalation without automated safety claims.

### AGENT-004 — Optimize profitable occupancy without breaking readiness.

A revenue agent combines booking pace, PriceLabs/Wheelhouse/Beyond feeds, actual inventory, stay rules, cleaner capacity, taxes and cleaning/commission costs to propose rates and gap-night offers by expected net contribution. Hosts control floors, maximum changes, audience and publish approval. It verifies actual channel acceptance and measures realized contribution; forecasts cannot establish availability or readiness.

**Acceptance evidence:** Show an orphan-night opportunity that conflicts with cleaning, reject it, then approve a feasible bounded offer; verify the accepted channel prices, one guest purchase, changed operational/access windows and realized owner net against the agent’s forecast.

### AGENT-005 — Source-linked portfolio questions and actionable follow-up.

Staff ask natural-language questions over permissioned live reservations, conversations, readiness and financial data. Answers cite records, cutoff, filters and uncertainty, reconcile figures to reports and can propose assigned follow-up. Rental owners get only their properties; no answer fabricates a settlement, silently changes a booking or claims unavailable live data.

**Acceptance evidence:** Ask why one property’s owner net fell and which arrivals are at risk; follow the cited records to matching reports, approve an assigned investigation, and ask as an unrelated owner and during a stale provider read to verify scope and explicit uncertainty.

### AGENT-006 — Bounded action authority and durable agent cases.

Expanded agents execute only separately granted property/action scopes, approved providers, spend/compensation ceilings and time windows. Exact approvals bind the proposed external action and relevant current revisions; changed price, inventory, recipient or terms invalidates approval. Agents record plans, attempts, acknowledgements, pending human work and verified end states; pause/revoke stops new effects while uncertain started effects reconcile. They cannot sign agreements, authorize payouts or declare readiness for people.

**Acceptance evidence:** In a recovery case approve a specific vendor/payment limit, change the recipient or booking, and reject the stale action; exceed a budget, inject guest instructions and revoke the agent during an uncertain provider response. Inspect the case after restart for no unauthorized effect and an explicit unresolved outcome.

## Honest boundaries and partner obligations

### BOUNDARY-001 — A separate complete vacation-rental product with named partners.

Cabin owns the short-stay booking-to-owner-close job. It connects approved OTAs rather than operating a booking marketplace, uses Stripe/licensed banking partners for rails and custody, Avalara or qualified filing partners/accountants for remittance and filings, licensed protection partners for insurance, and real cleaners/inspectors for physical work. Telecom providers carry messages and bounded workers carry long-running work. Partnership approval, US tax/financial configuration, provider agreements and native-app distribution remain required engineering/delivery work with named owners, supported data and unresolved blockers visible; none removes a promised PMS workflow.

**Acceptance evidence:** Use Connections/onboarding to inspect each required approval/configuration and its responsible party; attempt activation without approval, complete the documented partner setup and run a booking through externally acknowledged service, tax/payment outcomes and human readiness. Disconnected features remain visibly incomplete, never replaced by simulated success.

## Product separation and baseline interpretation

Long-term residential leasing, rent collection and resident management belong to [Terrace](https://github.com/just-every/run-terrace); Cabin exchanges property/accounting references where needed. General small-business books belong to [Pantry](https://github.com/just-every/run-pantry) or QuickBooks Online; Cabin retains the complete reservation/trust subledger and owner close required above. General customer support belongs to [HappyToHelp](https://github.com/just-every/run-happytohelp); Cabin owns guest conversations and stay recovery with links/integrations for wider support. These are separate products. No unowned category is absorbed.

Cabin does not operate payment or telecom networks, underwrite insurance, provide professional legal/tax certification or itself perform a cleaner/inspector’s physical work. Named partner connections, actual remittance/distribution outcomes and human verification deliver those parts of the buyer’s workflow. US tax rules, agreements, W-9/1099 classification, bank and partner configuration require authorized professional review; international currencies/jurisdictions are later expansion, while the complete US job remains the target.

Base native sessions, command lifecycle and import-kit custody remain the foundation. The existing local portability interpretation excludes transient installation credentials and uses later-journal erasure fencing; DATA-001 and DATA-002 retain those limits while extending the portable product data. No claim of complete Base equivalence follows from copied modules, an inherited manifest or a passing health check. New embeds, guest documents, provider calls, uploads and agent actions must meet their own access, input, custody and audit clauses; the old absence of those features is not a security exemption for their future implementation. External downloaded backups cannot be recalled, and provider acceptance cannot prove physical readiness or human receipt.

## Status per clause

Implementation baseline: `bc79d0df17cc606fb939b4cdaeb18d26643ab442`, inspected 16 October 2026, equal to current `main` at drafting. The inventory audit assessed 75 inventory rows (1 done, 16 partial, 58 missing); the table below assesses the differently grouped named contract clauses, including preserved foundations and new US/product requirements. No Cabin code or test changed after that audit, on this branch or on `main` through `f0c750fd3e325df82e2eaf15a85a7f1b5c35237a`. Revised 17 October 2026 in response to buyer review round 1: SYNC-008, SYNC-009, PRICE-002, GUEST-004 and OPS-007 were added, and SYNC-006, OPS-001, OPS-003, OPS-005 and INTERFACE-001 were sharpened. Revised again 17 October 2026 in response to buyer review round 2: SYNC-010 and PAY-005 were added, and SYNC-002, SYNC-003, SYNC-004, PAY-002, FIN-002, MIGRATE-002 and MIGRATE-003 were sharpened. Revised a third time 17 October 2026 in response to buyer review round 3: PAY-006 was added, and SYNC-004, PAY-002 and FIN-002 were sharpened.

`done` means the narrowly stated clause has implementation and an exercising test. `partial` means cited foundations exist but the full target behavior/evidence does not; `missing` means no implementing product flow was found. Source/test citations describe the current tree, not proof of live providers. All external integrations and agent outcomes need their stated acceptance journey. An unused shared module is not a product capability.

**84 clauses: 6 done · 22 partial · 56 missing.**

| Clause | Status | Evidence path and remaining work |
| --- | --- | --- |
| PROPERTY-001 | partial | `src/cabin/people.ts`; `src/cabin/model.ts`; `tests/cabin.test.mjs:17` Only names, owner contact and a fixed commission are implemented; property content, time zones and versioned management agreements are absent. |
| AUTH-001 | done | `src/cabin/credentials.ts`; `src/cabin/storage.ts`; `src/cabin/domain.ts`; `src/cabin/http.ts`; `tests/cabin.test.mjs:17`; `tests/cabin.test.mjs:67` |
| AUTH-002 | missing | — No implementing flow in the audited tree. |
| CONTROL-001 | done | `src/cabin/model.ts`; `src/cabin/storage.ts`; `src/cabin/calendars.ts`; `src/cabin/turnovers.ts`; `src/cabin/statements.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55`; `tests/cabin.test.mjs:67`; `tests/cabin.test.mjs:90` |
| CONTROL-002 | done | `src/cabin/credentials.ts`; `src/cabin/http.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:109` |
| SYNC-001 | done | `src/cabin/calendar-file.ts`; `src/cabin/calendars.ts`; `src/cabin/ui/calendar.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55` |
| SYNC-002 | partial | `src/cabin/calendars.ts`; `tests/cabin.test.mjs:31` Only manually supplied Airbnb calendar files exist. No approved two-way transport, rates or acknowledgement handling is implemented. |
| SYNC-003 | missing | — No implementing flow in the audited tree. |
| SYNC-004 | partial | `src/cabin/calendars.ts`; `tests/cabin.test.mjs:31` Manual Booking.com calendar snapshots exist; connectivity, rate plans, collection-method tracking and live acknowledgements do not. |
| SYNC-005 | missing | — No implementing flow in the audited tree. |
| SYNC-006 | missing | — No implementing flow in the audited tree. |
| SYNC-007 | missing | — No implementing flow in the audited tree. |
| SYNC-008 | missing | — No implementing flow in the audited tree. |
| SYNC-009 | partial | `src/cabin/calendar-file.ts`; `src/cabin/calendars.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55` RFC 5545 parsing, UID reconciliation, end-exclusive dates and malformed-file refusal exist for manually uploaded files; URL connections, scheduled polling, export feeds, inventory holds and stale-state alerts are missing. |
| SYNC-010 | missing | — No implementing flow in the audited tree. |
| RES-001 | partial | `src/cabin/ui/calendar.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:31` A snapshot booking list and clash display ship; a live grid and integrated payment/readiness views do not. |
| RES-002 | partial | `src/cabin/calendars.ts`; `src/cabin/model.ts`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:55` Only approved snapshot changes/cancellations exist; native selling and connected downstream lifecycle are absent. |
| RES-003 | missing | — No implementing flow in the audited tree. |
| RES-004 | missing | — No implementing flow in the audited tree. |
| RES-005 | missing | — No implementing flow in the audited tree. |
| RES-006 | missing | — No implementing flow in the audited tree. |
| PRICE-001 | missing | — No implementing flow in the audited tree. |
| PRICE-002 | missing | — No implementing flow in the audited tree. |
| WEB-001 | missing | — No implementing flow in the audited tree. |
| WEB-002 | missing | — No implementing flow in the audited tree. |
| WEB-003 | missing | — No implementing flow in the audited tree. |
| WEB-004 | missing | — No implementing flow in the audited tree. |
| WEB-005 | missing | — No implementing flow in the audited tree. |
| PAY-001 | missing | — No implementing flow in the audited tree. |
| PAY-002 | missing | — No implementing flow in the audited tree. |
| PAY-003 | missing | — No implementing flow in the audited tree. |
| PAY-004 | missing | — No implementing flow in the audited tree. |
| PAY-005 | missing | — No implementing flow in the audited tree. |
| PAY-006 | missing | — No implementing flow in the audited tree. |
| GUEST-001 | missing | — No implementing flow in the audited tree. |
| MESSAGE-001 | missing | — No implementing flow in the audited tree. |
| MESSAGE-002 | missing | — No implementing flow in the audited tree. |
| MESSAGE-003 | missing | — No implementing flow in the audited tree. |
| MESSAGE-004 | missing | — No implementing flow in the audited tree. |
| GUEST-002 | missing | — No implementing flow in the audited tree. |
| GUEST-003 | missing | — No implementing flow in the audited tree. |
| GUEST-004 | missing | — No implementing flow in the audited tree. |
| OPS-001 | partial | `src/cabin/turnovers.ts`; `tests/cabin.test.mjs:67` Manual drafts reference an approved booking and cleaner; automatic triggers, acceptance, reassignment, capacity/travel-time routing and escalation are absent. |
| EVIDENCE-001 | done | `src/cabin/turnovers.ts`; `src/cabin/photos.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:67` |
| OPS-002 | partial | `src/cabin/ui/turnovers.ts`; `src/cabin/turnovers.ts`; `public/cabin.css`; `tests/cabin.test.mjs:67` Online checklist/caption and one private photo exist; native/offline capture, multiple required photos and acceptance are missing. |
| OPS-003 | partial | `src/cabin/turnovers.ts`; `src/cabin/ui/turnovers.ts`; `tests/cabin.test.mjs:67` Cleaner photo completion is visible; cross-team readiness, supply/restock items, inspections and arrival gates are absent. |
| OPS-004 | missing | — No implementing flow in the audited tree. |
| OPS-005 | missing | — No implementing flow in the audited tree. |
| OPS-006 | missing | — No implementing flow in the audited tree. |
| OPS-007 | missing | — No implementing flow in the audited tree. |
| FIN-001 | missing | — No implementing flow in the audited tree. |
| FIN-002 | missing | — No implementing flow in the audited tree. |
| FIN-003 | partial | `src/cabin/people.ts`; `src/cabin/statements.ts`; `tests/cabin.test.mjs:90` Fixed property commission and manually supplied signed lines exist; agreement models and derived allocation rules are absent. |
| FIN-004 | partial | `src/cabin/statements.ts`; `src/cabin/ui/statements.ts`; `tests/cabin.test.mjs:90` Manual AUD statement arithmetic, exact approval, frozen details and formula-safe CSV ship. USD, reconciliation, PDF, scheduled generation/delivery and owner access are missing. |
| FIN-005 | missing | — No implementing flow in the audited tree. |
| FIN-006 | missing | — No implementing flow in the audited tree. |
| FIN-007 | missing | — No implementing flow in the audited tree. |
| FIN-008 | missing | — No implementing flow in the audited tree. |
| FIN-009 | missing | — No implementing flow in the audited tree. |
| REPORT-001 | missing | — No implementing flow in the audited tree. |
| REPORT-002 | missing | — No implementing flow in the audited tree. |
| API-001 | partial | `src/cabin/http.ts`; `docs/commands.md`; `tests/cabin.test.mjs:31`; `tests/cabin.test.mjs:109` Session commands and draft-only bearer API exist; booking/finance APIs, event webhooks, scoped app grants and Zapier do not. |
| MIGRATE-001 | partial | `src/cabin/movein/index.ts`; `src/cabin/movein/csv.ts`; `src/cabin/movein/targets.ts`; `docs/move-in.md`; `tests/cabin.test.mjs:124`; `tests/archive.test.mjs:27` Basic inert preview, apply, journal, guarded undo and erasure round-trip are tested. All documented collision, resume and dependency cases are not independently exercised. |
| MIGRATE-002 | missing | — No implementing flow in the audited tree. |
| MIGRATE-003 | missing | — No implementing flow in the audited tree. |
| MIGRATE-004 | missing | — No implementing flow in the audited tree. |
| MIGRATE-005 | missing | — No implementing flow in the audited tree. |
| MIGRATE-006 | missing | — No implementing flow in the audited tree. |
| MIGRATE-007 | missing | — No implementing flow in the audited tree. |
| MOBILE-001 | missing | — No implementing flow in the audited tree. |
| INTERFACE-001 | partial | `src/cabin/ui/index.ts`; `src/cabin/ui/calendar.ts`; `src/cabin/ui/turnovers.ts`; `src/cabin/ui/statements.ts`; `public/cabin.css`; `tests/cabin.test.mjs` Responsive forms and server errors exist. Full browser accessibility, the 40-property/three-year scale proof, native workflows and paid-provider cost disclosure are not established. |
| DATA-001 | partial | `src/cabin/archive-policy.mjs`; `scripts/installer/local.mjs`; `tests/archive.test.mjs:27` Current operational records/photos, approvals and move-in custody round-trip with excluded bearer keys. Future PMS records and inactive provider-job restore are not implemented. |
| DATA-002 | partial | `src/cabin/privacy.ts`; `src/cabin/movein/targets.ts`; `src/cabin/archive-policy.mjs`; `tests/archive.test.mjs:27` Property cascade/source retirement and later-journal refusal are exercised. Member erasure refuses used/invited grants; broad guest/operator erasure, retention holds and completion receipts need work. |
| AUDIT-001 | partial | `src/cabin/storage.ts`; `src/cabin/credentials.ts`; `src/cabin/movein/index.ts`; `migrations/core/0015_cabin.sql`; `tests/cabin.test.mjs:31`; `tests/archive.test.mjs:27` Domain/credential events, independent approvals and import journals exist; comprehensive provider/read history, anonymization guarantees and search/export are incomplete. The state read shows only the latest 100 events. |
| SECURITY-001 | partial | `src/cabin/credentials.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:17`; `tests/cabin.test.mjs:109` Hashed revocable draft keys and private cleaner data exist; OTA/payment/lock custody, signed provider events and broader sensitive-data policies are missing. |
| HTTP-001 | done | `src/server.ts`; `src/base/deployment-health.ts`; `tests/runtime.mjs` |
| RUNTIME-001 | partial | `scripts/installer/local.mjs`; `OPERATIONS.json`; `SEED-COMMAND-CONTRACT.md`; `tests/launch.test.mjs:10`; `tests/runtime.mjs`; `tests/archive.test.mjs:27` Local lifecycle/health and operational archive paths exist; external product jobs and remote/provider acceptance are unimplemented. CI is not proof of hosted connectivity. |
| AGENT-001 | partial | `src/cabin/http.ts`; `src/cabin/turnovers.ts`; `tests/cabin.test.mjs:67`; `tests/cabin.test.mjs:109` Bearer-prepared turnover drafts and human completion evidence are foundations only; no recovery agent, automatic dispatch, relocation, compensation, locks or financial closure exists. |
| AGENT-002 | partial | `src/cabin/statements.ts`; `src/cabin/http.ts`; `tests/cabin.test.mjs:90`; `tests/cabin.test.mjs:109` Agents can prepare manual statement drafts for exact human approval; settlement matching, record pursuit, correcting postings and payout closure are absent. |
| AGENT-003 | missing | — No implementing flow in the audited tree. |
| AGENT-004 | missing | — No implementing flow in the audited tree. |
| AGENT-005 | missing | — No implementing flow in the audited tree. |
| AGENT-006 | partial | `src/cabin/model.ts`; `src/cabin/credentials.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs:109`; `tests/cabin.test.mjs:55` Current agents are strictly draft-only with human revision approval. Expanded tool grants, budgets, durable cases and external-action reconciliation do not exist. |
| BOUNDARY-001 | missing | — No implementing flow in the audited tree. |
