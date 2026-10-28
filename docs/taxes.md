# US lodging-tax reviews

Open **Lodging taxes** in the manager workspace. This is a source-led monthly or calendar-quarter
review, accountant or partner packet and external-evidence workflow. Sending an
email does not file a government return or remit funds. No Avalara or other
statutory filing API is connected by this feature.

The owner configures each property's US state, county and city (including an
explicit Unincorporated determination), registration, authorized accountant or
filing partner and destination email. Add dated occupancy, lodging or sales
rules with their authoritative source and taxable fee treatment. Rates are
basis points: a configured 900 is 9%. A documented zero-rate rule records that
no levy applies. Missing jurisdictions, rules, registrations and reservation
sources remain visible work items and prevent approval. Configuration is
owner-only; operational review requires a human owner or manager.

## Sources, exemptions and corrections

Select a guest reservation, enter rent and taxable fees in USD cents, and
document any exempt portion with its certificate/reference and reason. Review
each calculated levy/month and record only the channel-collected/remitted
amount actually documented by the channel's settlement source. The remainder
is host liability; iCal and the channel name alone never establish collection
responsibility. Direct stays cannot attribute collection to an OTA.

The shared base is allocated over stay nights, preserving cents; each
effective rule/month is calculated and rounded separately. This supports
stays crossing months and rates changing during a stay. The final night of a
rule's effective range is inclusive; checkout is exclusive. All levies
currently share the entered taxable base and exemption amount. Jurisdictions
requiring different fee bases, compounding, other filing periods or
unconfigured tax treatments require accountant resolution and must remain
unsupported work items. Cabin supplies no automatic statutory rate lookup.

Paid direct receipts can be imported from their provider-confirmed frozen
quote. An effective rule snapshot, where present, is used intact. Legacy
receipts are accepted only when every saved jurisdiction level, rate and
exact tax amount matches configured rules effective for the original stay.
Unmapped receipts are refused for review, never repriced at today's rate.
The original payment reference, payment mode, quote and signature references
remain source evidence. A Stripe test payment remains explicitly identified
as test evidence; it is not proof of live collection.

Refunds/cancellations append reductions linked to each original levy. Record
the source refund reference, refunded base/exemption, total tax reduction,
channel-refunded share and accounting date. Reductions cannot exceed the
original remaining amount or move the channel share to the host. A zero
adjustment records a documented cancellation with no refundable tax. Every
levy on a cancelled stay requires its own determination. Sources and lines
are immutable. To correct a source or changed stay dates, fully reverse its
base and tax through adjustments, calculate the replacement and record the
new source; it explicitly supersedes the original.

Host tax posts through the existing double-entry ledger as receivable/tax
payable. Reductions post tax payable/receivable with the original owner and
legal entity retained. Late source records for a closed accounting month
post on the current open date, while retaining the original stay filing
month. A closed current period is refused. A source with no host liability
does not invent a cash or tax-payable entry.

## Review, delivery and external evidence

Choose a property, monthly or quarterly period and a month within that period.
A quarter is January through March, April through June, July through September
or October through December; its end date is exclusive. Select all configured
jurisdictions or one jurisdiction belonging to that property. The review sums
existing monthly source lines without recalculating or rounding taxes again.
It uses stay months for assessments and the entered accounting date for refunds.
Registration must remain valid through the final day of the selected period.

Prepare one property's period. State, county and city obligations retain
their own lines, exemptions, collection splits and ledger links. Approval
binds the exact revision and refuses changed configuration, sources,
reservations, unresolved work items or reversed/mismatched ledger evidence.
The approved snapshot, original source evidence, rates, recipients and
registration evidence are frozen. Later records form a supplemental review
containing only lines not included in any approved review, including overlapping
monthly and quarterly reviews. Approval of an overlapping review invalidates
previously prepared drafts. Original approved monthly snapshots and ledger
postings remain unchanged; even a negative supplement needs exact review.
A refund entered late with an accounting date inside a reviewed quarter becomes
a linked supplement to that quarter. A refund dated in the next quarter belongs
to that next quarter and keeps its original levy link.

