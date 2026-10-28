# Cabin target product contract

Cabin is vacation-rental property management and channel software for US owners and managers of 3–40 homes operating in USD. It replaces Guesty, Hostaway, OwnerRez and Lodgify across booking, guest service, field readiness and owner close, and must also beat Hospitable’s small-host automation and Breezeway’s field operations.

## Product target

| | |
| --- | --- |
| Category | Vacation-rental property management software with channel manager |
| Incumbents a buyer switches from | Guesty, Hostaway, OwnerRez, Lodgify |
| Up-and-comers it must also beat | Hospitable, Breezeway |
| First buyer | A US owner or manager of 3–40 vacation rentals, in USD and each property’s local time zone, selling through Airbnb, Vrbo, Booking.com and their own website |

The primary journey: Connect homes and channels, quote and reserve a stay, collect its consent and payment, keep the home ready and accessible, serve the guest, reconcile source settlements and close the rental owner’s books.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are reported separately.
- Done requires every acceptance outcome to have recorded proof; Status names the current evidence and gap.
- The Field proof register records real-world proof separately.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file.

## Door rules

- **D-1.** Stay changes. Every stay amendment re-evaluates its shared inventory, contractual balance, scheduled guest messages, work, access and owner allocations against the exact saved revision.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | none | not run |
| BASE-ACCESS-002 | Sessions | AUTH-002, GUEST-002, MOBILE-001, HTTP-001 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | AUTH-002 | not run |
| BASE-INPUT-001 | Validation | INTERFACE-001 | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | EVIDENCE-001 | not run |
| BASE-SECRET-001 | No leakage | WEB-002, GUEST-002, DATA-001, SECURITY-001 | not run |
| BASE-SECRET-002 | Startup | RUNTIME-001 | not run |
| BASE-DATA-001 | Export and import | DATA-001 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | DATA-002, AUDIT-001 | not run |
| BASE-DATA-004 | Outbound flows | DATA-003, SECURITY-001 | not run |
| BASE-DATA-005 | Independence | DATA-003, OPEN-001 | not run |
| BASE-PUBLIC-001 | Privacy | WEB-001, WEB-002 | not run |
| BASE-PUBLIC-002 | Origins | WEB-002 | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | HTTP-001 | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | SYNC-009, PAY-002, MESSAGE-001, MESSAGE-002, MESSAGE-003, FIN-007, RUNTIME-001 | not run |
| BASE-OPS-004 | Failure is visible | SYNC-009, PAY-002, MESSAGE-001, MESSAGE-002, MESSAGE-003, RUNTIME-001 | not run |
| BASE-OPS-005 | Audit | AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | CABIN-01, AUTH-002, EVIDENCE-001, FIN-007, MOBILE-001 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | DATA-002, AUDIT-001 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | DATA-001 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | DATA-002 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | CABIN-01, AUTH-002 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | none | not run |
| BASE-INSTALL-001 | Free self-host and removal | DATA-003, RUNTIME-001, OPEN-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | MESSAGE-001, MESSAGE-002, MESSAGE-003, GUEST-002, FIN-007 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | WEB-001, WEB-002, INTERFACE-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | none | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SECURITY-001, SURFACE-004 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | CONTROL-002, SURFACE-008 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | CONTROL-002, MESSAGE-004, SECURITY-001, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-003, SURFACE-008 | not run |
| BASE-AGENT-006 | Every action declares its risk class | CONTROL-002, MESSAGE-004, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-001, SURFACE-002, SURFACE-003 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | CONTROL-001, CONTROL-002, MESSAGE-002, MESSAGE-003, MESSAGE-004, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-005, SURFACE-006 | not run |
| BASE-AGENT-008 | Truthful attribution | CONTROL-001, CONTROL-002, MESSAGE-004, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-003, SURFACE-006 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | AUDIT-001, SURFACE-007 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-004 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | SURFACE-007 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | RUNTIME-001, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, SURFACE-006, SURFACE-008 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-005 | not run |

## Published clauses

- `CABIN-01`: *Tier:* Core · *From:* CABIN-01, PROPERTY-001 · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001

### Released operations

#### CABIN-01 — Homes, rental owners and effective management terms

**Requirement.** An operator maintains properties, units, addresses, local time zones, owners and management agreements, occupancy limits, amenities, photos, house rules, check-in/out times, emergency contacts and channel listing IDs. Effective-dated terms preserve the agreement used for each reservation and owner allocation. The home register includes its rental owner’s name, contact email and management commission. Managers and cleaners are invited under AUTH-002.

**Acceptance.**
1. Create two US properties with different time zones and owners through the property editor; amend one agreement and show that existing bookings retain their original terms while new quotes use the new terms.
2. Add two homes with their owners and commissions; invite a manager and two cleaners, then verify their property-specific views and refusal after deactivation.

## Target clauses

### Portfolio, authority and the existing approval foundation

#### AUTH-002 — PMS roles and property-specific permissions

*Tier:* Core · *From:* AUTH-002, AUTH-001 · *Cites:* BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001

**Requirement.** Portfolio managers, reservation staff, guest-service staff, accountants, inspectors, cleaners, maintenance vendors and rental owners have the intersection of explicitly selected properties and actions. Installation administration is distinct from rental ownership. The installation owner grants manager and cleaner membership; native rental submissions are bound to the installation’s own origin. Cleaners see assigned published jobs and redacted associated stay and home details; service staff receive necessary entry instructions without guest identity documents or owner banking details. Offboarding also withdraws connected device codes. API-001 and MOBILE-001 use these same rental roles and scopes.

**Acceptance.**
1. Invite each role from team settings; use its session to perform an allowed action and attempt the same action on another property, statement, identity document and credential; revoke a role during a queued job and verify execution is refused.
2. Using owner, manager and two cleaner sessions, exercise the stay, statement and photo doors; refuse cross-origin submissions, cleaner financial access and another cleaner’s photo.

#### CONTROL-001 — Exact revisions and immutable publication

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Calendar snapshot, turnover and operational statement drafts do not publish themselves. Publication binds the exact immutable revision with actor and time recorded. Changed calendar baselines, booking revisions, cleaner authority or property terms invalidate stale approval. Duplicate approval and duplicate completion cannot overwrite the published record. An agent's publication or sign-off carries commitment, plus the classes of its effects; the company’s policy decides the call.

**Acceptance.**
1. Prepare competing revisions through the command API, approve one, then submit the stale and duplicate approvals; change booking/property terms and prove the outdated turnover or statement cannot publish.

#### CONTROL-002 — Scoped agent preparation and classified execution

*Tier:* Core · *From:* CONTROL-002, CABIN-12 · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Calendar, turnover and statement preparation use the sponsoring person’s selected homes and actions. Preparation carries standard; publishing a revision or signing off a statement carries commitment, plus money for a charge or changed payable and external for an outside recipient. Finishing field work records the actor’s own attestation, never a different person’s physical inspection. The company’s policy decides these calls. The broader recovery actions are AGENT-006.

**Acceptance.**
1. Under the held company policy, issue access in Agent access, prepare all three draft types and verify that unapproved publication has no effect; after revocation the next context read is refused.
2. Under the all-autonomous company policy, publish the same exact revisions with their computed commitment and applicable money or external classes, while preserving the separate signed-in-person confirmation door.

### Distribution and reservations

#### SYNC-001 — Reviewed calendar files remain honest snapshots

*Tier:* Core

**Requirement.** Airbnb and Booking.com iCal snapshots retain import and approval times, reconcile by property/channel/UID and list additions, changes, cancellation, disappearance and overlaps before exact approval. Checkout is end-exclusive. Malformed or unsupported calendar constructs are refused. File review remains available for migration and diagnosis; its dates never constitute a live channel acknowledgment or a double-booking guarantee. Scheduled automatic iCal exchange for channels without an API is SYNC-009.

**Acceptance.**
1. Import two overlapping channel files, inspect the clash and timestamps, approve exact reviews, reimport without duplicates, cancel or remove a UID, test adjacent checkout/check-in, and reject a stale baseline and malformed file.

#### SYNC-002 — Airbnb two-way channel management

*Tier:* Core · *Register:* R-5

**Requirement.** Through an approved Airbnb API or contracted channel partner, Cabin receives reservations, modifications and cancellations and sends rates, availability and restrictions for mapped listings. It retains provider IDs, revisions and acknowledgments; authorization failures and channel constraints remain visible. Listing connection is proven before a manager enables selling. Several Airbnb host accounts, including co-hosted listings, connect side by side under SYNC-010. Inquiries, requests to book, pre-approvals, special offers and alteration requests are SYNC-008.

**Acceptance.**
1. Authorize an Airbnb test listing from Connections; book, extend and cancel through Airbnb, change a rate and close dates in Cabin, and verify both systems and their acknowledgment history agree without duplicate reservations.

#### SYNC-003 — Vrbo two-way channel management

*Tier:* Core · *Register:* R-5

**Requirement.** An approved Vrbo API or channel partner connection exchanges reservation lifecycle, live availability, rates, fees and supported stay restrictions. Account/listing mapping, payment-collection responsibility, acknowledgments and rejected fields are explicit; a failed connection cannot be labeled synchronized. Several Vrbo accounts connect side by side under SYNC-010.

**Acceptance.**
1. Connect a Vrbo listing, complete and alter a reservation at the channel, close inventory and change pricing in Cabin, cancel the stay and reconcile channel acknowledgments, payment responsibility and final availability.

#### SYNC-004 — Booking.com two-way channel management

*Tier:* Core · *Register:* R-5

**Requirement.** An approved Booking.com connectivity connection receives bookings, guest/date changes and cancellations, and publishes room/rate-plan availability, prices and restrictions. It tracks channel-versus-property collection and actionable channel rejections. Payments by Booking.com virtual credit cards are charged and reconciled under PAY-005, property-collect guest cards are charged, reported invalid and followed up under PAY-006, and several Booking.com property accounts connect side by side under SYNC-010.

**Acceptance.**
1. Map a Booking.com room/rate plan; reserve, amend and cancel externally, update Cabin availability/rate restrictions, and compare reservation identity, collection method and accepted channel state.
2. A Payments by Booking.com reservation passes its virtual card to PAY-005, and a property-collect reservation passes its guest card to PAY-006, whose acceptance journeys prove the charges.

#### SYNC-005 — Listing content and distribution

*Tier:* Core · *Register:* R-5

**Requirement.** A manager publishes property descriptions, photos, amenities, occupancy, house rules and supported fees from the property record to Airbnb, Vrbo and Booking.com. Channel-specific overrides, validation and review previews prevent accidental replacement of channel-only content. Google Vacation Rentals connects eligible direct-booking listings through approved connectivity with working price/availability landing links.

**Acceptance.**
1. Preview and publish one content revision to each named OTA and one Google Vacation Rentals listing; inspect accepted and rejected fields, keep an intentional channel override, and follow a Google referral to the correctly priced direct stay.

#### SYNC-006 — Inventory holds, measured closure latency and double-booking prevention

*Tier:* Core · *Rules:* D-1

**Requirement.** Every sale, quote hold, owner block, maintenance closure and imported iCal block uses one durable unit/night inventory allocation. Concurrent Cabin checkouts cannot sell the same inventory. From the commit of any allocation change, Cabin submits the closure or reopening to every connected API channel (Airbnb, Vrbo and Booking.com) within 15 seconds, and each channel’s provider-acknowledged closure must arrive within **2 minutes** of commit; Cabin’s own iCal export feeds (SYNC-009) reflect the change within 60 seconds. Connections shows the measured commit-to-acknowledgment time per channel and change; a breach of the 2-minute maximum, a refused acknowledgment or a disconnected channel raises an alert and an assigned exception and offers stop-sell for the affected inventory. Late channel collisions remain visible and open a recovery case rather than being overwritten.

**Acceptance.**
1. Race a direct checkout and a channel reservation for one unit/night through public booking/channel doors; prove only one Cabin allocation commits, record commit and acknowledgment timestamps for Airbnb, Vrbo and Booking.com and show each closure acknowledged within 2 minutes and the export feed updated within 60 seconds.
2. Hold one provider’s acknowledgment past 2 minutes in its test harness and verify the Connections breach alert, assigned exception and stop-sell.
3. A deliberately late OTA conflict is assigned for recovery with both original reservations retained.

#### SYNC-007 — Inspectable sync failures and safe recovery

*Tier:* Core

**Requirement.** Connections expose last successful exchange, lag, pending changes, field errors and provider acknowledgments. Signed/verified provider events are deduplicated and ordered by provider revision. Credential expiry, throttling, outages and uncertain writes survive restart as assigned exceptions; reconciliation reads establish external state before repeating uncertain effects. Reconnection cannot resurrect canceled stays or send stale rates.

**Acceptance.**
1. From Connections revoke authorization, deliver duplicate/out-of-order events, throttle a push and lose its response; restart Cabin, reconnect and reconcile against the provider, preserving one reservation and the newest accepted prices with every unresolved exception visible.
2. As this clause’s provider jobs are built, interrupt each channel job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### SYNC-008 — Inquiries, booking requests, special offers and alterations

*Tier:* Core · *Rules:* D-1

**Requirement.** Airbnb inquiries arrive as Inquiry-status records linked to their inbox thread, with requested dates, guests and quoted USD price, and hold no inventory. From the thread, staff pre-approve an inquiry, send a special offer with a custom price and terms, withdraw and re-send an offer, accept or decline a request to book inside Airbnb’s 24-hour response window, and accept or decline a guest’s alteration request. Every pending request shows its channel deadline; approaching deadlines escalate through MESSAGE-002 and expiry is recorded, never hidden. Hosts can enable automatic pre-approval per listing against saved criteria (stay rules, guest count, lead time, guest verification and no SYNC-006 conflict); inquiries that miss any criterion route to a person. Vrbo inquiries and booking requests and Booking.com request-to-book flows, where the channel offers them, use the same states and actions. Accepting a request, offer or alteration revalidates price and inventory through SYNC-006 and RES-004 and then updates downstream payments, messages, tasks and access through RES-002. Each outcome is recorded only on the channel’s acknowledgment. A request to book or alteration whose nights are already allocated to another reservation is declined at the channel with the overlapping reservation named: automatically when the host enables automatic decline for overlaps, otherwise routed to a person before the channel deadline.

**Acceptance.**
1. On an Airbnb test listing send an inquiry and see it as Inquiry; pre-approve it, withdraw the pre-approval and re-send it as a special offer with a custom price, and verify the guest-side offer and channel acknowledgment.
2. Decline one request to book and let another expire after 24 hours, verifying the recorded expiry and unchanged inventory.
3. Accept a guest alteration that moves dates and confirm inventory, price and downstream tasks update.
4. Auto-pre-approve an inquiry that meets saved criteria and route one that does not to a person.
5. Repeat a request flow on Vrbo and on Booking.com.
6. Every outcome is acknowledged by the channel.
7. Deliver a Vrbo request to book for nights already held by an Airbnb reservation with automatic decline enabled and verify Cabin declines it at Vrbo, names the overlapping Airbnb reservation and leaves inventory unchanged; with automatic decline off, verify the same request routes to a person with the overlap shown.

#### SYNC-009 — Automatic iCal sync for channels without an API

*Tier:* Core · *From:* SYNC-009, CABIN-02 · *Cites:* BASE-OPS-003, BASE-OPS-004

**Requirement.** For channels with no API connection, such as Furnished Finder, Hipcamp or a partner’s PMS, a manager connects any external iCal URL per unit. Cabin polls each URL on a configurable interval of 15 to 60 minutes (default 15), applies new, changed and removed events as channel blocks that take inventory through SYNC-006, and publishes a per-unit secret iCal export URL listing every Cabin reservation and block, which the manager can regenerate to revoke old links. Each feed shows last successful fetch, last applied change and next poll. An unreachable or malformed feed enters a visible stale state with an alert and assigned exception, keeps its last applied blocks rather than releasing nights, and recovers on the next good fetch. Connections and the listing settings state plainly that iCal sync is polled and does not guarantee against double booking; API channels carry that guarantee. Imported events never trigger guest messages or charges. SYNC-001 remains the manual review path for migration and diagnosis. Channel-specific exports omit that channel’s own stays, include direct stays and preserve an arriving collision for resolution under SYNC-006.

**Acceptance.**
1. Connect an external iCal URL served by a test host; add a block there and verify Cabin applies it within the configured polling interval and then refuses a direct booking for those nights.
2. Create a Cabin direct reservation and fetch the unit’s export URL to find it within 60 seconds; regenerate the export URL and confirm the old one returns 404.
3. Make the external feed unreachable, then malformed, and verify the stale state, alert, assigned exception and retained blocks; restore it and verify recovery and fresh timestamps.

#### SYNC-010 — Multiple connected accounts per channel and Airbnb co-hosting

*Tier:* Core · *Register:* R-5

**Requirement.** Each channel holds any number of connected accounts in one Cabin installation: several Airbnb host accounts, several Vrbo accounts and several Booking.com property accounts. Each account is authorized, given a manager-chosen nickname, monitored (last exchange, lag, exceptions) and revoked separately in Connections. Every listing, room and rate plan maps to the connected account that owns it, and its reservations, inbox threads (MESSAGE-001), reviews (GUEST-004), payouts (FIN-002) and acknowledgments are attributed to that account. Airbnb listings where the manager is a co-host connect through the co-host’s grant wherever Airbnb gives the co-host full access, after the listing owner’s host account authorizes; Connections shows each co-hosted listing’s granted permissions, and an action the grant lacks is refused with that reason rather than attempted. One account’s authorization failure, expiry or revocation stop-sells only that account’s inventory through SYNC-006 and opens SYNC-007 exceptions for it, while every other account keeps syncing. One listing cannot be mapped under two accounts at once, and moving a listing between accounts is a reviewed remap that keeps its reservation history.

**Acceptance.**
1. From Connections authorize two Airbnb host accounts (the second with a listing on which the manager is a full-access co-host after the owner’s account authorizes) and two Vrbo accounts, each with its own nickname; map one listing under each account.
2. Book, message and post a host review on a listing in every account and confirm each reservation, thread, review and payout carries its owning account.
3. Try to map one listing under both Airbnb accounts and confirm refusal.
4. Revoke one Airbnb account: verify only its listings are stop-sold with a SYNC-007 exception while a booking and rate change on the other Airbnb account and both Vrbo accounts still exchange and acknowledge normally; reauthorize and confirm recovery without duplicate reservations.

#### SYNC-011 — Channel agents in the host's own accounts

*Tier:* Core · *Register:* R-5

