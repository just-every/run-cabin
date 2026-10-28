# Cabin rulings

### RL-1 — Channel computer use is the launch route

Date: 2026-10-19 · Ruler: owner · Governs: SYNC-011, SYNC-002, SYNC-003, SYNC-004

At launch, channel actions use computer use in the host’s own Airbnb, Booking.com and Vrbo accounts. Partner/API connectivity remains the broader target. Host consent does not confer channel permission; channel-specific terms, session custody, exact grants and person-only security/terms handoffs remain binding. The detailed source disclosures are in docs/channel-terms.md.

### RL-2 — Every provider family inherits interruption reconciliation

Date: 2026-10-22 · Ruler: ct · Governs: RUNTIME-001, SYNC-007, SYNC-011, MESSAGE-001, MESSAGE-002, OPS-005, OPS-007, REPORT-002

Each current or future channel, message, payment, lock and report job preserves claims, attempts and outcomes across restart. Interruption before or after provider acceptance requires source reconciliation or an explicit uncertain outcome, never blind repetition. Existing current-job proof does not complete future provider-family or live-account acceptance.

### RL-3 — Reservation payment mandates and portal verification

Date: 2026-10-21; payment refinement 2026-10-22 · Ruler: ct · Governs: GUEST-002, PAY-002, PAY-005, PAY-006

The guest portal link alone conveys no private reservation data. Verification is bound to the reservation’s saved email and the requesting browser, separate from identity verification and staff sessions. Revocation, expiry, cancellation, changed email, erasure or explicit session termination ends access. Restores require fresh verification.

Native guest-card schedules bind exact consent, saved reservation terms and Stripe-hosted setup. Changes invalidate consent except a human host amendment that only lowers the charge or defers the stay and due dates; a normalized unchanged verified email retains consent. Uncertain effects are reconciled before amendment or renewed consent. Failed follow-up remains assigned without charging; retry needs provider-confirmed zero receipt and exact renewed authority. Booking.com property-collect cards inherit that guest mandate; virtual cards instead follow their activation, expiry and loaded-amount limits. Detailed challenge, cookie and collection rules are retained in docs/workflow-semantics.md.

### RL-4 — Interim local financial corrections

Date: 2026-10-23 · Ruler: ct · Governs: AGENT-002, FIN-001

The interim installation-owner-only correction boundary permits exact local append-only corrections with reason and before/after evidence. It adds no accountant exposure, outbound request, refund, period reopening or payout authority. Actual distributions remain subject to the independently verified authority in RL-101; a local matched record or unexecuted plan is not a distribution.

### RL-101 — Reconciled distribution plans without premature ACH authority

Date: 2026-10-28 · Ruler: ct · Governs: FIN-006

Question: May scoped accountants reconcile accounts while the native owner approves only unexecuted, internally reserved distribution plans?

Default adopted/proposed: Current property/action-scoped accountants reconcile; native owner alone approves an exact unexecuted plan; no ACH submission or invented settlement; restored plans inactive.

Outcome: **adopt with rider** — Approve the proposed default subject to the precise conditions below.

Normative outcome: Approve that preparation boundary: reconciliation must conserve bank cash, immutable ledger attribution and each owner liability, and refuse unmatched/unassigned sources; owner approval binds exact payee/amount/account/entity and available funds net of reserves/taxes/other liabilities, reserves internally and creates no bank or ledger payout. Actual execution requires separately verified licensed-partner/payee/bank authority and a fresh exact execution approval; provider pending/settled/failed/returned evidence alone drives money outcomes.

Why and incumbent comparison: Guesty explicitly requires business/bank/payee setup for native ACH and maintains owner-ledger/disbursement controls. No common norm limits all reconciliation or payout planning to a native owner; this is a conservative current approval boundary, not a substitute for the full scoped accounting and ACH target. Stripe checkout or Plaid read credentials cannot imply payout rights.

Placement (one copy): State plan-versus-execution authority once in FIN-006 and cite the existing finance role/custody/closed-period rules.

Engineering/proof: Licensed-partner agreement, funded trust bank arrangement, verified payees/execution, real transfer returns and corrected statements remain provider/account/legal dependencies. This ruling makes no legal sign-off, spend, account purchase or live transfer.

Sources:
- [https://web2025.guesty.com/blog/whats-new-in-guesty-trust-accounting/](https://web2025.guesty.com/blog/whats-new-in-guesty-trust-accounting/) — Guesty ACH payouts require business verification and connected bank/payee setup and expose transfer status; its trust tools prevent overdrafts and preserve locked periods.
- [https://help.guesty.com/hc/en-gb/articles/9358130376477-Accounting-reports-Overview](https://help.guesty.com/hc/en-gb/articles/9358130376477-Accounting-reports-Overview) — Guesty distinguishes owner balances, deposit/ledger controls and disbursements connecting funds to underlying transactions.

Observed clauses and complete Status Gaps:

- FIN-006: CONTRACT.md:418; Status at line 798. Gap: Buildable bank model and reconciliation implemented. Conservative default ADOPTED: current scoped accountants reconcile; native owner alone approves unexecuted plans; no ACH egress or invented settlement. Pending ct approval of this boundary. Remaining: selected licensed US ACH partner approval and funded trust-account arrangement, verified owner/vendor payees and execution authority; real pending/settled/failed/returned transfers, bank evidence of a return, restored liability and corrected owner statement are unproved. Existing Stripe checkout and Plaid Transactions credentials do not authorize trust-bank ACH distributions.
