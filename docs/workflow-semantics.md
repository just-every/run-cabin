These specifications preserve the detailed rules accompanying the contract. The contract states the buyer outcomes; the company’s policy decides every agent call.

## AUTH-002

**Scope semantics:** Current scopes are the intersection of the explicitly selected properties and actions; installation-owner administration remains separate. Current native pages, JSON, exports/downloads, agent context and queued effects recheck these grants; connected device codes are revoked on offboarding. API-001 and MOBILE-001 inherit these property/action grants and offboarding checks when their doors ship.

## PAY-002

**Current implementation semantic (ct, 22 October 2026):** Native priced direct reservations use integer USD cents, an immediate deposit, optional installment and pre-arrival balance at the home's local arrival time. Guest-card schedules require exact consent through the verified reservation-email portal before Stripe-hosted card setup. Date, price, policy or property changes invalidate consent; started effects must be reconciled before amendment or renewed consent, and payments/attempts stay preserved. A human host amendment that only lowers an amount or defers the stay and its due dates retains consent, never charging more or sooner. Contact changes invalidate payment consent only when the normalized verified email changes. Failed/overdue follow-up continues as an assigned task and message while consent is invalid, never a charge; retry requires a provider-confirmed zero-received failure and human approval after renewed consent. Cancellation suppresses unstarted work while uncertain effects retain readback. This guest-card rule also binds PAY-006 property-collect cards when their intake ships. PAY-005 Booking.com virtual cards use their activation, expiry and loaded-amount limits rather than guest consent. Both inherit scheduling, authority, receipt and reconciliation; their source mandates remain unimplemented.

## FIN-006

**Distribution preparation (RL-101).** Accountants with current property/action grants designate USD trust/operating accounts for one home and a frozen legal entity, retaining institution and last four digits only. Source-backed bank CSVs, exact immutable journal attribution and signed-amount matches produce frozen bank/ledger/owner-liability controls without posting a second receipt. Unassigned journals and unmatched bank rows prevent reconciliation. Only the native installation owner approves an exact unexecuted distribution plan against that owner's reconciled cash and liability, excluding reserves, advances, taxes, other payables and other owners' money. Plans reserve internally, never submit ACH or post a distribution; an approved licensed partner, verified payee and fresh execution approval are prerequisites to actual movement. Restored plans are inactive history. RL-101 adopts this boundary with its execution-authority rider.

## GUEST-002

Link-holder identity (ct, 21 October 2026): the portal link alone never renders private details. An unverified holder sees only the home's public name, a masked hint of the saved address (its first character and the domain's first character) and "Send code". A verified session is required for reservation details and dates, guest names, tasks, guide, instructions, door code, offers, issue reporting, downloads and their JSON. "Send code" emails a one-use 6-digit code through the installation's existing mail provider to the reservation's own saved email (trimmed and lowercased; never another address merged into the guest profile). The code is bound to the browser that asked for it, valid for 10 minutes, stored only as a hash and consumed by the first correct entry. Five wrong entries lock that reservation's challenges for 15 minutes, and sends are limited to three per 15 minutes. The send shows "accepted by the mail provider" or "failed", never "delivered". A correct code starts a reservation-scoped guest session (HttpOnly, Secure, SameSite=Lax, host-only cookie) that is separate from staff, owner and cleaner sessions and reads only that reservation. The session ends at the earliest of: the link's own expiry; link replacement or revocation; cancellation; a change to the saved email; erasure of the guest or reservation; or staff ending guest sessions. A different browser must verify again. A stay with no saved email shows "Ask your host to add your email" and nothing private until staff record one, and that edit is audited. This is separate from WEB-004. The email check proves the holder controls the booking's address, and WEB-004's Stripe Identity or manual decision still gates door codes, locks and access messages on its own. Portal-started WEB-004 checks require a verified session. Challenges and sessions are never archived or restored, so a restore requires fresh verification, and erasure deletes them. Sends, verifications, lockouts and session ends enter AUDIT-001 history with a masked recipient and never the code.

## MESSAGE-002

Exact behavior. Staff are active managers; the owner acts as administrator. A guest message that arrives after the team settings are first saved opens a case on its thread. The most specific matching route assigns it (a home beats all homes, urgent beats any); a routed manager who has shifts and is off shift at the home's local time is replaced by whoever is on shift, and with nobody on shift the escalation manager takes it. A response deadline runs from the guest's unanswered message (urgent threads sooner than normal ones); the escalation manager is notified with the full context and again every repeat interval until a person accepts the thread. Only a person's sent reply answers a thread; scheduled messages, drafts and failed sends do not. A person replying, or who replied in the last two minutes, blocks another person's reply. Every future source of guest threads (MESSAGE-001 channel replies, SYNC-008 requests) inherits this routing before it ships.

## API-001

**Inherited authority:** API-001 carries AUTH-002 property/action grants and offboarding checks on its credentials, reads, mutations and queued work.

## MOBILE-001

**Inherited authority:** MOBILE-001 carries AUTH-002 property/action grants and offboarding checks on its credentials, reads, mutations and queued work.

## AGENT-005

**Question semantics:** Natural-language topics are grounded in the current REPORT-001 records; the visible property, end-exclusive dates, channel and accounting controls define the cohort. Net comparisons use the immediately preceding window of equal calendar-day length and reconcile gross, refunds, fees, commissions, owner expenses and tax to journal sources. Unknown readiness counts as risk. Answers distinguish the saved installation revision from provider freshness; absent, failed or more-than-60-minute-old calendar reads never establish live state. Unsupported questions remain explicitly ungrounded. A human-approved investigation binds the answer digest, source revision, filters, current property and action grants, and a named authorized assignee; it creates only an internal task. API-001 and MOBILE-001 inherit these question-scope, source and approval boundaries when exposing the same capability.

## REPORT-001

**Reporting semantics:** Date windows and checkout are end-exclusive in each home’s zone.

Occupancy counts distinct guest nights over calendar nights less distinct owner, maintenance and other blocks; channel/owner filters select the guest cohort while retaining those inventory blocks.

ADR uses known rental cents over priced guest nights; RevPAR uses the same rental cents over available nights, with missing prices explicit and cent remainders allocated to the earliest nights.

Booking dates are the first saved revision, not the latest amendment.

Financial rows use journal effective dates: cash shows recorded trust receipts/paid costs; accrual shows posted earning events/costs, with contractual rent, liability movements and cash movements labelled separately.

`docs/reports.md` states the precise event classification and reconciliation rules used by the code.

REPORT-002 and AGENT-005 inherit these report definitions, permitted source links and cutoff; INTERFACE-001 retains its own scale/performance obligation.


## Bearer credential custody

The legacy bearer and native-session transports are distinct. Keys are shown once, stored hashed, bound to the owner version, expiring and immediately revocable. Legacy tests record its former draft-only implementation; the target CONTROL-002 uses server-computed classes and the company’s policy for execution.