**Requirement.** For launch, the host connects their own Airbnb, Booking.com and Vrbo accounts to an AI agent with computer use. Acting on the host's behalf in each channel's extranet, the agent closes nights (blocks dates), reads and answers guest messages, and reads reservations. Each channel action keeps its exact source revision and protected before/after screenshot under AUDIT-001 and SECURITY-001. At any CAPTCHA, 2FA challenge or terms prompt, the agent stops and hands control back to the host; it never solves or bypasses them or accepts terms for the host. Credentials stay with the host's session and Cabin never stores them beyond what the host explicitly grants. Before connection the host sees the [channel-specific terms risks](/docs/channel-terms), the session/data custody and the exact authority being granted. This is the launch route for homepage rows 12, 15, 16, 17, 42 and 46 (RL-1); the broader channel-management requirements remain in SYNC-002–010.

**Acceptance.**
1. Separately on Airbnb, Booking.com and Vrbo, inspect the risk notice, connect the host's own account, close a night, read and answer a guest message, and read a reservation in the extranet.
2. Inspect each action's who/what/when log and screenshot and compare its result with the channel.
3. Encounter a 2FA prompt on each channel and verify automation stops and hands control to the host without entering a code; also verify CAPTCHA and terms prompts stop work without solving, bypassing or accepting them.
4. Inspect session custody against the host's explicit grant and revoke access to stop further actions.
5. As this clause’s provider jobs are built, interrupt each channel job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### RES-001 — Portfolio calendar with operational context

*Tier:* Core

**Requirement.** Reservation staff use a multi-property day/week/month calendar with channel, guest, payment, owner-block and readiness states. Filters and drill-down show the authoritative reservation, timezone-correct arrival/departure, sync freshness, turnover and open issues. Unavailable reads show stale/unknown state rather than a falsely available night.

**Acceptance.**
1. Open the calendar for a realistic 20-home portfolio; filter by property/channel, inspect an overlapping stay, unpaid arrival, owner block and unready turnover, and follow each to its source record on desktop and phone.

#### RES-002 — Complete reservation lifecycle

*Tier:* Core · *Rules:* D-1

**Requirement.** Staff create direct, phone and manual reservations, record channel bookings, modify guest/date/unit/price details, handle no-shows and cancellations, and retain policy, source IDs and full revision history. A change recomputes inventory, payment balance, messages, tasks, access and owner allocations; conflicting edits require reconciliation rather than silently replacing another revision.

**Acceptance.**
1. Create a phone reservation, extend it, move units, cancel under its saved policy and inspect downstream calendar, balance, queued messages, cleaning and lock changes; repeat with a channel amendment and duplicate event.

#### RES-003 — Owner stays and maintenance blocks

*Tier:* Core · *Rules:* D-1

**Requirement.** Managers and permitted rental owners create, edit and cancel personal-stay or maintenance blocks, with reasons and date ranges. Blocks reserve the same inventory as guest stays, publish to channels and affect billable owner-use rules and readiness tasks without inventing guest revenue.

**Acceptance.**
1. Book an owner stay through the owner portal, request overlapping maintenance, reject an occupied overlap, and cancel the owner stay; verify all channels, calendar, cleaning tasks and owner-use expense allocations.

#### RES-004 — Stay rules, fees and cancellation policies

*Tier:* Core

**Requirement.** Effective-dated seasonal/day-of-week rates, minimum/maximum nights, orphan-gap rules, arrival/departure restrictions, advance notice, booking windows, preparation buffers, occupancy limits, extra-guest/pet/cleaning fees and cancellation policies govern every quote and channel push. Unsupported channel restrictions are named; inclusive/exclusive fees and taxes are disclosed before commitment. Per-channel markups and weekly/monthly discounts are PRICE-002.

**Acceptance.**
1. Price boundary-date, gap-night, last-minute and extra-guest stays through direct checkout and each OTA adapter; prove an invalid stay cannot book, valid totals agree with the breakdown, and an old reservation retains its saved cancellation policy.

#### RES-005 — Linked rooms and whole-property inventory

*Tier:* Core

**Requirement.** Linked listings and interchangeable units express shared physical capacity: selling a room closes an incompatible whole-home listing and selling the whole home closes its rooms. Unit assignment, owner blocks and maintenance use the same constraints across direct and channel inventory.

**Acceptance.**
1. Link two rooms and their whole-home listing, sell a room via an OTA and attempt a whole-home direct booking; then cancel and sell the whole home, proving both room listings close and all channel acknowledgments reconcile.

#### RES-006 — Quotes and conversion to a reserved stay

*Tier:* Core · *Rules:* D-1

**Requirement.** Staff issue itemized USD quotes with guest counts, fees, taxes, cancellation terms, expiry, optional inventory hold and a secure direct-reservation link. Revisions and accepted terms are retained. Expired quotes release holds; concurrent quote acceptance revalidates price and inventory before payment. Staff enter expiry with an explicit time zone; it is stored in UTC and expires when the current time is at or after that instant. A revision retains earlier itemized terms and replaces its optional hold; changed home terms require a new staff revision. Acceptance atomically replaces the quote hold with the checkout hold; repeat acceptance returns the same booking.

**Acceptance.**
1. Send a quote from Reservations, accept its link as a guest, complete checkout once and inspect the resulting booking; expire a rival quote and attempt acceptance after a rate or availability change without silently charging obsolete terms.

### Revenue and direct bookings

#### PRICE-001 — Revenue planner and dynamic pricing connections

*Tier:* Core

**Requirement.** A nightly planner imports market-informed rates and stay restrictions from three supported pricing providers through separate named adapters. Hosts choose the active source per listing, set USD floors and ceilings and manual overrides, inspect provenance and preview changes. Daily updates honor saved limits and property rules; unavailable feeds preserve explicit last-known pricing with an alert.

**Acceptance.**
1. Connect and exercise PriceLabs, Wheelhouse and Beyond separately; import a daily plan, override one night, reject a below-floor rate, simulate stale provider data and publish valid prices to all three OTAs with acknowledgments.

#### PRICE-002 — Per-channel markups and length-of-stay discounts

*Tier:* Core

**Requirement.** Per listing and per channel, a manager sets a percentage or fixed USD markup or markdown (for example +15% on Booking.com to cover commission, or −$20 a night on Vrbo) and chooses whether cleaning and other fees are included in the adjusted amount. Weekly (7+ nights) and monthly (28+ nights) length-of-stay discounts apply to direct quotes and are published as Airbnb weekly/monthly discounts, Vrbo length-of-stay discounts and Booking.com rate plans or length-of-stay pricing. Adjustments apply after the PRICE-001 rate and before channel push. No markup or discount takes a night below its saved floor, and an unsupported channel combination is named before publication. Each reservation records the base rate, channel adjustment and discount it used, and the rates view shows the expected payout after commission per channel.

**Acceptance.**
1. Configure a +15% Booking.com markup that includes the cleaning fee and a fixed $20-a-night Vrbo markdown that excludes fees; publish and verify each channel’s acknowledged nightly price and fees, then book on each and reconcile the payout to the expected figures.
2. Set weekly and monthly discounts and quote 7-night and 28-night stays on direct, Airbnb and Booking.com (as a rate plan), verifying each discounted total.
3. Set a discount that would cross the floor and verify the floor holds and the conflict is shown.

#### PRICE-003 — One rate sent to every channel

*Tier:* Core

**Requirement.** Each listing’s nightly rates, fees and stay restrictions come from one source, PRICE-001’s active provider or the host’s own rates, and Cabin publishes the same values to Airbnb, Vrbo, Booking.com and the direct site, so a night costs the guest the same everywhere unless the host has set a deliberate PRICE-002 channel adjustment, which the rates view labels as such. After each push Cabin reads back each channel’s accepted price per night and raises any drift from the expected value, whether from a partial push, a channel-side edit or a fee mapping, as an assigned exception with a one-step republish.

**Acceptance.**
1. With no channel adjustments, publish 60 nights of rates and a cleaning fee for a listing connected to all three OTAs and the direct site; read back each channel’s accepted nightly price and fee and verify all four agree for every night.
2. Edit one night’s price in a channel’s test extranet and verify Cabin flags the drift and restores parity on republish.
3. Add a PRICE-002 Booking.com markup and verify the difference is shown as deliberate, not as drift.

#### WEB-001 — Branded direct-booking website

*Tier:* Core · *From:* WEB-001, CABIN-03 · *Cites:* BASE-PUBLIC-001, BASE-ACCESSIBILITY-001

**Requirement.** Hosts publish a mobile booking website on their custom domain with their branding, property search, galleries, amenities, guide content, policies and live prices/availability. They control pages, SEO metadata, analytics consent and domain portability. One guest checkout collects whatever the property requires: the Stripe payment (PAY-001), the signed rental agreement (WEB-003), the identity check (WEB-004) and the damage-deposit hold (PAY-003). Cabin operates the guest booking site as a product feature; the Cabin marketing homepage remains separate. A guest can be marked checked out only after the stay’s check-in time; the booking receipt itemizes charges and describes the actual separate damage hold.

**Acceptance.**
1. Publish a two-property site on a test custom domain, edit a property page, search real available dates at 1440 and 390 pixels and complete a guest booking with the exact advertised total and terms.
2. For a property that requires a rental agreement, ID check and damage deposit, complete checkout once and verify the Stripe payment, signed agreement, verification outcome and deposit hold all attach to the one reservation before it is confirmed.
3. Attempt checkout before check-in and verify refusal; inspect the itemized receipt and release or capture the separate hold with its reason.

#### WEB-002 — Embeddable booking engine

*Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-PUBLIC-002, BASE-SECRET-001, BASE-ACCESSIBILITY-001

**Requirement.** A documented booking widget and WordPress-compatible embed use the same live search, inventory, price and Stripe checkout as the hosted site. The embed uses the same property and stay permissions as the hosted booking door. Payment/confirmation return safely to the host’s chosen page on desktop and phone.

**Acceptance.**
1. Install the widget on an allowed external site and WordPress page, complete a stay and verify one reservation; refuse an unapproved origin and an attempt to query private reservation/guest records.

#### WEB-003 — Signed rental agreements

*Tier:* Core

**Requirement.** Managers maintain versioned US rental-agreement templates and rules per property. Guests review the exact booking terms and electronically sign; the signed document, signer evidence, time and document version remain attached to the reservation. Amendments requiring renewed agreement are tracked and unresolved signing blocks configured check-in actions.

**Acceptance.**
1. Book with a required agreement, sign through the guest link, download the saved signed version, then amend dates/terms and verify renewed consent is requested and the original signature is preserved.

#### WEB-004 — Guest identity verification

*Tier:* Core

**Requirement.** Managers configure risk-based identity verification through Stripe Identity or an approved verification partner, with explicit guest consent, restricted access and a manual review alternative. Cabin retains necessary verification state and provider references while minimizing identity-document copies. Failed or incomplete checks enter an assigned review queue and obey saved access-release policy.

**Acceptance.**
1. Complete and fail partner verification from the guest check-in link, route one case for human review, confirm staff access limits and retention/erasure behavior, and prove door codes do not release while a required verification remains unresolved.

#### WEB-005 — Promotions, upsells and gap-night offers

*Tier:* Core · *Rules:* D-1

**Requirement.** Hosts offer scoped coupons, repeat-guest rates, paid extras, early check-in, late checkout and gap-night extensions. Eligibility, inventory, cleaner capacity, minimum net contribution, consent and owner allocations are checked before an offer is sent or charged. Acceptance updates the original stay and every downstream system; expiration/cancellation releases inventory and follows the refund policy.

**Acceptance.**
1. Send a gap-night extension and paid early-arrival offer, accept one through the guest portal, reject an ineligible coupon and an offer that conflicts with cleaning, and reconcile payment, access, channels and the owner statement.

### Guest payments and service

#### PAY-001 — Processor-backed USD checkout and manual payments

*Tier:* Core

**Requirement.** Stripe checkout collects guest card payments and supported US ACH payments against itemized reservations; hosted/tokenized processor controls keep raw card/bank credentials out of Cabin. Payment success, pending ACH, failed authentication and failure are distinct from a booking hold. Staff record authorized cash/check/manual receipts with provenance, never as invented processor settlements.

**Acceptance.**
1. Book through the public site with successful, declined and authentication-required cards plus pending/returned ACH in the processor test environment; replay payment callbacks and prove one correct reservation balance and no raw payment credentials in reads, exports or logs.

#### PAY-002 — Scheduled collection and payment follow-up

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1

**Requirement.** Deposit, installment and balance schedules use the reservation’s policy and authorized payment mandate. Due jobs collect through Stripe, record receipts and chase failed/overdue payments with assigned deadlines. Date changes and cancellation reschedule or suppress future collection; uncertain charges require provider reconciliation before another attempt.

**Acceptance.**
1. Configure a deposit and pre-arrival balance in Payments, advance the schedule, fail one collection, resolve its reminder and change/cancel the stay before the next charge; inspect processor records and Cabin’s durable job outcomes after restart.

#### PAY-003 — Damage deposits, refunds and cancellation settlement

*Tier:* Core · *Rules:* D-1

**Requirement.** Cabin distinguishes security-deposit authorizations, refundable deposits and rent, tracks authorization expiry and release, and requests approved full/partial refunds through Stripe. Claims require evidence and human approval; canceled/changed stays calculate amounts from saved terms. Duplicate callbacks or repeated operator clicks cannot double-capture, refund or release funds. A damage-deposit hold is placed on the guest’s card at checkout or before arrival and released automatically within the configured window after checkout when no claim is opened; a hold the card authorization would outlive is renewed under the guest’s mandate or flagged to a person before it expires.

**Acceptance.**
1. Authorize a damage deposit, approve an evidenced partial claim, release the remainder, issue a partial rent refund and cancel a second stay; replay each event and verify processor balances, guest receipts, tax adjustments and owner liabilities match once.
2. Check out a third stay with no claim and verify its hold is released automatically within the configured post-checkout window; for a stay longer than a card authorization lasts, verify the hold is renewed or flagged before it expires.

#### PAY-004 — Protection partners and chargeback casework

*Tier:* Core

**Requirement.** Hosts may connect licensed damage/travel-protection and dispute-support partners, for example Safely or an eligible protection provider, with eligibility, price, coverage/exclusions and guest acceptance recorded. Disputes retain deadlines, signed agreements, communication and work evidence for human-approved submission. Partner acknowledgment is separate from coverage, claim approval or recovered money.

**Acceptance.**
1. Enroll an eligible stay, decline an ineligible one with its reason, open a damage/chargeback case, approve its evidence packet and follow the provider’s accepted/rejected outcome through reservation and owner adjustments.

#### PAY-005 — Booking.com virtual credit cards

*Tier:* Core

**Requirement.** When Payments by Booking.com collects a stay, its virtual credit card (VCC) is tokenized straight into Stripe’s vault through the channel connection; Cabin never stores, logs or shows the full card number or security code. Cabin records the VCC token reference with its loaded amount (USD), activation date and expiry date on the reservation. A PAY-002 collection job charges exactly the loaded amount through Stripe, once, on or after the activation date and before expiry. Cabin refuses any charge before activation, after expiry or above the loaded amount, and a replayed callback or repeated job cannot charge twice. An expired or declined VCC, or a stay date change that leaves the activation date out of step with the new dates (the date does not move with the stay), opens an assigned exception with the channel’s deadline rather than charging. A charged VCC posts to the reservation’s trust subledger (FIN-001) and reconciles to the Booking.com payout and the owner line in FIN-002. Booking.com virtual-card charges are scheduled collection jobs bound by PAY-005’s activation, expiry and loaded-amount limits.

**Acceptance.**
1. Receive three Booking.com test reservations carrying VCCs with set loaded amounts and activation dates.
2. On the first, attempt a charge before activation and confirm refusal with no processor charge; advance to activation and verify exactly the loaded amount is charged once, including after a replayed callback and a rerun job, and that no full card number appears in reads, exports or logs.
3. Let the second VCC expire and move the third stay earlier so its activation date falls after the new check-in; verify both become assigned exceptions with no charge.
4. Reconcile the charged amount to its reservation, Booking.com payout and owner statement line.
5. The collection job runs through PAY-002's schedule, authority, receipt and reconciliation.

#### PAY-006 — Booking.com property-collect guest cards

*Tier:* Core

**Requirement.** When a Booking.com reservation uses property collect (Booking.com’s hotel-collect model, where the property rather than Booking.com charges the guest), the guest’s card arrives through the channel connection and is tokenized straight into Stripe’s vault; Cabin never stores, logs or shows the full card number or security code, and keeps only the token reference, brand, last four digits and expiry. That token becomes the reservation’s payment mandate, and PAY-002 charges it on the reservation’s saved deposit and balance schedule with the same idempotency and replay protection as every other collection job. A permitted role can report a declined or invalid card to Booking.com from the reservation’s Payments section, once per card: Cabin records the report as made only when Booking.com acknowledges it, and a repeated click or replayed job sends nothing further. After acknowledgment the reservation shows the guest’s deadline to supply new card details as Booking.com states it (normally 24 hours), and an assigned exception escalates before and at that deadline. An updated card from Booking.com is tokenized the same way, replaces the mandate, retries the failed charge and resumes the schedule. If no valid card arrives by the deadline, Cabin offers the penalty-free cancellation Booking.com’s invalid-card process allows; a human confirms it, and Cabin records the cancellation, reopens inventory through SYNC-006 and suppresses future collection only after Booking.com acknowledges it. Collected amounts post to the reservation’s trust subledger (FIN-001) and reconcile in FIN-002, where Booking.com’s commission on a property-collect stay is a payable on Booking.com’s commission invoice to the property, never netted from a payout. A property-collect Booking.com guest card received under PAY-006 is the reservation’s authorized mandate for its saved deposit and balance schedule.

**Acceptance.**
1. Receive three property-collect Booking.com test reservations through the connection and confirm no full card number or security code appears in any read, export, log or archive.
2. On the first, verify the deposit and balance each charge on schedule exactly once, including after a replayed callback and a rerun job.
3. On the second, decline the card, report it invalid from the reservation and repeat the report; verify a single report, Booking.com’s acknowledgment, and the guest deadline with an assigned exception.
4. Deliver an updated card from Booking.com and verify the failed charge retries once and the schedule resumes.
5. Leave the third reservation’s declined card un-updated past its deadline; verify the penalty-free cancellation is offered, confirmed by a human and acknowledged by Booking.com, that inventory reopens and that no further charge is attempted.
6. Reconcile the collected amounts and the Booking.com commission invoice to each reservation and its owner statement line.
7. The collection job runs through PAY-002's schedule, authority, receipt and reconciliation.

#### GUEST-001 — Guest profiles and repeat-stay context

*Tier:* Core

