# Portable records and safe restore

From the installation folder, `rer export --output exports/cabin.rer` produces a
versioned structured archive. `rer import --input exports/cabin.rer --yes`
restores into empty product data. These commands operate on the local copy;
use the hosted backup command for a hosted database. Keep either archive
private: it contains personal, contractual and financial business records.

## Schema and evidence

The RER portability v2 manifest describes product/schema identity, applied
migrations, table columns and counts, media, source identity and erasure epoch.
SHA-256 checks cover each part and the complete manifest/content. SQL constraints
and product validation run in staging before publication. Product validation
checks operational/media references, balanced trust journals, unchanged rental
document hashes and the inactive restore state. Damaged, incomplete, active or
populated restores are refused. When a later erasure journal is available,
`--journal PATH` fences older personal records; an isolated old archive cannot
know about future erasure.

| Record family | Structured storage |
| --- | --- |
| Homes, staff and effective management terms | `cb_properties`, `cb_members`, property/profile and management records in `cb_records` |
| Reservations, calendar history and inventory | Booking, request, feed, block and review records in `cb_records`; direct homes/stays in `cb_direct_homes`, `cb_direct_stays` |
| Guest profiles, consent and conversations | Guest, merge, offer, message and schedule records in `cb_records` |
| Signed agreements and identity decisions | Versioned agreement documents in `cb_records`; minimal verification records in `cb_verifications` |
| Cleaning, maintenance and readiness | Turnover, task, work expense and readiness records in `cb_records`; original image bytes and digests in `cb_photos` |
| Payouts, trust ledger, statements and owner records | Payouts/statements/postings in `cb_records`; `cb_ledger_*`, `cb_owner_*` business records and opening balances |
| Tax sources, reviews and recorded filing evidence | `cb_tax_*` business records |
| Attributable history and move-in custody | `cb_events`, approvals, redaction/fencing references, `cb_import_*`, `cb_provider_moveins`, `cb_movein_guests` and import-kit `ik_*` journals/source evidence |

The exact JSON record kinds and typed fields are in `src/cabin/model.ts` and
each area's types; SQL columns and relations are in `migrations/core/`. Original
financial amounts use integer USD cents. Signed document text, signatures,
hashes, approval identity and media bytes retain their original evidence.

Usable downloads remain available after restore: approved statement CSV and
PDF from **Statements**, the complete ledger CSV, activity JSONL, tax JSON,
signed agreement downloads and original photo routes. These all use current
native authority. The PDF is generated in the Worker with the bundled OFL Inter
font; it does not send records to a document service.

## What stays local

Archives exclude native/owner sessions, bearer keys, Pantry credentials and the
saved Stripe credential table. Inbox AI keys are removed. Private calendar
links used by calendars, exports, guests and agreements are removed. Saved
card and customer credentials and checkout links become inert references.
Retained provider move-in previews also lose calendar credentials; their
original approval fingerprints remain historical and those previews must be
recreated before further application or reversal. Historical message bodies lose access codes and private stay links;
signed contractual text is preserved and checked against its original digest.
Installation environment secrets are never part of the archive.

## Resume deliberately

A restored copy starts with an installation review fence, all provider sharing
disconnected and direct booking pages unpublished. Old queued mail, scheduled
messages and tax packets are retired; old door codes/links and returning offers
are revoked. Calendar feeds require fresh links. Historical direct payment
records never enter the payment scheduler and cannot capture or release a hold;
reconcile those existing operations directly in Stripe. No old charge, message,
payout or access code is replayed.

In **Channels → Restored installation review**, first check the records and
existing operations at the providers. Ensure the old installation is no longer
performing the same work. The installation owner approves the current review,
then reconnects each provider with its own settings. Each current/future
reservation stays paused until the owner reviews its current revision and
restarts service. Cabin then creates fresh access/service from current facts;
retired queued effects stay retired. Historical records remain readable
throughout, and the review and restart are attributable in Activity.

`tests/archive.test.mjs` exercises the public commands with a populated source,
compares signed documents, original photos and frozen financial evidence,
rejects checksum damage/populated stores/later erasures, and drives the restored
review, provider and reservation controls through product routes. It records
outbound requests during Cron and ordinary mutations and requires none before
explicit reconnection. `tests/archive-records.mjs` supplies this journey's
synthetic business data and paid-provider network edge.

## Hosted backups

`rer run backup:hosted -- --environment NAME --env-file .env.cabin` exports the
remote D1 database, then sanitizes and validates it in private temporary storage.
The delivered SQL has a Cabin format/version/product header and content SHA-256;
it includes the schema, business rows and original photo blobs. Raw provider
SQL is removed and never becomes the backup. The output is created mode 600.

Restore with the same command plus `--restore exports/FILE.sql --yes` into a
fresh deployment of the same edition. It validates the complete archive before
contacting the destination, requires migration-empty product data and only the
original bootstrap owner matching an archived owner email, refuses later
identity activity, then commits the exact destination snapshot guards and
paused records in one D1 ingestion. The bootstrap session is atomically retired.
A concurrent write refuses the whole restore. `tests/hosted-backup.test.mjs`
exercises that race, immutable history, claimed targets, extra-operator refusal,
checksums and signed-document/ledger/photo damage through the SQL format.
