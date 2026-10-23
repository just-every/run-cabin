Open **Trust ledger → Financial exception cases** to investigate one reservation’s split settlements, missing fees or later refunds. Each case retains its opening owner agreement and links the current reservation revision, frozen owner agreement, imported settlements, immutable journals, bank matches and approved statements. Amounts are integer USD cents. Missing records never supply an estimated amount.

Track the record to obtain and the person responsible for obtaining it. This records human work; Cabin does not send a provider request. Import the actual record through the existing payout or bank-statement door, or approve its source correction, then link its saved ID to the request. A missing-fee request cannot be satisfied by a zero-fee settlement; a refund request needs negative refund evidence.

A corrected provider CSV must contain exactly one transaction with the original transaction identity, reservation reference and payout ID. The proposed source retains its CSV, SHA-256 digest and provider record reference. Review the source figures and explanation; reject the proposal with a reason or explicitly approve its exact linked reversal and replacement in an open period. Approval refuses changed reservation, property, agreement, ledger, bank or statement evidence. A reservation moved to another home or no longer available leaves its historical case readable with an explicit source exception; new correction proposals and approvals are refused until the source scope is reconciled. Rejection, record requests and repeated reads never post money. Approval preserves the original journal’s owner and legal entity. The original settlement and released statement stay frozen. Corrected source amounts are retained on the replacement journal so cash and accrual reports reconcile the same net without rereading a mutable provider row.

The first slice corrects unallocated native cash and owner-liability payout postings. Allocated receipts, transferred source scopes and processor-funded postings require their existing accounting workflows; the case refuses to substitute a different posting model. A reversed source cannot be corrected again through this door.

Use **Statements → Reconciled monthly ledger close** for the linked adjustment after approval. Older imported-statement and allocation writers refuse records with correcting journals so they cannot silently reuse the original source amounts; an obsolete imported draft cannot be approved. A later-period correction links back to the prior frozen statement; a same-month supplement names its latest statement ID. Review and approve the exact statement separately. Financial-case approval does not approve a statement, reopen a period, send a refund or transfer funds.

The case displays recorded owner payable, recorded distribution and the portion matched to bank evidence separately. It remains open. Matching local records does not establish an actual provider transfer, completeness of a source export, physical receipt of money or FIN-006 execution authority. The full AGENT-002 acceptance still requires actual owner-distribution evidence and the remaining provider workflows.

The conservative default, awaiting contract review, is installation-owner-only case access and decisions. Accountants retain their existing finance tools; this feature grants no additional access or external authority. Every change records actor, revision and history. Archive export keeps evidence but pauses cases; **Review current sources** retires pending proposals before new work. Property and guest erasure retains case accounting evidence under the existing reviewed accounting-retention policy.

The same operations are available through the authenticated command door (`POST /api/cabin/command`, body `{ "name": "financeCase.open", "input": { ... } }`):

- `financeCase.open`: `bookingId`, `reason`.
- `financeCase.request`: case `id`, `revision`, `kind` (`settlement`, `fee`, `refund`, `bank`), `detail`.
- `financeCase.obtain`: case `id`, `revision`, `requestId`, `evidenceId`.
- `financeCase.propose`: case `id`, `revision`, current evidence `baseline`, `payoutId`, `csv`, retained-source `evidence`, open `effectiveDate`, `why`.
- `financeCase.reject` / `financeCase.approve`: case `id`, `revision`, `proposalId`, `reason`; approval additionally requires `confirm: "yes"`.
- `financeCase.review`: case `id`, `revision`.

Read the current cases and their evidence digests in the authenticated state’s `financialExceptions` collection. No new bearer-agent authority is granted.