**Requirement.** Guest records join channel identities, verified contact details, reservations, communications, consent, preferences and service history without silently merging different people or exposing sensitive notes. Staff can review and undo a duplicate merge, restrict sensitive fields and see the source of each fact; returning guests receive their saved preferences only within consent and property policy.

**Acceptance.**
1. Receive the same guest on two channels, review a suggested merge, record a preference and opt-out, book a return stay and undo a mistaken merge; verify the right history follows each person and role-limited reads remain private.

#### MESSAGE-001 — Unified channel, SMS, email and WhatsApp inbox

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004

**Requirement.** Airbnb, Vrbo and Booking.com conversations, guest email, Twilio SMS and WhatsApp join reservation-linked threads with attachments and delivery history. Twilio/SendGrid or the selected Base mail adapter supplies email delivery; provider approval, US messaging registration and consent are implementation work. Inquiry, request-to-book, special-offer and alteration actions (SYNC-008) are taken from the thread. Cabin preserves channel reply rules. Messages from the same guest on any channel, SMS or email join one thread per guest, linked through GUEST-001’s guest record and grouped by reservation.

**Acceptance.**
1. Receive and reply on all three OTA channels, email, SMS and WhatsApp through the inbox; attach the correct reservation, replay an inbound event and simulate a rejected/outage send, proving one visible message and an assigned delivery failure without false delivery claims.
2. Have one guest write about the same stay on Airbnb, then by SMS and by email, and verify all three appear in order in one thread for that guest, with each reply sent on the channel its message came from.
3. As this clause’s provider jobs are built, interrupt each message job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### MESSAGE-002 — Team routing and response accountability

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004, BASE-AGENT-007

**Requirement.** Templates, internal notes, labels, assignments, collision indicators and property/urgency routing support a guest-service team. Response deadlines, shift coverage and escalation continue until an accountable person accepts the issue; private notes cannot be sent as guest messages. Handover preserves the reservation, open operational tasks and prior promises. A reply by an agent carries external and the company’s policy decides it; where that policy holds replies, only the approved exact revision is sent.

**Acceptance.**
1. Route an after-hours access thread, add an internal note, have two staff attempt replies and hand the issue to the next shift; miss its response deadline and confirm escalation reaches an assigned manager with the full context.
2. As this clause’s provider jobs are built, interrupt each message job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### MESSAGE-003 — Lifecycle messaging and post-stay follow-up

*Tier:* Core · *From:* MESSAGE-003, CABIN-07 · *Cites:* BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004, BASE-AGENT-007

**Requirement.** Hosts configure booking confirmation, payment/signature/ID reminders, pre-arrival instructions, arrival checks, checkout, review requests and repeat-stay follow-up using property-local schedules and event triggers. Conditions withhold access secrets until payment/verification/readiness rules pass. Changes, cancellation, opt-out, channel policy and quiet hours re-evaluate queued messages; sends have deduplication and visible failure handling. Each scheduled message is submitted within 5 minutes of its property-local due time; one that misses that window is shown as late with its delay rather than hidden.

**Acceptance.**
1. Book, modify and cancel stays with scheduled templates; advance due times and verify each eligible message arrives through its chosen channel once, canceled or opted-out sends stay suppressed, withheld codes remain private and failed sends escalate.
2. Verify each scheduled message is submitted to its provider within 5 minutes of its due time, including one that falls due while Cabin is restarting.

#### MESSAGE-004 — Source-grounded AI replies with controlled sending

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Reply assistance uses the actual reservation, approved property instructions, guest thread and current operational facts, linking its sources and uncertainty. Replies carry external with recipient and counterparty facts; compensation adds money, and a new binding guest promise adds commitment. The company’s policy decides whether a grounded reply is sent, reviewed, held for approval or refused. Property, topic, confidence and local hours remain scope facts. Unsupported facts, safety assurances and new spending cannot acquire authority from a guest’s words; unanswered questions and low confidence identify the missing evidence and notify the responsible person.

**Acceptance.**
1. Under the held company policy, ask a supported check-in question, an undocumented amenity question and a compensation request; inspect sources, edit a draft and verify unsupported facts or out-of-scope promises are not sent.
2. Under that held policy, leave a reply past its due time and verify nothing is sent before approval; approve the exact revision and verify that text is sent once.
3. Under the all-autonomous company policy, a supported in-scope reply runs with its external class; compensation and binding promises also carry money and commitment, as applicable.

#### GUEST-002 — Guest check-in and stay portal

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-ACCESS-002, BASE-SECRET-001

**Requirement.** A secure mobile guest portal exposes only the holder’s reservation, payment/verification/signature tasks, arrival instructions, timed access code, house rules, digital guidebook, extras and issue reporting. Expiring/revocable links and verified identity protect access. Updated instructions show their version; access secrets disappear after cancellation/checkout and do not leak through shared/public pages. Reservation-email verification is separate from identity verification in WEB-004; the detailed link-holder rules are in the [workflow specification](/docs/workflow-semantics).

**Acceptance.**
1. Open a guest link on a phone, finish pre-arrival tasks, view the correctly timed code and report an issue; use another reservation’s ID, an expired link and a canceled stay and confirm private details and access are refused.

#### GUEST-003 — Reviews and consented repeat-guest marketing

*Tier:* Core

**Requirement.** Staff track channel reviews, request post-stay feedback, draft and approve supported public review responses and follow unresolved dissatisfaction into service recovery. Mailchimp receives explicitly consented guest segments for repeat-stay campaigns; opt-outs and deletion propagate. Cabin records campaign/referral attribution without treating review requests or audience export as completed guest recovery. Approved review replies and post-stay thank-you messages go out at their scheduled property-local time and are recorded as sent only on the channel’s or provider’s acceptance. The host’s own reviews of guests are GUEST-004.

**Acceptance.**
1. Complete a stay, deliver one eligible review request, receive a negative response and assign recovery, approve a channel review reply, sync a consented Mailchimp segment and verify an opt-out removes the guest before the next campaign.
2. Schedule an approved review reply and a post-stay thank-you and verify each is posted or sent once at its scheduled time and recorded on acknowledgment.

#### GUEST-004 — Automated host reviews of Airbnb guests

*Tier:* Core

**Requirement.** After each Airbnb checkout Cabin can post the host’s review of the guest from a pool of manager-approved templates, after a configurable delay inside Airbnb’s review window, with configured star ratings and an optional private note. Staff can stop automation for one reservation, for example after a bad stay; that stay enters a review-needed queue showing its deadline. Automation never posts where a review was already written by hand, in Cabin or on Airbnb, and never posts after the window closes. A review is recorded as posted only on Airbnb’s acknowledgment; a refused post becomes an assigned task before the deadline.

**Acceptance.**
1. Check out three Airbnb test stays: one receives a templated review after the configured delay and Airbnb accepts it; one has automation stopped and stays in the queue until a person writes and submits it; one already reviewed by hand is not overwritten.
2. Refuse one post in the provider test harness and verify the assigned task, and confirm no post is attempted after the window closes.

### Property operations and access

#### OPS-001 — Reservation-triggered turnover dispatch

*Tier:* Core · *From:* OPS-001, CABIN-04 · *Rules:* D-1

**Requirement.** Confirmed reservations, checkout, amendments and cancellations create or revise the appropriate cleaning/inspection tasks exactly once. Managers configure per-property templates, timing, rates and approved teams; cleaners accept or decline, receive reminders, and can be replaced without losing history. Overdue or declined jobs escalate before arrival. Each cleaner or team has a saved daily capacity (jobs and hours) and home base; travel time between consecutive jobs comes from property addresses through a routing provider such as the Google Maps Distance Matrix API, or from manager-entered drive times. An assignment that would exceed capacity or cannot reach the next job within its window is never made silently: it routes to the next eligible backup or is flagged to a manager with the reason. Cleaner notices carry the work window, address and authorized entry details and are updated or canceled with the stay; guest and cleaner codes remain OPS-005.

**Acceptance.**
1. Confirm, extend and cancel a stay through reservation doors, inspect generated tasks, have a cleaner decline and a backup accept, and verify deadlines, changed instructions and cancellation propagate with no duplicate payable turnover.
2. Then give one cleaner two same-day turnovers that cannot both be reached within their windows given travel time, and a third job beyond the cleaner’s daily capacity; verify each is routed to a backup or flagged to a manager with the reason shown.

#### EVIDENCE-001 — Private immutable cleaner completion evidence

*Tier:* Core · *From:* EVIDENCE-001, CABIN-05 · *Cites:* BASE-INPUT-003, BASE-ROLE-001

**Requirement.** Only the assigned currently authorized cleaner completes an approved turnover, once, using every approved checklist item and a valid PNG/JPEG with caption. Completion retains original photos, their digest and caption, the completing cleaner and time. A changed booking invalidates stale completion authority; authorized photo retrieval rechecks current permissions. Work finished after the next check-in remains done and is labeled late. A reopened job names the stay or checkout change and can be completed again while reusing its original photos.

**Acceptance.**
1. Complete a job through the cleaner command/photo doors; reject missing checks, malformed images, another cleaner and a duplicate completion, then retrieve the original photo only with an authorized session.
2. Finish late, amend the stay, inspect the reason for reopening and complete again without duplicated photos.

#### OPS-002 — Cleaner mobile work with reliable uploads

*Tier:* Core

**Requirement.** The cleaner app provides assigned schedules, directions, safe entry instructions, checklists, notes, multiple required work photos and issue reporting. Poor connectivity preserves private local drafts; reconnect reconciles the current assignment and booking revision before completing or uploading. Mobile capture cannot manufacture completion or expose another property’s data.

**Acceptance.**
1. On a phone accept an assigned job, capture required checklist photos and an issue, lose connectivity, then reconnect after a booking edit; retain the draft, request review of stale work and complete only the current approved task.

#### OPS-003 — Readiness is verified before arrival

*Tier:* Core · *From:* OPS-003, CABIN-06

**Requirement.** A per-stay readiness record combines accepted cleaning, maintenance blockers, inspection evidence, supplies and access verification. Per-property supply and restock items (for example linens, toiletries, coffee and paper goods) are readiness items: a failed or short item keeps the arrival unready until it is restocked and attested, or a manager explicitly excepts it. Named people attest physical completion; pending/failed evidence remains unready. Managers see at-risk arrivals, chase overdue work and explicitly approve exceptions with guest impact recorded. A cleaner upload alone cannot certify building safety. The readiness board is available for any chosen property-local day; photographed maintenance reports remain OPS-004.

**Acceptance.**
1. Open an arrival with completed cleaning but failed lock and maintenance checks and a failed restock item; verify it stays unready, resolve the tasks and restock and attest the item, obtain inspector acceptance and show the manager and guest-service team the final readiness state and evidence.

#### OPS-004 — Maintenance, inspections and work-order expenses

*Tier:* Core

**Requirement.** Managers dispatch corrective work orders and recurring preventive maintenance/inspections with assets, checklists, priority, photos, due dates, vendor acceptance, quotes and attached invoices/expenses. Approval limits govern spend; unavailable units close inventory. Cleaners, inspectors and guests report broken things from their task or the guest portal with photos, and each report becomes a work order assigned to the property’s maintenance person or vendor. Completion requires evidence and inspection when configured, allocates the approved cost to the correct owner and reschedules the next recurrence.

**Acceptance.**
1. Report a broken appliance, approve a vendor quote, block the unit, receive invoice/photos and inspect completion; reopen for guests, reconcile the owner expense and advance a recurring inspection without duplicate tasks.
2. From a turnover, have the cleaner report a broken patio light with a photo and verify a maintenance task is created with that photo, linked to the turnover and property, assigned to the property’s maintenance person and notified to them.

#### OPS-005 — Stay-bound smart-lock automation

*Tier:* Core · *Rules:* D-1 · *Register:* R-6

**Requirement.** Schlage, Yale, August, Kwikset, RemoteLock, Igloohome, Nuki and Salto locks connect directly or through an approved bridge such as Seam; Connections shows which path each lock uses. Cabin provisions a unique stay-bound code for every confirmed reservation at a lock-equipped property without staff action, verifies provider/device state, sends them only when release rules pass, updates windows for changed stays and revokes them on cancellation/checkout. Battery/offline alerts trigger assigned action and a manager-approved backup entry plan; an API acknowledgment alone is not a tested door. Hub-dependent and offline-PIN locks follow OPS-007.

**Acceptance.**
1. Connect each named lock family, directly or through the bridge; for each, provision and verify a stay code, extend then cancel the booking and observe expiry/revocation at the device or provider test harness.
2. Route a low-battery/offline lock to a person before arrival.
3. Confirm a reservation through a channel and verify its code is provisioned with no staff action, shown as active only once the provider or device confirms it, and sent to the guest only after release rules pass; a stay with an unresolved payment or ID check keeps its code unsent.
4. As this clause’s provider jobs are built, interrupt each lock job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### OPS-006 — Breezeway specialist operations handoff

*Tier:* Core

**Requirement.** A host using Breezeway can map properties, reservation events and task types, send authorized work and receive acceptance, completion, photos and issues. Cabin shows the system responsible for each task and avoids duplicate dispatch or expense creation. Disconnects and conflicting updates remain assigned exceptions; imported completion feeds readiness only after required human inspection.

**Acceptance.**
1. Connect Breezeway, amend a reservation, accept and complete its turnover externally, return photos and an issue, then replay events and disconnect the adapter; verify one owned task and cost with visible unresolved readiness.

#### OPS-007 — Hub-dependent and offline-PIN locks

*Tier:* Core · *Register:* R-6

**Requirement.** Each connected lock records its connectivity mode: cloud or Wi-Fi, hub-bridged (for example Schlage Sense, Bluetooth Yale and August models, or Nuki through its bridge) or offline (for example Igloohome time-bound PINs). Before enablement Cabin states when a hub is required and then shows the hub’s online state. For an offline-only lock Cabin generates the provider’s time-bound PIN for the stay window, labels it as unverifiable at the device and not revocable early, and requires a manager-approved fallback (a code-change task or lockbox) for cancellations and early checkouts. A hub going offline before arrival opens an assigned case, and code delivery still waits for release rules.

**Acceptance.**
1. Connect an Igloohome lock in offline mode and a Schlage Sense through its hub; verify the hub requirement is stated before enablement.
2. Provision an offline time-bound PIN, confirm it is labeled unverifiable, then cancel the stay and verify the fallback task.
3. Take the hub offline before an arrival and verify the assigned case and that code delivery waits for release rules.
4. As this clause’s provider jobs are built, interrupt each lock job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

#### OPS-008 — A day board of departures, arrivals and readiness

*Tier:* Core

**Requirement.** For each property-local day, managers and guest-service staff see every home’s departure, arrival, turnover, access and readiness on one board on desktop and phone. A departure shows the scheduled checkout time and, once known, the actual checkout time and its source (guest portal, lock event, cleaner start or staff entry). An arrival shows the guest’s name, channel and expected arrival time from the reservation or guest portal. Each turnover shows its assigned cleaner and window; each stay’s door code shows pending, active (confirmed by the provider or device under OPS-005) or failed, and the code itself only to people with access authority; a declined or expired channel request (SYNC-008) shows with its reason. A portfolio summary states how many homes are ready for a chosen day, for example “All five homes ready for Saturday”, from OPS-003’s readiness records, and names any that are not. Every entry links to its source record; stale or unknown state is shown as such, never as ready.

**Acceptance.**
1. Seed five homes with Saturday departures and arrivals across Airbnb, Vrbo and Booking.com.
2. At 1440 and 390 pixels open Saturday’s board and verify one home shows Checked out with its actual time and source, one shows an arriving guest’s name, channel and time, one shows its assigned cleaner, one shows an active door code without revealing it to a cleaner session, and a declined overlapping Vrbo request shows its reason.
3. Leave one turnover unaccepted and verify the summary reads 4 of 5 ready and names that home; complete and attest it and verify the summary reads all five homes ready.

### US money, owner accounting and reporting

#### FIN-001 — Reservation-linked USD trust subledgers

*Tier:* Core

**Requirement.** A balanced ledger in integer USD cents separates guest receivables, advance deposits, damage holds, owner liabilities, manager revenue, channel/processor fees, expenses, taxes and cash by legal entity, property, owner and reservation. Entries retain effective/posting dates, sources and correction links. Closed periods use reversing adjustments; owner/client money is never silently netted across unrelated owners.

**Acceptance.**
1. Through reservation, payment and accounting doors record a deposit, earned stay, channel fee, tax, refund and owner expense; drill each balance to source transactions and prove debits equal credits before and after a period-close correction.

#### FIN-002 — Payout reconciliation per reservation

*Tier:* Core

**Requirement.** Airbnb, Vrbo, Booking.com and Stripe settlement records reconcile gross bookings, commissions, processor fees, withheld taxes, refunds, disputes, payout batches and bank receipt to each reservation and owner. Split/partial payouts and rounding differences remain explainable exceptions. Each settlement is attributed to the connected channel account that earned it (SYNC-010), and charged Booking.com virtual cards (PAY-005) reconcile to their reservation, Booking.com payout and owner line. Property-collect Booking.com charges (PAY-006) reconcile to their reservation, Stripe payout and owner line, and Booking.com’s commission invoice reconciles line by line to those reservations as a payable, never netted from a payout. Original provider events survive corrections; missing records are pursued until resolved, never filled with invented income.

**Acceptance.**
1. Import or receive each named provider’s settlement with multiple stays across two connected accounts of one channel, a charged Booking.com virtual card, a property-collect Booking.com charge with its commission invoice, a partial refund and a missing payout; reconcile a real bank receipt through the accounting view, retain the unmatched item and close it only after the missing external record arrives.

#### FIN-003 — Management agreements and expense allocation

*Tier:* Core

**Requirement.** Effective-dated management models define commission bases, fixed/percentage fees, owner-use cleaning, pass-through costs, taxes, shared costs, reserves and multiple-owner splits. Approved invoices/work-order costs attach to reservations or property periods, with evidence and accountant-reviewed mappings. Staff can explain every owner/manager allocation and its agreement version.

**Acceptance.**
1. Configure two different owner agreements, post reservation revenue and a shared repair, amend terms for a later stay, then inspect exact owner splits, fees, reserve and invoice evidence without rewriting the earlier allocation.

#### FIN-004 — Reconciled frozen owner statements and monthly delivery

*Tier:* Core · *From:* FIN-004, CABIN-09

**Requirement.** Monthly USD owner statements derive from the reconciled ledger and show opening balance, each stay, gross revenue, fees, commissions, tax responsibility, expenses, reserves, refunds, distributions and closing payable. Managers review differences and exact revisions before release; scheduled generation/delivery follows configured approval policy. Approved PDF/CSV and portal versions freeze the terms and totals; corrections issue traceable adjustments rather than rewriting sent statements. Imported Airbnb and Vrbo payout lines match individual stays with actual channel fees and paid owner expenses; the separate owner portal is FIN-005.