Explicit delivery sends a separate frozen packet per jurisdiction through
Cabin's existing mail provider. Provider acceptance, suppression, missing
configuration and failure remain distinct. A content SHA-256 and stable
delivery ID are recorded. Development/demo delivery may be suppressed;
suppression is never filing acceptance. An interrupted send remains
uncertain and must be checked with the mail provider. Failed deliveries are
not silently retried: a manager must confirm the previous attempt was
checked before requesting another send. Previously sent levies are skipped
when retrying the remaining packets.

A human records the actual partner filing acknowledgement or rejection,
reference, date, document custody location and identity. After an
acknowledgement, a human may record actual bank/remittance payment evidence.
Payments cannot exceed the reviewed remaining host liability and append
linked tax-payable/cash ledger entries. Evidence records are immutable;
duplicate external references are refused. These commands record documents
and accounting effects; they do not create government acceptance or move
money. Negative supplemental obligations remain credits for partner review.

Download the exact review JSON with its jurisdiction packets, delivery
history, external evidence and balances. Cleaner and agent state excludes
all tax configuration and source/evidence data, and the export requires a
live human manager session. The installation's ordinary archive includes
the new operational tables; no new provider credential store is introduced.

## Public command interface

Use the existing authenticated, CSRF-protected `/api/cabin/command` door.
Each command accepts `{name, input}`. Forms use the same commands.

| Command | Input |
| --- | --- |
| `tax.profile.save` | `propertyId, country:"US", state, county, city`; current `revision` when editing |
| `tax.jurisdiction.save` | `propertyId, level, registrationStatus, registrationReference, registrationUntil?`, `partner, recipient, source`; current `revision` when editing |
| `tax.rule.save` | `jurisdictionId, taxType, bps, from, until, source`; `id, revision` when editing |
| `tax.source.preview` | `bookingId, baseCents, exemptCents, exemptionEvidence?` |
| `tax.source.record` | Preview inputs plus `previewDigest, reference, document, collections:[{ruleId,month,channelCents}], confirm:"yes"`; `supersedesSourceId` only for a fully reversed replacement |
| `tax.source.direct` | `stayId, confirm:"yes"` |
| `tax.adjust` | `lineId, effectiveDate, baseCents, exemptCents, taxCents, channelCents, reference, reason, confirm:"yes"` |
| `tax.report.prepare` | `propertyId, month, periodKind?:"month"|"quarter", jurisdictionId?` |
| `tax.report.approve` | `id, revision, confirm:"yes"` |
| `tax.report.deliver` | `id, revision, confirm:"yes"`, optional `jurisdictionId`; retry adds `checkedProvider:"yes"` |
| `tax.evidence.record` | `id, revision, jurisdictionId, kind:"acknowledgement"|"rejection"|"payment", reference, date, document, amountCents, confirm:"yes"` |

`GET /api/cabin/taxes/:reviewId.json` exports the frozen review plus its latest
delivery/evidence history. `/api/cabin/state` exposes the authorized `taxes`
projection. Public commands always recheck native sessions and authority.

## Proof and limits

`tests/taxes.test.mjs` uses public commands and exports to exercise two US
properties, direct and OTA responsibility, an exemption, refund adjustments,
separate state/county/city obligations, stale approval refusal, frozen
review/email packets, rejection/acknowledgement/payment evidence and ledger
reconciliation. The mail provider is faked only at the test network edge.
Hosted October review and separate accountant packet delivery were exercised at 1440 and 390, with received DMARC-passing mail and no invented filing/payment records. The configured test case retained $118 of unfiled host liability after excluding channel remittances.

The test does not prove any real statutory filing, partner acknowledgement
or movement of money. A live authorized filing partner and jurisdiction
acceptance/payment documents remain external acceptance work.

`tests/taxes.test.mjs` also exercises quarter and year boundaries, separate
levy totals, monthly and quarterly overlap refusal in both directions, late
refund supplements, refused unsafe approvals, frozen monthly exports, restart
and exact source-line ledger reconciliation. `tests/tax-periods-browser.mjs`
runs in push Verify through native review forms and downloaded JSON, with
desktop assertions and phone review use. Neither journey files a return or
remits funds; the statutory partner and real OTA acceptance remain unproved.