**Acceptance.**
1. Run month-end with a missing payout, resolve its exception, review and approve the USD statement, deliver it once to the owner portal/email and compare every line to the ledger; verify every Airbnb, Vrbo, Booking.com and Stripe payout received for the month appears on its owner’s statement split to the stays it paid, with none omitted or counted twice; later amend property terms and correct a posted item without changing the original safe CSV/PDF.

#### FIN-005 — Rental-owner portal and personal stays

*Tier:* Core

**Requirement.** Rental owners securely view only their properties, agreed calendar visibility, occupancy/revenue, reconciled statements, invoices, reserves, distributions and open issues. They download records, approve authorized expenses and request personal stays subject to inventory/management rules. Ownership changes retain historical statement access under explicit grants without exposing other owners or guest identity documents.

**Acceptance.**
1. Invite two unrelated rental owners, show each its statements and performance, approve an expense and request an owner stay; try cross-owner URLs/exports and transfer ownership, verifying historical and future access follow the grants.

#### FIN-006 — Trust accounts, bank reconciliation and approved ACH distributions

*Tier:* Core

**Requirement.** Scoped accountants designate trust and operating accounts and reconcile source-backed bank cash, immutable ledger attribution and each owner liability by property and frozen legal entity. Bank feeds use Plaid or an approved US banking partner. Unmatched bank rows and unassigned journals prevent reconciliation; a matched bank row does not post another receipt. RL-101 governs this preparation boundary; distribution reservation is FIN-010 and money execution is FIN-011, with FIN-001 custody and closed-period rules.

**Acceptance.**
1. Reconcile two trust accounts and their separate owner liabilities to bank and ledger sources; refuse unmatched or unassigned sources and any use of another owner’s funds.

#### FIN-007 — QuickBooks Online accounting synchronization

*Tier:* Core · *From:* FIN-007, CABIN-10 · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-MAIL-001

**Requirement.** Cabin provides its own QuickBooks Online connector with accountant-approved mappings for properties/classes, owners/vendors, revenue, deposits, fees, taxes, expenses and settlements. Previewed exports/sync batches retain external IDs, errors and reconciliation totals; duplicates and edits are handled without double posting. Guesty Connect is a migration reference, not an available Cabin connector. The same approved-statement journal can be posted once to the owner’s Pantry with its matched source evidence and a scoped revocable connection; retry retains the original journal and revocation shows a broken connection. QuickBooks CSV and Desktop IIF journals are also available for a person’s import.

**Acceptance.**
1. Authorize a QuickBooks Online test company, map accounts, sync a month including a refund and expense, reconcile totals, repeat the batch and handle an externally edited or rejected transaction without duplication.
2. Post an approved statement twice to Pantry and read one journal with its evidence; revoke the scoped connection and inspect its broken state.
3. Download the QuickBooks CSV and Desktop IIF journals for a person’s import.

#### FIN-008 — US occupancy, lodging and sales-tax obligations

*Tier:* Core · *Register:* R-9

**Requirement.** Property jurisdiction and stay dates drive configured occupancy/lodging and applicable sales-tax rules, exemptions and filing periods. Cabin separates channel-collected/remitted amounts from host liability, adjusts cancellations/refunds and tracks registration, filing and payment evidence. Avalara MyLodgeTax or an approved filing/remittance partner receives reviewed obligations; unsupported jurisdictions remain explicit work items until supported, without removing the tax workflow. Quotes and direct checkout show each lodging-tax line with its jurisdiction and rate before the guest commits, and each state, county and city levy is tracked, filed and reconciled as its own obligation.

**Acceptance.**
1. Book direct and OTA stays in two US jurisdictions with mixed collection responsibility and an exemption, refund one, approve a filing/remittance through the selected partner and reconcile acknowledgments, payments and remaining liability to the ledger.
2. Quote a direct stay at a Maine property and verify checkout shows the state lodging-tax line at the configured 9% rate; for a stay where both a state and a county tax apply, verify each is collected, filed and reconciled separately.

#### FIN-009 — US owner and contractor tax reporting

*Tier:* Core · *Register:* R-9

**Requirement.** Restricted W-9/payee records, owner and contractor payment histories, filing classifications and accountant adjustments support US 1099 preparation. Managers review totals and recipient details, generate accountant/e-file exports and submit through an authorized filing partner; acceptance, rejection, correction and recipient delivery are tracked. Tax IDs are masked outside the authorized tax workflow.

**Acceptance.**
1. From year-end reporting prepare owner and cleaner/vendor 1099 records, review exclusions/adjustments, submit a partner test filing, correct a rejection and download the accepted export without leaking tax IDs to service staff or ordinary archives.

#### REPORT-001 — Operational, revenue and owner performance reports

*Tier:* Core

**Requirement.** Live reports show occupancy with owner/maintenance blocks separated, ADR, RevPAR, booking pace, channel mix, gross/net revenue, cancellations, collection/settlement exceptions, owner performance, cleaning cost and readiness/service deadlines. Filters use property-local dates and explicit cash/accrual or stay/booking-date bases. Totals drill to permitted source records and export without hidden truncation. REPORT-002 and AGENT-005 use the same property-local, end-exclusive accounting and occupancy definitions documented with these reports.

**Acceptance.**
1. Use a mixed-channel month with owner blocks, refunds and incomplete payouts; filter a portfolio report, explain its occupancy denominator and accounting basis, and reconcile exported totals and drill-downs to reservations and ledger records.

#### REPORT-002 — Saved reports and scheduled sharing

*Tier:* Core

**Requirement.** Managers save report filters and schedule scoped owner/team delivery with period, recipients and format visible. Each run records the exact data cutoff, access scope, generated artifact and delivery outcome; changed access, failed generation or delivery creates assigned follow-up. No recipient receives another owner’s rows through a saved report.

**Acceptance.**
1. Schedule two owner reports and a manager digest, revoke one owner before run time, advance the schedule and inspect artifacts/delivery history; verify unauthorized delivery is refused and a failed send is assigned for resolution.
2. As this clause’s provider jobs are built, interrupt each report job before and after provider acceptance and prove restart reconciliation prevents duplicate external effects (RL-2).

### Integrations, migration, mobility and durable custody

#### API-001 — Documented API, webhooks and Zapier automation

*Tier:* Core

**Requirement.** A versioned scoped API covers property, reservation, availability, messages, work, financial records and exports with pagination and idempotent mutations. Signed outbound webhooks expose lifecycle and financial events with delivery history, bounded retry and replay controls; Zapier uses the same grants and durable events. Third-party access is revocable and cannot bypass approval, payment or property scopes.

**Acceptance.**
1. Create/read a reservation through documented API credentials, consume a signed webhook in Zapier, repeat a mutation and replay a delivered event; revoke credentials and show private/financial actions and stale queued jobs are refused.

#### MIGRATE-001 — Reviewed property-register move-in

*Tier:* Core · *From:* MIGRATE-001, CABIN-11

**Requirement.** The owner can preview a property-register CSV without publishing, inspect normalized rows/refusals and the source fingerprint, approve the exact plan, read a durable journal and safely undo unchanged imported records. Source-byte custody, collision/authority guards and dependency-aware reversal preserve native edits; retained source can be retired on erasure. No import may create users, sell inventory or move funds implicitly. The Guesty, Hostaway and OwnerRez report adapters retain their full migration requirements in MIGRATE-002, MIGRATE-003 and MIGRATE-004.

**Acceptance.**
1. Use Move in to preview/apply the documented CSV, reject a changed fingerprint, inspect the durable job, edit one imported property and undo; retain that native edit with its disposition, then erase another imported property and verify source retirement.

#### MIGRATE-002 — Migration from reservation source A

*Tier:* Core

**Requirement.** A reservation source A-specific export and API adapter maps properties and listings, future and historical reservations, guests, threads and attachments, fees and rules, tasks, owner terms, settlements and opening owner balances into a reviewed move-in plan. Original IDs, field mappings, counts and unsupported data remain visible. Missing source permissions or inaccessible history produce a named remediation and export request rather than silent omission. Channel mappings carry each listing’s owning channel account, including several Airbnb, Vrbo and Booking.com accounts and co-hosted Airbnb listings, so each maps to its SYNC-010 connected account.

**Acceptance.**
1. Upload a permissioned reservation source A export or connect a test account in Move in; preview each record family and balance, fix one mapping, apply without guest sends and charges and reconcile source counts and financial totals with the resulting Cabin records.
2. Include listings from two Airbnb accounts, one co-hosted, and confirm after reauthorization that each listing maps to its own connected account.

#### MIGRATE-003 — Migration from reservation source B

*Tier:* Core

**Requirement.** A separate reservation source B adapter preserves property and channel IDs, future and history bookings, guest conversations, rate and rule data, operations, payment and settlement history and owner opening balances. The reviewed plan distinguishes migrated history from live channel authority, lists exclusions with retrieval steps and deduplicates later channel events by external identity. Each listing keeps its owning channel account, so a portfolio spread over several Airbnb, Vrbo or Booking.com accounts, including co-hosted Airbnb listings, maps to the matching SYNC-010 connected accounts.

**Acceptance.**
1. Import a permissioned reservation source B dataset through Move in with a modified stay, archived thread and unpaid owner balance; reconcile records and totals, then deliver the same stay’s live channel event and prove it updates rather than duplicates the booking.
2. Use listings from two Vrbo accounts and confirm each maps to, and receives live events through, its own connected account.

#### MIGRATE-004 — Migration from reservation source C

*Tier:* Core

**Requirement.** An reservation source C adapter imports properties, guest and booking history, quotes, signed rental agreements, message history, payment and deposit records, owner commissions, statements and opening balances. Legacy processor tokens and channel credentials are not assumed transferable: reconnect and consent steps are explicit while historical references and obligations remain intact.

**Acceptance.**
1. Preview and apply a permissioned reservation source C export including a signed agreement, future installment and owner statement; compare source records and balances, reconnect payment and channel authority and verify no historical collection or message is replayed.

#### MIGRATE-005 — Migration from reservation source D

*Tier:* Core

**Requirement.** A reservation source D adapter preserves property content and media, rates, reservations, guest messages, agreements, payments, tasks, owner balances and website and domain redirect requirements. Staff see a complete mapping and missing-artifact report before approval; the guest’s future booking link and terms remain recoverable during website cutover.

**Acceptance.**
1. Import a permissioned reservation source D dataset from Move in, reconcile a future stay and historical refund, retrieve its original agreement and media, preview website redirects and verify the migrated guest can reach the correct reservation without being charged again.

#### MIGRATE-006 — Switching from automation and field-operations sources

*Tier:* Core

**Requirement.** automation source E migration maps booking, guest-message, automation, pricing, lock and owner-statement history with explicit reconnection of authority. field-operations source F migration or continued connection maps properties, checklists, accepted work, photos and unresolved issues. Historical completion does not automatically certify an upcoming stay ready; unsupported fields remain retrieval work with source custody.

**Acceptance.**
1. Run separate permissioned automation source E and field-operations source F imports, compare upcoming tasks, guest threads and balances, then enable one new reservation event and prove one active task and message workflow with required readiness rechecks.

#### MIGRATE-007 — CSV history, cutover rehearsal and accountable go-live

*Tier:* Core

**Requirement.** Future and historical reservation CSVs support field mapping, timezone/currency checks and duplicate/conflict review. Migration rehearsals reconcile property/stay/guest counts and opening balances, require human approval of unresolved gaps, and sequence old-PMS shutdown, channel/payment/domain reconnection and live inventory checks. Cutover never runs two charging or messaging schedulers; rollback preserves new bookings and financial evidence. Channel reconnection attaches each existing Airbnb, Vrbo and Booking.com listing to its Cabin property by its channel listing ID; it never creates a replacement listing that would lose reviews or history.

**Acceptance.**
1. Import a reservation CSV, rehearse migration of a 20-home portfolio, resolve mismatched counts and a changed opening balance, then perform a controlled cutover and rollback while a new booking arrives; retain that booking and prove one active sender/collector.
2. After cutover verify each Airbnb, Vrbo and Booking.com connection is attached to the same channel listing ID it had before the move, with its reviews, ratings and future reservations intact and no new listing created.

#### MOBILE-001 — Native manager and field-team apps

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESS-002 · *Register:* R-8

**Requirement.** US iOS and Android apps provide role-scoped reservation/calendar, inbox, arrival/readiness, cleaner/vendor tasks, camera uploads and actionable push notifications. Offline work is encrypted on device and reconciles revision/authority on reconnect; sign-out or revocation prevents stale data/credentials granting access. The mobile owner portal supports statements and owner stays without exposing staff-only records.

**Acceptance.**
1. On iOS and Android as manager, cleaner and rental owner, handle a changed arrival, reply to a guest, complete an evidenced task and open a statement; test offline conflict, push acknowledgment and grant revocation while offline/reconnecting.

#### INTERFACE-001 — Responsive accessible and honest operations

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-INPUT-001 · *Register:* R-3, R-4

**Requirement.** Desktop and mobile pages expose textual statuses, source freshness, errors, pending work and actionable empty states. Failed actions remain visible and do not erase user inputs or masquerade as success. Cabin is proven at the top of its buyer range: 40 properties with three years of history (at least 10,000 reservations, 100,000 guest messages and 15,000 turnover tasks) and 25 staff. At that size the portfolio calendar month view loads in under 2 seconds, inbox search returns in under 1 second, and reports render and export every row with totals matching ledger records. Lists use explicit pagination, never silent truncation; operators see provider/usage costs before enabling paid services.

**Acceptance.**
1. At 1440 and 390 pixels, use realistic properties/stays through calendar review, cleaner photo completion and statement download; exercise keyboard/error recovery and the full target booking/inbox journey.
2. Seed an installation with 40 properties and three years of history at the stated volumes; measure calendar, inbox search and report timings against the stated limits and verify paginated lists and exports return every row with counts and totals matching the source records.

#### DATA-001 — Complete portable product records and safe restore

*Tier:* Core · *From:* DATA-001, CABIN-13 · *Cites:* BASE-DATA-001, BASE-BACKUP-001, BASE-SECRET-001

**Requirement.** The portable Cabin archive preserves reservation sources and revisions, guest and thread history, signed agreements, cleaner originals, trust-ledger attribution, frozen statements and import journals in its documented schema, with usable CSV, PDF and media downloads. Historical payments and provider outcomes remain evidence rather than runnable work; restored connections, scheduled sends, distribution plans and access-code jobs stay inactive until the owner reauthorizes their actual destinations. The hosted backup produces an owner-only file without exposing a temporary download link.

**Acceptance.**
1. Use the public rer export/import commands to round-trip a populated installation, compare all record families/media and totals, reject damaged or populated restores and verify restored jobs/connections remain inactive until the new owner reauthorizes them.

#### DATA-002 — Erasure, retention and later-journal fencing

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006, BASE-AUDIT-001

**Requirement.** Guest, invited-member and property erasure includes original cleaner attachments and retained import sources. Dated signed-document holds and immutable accounting obligations identify the exact retained records and expiry or release condition. Automation never reuses an erased contact. Local archive fencing rejects an older copy when supplied the later erasure journal. External partner records and downloaded backups require the receipt’s explicit external steps; an isolated old backup cannot discover future erasures.

**Acceptance.**
1. Erase a property/guest with photos, threads and source files, verify all public/private read and queued-action doors, inspect retained legal records and anonymized audit, then attempt old restore with the later journal and confirm refusal without partial writes.

#### DATA-003 — Every booking, guest and payout stays in the owner’s installation

*Tier:* Core · *Cites:* BASE-DATA-004, BASE-DATA-005, BASE-INSTALL-001

**Requirement.** Disconnecting an owner-connected provider fences further manual and queued sharing of Cabin reservation, guest, payout and cleaner-photo data while preserving historical records in the owner’s installation. Connections identifies the affected product workflows and the authority needed to reconnect.

**Acceptance.**
1. Run a populated installation through a channel booking, a guest conversation, a payout import and a cleaner photo with every outbound network request recorded; verify each resulting record is in the owner’s database or file storage and that the only outbound requests went to the connected providers named in Connections.
2. Disconnect one provider and verify no further data reaches it.

#### AUDIT-001 — Permanent attributable business and automation history

*Tier:* Core · *Cites:* BASE-OPS-005, BASE-AUDIT-001, BASE-DATA-003, BASE-AGENT-009

**Requirement.** The Cabin trail links rental-role changes, exact approvals, reservation revisions, released guest access, channel and lock actions, trust postings, move-in journals and recovery decisions to their stay, property, source revision and result. It excludes personal message bodies and active entry capabilities while preserving the accounting attribution needed after guest erasure.

**Acceptance.**
1. Follow a stay from booking through task, message, lock, refund and owner statement; export its human/agent/provider history, erase the guest and verify useful anonymized attribution remains without secrets or personal message bodies.

#### SECURITY-001 — Provider custody and declared external data

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004, BASE-AGENT-003, BASE-AGENT-005

**Requirement.** Before a provider connection is enabled, Connections discloses its destination, rental-data families, purpose, action/home authority and provider cost. Credential rotation fences old inbound events and queued effects. Ordinary staff and agent views omit guest identity copies, tax and bank details and active door capabilities unless their job-specific scope permits them. Reply assistance uses only the current matched stay and property instructions; guest-authored text cannot confer authority.

**Acceptance.**
1. Enable, rotate and revoke a provider connection, submit forged events and adversarial guest text, inspect role-limited API/export/log/agent outputs and prove revoked queued actions stop while historical evidence remains readable.

#### HTTP-001 — Real Worker health and document dispatch

*Tier:* Core · *Cites:* BASE-OPS-001, BASE-ACCESS-002

**Requirement.** The built Cabin Worker serves the installed Cabin homepage, keeps unknown document and API paths as real not-found responses, and dispatches private stay operations through native authority. Its installation health does not certify a live channel, a physical home or receipt by a guest.

**Acceptance.**
1. Run the emitted Worker on migrated local storage; request the health door, installed homepage and unknown document/API doors, verifying successful health/branding and true 404s.

#### RUNTIME-001 — Owner-run lifecycle and durable background work

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-SECRET-002, BASE-OPS-003, BASE-OPS-004, BASE-AGENT-012 · *Register:* R-1, R-2

**Requirement.** A fresh Cabin source installation supports a native owner completing a saved rental job across a development-server restart. Rental channel, guest-message, payment, lock and report work retains its due time, claimed attempt, provider evidence and unresolved outcome across interruption before or after provider acceptance. Reconciliation establishes the external state before another effect; each future adapter inherits that same boundary (RL-2).

**Acceptance.**
1. Start a fresh source checkout with rer dev, sign in and complete a product job, stop/restart and recover durable state; interrupt each external job before/after provider acceptance and prove reconciliation prevents duplicate charges, sends or unlocks.
2. Run the homepage’s five commands on a clean Linux machine to a signed-in installation.

### Honest boundaries and partner obligations

#### BOUNDARY-001 — A separate complete vacation-rental product with named partners

*Tier:* Core · *Register:* R-5

**Requirement.** Cabin owns the short-stay booking-to-owner-close job. It connects OTAs through the host-account agents in SYNC-011, subject to the [recorded terms risks](/docs/channel-terms), or approved partner connections rather than operating a booking marketplace, uses Stripe/licensed banking partners for rails and custody, Avalara or qualified filing partners/accountants for remittance and filings, licensed protection partners for insurance, and real cleaners/inspectors for physical work. Telecom providers carry messages and bounded workers carry long-running work. Partnership approval, US tax/financial configuration, provider agreements and native-app distribution remain required engineering/delivery work with named owners, supported data and unresolved blockers visible; none removes a promised PMS workflow.

**Acceptance.**
1. Inspect each channel's terms warning and explicit session/action grant before connecting its host-account agent.
2. Use Connections/onboarding to inspect each required approval/configuration and its responsible party; attempt activation without approval, complete the documented partner setup and run a booking through externally acknowledged service, tax/payment outcomes and human readiness.
3. Disconnected features remain visibly incomplete, never replaced by simulated success.

#### OPEN-001 — Free and open source under the MIT license

*Tier:* Core · *Cites:* BASE-DATA-005, BASE-INSTALL-001

**Requirement.** The complete Cabin vacation-rental product is published under the MIT license, including every property, staff, channel and volume capability without an author payment tier. Provider fees remain their own and are disclosed with their source before enabling under INTERFACE-001.

**Acceptance.**
1. Verify the public source licence and declared package licence are MIT; install from the public source with no account or key from the Cabin authors and reach every product area with 40 properties and 25 staff without a payment, upgrade or license prompt; enable a paid provider and verify its cost is shown as the provider’s before activation.

### Public hosted demo

#### SITE-002 — Hosted vacation-rental demo

*Tier:* Core

**Requirement.** The homepage’s Try the demo opens a public hosted Cabin installation that a visitor can use without an account or local install: a clearly labeled sample US vacation-rental business with fictional properties, guests, channel stays, cleaner jobs with photos and owner statements in USD. Each visitor has an isolated sandbox; it expires and discards visitor changes on a published schedule, and the next session starts from fresh sample data. The demo holds no real guest data, never connects to a visitor’s production accounts and sends no real guest message, charge, payout or lock/provider action. Any contact details a visitor types are discarded with the sandbox and excluded from retained logs and backups. It is separate from owner installations, which still start empty.

**Acceptance.**
1. From the homepage’s Try the demo at 1440 and 390 pixels, start a signed-out visitor session without installing or supplying contact details; find seeded US homes, guests, stays, cleaner photos and USD statements.
2. Approve a seeded calendar review, complete a turnover and approve an owner statement through their normal product doors.
3. Open a second visitor session and prove the first visitor’s changes are absent.
4. Advance the host’s scheduled expiry in its test boundary, verify the old session can no longer read its data, and start again to find fresh sample data with the changes and typed contact details gone from storage, logs and backups.
5. Record outbound effects during the journey and prove no real message, charge, payout or lock/provider action occurred; launch a fresh owner installation and find no sample records.
6. Separately verify the public demo hostname and homepage link open the working hosted demo.

### US money, owner accounting and reporting

#### FIN-010 — Exact internally reserved distribution plans

*Tier:* Core · *From:* FIN-006

**Requirement.** Under RL-101 the native installation owner alone approves an exact, unexecuted plan binding payee, amount, bank account and legal entity. Available funds exclude reserves, taxes, advances, other payables and other owners’ money. Approval reserves internally and creates neither a bank payout nor a ledger distribution. Restored plans are inactive. This is a conservative preparation boundary; an agent’s preparation carries standard and an execution call carries money and commitment, decided by the company’s policy subject to FIN-011’s verified external authority.

**Acceptance.**
1. Prepare an owner or vendor plan from reconciled balances and approve its exact payee, amount, account and entity as native owner; refuse any use of reserved funds or another owner’s money.
2. Read the internal reservation and verify that no bank request or ledger payout was made; restore it and verify inactive history.

#### FIN-011 — Verified ACH execution and returned distributions

*Tier:* Core · *From:* FIN-006 · *Register:* R-7

**Requirement.** Actual distribution uses a separately verified licensed ACH/payout partner, funded trust arrangement, verified owner or vendor payee and bank execution authority. Fresh exact execution approval under RL-101 binds the chosen payee, amount, account and entity; an agent’s equivalent call carries money and commitment and the company’s policy decides it, without manufacturing a person’s approval. Only provider pending, settled, failed and returned evidence drives the money outcome. A return restores liability and corrects the owner statement through FIN-001’s immutable custody and closed-period rules; Cabin itself never custodies funds.

**Acceptance.**
1. Execute an exactly authorized owner or vendor distribution using the verified partner and payee, with available funds net of all reserves and liabilities.
2. Follow pending, settled, failed and returned transfers from provider evidence; read bank evidence of a return, restored owner liability and the corrected owner statement.
3. Refuse execution lacking fresh exact authority, including any attempt to use another owner’s funds.

### Agent surface

**Specialist: rental operations coordinator.** It sells and services stays, keeps homes ready, pursues missing money evidence and closes each rental owner’s books.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call.

**How Cabin computes each class.**
- standard: reversible internal plans, notes, assignments, quotes and reads; measure items from the selected records.
- external: publishing listings or availability, guest/vendor/channel messages, outside reports and any newly exposed record; count recipients and derive internal, known, new or public counterparty from saved contacts and publication scope.
- money: payments, credits, refunds, distribution execution, changed rates, vendor costs and changed owner payables; compute integer USD amount, currency and payee from the exact stay, ledger or provider record.
- commitment: signed rental terms, binding guest offers, vendor acceptance and owner/accounting sign-off; compute value and counterparty from the exact revision.
- gated: a channel’s consent or terms step, Stripe-hosted card entry, identity verification or bank/payee verification that its outside provider keeps for a person; name the provider and step from the provider’s response.
- access: invitations, rental-role/property scopes, portal or device grants and revocations; count people or devices and compute widening or narrowing from current authority.
- security: connection credentials, secret rotation, provider protections and backup recovery settings; name the changed setting.
- destructive: permanent erasure or an irreversible accounting discard; count affected records from the current dependency graph.
- sensitive: unmasked identity, tax, bank or payment evidence; count records and name the regulated data kind from the selected fields.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `cabin.integrations.manage` | Create scoped API connections and lifecycle deliveries | API-001 | access · security (+ external) | Native capability or target; MCP adapter not yet proven |
| `cabin.homes.manage` | Maintain homes and effective owner terms | CABIN-01 | standard or commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.team.manage` | Change rental roles and property scopes | AUTH-002 | access | Native capability or target; MCP adapter not yet proven |
| `cabin.calendar.review` | Review and publish exact calendar revisions | SYNC-001, CONTROL-001 | standard or commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.channel.connect` | Connect accounts and publish channel content | SYNC-002, SYNC-003, SYNC-004, SYNC-005, SYNC-010, SYNC-011, BOUNDARY-001 | security · external (+ gated) | Native capability or target; MCP adapter not yet proven |
| `cabin.inventory.update` | Change and reconcile held nights and requests | SYNC-006, SYNC-007, SYNC-008, SYNC-009, RES-003, RES-005 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.reservations.manage` | Find, quote, create and amend stays | RES-001, RES-002, RES-004, RES-006 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.pricing.publish` | Preview and publish channel rates | PRICE-001, PRICE-002, PRICE-003 | money · external | Native capability or target; MCP adapter not yet proven |
| `cabin.website.publish` | Edit and publish booking sites and embeds | WEB-001, WEB-002 | standard or external | Native capability or target; MCP adapter not yet proven |
| `cabin.agreements.sign` | Prepare or sign exact rental terms | WEB-003 | standard or commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.verification.review` | Handle consented identity cases | WEB-004 | sensitive (+ commitment) (+ gated) | Native capability or target; MCP adapter not yet proven |
| `cabin.promotions.offer` | Offer and accept paid stay extensions and extras | WEB-005 | external · money (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.payments.collect` | Collect, reconcile, refund or dispute stay charges | PAY-001, PAY-002, PAY-003, PAY-004, PAY-005, PAY-006 | money (+ sensitive) (+ gated) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.guests.manage` | Maintain guest identity, portal and review work | GUEST-001, GUEST-002, GUEST-003, GUEST-004 | standard or external (+ access) (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.messages.reply` | Route, draft, schedule and send guest replies | MESSAGE-001, MESSAGE-002, MESSAGE-003, MESSAGE-004 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.work.dispatch` | Dispatch cleaning, readiness and maintenance | OPS-001, OPS-003, OPS-004, OPS-006, OPS-008 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.work.complete` | Record the actor’s cleaner evidence and completion | EVIDENCE-001, OPS-002 | standard or commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.locks.manage` | Provision, inspect and withdraw stay access | OPS-005, OPS-007 | access · security (+ external) | Native capability or target; MCP adapter not yet proven |
| `cabin.ledger.post` | Allocate source-backed trust entries and corrections | FIN-001, FIN-003 | money · commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.finance.reconcile` | Reconcile bank and provider settlements | FIN-002, FIN-006 | standard (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.statements.release` | Close books and share exact owner statements | FIN-004, FIN-005 | commitment (+ external) (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.distributions.plan` | Prepare exact internally reserved plans | FIN-010 | standard or commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.distributions.execute` | Execute verified owner/vendor ACH | FIN-011 | money · commitment (+ gated) | Native capability or target; MCP adapter not yet proven |
| `cabin.books.sync` | Publish journals to Pantry or QuickBooks | FIN-007 | external · commitment | Native capability or target; MCP adapter not yet proven |
| `cabin.taxes.file` | Prepare and file authorized US obligations | FIN-008, FIN-009 | sensitive · commitment (+ external) (+ money) (+ gated) | Native capability or target; MCP adapter not yet proven |
| `cabin.reports.run` | Read and schedule scoped rental reports | REPORT-001, REPORT-002 | standard or external (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.archives.export` | Export or restore rental records | DATA-001 | standard or security (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.erasure.run` | Erase reviewed rental personal records | DATA-002 | destructive (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.providers.manage` | Review, rotate and revoke connected sharing | DATA-003, SECURITY-001 | security (+ access) (+ gated) | Native capability or target; MCP adapter not yet proven |
| `cabin.activity.read` | Read source-linked rental history | AUDIT-001 | standard (+ sensitive) | Native capability or target; MCP adapter not yet proven |
| `cabin.agents.prepare` | Prepare or execute classified rental work | CONTROL-002 | standard or commitment (+ external) (+ money) | Native capability or target; MCP adapter not yet proven |
| `cabin.recovery.run` | Recover a stay and inspect outstanding work | AGENT-001, AGENT-006 | standard or external (+ money) (+ commitment) (+ access) (+ security) | Native capability or target; MCP adapter not yet proven |
| `cabin.exceptions.resolve` | Pursue missing records and exact corrections | AGENT-002 | standard or commitment (+ external) (+ money) (+ destructive) | Native capability or target; MCP adapter not yet proven |
| `cabin.issues.resolve` | Pursue inspected guest issue resolution | AGENT-003 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.revenue.plan` | Evaluate and publish profitable stay offers | AGENT-004 | standard or external (+ money) (+ commitment) | Native capability or target; MCP adapter not yet proven |
| `cabin.questions.ask` | Answer source-linked portfolio questions | AGENT-005 | standard or external (+ commitment) | Native capability or target; MCP adapter not yet proven |

**Resources.** cabin://homes/{id}, cabin://stays/{id}, cabin://guests/{id}, cabin://threads/{id}, cabin://tasks/{id}, cabin://readiness/{stay}, cabin://statements/{id}, cabin://journals/{id}, cabin://distributions/{id}, cabin://cases/{id}, cabin://reports/{id}.

**Events.** stay.changed, inventory.changed, message.changed, work.changed, readiness.changed, settlement.changed, statement.changed, distribution.changed, case.changed and the inherited policy/approval/review events.

**Prompts.** Prepare arrivals (RES-001, OPS-003, OPS-008); recover a disrupted stay (AGENT-001, AGENT-003, AGENT-006); reconcile owner close (FIN-004, FIN-006, AGENT-002); explain the portfolio (AGENT-005); improve net occupancy (AGENT-004).

**Not tools, and why.** MIGRATE-001: the reviewed import door owns source custody and cutover. MIGRATE-002: the Guesty import door owns provider mappings. MIGRATE-003: the Hostaway import door owns provider mappings. MIGRATE-004: the OwnerRez import door owns source agreements and mandates. MIGRATE-005: the Lodgify import door owns website cutover. MIGRATE-006: the Hospitable and Breezeway import/connector doors own source handoff. MIGRATE-007: the import door owns parallel-run cutover and rollback. MOBILE-001: native installation, camera capture, offline device storage and push are device work; their server jobs use the corresponding tools. INTERFACE-001: the responsive interaction and measured rendering are a person’s screen; each underlying server job is a tool. HTTP-001: Worker dispatch and installation health are installation facts. RUNTIME-001: installation and process restart are installation facts; durable job actions use their originating tools. SITE-002: the isolated visitor demo is a person’s interactive screen. OPEN-001: public licensing and price are installation facts.

**Limits.** Calendar bytes, attachment/photo size and request rate follow the documented capacity limits. Business volume and spend caps are the company’s policy. No agent access promise implies provider quota or channel permission.

**Handoffs.** Listens for booking, payment, guest-message and field-work changes and source settlement arrivals. Emits typed readiness, missing-record and owner-close events with their record references for the accounting and records specialists.

#### SURFACE-001 — The rental action registry covers the contract

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The rental registry covers this tool table and the named non-tool reasons, including every Core rental workflow.

**Acceptance.**
1. Compare discovered rental tools and Core clause coverage with the table and non-tool reasons.
2. Invoke each rental tool on its stay/property fixture and compare its native action result and source-linked record state.

#### SURFACE-002 — Compute stay, exposure and financial classes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Rental class computation uses current stays, recipients, owner ledgers and exact terms.

**Acceptance.**
1. A reversible internal plan or note carries standard with its item count.
2. The same action publishing outside the business carries external with recipient count and saved known, new or public counterparty; moving a record into an externally visible destination also carries external.
3. A stay price, credit, refund, cost or distribution computes money with exact USD amount and payee, including changed owner liabilities.
4. Signing terms, issuing a binding offer, accepting vendor work or releasing an owner close adds commitment with its exact value and counterparty.

#### SURFACE-003 — Compute rental authority and regulated-data classes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Connection, identity and custody calls derive their classes from the current authority and data.

**Acceptance.**
1. Changing a rental role, property scope or stay/device grant carries access with the affected people/devices and widening or narrowing.
2. Rotating connection credentials or changing recovery protections carries security with the changed setting.
3. Erasing personal records or irreversibly discarding an accounting close carries destructive with the affected record count.
4. Reading unmasked ID, W-9, bank or payment evidence carries sensitive with record count and data kind.
5. Channel consent, hosted card entry, identity verification and payee/bank verification add gated when the named provider keeps that step for a person; its provider and step match the actual response.

#### SURFACE-004 — Rental record resources and change handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-010

**Requirement.** The rental resource templates and event families are those named above, linked through the exact stay and property.

**Acceptance.**
1. Read each declared rental resource type and follow a mutation’s resource link to the changed source revision.
2. Change a stay, issue, task, statement and distribution fixture and read their declared typed events with the same record references across the supported channels.
3. Remove a property grant mid-run and verify its later rental events no longer reach that subscriber.

#### SURFACE-005 — A stranger coordinator completes the seeded rental week

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-013 · *Register:* R-10

**Requirement.** A stranger agent completes a seeded week using only the installation URL and rental MCP surface, under two named company policies.

**Acceptance.**
1. Under all-autonomous policy, prepare arrivals, resolve a cleaner cancellation, send the updated guest instructions, post a supported credit and reconcile an owner statement without a policy wait or policy refusal.
2. Under held policy, standard work enters review and every other declared class waits for its exact approval; the signed-in test person grants those actions and the same rental outcomes reconcile.
3. Compare the stay, inventory, photos, guest confirmation, provider receipts, owner liability and unresolved work across both runs; no missing source becomes a claimed settlement.
4. Before policy setup is answered, attempt the same first rental action and inspect the setup question and absence of effect.

#### SURFACE-006 — Rental decisions retain exact source authority

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Pending rental actions bind the stay, recipient, inventory, source revision and exact terms they use.

**Acceptance.**
1. Change a stay, payee, recipient or price while its action is held by company policy and verify the old saved revision has no effect.
2. After the exact current action runs, distinguish its preparer, deciding actor and physical inspector in the rental record and owner close.
3. Retry an interrupted guest send, charge and lock change and reconcile one external effect or an explicitly unresolved source outcome.

#### SURFACE-007 — The rental overview reconciles the week

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-009, BASE-AGENT-011

**Requirement.** The rental overview connects the seeded week’s actions to its stays, owners, cases, provider costs and class measures.

**Acceptance.**
1. Reconcile action counts, outside recipients, USD movements and provider spend to the week’s rental records and policy decisions.
2. Open the held week’s review items, exact pending actions and provider handoffs and follow each to its permitted stay or case.
3. Pause the coordinator midway through a due arrival and verify pending rental work retains its source state while agent effects stop.

#### SURFACE-008 — Restore never reactivates rental authority

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-012

**Requirement.** Restored rental evidence does not revive a distribution, guest-send mandate or access-code job.

**Acceptance.**
1. Restore the seeded week and read historical plans and receipts without activating its provider credentials, distribution execution or scheduled guest sends.
2. Reauthorize one exact destination through the current owner flow, resume its current work and verify that historical provider outcomes do not replay.

## Push further

### Push further: agents complete the stay’s job

#### AGENT-001 — Recover a disrupted stay through verified readiness

*Tier:* Core · *From:* AGENT-001, CABIN-08 · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012 · *Rules:* D-1

**Requirement.** When a cleaner cancels, a reservation conflicts or a guest reports a problem, a recovery agent correlates actual channel revisions, guest threads, accepted tasks, photos, access events, alternative inventory and balances. It secures a replacement cleaner, chases acceptance/completion, provisions and verifies new door codes, and offers compensation or an alternative stay. Compensation and changed owner payables carry money; relocation and binding guest promises carry commitment; outside contact carries external. The company’s policy decides each agent call, binding its exact stay, recipient, price and revision. A person’s physical readiness attestation remains their own. The case closes only after guest/field confirmation, reconciled channels/access and the final owner balance, or remains explicitly escalated.

**Acceptance.**
1. Cancel the cleaner shortly before an arrival, then report a failed lock as the guest.
2. Under the held company policy, approve the exact budget and relocation or compensation choice; verify backup acceptance, completed evidence, new code state, guest confirmation and corrected owner net.
3. Stop and restart midway and reject a pending action under that held policy; inspect every unresolved step and balance rather than silently skipping it.

#### AGENT-002 — Close reservation-to-owner financial exceptions

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** A reconciliation agent uses source settlement events, bank receipts, reservation revisions, refunds, fees and effective owner agreements to explain discrepancies and seek missing provider records. It proposes correcting entries and statements with source links, follows the exception until balanced and verifies final owner payable/distribution. Refunds and payouts carry money; postings or period sign-off carry commitment, with destructive when reopening irreversibly discards a close. The company’s policy decides the agent’s call; unsupported assumptions never become ledger entries. RL-4 preserves the interim native correction boundary, and RL-101 governs distribution preparation and separately authorized execution in FIN-006, FIN-010 and FIN-011.

**Acceptance.**
1. Under the held company policy, create a stay with split payout, missing channel fee and later refund; inspect the agent’s evidence, obtain the missing record, reject one correction, approve the exact adjustment and reconcile the ledger, frozen-statement adjustment and actual owner distribution to the same net.

#### AGENT-003 — Resolve guest issues through accepted field work

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** An issue agent classifies guest messages against approved property instructions and current stay facts, proposes safe troubleshooting, dispatches maintenance or cleaning with money for costs, commitment for a binding vendor assignment and external for guest/vendor contact, as decided by the company’s policy and its limits. It follows vendor acceptance, inspection and guest confirmation. It checks recurrence after the fix. Safety/emergency cases reach a named human and appropriate emergency-service instructions immediately; the agent never assures structural/physical safety or closes on a drafted reply alone.

**Acceptance.**
1. Under the held company policy, report an access failure and leaking appliance through the guest portal or inbox; approve the exact dispatch, decline one vendor, complete inspected work and obtain guest confirmation plus a recurrence check.
2. Send an emergency report and verify immediate human escalation without automated safety claims.

#### AGENT-004 — Optimize profitable occupancy without breaking readiness

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** A revenue agent combines booking pace, PriceLabs/Wheelhouse/Beyond feeds, actual inventory, stay rules, cleaner capacity, taxes and cleaning/commission costs to propose rates and gap-night offers by expected net contribution. Hosts set floors, maximum changes and audience. Rate publication and changed charges carry money, guest offers carry external and binding offers add commitment; the company’s policy decides each agent call. It verifies actual channel acceptance and measures realized contribution; forecasts cannot establish availability or readiness.

**Acceptance.**
1. Under the held company policy, inspect an orphan-night opportunity that conflicts with cleaning, reject it, then approve a feasible exact offer; verify accepted channel prices, one guest purchase, changed work/access windows and realized owner net against the forecast.

#### AGENT-005 — Source-linked portfolio questions and actionable follow-up

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Staff ask natural-language questions over permissioned live reservations, conversations, readiness and financial data. Answers cite records, cutoff, filters and uncertainty, reconcile figures to reports and can propose assigned follow-up. Rental owners get only their properties; no answer fabricates a settlement, silently changes a booking or claims unavailable live data. An assigned internal investigation carries standard; any outside follow-up adds external and a binding promise adds commitment. The company’s policy decides the agent’s call. Answers use the accounting definitions in REPORT-001 and preserve exact source revision, filters, property scope and named assignee.

**Acceptance.**
1. Ask why one property’s owner net fell and which arrivals are at risk; follow the cited records to matching reports. Under the held company policy, approve an exact assigned investigation. Ask as an unrelated owner and during a stale provider read and verify scope and explicit uncertainty.

#### AGENT-006 — Bounded action authority and durable agent cases

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Recovery work binds each exact plan to its stay, recipient, inventory, price, provider, terms and current property/action grant. Changed facts invalidate the saved plan. Credits and cleaning spend carry money; outside messages carry external; relocation, agreements and relied-on sign-off carry commitment; changing grants carries access, and changing provider credentials carries security. The company’s policy sets dispositions and any spending ceilings or time windows. The recovery case preserves its plan, attempts, provider evidence and unresolved work. An agent records only its own decisions; people’s signatures, execution approvals and physical inspections are attributed only after those people act.

**Acceptance.**
1. Under the held company policy, prepare a specific vendor or payment action, change the recipient or booking and refuse the stale revision; cross a company spending cap, inject guest instructions and revoke access during an uncertain provider response.
2. After restart verify no unauthorized effect and an explicit unresolved outcome.
3. Under the company policy that makes recovery money calls up to $100 autonomous and larger calls require approval, a $75 guest credit posts the owner adjustment once; a $150 credit remains unsent until the named person approves it.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | A clean macOS installation completing the Cabin rental journey | RUNTIME-001 | not run | | |
| R-2 | A working installation in an owner-controlled Cloudflare account, with signed-in rental journey and removal receipt | RUNTIME-001 | not run | | |
| R-3 | A human screen-reader pass on the rental journeys | INTERFACE-001 | not run | | |
| R-4 | A dated VPAT for the rental operator and guest surfaces | INTERFACE-001 | not run | | |
| R-5 | Real authenticated Airbnb, Vrbo and Booking.com host-account and partner acceptance, with actual channel terms permission | SYNC-002, SYNC-003, SYNC-004, SYNC-005, SYNC-010, SYNC-011, BOUNDARY-001 | not run | | |
| R-6 | Physical operation and emergency fallback on each named lock family | OPS-005, OPS-007 | not run | | |
| R-7 | Licensed ACH partner, funded trust arrangement, legal authority and verified real payee/bank execution and return receipts | FIN-011 | not run | | |
| R-8 | iOS and Android store distribution approval | MOBILE-001 | not run | | |
| R-9 | Authorized US tax/legal review and real agency filing/remittance receipts | FIN-008, FIN-009 | not run | | |
| R-10 | Rental MCP operation in Claude, ChatGPT, Codex and Copilot clients | SURFACE-005 | not run | | |

## Boundaries

- Long-term residential leasing, rent collection and resident management belong to [Terrace](https://github.com/just-every/run-terrace); Cabin exchanges property/accounting references where needed. General small-business books belong to [Pantry](https://github.com/just-every/run-pantry) or QuickBooks Online; Cabin retains the complete reservation/trust subledger and owner close required above. General customer support belongs to [HappyToHelp](https://github.com/just-every/run-happytohelp); Cabin owns guest conversations and stay recovery with links/integrations for wider support. These are separate products. No unowned category is absorbed.

- Cabin does not operate payment or telecom networks, underwrite insurance, provide professional legal/tax certification or itself perform a cleaner/inspector’s physical work. Named partner connections, actual remittance/distribution outcomes and human verification deliver those parts of the buyer’s workflow. US tax rules, agreements, W-9/1099 classification, bank and partner configuration require authorized professional review; international currencies/jurisdictions are later expansion, while the complete US job remains the target.

- Base native sessions, command lifecycle and import-kit custody remain the foundation. The existing local portability interpretation excludes transient installation credentials and uses later-journal erasure fencing; DATA-001 and DATA-002 retain those limits while extending the portable product data. No claim of complete Base equivalence follows from copied modules, an inherited manifest or a passing health check. New embeds, guest documents, provider calls, uploads and agent actions must meet their own access, input, custody and audit clauses; the old absence of those features is not a security exemption for their future implementation. External downloaded backups cannot be recalled, and provider acceptance cannot prove physical readiness or human receipt.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | "syncs Airbnb, Vrbo and Booking.com" | SYNC-002, SYNC-003, SYNC-004, SYNC-009 |
| 2 | "answers your guests" | MESSAGE-001, MESSAGE-004 |
| 3 | "sends the cleaner" | OPS-001 |
| 4 | "and the door code" | OPS-005 |
| 5 | "turns every payout into an owner statement" | FIN-002, FIN-004 |
| 6 | "100% free, open source alternative to Guesty, Hostaway and OwnerRez" | OPEN-001, BOUNDARY-001, MIGRATE-002, MIGRATE-003, MIGRATE-004 |
| 7 | Ready ✓ · Pine Ridge Cabin; Checked out 10:00 am · Sandy Shores | OPS-008, OPS-003, RES-002 |
| 8 | Guest arriving 4 pm · Airbnb · Lake Loft | OPS-008, RES-002, GUEST-001 |
| 9 | Door code 4417 active | OPS-005, OPS-008 |
| 10 | Cleaning · Luis · Desert Casita | OPS-008, AUTH-002 |
| 11 | Vrbo request declined · overlaps Airbnb | SYNC-008, SYNC-006, SYNC-003 |
| 12 | "Booked once. Closed everywhere." / "Seconds later those nights close on Vrbo, Booking.com and your own site" | SYNC-006, SYNC-002, SYNC-003, SYNC-004, SYNC-011 |
| 13 | Lake Loft calendar: channel rows, stay bar and Closed bars, end-exclusive checkout | RES-001, SYNC-001, SYNC-006 |
| 14 | "Rates from PriceLabs" with each night's rate | PRICE-001 |
| 15 | Sync log: per-channel results, a rate-limited push and its retry | SYNC-007, SYNC-002, SYNC-003, SYNC-004, SYNC-011 |
| 16 | "Airbnb · reservation HMQ4K2Z9 received" | SYNC-002, RES-002, SYNC-011 |
| 17 | "Airbnb, Vrbo, Booking.com, text and email arrive in one thread per guest" | MESSAGE-001, GUEST-001, SYNC-011 |
| 18 | "Scheduled messages go out on time" (directions and Wi-Fi sent; check-in steps scheduled) | MESSAGE-003 |
| 19 | "and Cabin drafts the rest" / Draft with Send and Edit | MESSAGE-004 |
| 20 | "Door code start moved to 2:00 pm" | OPS-005, MESSAGE-004 |
| 21 | "Every checkout opens a turnover: the cleaner, the checklist, the photos and a fresh door code for the next guest" | OPS-001, OPS-005 |
| 22 | The cleaner's phone: job window, ready time, ticked checklist, "Photos 12 / 12" | OPS-002, EVIDENCE-001 |
| 23 | "Desert Casita · front door": the cleaner's and next guest's codes | OPS-005 |
| 24 | "Patio light out · task added for Dale" | OPS-004, OPS-002 |
| 25 | "Cabin finds a new cleaner" / "Asked 3 nearby cleaners · Ana Diaz accepted" | AGENT-001, OPS-001 |
| 26 | "resets the door codes" | AGENT-001, OPS-005 |
| 27 | "settles it with the guest before she arrives" / "Offered 10% off her next stay" | AGENT-001, AGENT-003, AGENT-006, WEB-005 |
| 28 | "Checklist 18 / 18 · photos 14 / 14" / "Lake Loft ready" / "Resolved 3:32 pm" | AGENT-001, EVIDENCE-001, OPS-003 |
| 29 | "Cost to owner $0.00" | AGENT-001, FIN-001 |
| 30 | "All five homes ready for Saturday" | OPS-008, OPS-003 |
| 31 | "Airbnb's payout matches Megan's stay to the cent" | FIN-002 |
| 32 | The owner's October statement and its arithmetic | FIN-003, FIN-004 |
| 33 | "QuickBooks · synced Oct 31" | FIN-007 |
| 34 | "Owner portal · Karen viewed Nov 1" | FIN-005, AUDIT-001 |
| 35 | "Lodging tax 9% · $172.44 · filed Nov 1" | FIN-008 |
| 36 | "Your own booking site takes the payment" / "Pay … Powered by Stripe" | WEB-001, PAY-001 |
| 37 | "the rental agreement" | WEB-003, WEB-001 |
| 38 | "the ID check" | WEB-004, WEB-001 |
| 39 | "the damage deposit" / "held, not charged" | PAY-003, WEB-001 |
| 40 | Checkout lines: nights, cleaning fee, lodging tax 9%, total | RES-004, FIN-008 |
| 41 | "Returning guest 10%" / "Welcome back, Megan" | GUEST-001, WEB-005 |
| 42 | "Jul 10–14 · closed on Airbnb, Vrbo, Booking.com" | SYNC-006, SYNC-002, SYNC-003, SYNC-004, SYNC-011 |
| 43 | "No channel fee" | WEB-001, PAY-001 |
| 44 | "Move from an existing reservation system" | MIGRATE-002, MIGRATE-003, MIGRATE-004 |
| 45 | "with listings, reservations, guests and owner balances" | MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-007 |
| 46 | "Your channel listings and reviews stay where they are" / listings reconnected | MIGRATE-007, SYNC-002, SYNC-003, SYNC-004, SYNC-011 |
| 47 | `rer install` / `rer setup` | RUNTIME-001, HTTP-001 |
| 48 | "Not yet: Expedia, hotel room types and built-in dynamic pricing." | BOUNDARY-001 |
| 49 | "Open source vacation rental software for hosts and managers" / "Free and open source, MIT licensed" | OPEN-001 |
| 50 | "Try the demo" | SITE-002 |

## Retired clauses

| ID | Now | Reason |
| --- | --- | --- |
| PROPERTY-001 | merged into CABIN-01 | The release summary or overlapping definition repeats the CABIN-01 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-02 | merged into SYNC-009 | The release summary or overlapping definition repeats the SYNC-009 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-03 | merged into WEB-001 | The release summary or overlapping definition repeats the WEB-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-04 | merged into OPS-001 | The release summary or overlapping definition repeats the OPS-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-05 | merged into EVIDENCE-001 | The release summary or overlapping definition repeats the EVIDENCE-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-06 | merged into OPS-003 | The release summary or overlapping definition repeats the OPS-003 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-07 | merged into MESSAGE-003 | The release summary or overlapping definition repeats the MESSAGE-003 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-08 | merged into AGENT-001 | The release summary or overlapping definition repeats the AGENT-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-09 | merged into FIN-004 | The release summary or overlapping definition repeats the FIN-004 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-10 | merged into FIN-007 | The release summary or overlapping definition repeats the FIN-007 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-11 | merged into MIGRATE-001 | The release summary or overlapping definition repeats the MIGRATE-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-12 | merged into CONTROL-002 | The release summary or overlapping definition repeats the CONTROL-002 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| CABIN-13 | merged into DATA-001 | The release summary or overlapping definition repeats the DATA-001 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| AUTH-001 | merged into AUTH-002 | The release summary or overlapping definition repeats the AUTH-002 capability; distinct outcomes are retained there and duplicate outcomes remain in their detailed clauses. |
| RUNTIME-002 | moved to Base BASE-INSTALL-001 | The shared installation duty owns the lifecycle; real clean-machine and owner-cloud receipts are retained as R-1 and R-2. |

## Status

Judged from the code and tests at commit `a124cd29ea9575bf4b077e4aef05088f7c2ef04a` (21 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 0 | 1 | 0 | 1 |
| Target and push further | 15 | 56 | 27 | 98 |
| All | 15 | 57 | 27 | 99 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `CABIN-01` | Homes, rental owners and effective management terms | published | partial | `src/cabin/people.ts`; `src/cabin/credentials.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs`; `src/cabin/properties/`; `src/cabin/homes.ts`; `src/cabin/direct/`; `src/cabin/statements.ts`; `src/cabin/ledger/store.ts`; `tests/property-register.test.mjs`; `docs/properties.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Both differently zoned properties are exercised through the property editor; Two homes retain their named rental owners and commissions; Manager and both cleaner invitations retain scoped property views; Deactivated cleaner cannot read on the next request. |
| `AUTH-002` | PMS roles and property-specific permissions | target | partial | `tests/cabin.test.mjs`; `tests/allocations.test.mjs`; `tests/cleaner-mobile.test.mjs`; `docs/team-access.md`; `src/cabin/credentials.ts`; `src/cabin/storage.ts`; `src/cabin/domain.ts`; `src/cabin/http.ts` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Every rental role has an allowed action; Cleaner financial mutation is refused without changing state. |
| `CONTROL-001` | Exact revisions and immutable publication | target | partial | `src/cabin/model.ts`; `src/cabin/storage.ts`; `src/cabin/calendars.ts`; `src/cabin/turnovers.ts`; `src/cabin/statements.ts`; `tests/cabin.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Stale calendar publication cannot replace the current revision; Stale statement and duplicate approval preserve the published statement; Changed booking and property terms prevent stale turnover or statement publication. |
| `CONTROL-002` | Scoped agent preparation and classified execution | target | partial | `src/cabin/credentials.ts`; `src/cabin/http.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Held-policy preparation, no pre-approval effect and revocation; All-autonomous classified publication and separate person-confirmation door. The old bearer tests prove preparation, refusal of publication and immediate revocation. Company-policy classification and execution under both held and all-autonomous policies are unasserted; the bearer implementation still hard-codes draft-only access. |
| `SYNC-001` | Reviewed calendar files remain honest snapshots | target | partial | `src/cabin/calendar-file.ts`; `src/cabin/calendars.ts`; `src/cabin/ui/calendar.ts`; `tests/cabin.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Stale baseline and malformed calendar are refused without changing bookings. |
| `SYNC-002` | Airbnb two-way channel management | target | partial | `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/calendars.ts`; `tests/cabin.test.mjs`; `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs` | Live iCal both ways: Cabin polls the listing's Airbnb calendar link on a 15–60 minute schedule and publishes a per-channel export link. No partner API, rates, restrictions, acknowledgments or co-host grants.  The new browser core is locally exercised only; live channel proof is pending. |
| `SYNC-003` | Vrbo two-way channel management | target | partial | `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/inventory.ts`; `tests/cabin.test.mjs`; `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs` | Vrbo calendar links are polled and Vrbo gets its own export link; Vrbo requests are checked in Cabin. No partner API, reservation lifecycle, rates, fees or acknowledgments.  The new browser core is locally exercised only; live channel proof is pending. |
| `SYNC-004` | Booking.com two-way channel management | target | partial | `src/cabin/channels.ts`; `src/cabin/ical-export.ts`; `src/cabin/calendars.ts`; `tests/cabin.test.mjs`; `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs` | Booking.com calendar links both ways (its feed marks every closed night alike, so they import as blocks); connectivity, rate plans, collection-method tracking and live acknowledgments do not exist.  The new browser core is locally exercised only; live channel proof is pending. |
| `SYNC-005` | Listing content and distribution | target | missing |  | No implementing flow in the audited tree. |
| `SYNC-006` | Inventory holds, measured closure latency and double-booking prevention | target | partial | `src/cabin/inventory.ts`; `src/cabin/storage.ts`; `src/cabin/ical-export.ts`; `src/cabin/ui/calendar-grid.ts`; `tests/cabin.test.mjs`; `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs` | Every stay, hold and block takes its unit/nights; overlapping and concurrent requests cannot both hold a night (version-guarded commits) and export links reflect each change on the next read. No API channel submission or acknowledgment timing, breach alerts, stop-sell or recovery cases; polled iCal collisions are kept and shown, not assigned.  The new browser core is locally exercised only; live channel proof is pending. |
| `SYNC-007` | Inspectable sync failures and safe recovery | target | partial | `src/cabin/channels.ts`; `src/cabin/ui/channels.ts`; `tests/cabin.test.mjs`; `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs` | Each calendar link shows last success, last change, next poll and its error; a failed read goes stale, keeps its nights and recovers on the next good read. No provider events, throttling, uncertain-write reconciliation or assigned exceptions.  The new browser core is locally exercised only; live channel proof is pending. |
| `SYNC-008` | Inquiries, booking requests, special offers and alterations | target | partial | `src/cabin/inventory.ts`; `src/cabin/ui/requests.ts`; `tests/cabin.test.mjs` | Requests taken in Cabin are declined with the overlapping reservation named, or held; no inquiry states, channel deadlines, offers, alterations or channel-side answers (partner APIs). |
| `SYNC-009` | Automatic iCal sync for channels without an API | target | partial | `src/cabin/channels.ts`; `src/cabin/calendars.ts`; `src/cabin/ical-export.ts`; `src/cabin/ui/channels.ts`; `tests/calendars-sync.test.mjs`; `docs/channel-calendars.md`; `src/cabin/inventory.ts`; `tests/cabin.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Applied polling occurs within the configured interval; A direct reservation appears in the exported unit calendar within 60 seconds. |
| `SYNC-010` | Multiple connected accounts per channel and Airbnb co-hosting | target | missing |  | No implementing flow in the audited tree. |
| `SYNC-011` | Channel agents in the host's own accounts | target | partial | `src/cabin/channel-agent/`; `scripts/channel-agent/`; `tests/channel-agent.test.mjs`; `docs/channel-agent.md` | Local calendar and source-table reading slices connect isolated granted sessions, preserve native reservations/inbox/payouts, log who/what/when with encrypted screenshots, and stop for CAPTCHA/2FA/terms. Risk/session disclosures, listing identity, replay/revision guards, paid-only settlement imports, erasure and inactive restore are locally exercised with synthetic pages. Exact-approved browser replies, real authenticated layouts and all three live host-account acceptance journeys remain unproven. |
| `RES-001` | Portfolio calendar with operational context | target | partial | `src/cabin/ui/calendar.ts`; `src/cabin/ui/calendar-grid.ts`; `src/cabin/ui/calendar-state.ts`; `src/cabin/ui/calendar-detail.ts`; `public/calendar.css`; `tests/calendar.test.mjs`; `docs/portfolio-calendar.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: The same calendar source drill-down works on desktop and phone. |
| `RES-002` | Complete reservation lifecycle | target | done | `src/cabin/reservations/`; `src/cabin/calendars.ts`; `src/cabin/agreements/records.ts`; `tests/reservations.test.mjs`; `tests/direct.test.mjs`; `tests/turnovers.test.mjs`; `docs/reservation-lifecycle.md` |  |
| `RES-003` | Owner stays and maintenance blocks | target | partial | `src/cabin/blocks.ts`; `src/cabin/inventory.ts`; `src/cabin/owners/`; `src/cabin/dispatch.ts`; `src/cabin/readiness.ts`; `src/cabin/ui/blocks.ts`; `migrations/core/0030_owner_blocks.sql`; `tests/owners.test.mjs`; `docs/owner-blocks.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: The resulting calendar state is read after cancellation. |
| `RES-004` | Stay rules, fees and cancellation policies | target | partial | `tests/direct.test.mjs`; `tests/quotes-browser.test.mjs`; `tests/direct-rules-browser.mjs`; `docs/direct-bookings.md` | Native quotes and direct checkout support dated seasonal and weekday rates, notice, booking windows and preparation buffers alongside the existing stay limits, gaps, occupancy, cleaning and extra-guest fees. Saved cancellation terms already exist and remain frozen. Still open: arrival and departure restrictions, pet fees, effective-dated cancellation policy selection, inclusive fee and tax options, and consistent OTA rate and restriction publication with named unsupported restrictions and actual accepted channel readback. Authorized Airbnb, Vrbo and Booking.com host listings and sessions remain an external dependency; synthetic edges do not prove live publication. Per-channel adjustments and length discounts belong to PRICE-002. |
| `RES-005` | Linked rooms and whole-property inventory | target | partial | `tests/cabin.test.mjs`; `tests/quotes-browser.test.mjs`; `tests/channel-agent.test.mjs`; `tests/linked-channel-browser.mjs`; `tests/quotes-archive.test.mjs`; `docs/shared-inventory.md` | Native physical-unit inventory is built. Still requires an authorized actual OTA room sale and cancellation, whole-home sale, accepted room closures and reconciled acknowledgments from every connected channel. Synthetic source calendars, browser edges and exports do not prove those receipts. Interchangeable units require explicit assignment before booking. |
| `RES-006` | Quotes and conversion to a reserved stay | target | done | `src/cabin/reservations/quotes.ts`; `src/cabin/reservations/quotes-ui.ts`; `src/cabin/direct/checkout.ts`; `tests/reservations.test.mjs`; `tests/quotes-browser.test.mjs`; `tests/quotes-archive.test.mjs`; `docs/reservation-quotes.md` |  |
| `PRICE-001` | Revenue planner and dynamic pricing connections | target | missing |  | No implementing flow in the audited tree. |
| `PRICE-002` | Per-channel markups and length-of-stay discounts | target | missing |  | No implementing flow in the audited tree. |
| `PRICE-003` | One rate sent to every channel | target | missing |  | No rates, channel price publication, read-back or drift exceptions exist. |
| `WEB-001` | Branded direct-booking website | target | partial | `src/cabin/website/`; `src/cabin/direct/`; `src/cabin/ui/direct.ts`; `migrations/core/0036_booking_website.sql`; `tests/website.test.mjs`; `tests/direct.test.mjs`; `tests/archive.test.mjs`; `docs/booking-website.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Booking at both widths retains the exact advertised total and terms; Checkout before check-in is refused; Capture and release retain the entered reason in read-back. |
| `WEB-002` | Embeddable booking engine | target | done | `src/cabin/website/embed.ts`; `src/cabin/website/store.ts`; `src/cabin/website/ui.ts`; `src/cabin/direct/http.ts`; `src/cabin/direct/checkout.ts`; `tests/website.test.mjs`; `tests/website-browser.test.mjs`; `docs/booking-website.md` |  |
| `WEB-003` | Signed rental agreements | target | done | `src/cabin/agreements/`; `src/cabin/direct/`; `src/cabin/ui/direct.ts`; `src/cabin/dispatch.ts`; `src/cabin/guest.ts`; `src/cabin/inbox/deliver.ts`; `tests/direct.test.mjs`; `docs/rental-agreements.md` |  |
| `WEB-004` | Guest identity verification | target | done | `src/cabin/verification/`; `src/cabin/direct/`; `src/cabin/codes.ts`; `src/cabin/agreements/records.ts`; `src/cabin/guest.ts`; `src/cabin/audit/privacy.ts`; `migrations/core/0031_verification.sql`; `tests/direct.test.mjs`; `docs/identity-verification.md` |  |
| `WEB-005` | Promotions, upsells and gap-night offers | target | partial | `src/cabin/promotions/`; `src/cabin/guests/offers.ts`; `src/cabin/direct/`; `src/cabin/finance/import.ts`; `tests/promotions.test.mjs`; `tests/guests.test.mjs`; `tests/direct.test.mjs`; `docs/promotions.md`; `docs/remaining-dependencies.md` | Scoped coupons and returning rates; signed paid gap, early/late and extra supplements; live eligibility, inventory, cleaner capacity, consent, contribution and frozen owner allocation checks. Durable Stripe reconciliation updates the original reservation, balance, work, messages, access, exports and ledger; cancellation/refunds restore prior terms. Hosted USD 218 gap and USD 54.50 early-arrival payments/refunds, real authenticated offer/receipt/refund mail, cleaner conflict refusal and 1440/390 operator/guest journeys proven. Full owner-statement acceptance remains unproven: monthly close correctly refused missing original-stay settlement records, and the supplied Australian Stripe account settles AUD rather than eligible USD payouts. Route tests cover source-backed statement allocation at the provider network edge. Live OTA/device acknowledgments retain SYNC/OPS prerequisites. |
| `PAY-001` | Processor-backed USD checkout and manual payments | target | partial | `src/cabin/direct/`; `src/cabin/ui/direct.ts`; `tests/direct.test.mjs`; `docs/direct-bookings.md` | Stripe-hosted USD test-card checkout, server reconciliation, saved mandate and distinct holds/paid/confirmed states. Real test-card browser acceptance plus network-edge route test. Source-backed cash and cleared-check receipts now post once through Payments with immutable provenance, explicit actual-receipt confirmation and correct reservation balances: src/cabin/direct/manual-receipts.ts; tests/direct.test.mjs — source-backed cash and cleared-check receipts post once, retain evidence and reduce only the correct outstanding balance; tests/collection-browser.mjs at 1440/390. US ACH pending/returned proof needs a US Stripe test account with ACH enabled and live-mode authority. One test-mode held-key us_bank_account probe verified country US but returned HTTP 400 for the removed payment_method_types parameter (req_CPx0gLKmzR4cI6, 23 October 2026); ACH capability is unproved and the single-probe authorization is exhausted. docs/ach-probe.md records the exact blocker; no live-mode request was made. |
| `PAY-002` | Scheduled collection and payment follow-up | target | done | `tests/direct.test.mjs`; `tests/collection-support.mjs`; `tests/collection-consent-flow.mjs`; `tests/collection-browser.mjs`; `tests/collection-stripe.mjs`; `docs/scheduled-collection.md` |  |
| `PAY-003` | Damage deposits, refunds and cancellation settlement | target | partial | `src/cabin/direct/`; `src/cabin/ui/direct.ts`; `src/cabin/ledger/`; `src/cabin/reservations/finance.ts`; `src/cabin/taxes/direct.ts`; `tests/direct.test.mjs`; `docs/direct-bookings.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Partial evidenced capture is read back with the retained reason; Every processor callback replay preserves each captured, refunded and released outcome; No-claim checkout releases the authorization within the configured window. |
| `PAY-004` | Protection partners and chargeback casework | target | missing |  | No implementing flow in the audited tree. |
| `PAY-005` | Booking.com virtual credit cards | target | missing |  | No implementing flow in the audited tree. Inherits PAY-002's schedule, current authority, receipt and reconciliation; its channel card intake and provider acceptance remain account-blocked. |
| `PAY-006` | Booking.com property-collect guest cards | target | missing |  | No implementing flow in the audited tree. Inherits PAY-002's schedule, current authority, receipt and reconciliation; its channel card intake and provider acceptance remain account-blocked. |
| `GUEST-001` | Guest profiles and repeat-stay context | target | done | `src/cabin/guests/`; `src/cabin/inbox/threads.ts`; `src/cabin/direct/`; `src/cabin/audit/privacy.ts`; `src/cabin/privacy.ts`; `tests/guests.test.mjs`; `tests/inbox.test.mjs`; `docs/guests.md` |  |
| `MESSAGE-001` | Unified channel, SMS, email and WhatsApp inbox | target | partial | `src/cabin/inbox/threads.ts`; `src/cabin/inbox/inbound.ts`; `src/cabin/inbox/deliver.ts`; `src/cabin/inbox/adapters/twilio.ts`; `src/cabin/inbox/adapters/booking.ts`; `src/cabin/ui/inbox.ts`; `tests/inbox.test.mjs` | One thread per guest, keyed by the email (else phone) on their stays, joins every stay from any channel or direct, guest email routed to the install's address (Reply-To honored, quoted history left out, other addresses refused unread), the host's replies by email threaded under the guest's message, and submitted, sent, suppressed, unavailable and failed states. Twilio texts and Booking.com messages run through adapters tested only against documented-shape fixtures: texting waits on the owner's US A2P registration and Booking.com on a connectivity partner account, and the page says so. Airbnb and Vrbo messaging, WhatsApp, attachments, inquiry and alteration actions are absent. |
| `MESSAGE-002` | Team routing and response accountability | target | partial | `src/cabin/inbox/team/`; `src/cabin/inbox/commands.ts`; `src/cabin/ui/inbox.ts`; `src/cabin/storage.ts`; `tests/replies.test.mjs`; `docs/inbox.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Interrupted message submission reconciles across restart without duplicate external effect. |
| `MESSAGE-003` | Lifecycle messaging and post-stay follow-up | target | partial | `src/cabin/inbox/`; `src/cabin/ui/inbox.ts`; `tests/lifecycle.test.mjs`; `tests/inbox.test.mjs`; `docs/lifecycle-messages.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: A message due across actual restart meets the same due-time limit. |
| `MESSAGE-004` | Source-grounded AI replies with controlled sending | target | partial | `src/cabin/inbox/`; `tests/replies.test.mjs`; `tests/inbox.test.mjs`; `docs/inbox.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Held-policy reply stays unsent past due time until exact approval; All-autonomous policy computes external, money and commitment for the relevant replies. Cited tests assert source-grounded drafts, exact person-sent replies, a narrow automatic rule and refusal of unsupported promises. The shared company-policy decision and external/money/commitment computations under both policies are unasserted. |
| `GUEST-002` | Guest check-in and stay portal | target | done | `tests/guest-portal.test.mjs`; `tests/promotions.test.mjs`; `tests/website-browser.test.mjs`; `tests/archive.test.mjs`; `docs/guest-portal.md` |  |
| `GUEST-003` | Reviews and consented repeat-guest marketing | target | missing |  | No implementing flow in the audited tree. |
| `GUEST-004` | Automated host reviews of Airbnb guests | target | missing |  | No implementing flow in the audited tree. |
| `OPS-001` | Reservation-triggered turnover dispatch | target | partial | `src/cabin/dispatch.ts`; `src/cabin/dispatch/`; `src/cabin/turnovers.ts`; `src/cabin/homes.ts`; `src/cabin/settle.ts`; `tests/dispatch.test.mjs`; `tests/turnovers.test.mjs`; `docs/turnover-dispatch.md`; `src/cabin/codes.ts`; `src/cabin/notices.ts` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: No duplicate payable work is manufactured on cancellation. |
| `EVIDENCE-001` | Private immutable cleaner completion evidence | target | partial | `src/cabin/turnovers.ts`; `src/cabin/photos.ts`; `src/cabin/domain.ts`; `tests/cabin.test.mjs`; `tests/turnovers.test.mjs`; `src/cabin/turnover-window.ts` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Missing checklist items and malformed images are refused without effect; Duplicate completion is refused with no second completion. |
| `OPS-002` | Cleaner mobile work with reliable uploads | target | done | `src/cabin/ui/turnovers.ts`; `src/cabin/turnovers.ts`; `src/cabin/maintenance.ts`; `public/cleaner-drafts.js`; `public/cleaner-draft-store.js`; `public/photo-upload.js`; `tests/cleaner-mobile.test.mjs`; `tests/turnovers.test.mjs`; `docs/cleaner-mobile.md` |  |
| `OPS-003` | Readiness is verified before arrival | target | partial | `src/cabin/readiness.ts`; `src/cabin/readiness/`; `src/cabin/ui/readiness.ts`; `tests/readiness.test.mjs`; `tests/turnovers.test.mjs`; `tests/replies.test.mjs`; `tests/recovery.test.mjs`; `docs/readiness.md`; `src/cabin/maintenance.ts` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: The failed restock item is separately read before resolution; The manager and guest-service team both read the same final readiness evidence. |
| `OPS-004` | Maintenance, inspections and work-order expenses | target | partial | `src/cabin/work-orders/`; `src/cabin/maintenance.ts`; `src/cabin/ui/maintenance.ts`; `src/cabin/guest.ts`; `src/cabin/ledger/store.ts`; `tests/work-orders.test.mjs`; `tests/turnovers.test.mjs`; `tests/readiness.test.mjs`; `docs/maintenance.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Approved quote and invoice are both read back with their exact evidence; The new task retains both the original photo and turnover link. |
| `OPS-005` | Stay-bound smart-lock automation | target | partial | `src/cabin/codes.ts`; `src/cabin/dispatch.ts`; `src/cabin/locks.ts`; `src/cabin/guest.ts`; `tests/turnovers.test.mjs` | Every confirmed stay gets a guest code valid check-in to check-out and each assigned turnover a cleaner code for its window, without staff action; windows move with the stay and codes are revoked on cancellation or reassignment; the guest sees theirs on a secret stay page. Codes are pushed through a Seam adapter tested only against Seam-shaped fixtures: the owner's lock account is not connected, so codes are set by hand and the page says so (unavailable on RER Managed until its provider relay). A human may approve early arrival from the inbox only after verified readiness, moving the guest and preceding cleaner windows with one confirmation (src/cabin/inbox/arrival.ts, tests/replies.test.mjs). No device state checks, battery/offline alerts or backup entry plans. Held-key read-only discovery on 23 October confirms one sandbox Schlage Encode; the provider list has no RemoteLock entry, so the required eight-family journey needs an authorized RemoteLock-capable connection outside this held route. Metadata is not provisioning proof; docs/lock-sandbox.md. |
| `OPS-006` | Breezeway specialist operations handoff | target | missing |  | No implementing flow in the audited tree. |
| `OPS-007` | Hub-dependent and offline-PIN locks | target | missing |  | No implementing flow in the audited tree. Whole-clause blocker: an authorized Schlage Sense provider/device/hub path; Seam lists Sense as unavailable, so the held sandbox cannot prove the named hub leg. Igloohome capability alone cannot complete it. docs/lock-sandbox.md. |
| `OPS-008` | A day board of departures, arrivals and readiness | target | partial | `src/cabin/ui/departures.ts`; `src/cabin/ui/requests.ts`; `src/cabin/ui/readiness.ts`; `src/cabin/readiness.ts`; `src/cabin/ui/turnovers.ts`; `src/cabin/ui/calendar.ts`; `tests/readiness.test.mjs`; `tests/readiness-browser.test.mjs`; `tests/turnovers.test.mjs`; `tests/cabin.test.mjs`; `docs/day-board.md` | The chosen property-local day now lists all confirmed stay departures, scheduled checkout from the reservation/home, current cleaner/staff checkout time and source, explicit unknowns and source links even without another arrival or turnover. Existing readiness cards show the next arrival, cleaner/window, locally generated code state and photos with the readiness summary. Multiple Eastern/Hawaii homes, unrecorded departures, cancellations, role limits and source links are asserted; desktop/phone day selection and navigation exercised at 1440/390. Selected-day declined non-direct stay requests now retain their historical reasons and exact request/overlap source links, including records older than the recent-request window. These are explicitly Cabin decisions, not channel acknowledgments. Guest-portal/lock-event checkout, provider-confirmed access state, channel-side declined/expired outcomes and the full five-home integrated acceptance journey remain open. Whole-clause blocker: real OTA accounts for externally acknowledged declined/expired decisions and the provider-confirmed access acceptance, not just local request records; docs/lock-sandbox.md. |
| `FIN-001` | Reservation-linked USD trust subledgers | target | partial | `src/cabin/ledger/`; `src/cabin/ui/ledger.ts`; `migrations/core/0022_ledger.sql`; `tests/ledger.test.mjs`; `tests/recovery.test.mjs`; `docs/trust-ledger.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: The operator drills every named balance to its source transaction. |
| `FIN-002` | Payout reconciliation per reservation | target | partial | `src/cabin/finance/`; `tests/finance.test.mjs`; `tests/direct.test.mjs` | Airbnb/Vrbo USD payout CSVs match stays with actual imported fees and unmatched review. Stripe test automatic USD payouts match direct payment intents; live USD acceptance still needs an eligible automatic USD payout (fleet test account settles AUD). Partner APIs, FX, bank receipt and full exception closure remain later. |
| `FIN-003` | Management agreements and expense allocation | target | done | `src/cabin/properties/terms.ts`; `src/cabin/finance/allocation-commands.ts`; `src/cabin/finance/cost-commands.ts`; `src/cabin/finance/allocation-statements.ts`; `src/cabin/work-orders/expenses.ts`; `src/cabin/blocks.ts`; `tests/allocations.test.mjs`; `docs/management-allocations.md` |  |
| `FIN-004` | Reconciled frozen owner statements and monthly delivery | target | partial | `src/cabin/finance/month-close.ts`; `src/cabin/finance/close-schedule.ts`; `src/cabin/statements.ts`; `src/cabin/owners/sections.ts`; `src/cabin/owners/http.ts`; `tests/month-close.test.mjs`; `docs/monthly-close.md`; `docs/statement-settlements.md`; `src/cabin/finance/`; `src/cabin/owners/`; `tests/finance.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Missing payout prevents close until its source arrives; All four providers’ received settlements are included exactly once; Every individual statement line reconciles to the ledger. |
| `FIN-005` | Rental-owner portal and personal stays | target | done | `src/cabin/owners/`; `src/cabin/ui/owners-operations.ts`; `migrations/core/0028_owner_operations.sql`; `tests/owners.test.mjs`; `tests/finance.test.mjs`; `docs/statements.md` |  |
| `FIN-006` | Trust accounts, bank reconciliation and approved ACH distributions | target | partial | `src/cabin/finance/banking/`; `tests/ledger.test.mjs`; `tests/banking-browser.mjs`; `tests/archive.test.mjs`; `tests/banking-archive.mjs`; `docs/trust-banking.md` | Source-backed bank imports and frozen bank/ledger/owner controls are implemented. Live bank-feed and complete two-account reconciliation proof remain open; separately reserved plans and actual ACH execution are FIN-010 and FIN-011. |
| `FIN-007` | QuickBooks Online accounting synchronization | target | partial | `tests/finance.test.mjs`; `tests/qbo-sandbox.mjs`; `evidence/fin-007-qbo-sandbox-2026-10-26.json`; `tests/qbo-browser.mjs`; `tests/archive.test.mjs`; `tests/qbo-archive.mjs`; `docs/statements.md`; `src/cabin/finance/books.ts`; `src/cabin/finance/pantry-posting.ts` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Month refund and expense values reconcile across every external line; Authorized QuickBooks CSV content is read back. |
| `FIN-008` | US occupancy, lodging and sales-tax obligations | target | partial | `src/cabin/taxes/`; `migrations/core/0029_taxes.sql`; `tests/taxes.test.mjs`; `docs/taxes.md`; `src/cabin/direct/`; `tests/direct.test.mjs` | Effective-dated monthly state/county/city obligations separate documented channel remittances from host liability. Source-led exemptions/refunds and paid direct receipt matching retain original levy evidence; host tax/payment records post to the trust ledger. Exact frozen reviews are sent separately to named accountant recipients, and human-recorded acknowledgment/rejection/payment documents remain distinct from mail acceptance. Hosted monthly review, freeze and authentic accountant-packet receipt exercised at 1440 and 390; no statutory filing/payment record invented. Real statutory partner filing/remittance, nonmonthly periods, differing taxable bases and automatic jurisdiction/rate lookup remain open. Released checkout still collects its configured state/county lines; the monthly workflow does not silently reprice existing receipts. |
| `FIN-009` | US owner and contractor tax reporting | target | missing |  | No implementing flow in the audited tree. |
| `REPORT-001` | Operational, revenue and owner performance reports | target | done | `src/cabin/reports/`; `docs/reports.md`; `tests/finance.test.mjs`; `tests/readiness-browser.test.mjs`; `tests/allocations.test.mjs`; `tests/promotions.test.mjs` |  |
| `REPORT-002` | Saved reports and scheduled sharing | target | done | `tests/finance.test.mjs`; `tests/allocations.test.mjs`; `tests/readiness-browser.test.mjs`; `docs/reports.md` |  |
| `API-001` | Documented API, webhooks and Zapier automation | target | partial | `src/cabin/http.ts`; `docs/commands.md`; `tests/cabin.test.mjs` | Versioned domain APIs, scoped application grants, signed durable webhooks and live Zapier consumption remain unshipped. Unpublished foundation work awaits publication tooling; an authorized Zapier account and receiver are also required. |
| `MIGRATE-001` | Reviewed property-register move-in | target | partial | `src/cabin/movein/csv.ts`; `src/cabin/movein/index.ts`; `src/cabin/movein/targets.ts`; `src/cabin/ui/movein.ts`; `tests/movein-register.test.mjs`; `tests/cabin.test.mjs`; `tests/archive.test.mjs`; `docs/move-in.md`; `src/cabin/movein/`; `tests/movein.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Changed fingerprint is refused without applying rows. |
| `MIGRATE-002` | Migration from reservation source A | target | partial | `./src/cabin/movein/providers/`; `src/cabin/movein/provider-import.ts`; `src/cabin/movein/provider-records.ts`; `docs/move-in-formats.md`; `tests/movein.test.mjs` | Documented CSV reports plus explicit supplementary owner terms, USD opening balances and iCal links; immutable preview, row refusals, guarded apply and undo and totals sign-off. API response adapters use recorded synthetic fixtures only. Live API credentials, threads and attachments, fees, rules, tasks and settlement history, full channel account and co-host mappings and inaccessible source history remain open. |
| `MIGRATE-003` | Migration from reservation source B | target | partial | `./src/cabin/movein/providers/`; `src/cabin/movein/provider-import.ts`; `src/cabin/movein/provider-records.ts`; `docs/move-in-formats.md`; `tests/movein.test.mjs` | Documented CSV reports plus explicit supplementary owner terms, USD opening balances and iCal links; immutable preview, row refusals, guarded apply and undo and totals sign-off. API response adapters use recorded synthetic fixtures only. Live API credentials, threads and attachments, fees, rules, tasks and settlement history, full channel account and co-host mappings and inaccessible source history remain open. |
| `MIGRATE-004` | Migration from reservation source C | target | partial | `./src/cabin/movein/providers/`; `src/cabin/movein/provider-import.ts`; `src/cabin/movein/provider-records.ts`; `docs/move-in-formats.md`; `tests/movein.test.mjs` | Documented CSV reports plus explicit supplementary owner terms, USD opening balances and iCal links; immutable preview, row refusals, guarded apply and undo and totals sign-off. API response adapters use recorded synthetic fixtures only. Live API credentials, threads and attachments, fees, rules, tasks and settlement history, full channel account and co-host mappings and inaccessible source history remain open. |
| `MIGRATE-005` | Migration from reservation source D | target | missing |  | No implementing flow in the audited tree. |
| `MIGRATE-006` | Switching from automation and field-operations sources | target | missing |  | No implementing flow in the audited tree. |
| `MIGRATE-007` | CSV history, cutover rehearsal and accountable go-live | target | partial | `src/cabin/movein/reconcile.ts`; `src/cabin/movein/provider-import.ts`; `src/cabin/ui/movein.ts`; `tests/movein.test.mjs` | Source versus saved reservation counts, future nights and opening owner balances; owner sign-off requires every difference and refused row accounted for. Stable listing IDs retain iCal links and imported holds; undo preserves edited/dependent data by refusing reversal. Full vendor history, live API parallel-run cutover and channel partner account reconnection remain open. |
| `MOBILE-001` | Native manager and field-team apps | target | missing |  | No implementing flow in the audited tree. |
| `INTERFACE-001` | Responsive accessible and honest operations | target | partial | `tests/readiness-browser.test.mjs`; `tests/cleaner-mobile.test.mjs`; `tests/interface-accessibility.mjs`; `tests/inbox.test.mjs`; `tests/interface-scale.mjs`; `docs/interface.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Calendar, photo and statement journeys run at both widths with keyboard error recovery; The complete target booking and inbox journeys pass. |
| `DATA-001` | Complete portable product records and safe restore | target | partial | `src/cabin/archive/`; `src/cabin/archive-policy.mjs`; `scripts/backup/`; `scripts/backup-hosted.mjs`; `tests/archive.test.mjs`; `tests/hosted-backup.test.mjs`; `docs/portable-records.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Damaged and populated destinations are refused without partial data; Restored jobs and connections remain inactive until exact reauthorization. |
| `DATA-002` | Erasure, retention and later-journal fencing | target | partial | `src/cabin/privacy/`; `src/cabin/privacy.ts`; `src/cabin/audit/privacy.ts`; `src/cabin/verification/retention.ts`; `migrations/core/0034_erasure.sql`; `tests/privacy.test.mjs`; `tests/archive.test.mjs`; `docs/erasure.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Later erasure journal fences old restore without partial writes. |
| `DATA-003` | Every booking, guest and payout stays in the owner’s installation | target | done | `src/cabin/connections/`; `src/cabin/storage.ts`; `src/cabin/photos.ts`; `tests/data-custody.test.mjs`; `docs/data-custody.md` |  |
| `AUDIT-001` | Permanent attributable business and automation history | target | partial | `src/cabin/audit/`; `src/cabin/ui/activity.ts`; `migrations/core/0023_audit.sql`; `tests/audit.test.mjs`; `docs/activity.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Human, agent, provider, lock, refund and statement outcomes are each present. |
| `SECURITY-001` | Provider custody and declared external data | target | partial | `src/cabin/connections/`; `src/cabin/inbox/reply-sources.ts`; `src/cabin/inbox/ai.ts`; `src/cabin/archive/transform.mjs`; `migrations/core/0035_provider_security.sql`; `tests/security.test.mjs`; `docs/provider-security.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Logs, exports and all agent outputs omit every named sensitive field. |
| `HTTP-001` | Real Worker health and document dispatch | target | done | `src/server.ts`; `src/base/deployment-health.ts`; `tests/runtime.mjs` |  |
| `RUNTIME-001` | Owner-run lifecycle and durable background work | target | partial | `tests/launch.test.mjs`; `tests/archive.test.mjs`; `tests/direct.test.mjs`; `tests/collection-support.mjs`; `tests/recovery-authority.test.mjs`; `tests/lifecycle.test.mjs`; `tests/message-interruption-support.mjs`; `tests/channel-agent.test.mjs`; `tests/finance.test.mjs`; `tests/recovery-browser.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Every payment, send and lock boundary reconciles without duplicate external effects. |
| `AGENT-001` | Recover a disrupted stay through verified readiness | push-further | partial | `tests/recovery.test.mjs`; `tests/recovery-alternative-support.mjs`; `tests/channel-agent.test.mjs`; `tests/recovery-authority.test.mjs`; `tests/recovery-browser.mjs`; `tests/recovery-sandbox.mjs`; `tests/recovery-mail-sandbox.mjs`; `src/cabin/recovery/` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Cleaner cancellation and failed lock are followed through the same recovery case; Held-policy exact budget and relocation produce backup acceptance, photos and guest confirmation; New code and corrected owner net are reconciled; Interrupted held-policy work preserves every unresolved step and balance. Collision, approved native relocation and rescheduling, inspected preparation, guest confirmation, recurrence and original-owner adjustment are implemented and asserted. Channel-controlled or paid terms remain explicitly escalated until accepted at their source; pending channel outcomes and previous access removal prevent closure. Production SendGrid readiness mail is received and authenticated. Latest isolated Kwikset sandbox run confirmed initial programming and previous-code removal, then assigned the replacement failure because no matching provider code was visible; it never repeated the uncertain create. Remaining live sandbox proof: verified replacement programming and complete native recovery closure. All owned codes and the test connection were removed. |
| `AGENT-002` | Close reservation-to-owner financial exceptions | push-further | partial | `src/cabin/finance/exceptions/`; `docs/financial-exceptions.md`; `tests/ledger.test.mjs`; `tests/financial-exceptions-browser.mjs`; `tests/archive.test.mjs`; `tests/financial-exceptions-archive.mjs` | Source-linked native cases and manually obtained provider records now support exact correction of unallocated native payout postings, preserving historical owner and entity and frozen statements. Legacy imported frozen statements now enter exact source review and receive linked later-period adjustments without rewriting their files; unmatched bank statements cannot resolve a bank-record request. Remaining: automatic provider-record pursuit, allocated and transferred correction workflows, legacy statement commission and paid costs not posted to the ledger, processor-funded corrections, full source and bank completeness and verified actual owner distribution. FIN-002 and FIN-006 external settlement and authorized transfer dependencies remain; local matching and unexecuted plans are not distribution evidence. BLOCKED for actual distribution by FIN-006: a selected licensed US payout partner, authorized funded trust accounts, verified owner and vendor payees and fresh execution authority are not held. FIN-002 still needs complete eligible source settlements and actual bank receipts. |
| `AGENT-003` | Resolve guest issues through accepted field work | push-further | partial | `src/cabin/issues/`; `src/cabin/work-orders/`; `src/cabin/inbox/inbound.ts`; `src/cabin/guest.ts`; `tests/issues.test.mjs`; `tests/work-orders.test.mjs`; `tests/recovery.test.mjs`; `docs/guest-issues.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Inspected field work resolves both access failure and leaking appliance; Held company policy decides the exact dispatch classes. |
| `AGENT-004` | Optimize profitable occupancy without breaking readiness | push-further | missing |  | No implementing flow in the audited tree. |
| `AGENT-005` | Source-linked portfolio questions and actionable follow-up | push-further | partial | `src/cabin/questions/`; `docs/portfolio-questions.md`; `tests/finance.test.mjs`; `tests/allocations.test.mjs`; `tests/readiness-browser.test.mjs` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Held company policy computes and decides the investigation class. |
| `AGENT-006` | Bounded action authority and durable agent cases | push-further | partial | `src/cabin/recovery/`; `src/cabin/connections/mail.ts`; `src/cabin/locks.ts`; `src/cabin/ui/recovery.ts`; `tests/recovery-authority.test.mjs`; `tests/recovery.test.mjs`; `docs/recovery-authority.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Changed recipient or booking refuses the old held action revision; Company policy cap and injected guest instructions cannot widen authority; The named company policy makes $75 autonomous and holds $150 for exact approval. |
| `BOUNDARY-001` | A separate complete vacation-rental product with named partners | target | missing |  | No implementing flow in the audited tree. |
| `OPEN-001` | Free and open source under the MIT license | target | partial | `LICENSE`; `package.json`; `src/cabin/people.ts`; `src/cabin/connections/store.ts`; `src/cabin/connections/ui.ts`; `src/cabin/connections/security-ui.ts`; `docs/free-source.md` | Cited evidence asserts the outcomes marked asserted in DONE-AUDIT. Unasserted: Public source licence and declared package licence are MIT; Installation needs no author account or key; Every product area supports 40 homes and 25 staff without an author payment gate; Provider cost and its source are shown before activation. |
| `SITE-002` | Hosted vacation-rental demo | target | partial | `src/demo.ts`; `src/cabin/demo/`; `src/modules/demo/`; `deploy-demo.json`; `.github/workflows/run-demo.yml`; `src/site/shell/links.ts`; `tests/demo.test.mjs` | Fictional rental data, demo effect suppression, a hosted-demo workflow and a direct homepage demo URL exist. Public host availability, scheduled sandbox expiry with storage/log/backup erasure and the full isolated visitor journey are not established by the seed tests. |
| `FIN-010` | Exact internally reserved distribution plans | target | partial | `src/cabin/finance/banking/`; `tests/ledger.test.mjs`; `tests/banking-browser.mjs`; `tests/archive.test.mjs`; `tests/banking-archive.mjs`; `docs/trust-banking.md` | Bank reconciliation and internally reserved native-owner plans are implemented. Full exact payee/account/entity and net-liability proof must be judged; no actual execution is claimed. |
| `FIN-011` | Verified ACH execution and returned distributions | target | missing | `src/cabin/finance/banking/`; `tests/ledger.test.mjs`; `tests/banking-browser.mjs`; `tests/archive.test.mjs`; `tests/banking-archive.mjs`; `docs/trust-banking.md` | Licensed-partner approval, funded trust arrangement, verified payees, execution authority and actual pending/settled/failed/returned transfers, bank return evidence, restored liability and corrected owner statement are absent. Stripe checkout and Plaid read credentials convey no payout authority. |
| `SURFACE-001` | The rental action registry covers the contract | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-002` | Compute stay, exposure and financial classes | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-003` | Compute rental authority and regulated-data classes | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-004` | Rental record resources and change handoffs | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-005` | A stranger coordinator completes the seeded rental week | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-006` | Rental decisions retain exact source authority | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-007` | The rental overview reconciles the week | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
| `SURFACE-008` | Restore never reactivates rental authority | target | missing |  | The rental MCP adapter, computed classes and company-policy conformance journey for these outcomes are not implemented or asserted. |
