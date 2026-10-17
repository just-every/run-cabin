Open **Statements** as the owner or a manager. Import an Airbnb transaction-history CSV or a Vrbo payment-history CSV for a home. CSV partner exports are supported now; Airbnb/Vrbo partner payout APIs require the owner's later partner accounts. Only USD is supported. Every monetary value is parsed as integer cents; fees come from provider columns, never a typed percentage.

Airbnb reservation rows use Date, Type, Confirmation code, Start date and Nights (or Check-in / Check-out), Currency, Gross earnings, Host service fee and Amount. Payout summary rows are excluded. Vrbo reservation rows use Date, Reservation ID (or Reservation number), Check-in / Check-out, Currency, Gross booking amount (or Rental amount), Commission, Processing fee and Net amount. Native Vrbo RefID, Your Revenue, Payment Processing Fee and Payable To You exports are supported; traveler Service Fee is distinct from host deductions. ISO and US M/D/YYYY dates work. Include transaction IDs and payout IDs to distinguish split payments. Refund rows carry negative gross and returned fees. Inconsistent gross/fees/net, foreign currency, ambiguous rows and unsupported records stop the import with a visible error.

Cabin matches a source reference to an iCal reservation UID, or the same home's exact channel and stay dates. Ambiguous and unmatched rows remain exceptions. Sync the calendar and confirm the correct candidate; Cabin never guesses a stay. Importing an unchanged provider transaction again does not duplicate it. A changed transaction requires reconciliation rather than silently replacing approved money.

**Import Stripe test payouts** reads Stripe's test-mode paid automatic USD payouts and their balance transactions, including actual fees. Payment intents match Cabin's direct-booking stays. Save a test key under **Direct bookings → Connect Stripe**, or configure `STRIPE_TEST_SECRET_KEY`. This statement import remains test-mode only; it does not import live payouts even if your direct bookings use a live key. Pending charges are not payouts. Stripe cannot attribute manual payouts to charges; non-USD payouts are excluded and Cabin does not invent FX conversions. Stripe-shaped network fixtures cover the USD path; the application does not synthesize settlements.

Choose a payout month and prepare the statement. Gross receipts minus imported channel fees minus the home's management commission gives owner payout. Commission is half-up integer arithmetic on gross. Every line must match a stay. Approval binds the exact revision, source lines, home owner and commission. Changed data invalidates a draft; approved statements stay frozen. Existing entered adjustment statements remain readable and their API is retained for existing integrations; the payout workflow does not accept typed channel fees.

Approval queues an owner email with a private portal link. Status shows pending, sending, sent (provider accepted), unavailable, suppressed in development, or failed/uncertain. Check the provider before explicitly sending another copy after an uncertain outcome. Local and demo mail stays silently suppressed; there is no application inbox.

## Owner portal

Owners use `/owners/signin`, independently of operator accounts. Their home owner email receives a 20-minute, one-use sign-in link. The confirmation creates a separate HttpOnly session. Owners see only homes currently assigned to their email, those homes' stays, and approved statements whose frozen recipient also matches. Changed ownership removes access immediately and does not disclose the prior owner's statements to a new owner. Owner sessions cannot call operator commands. Operators can preview a home's owner view from Statements.

## Pantry and QuickBooks

[Pantry](https://run-pantry.com) is Run Edit Run’s own bookkeeping app, installed separately from Cabin. It can receive balanced journal proposals directly; a person approves and posts them there. [Get Pantry](https://run-pantry.com/run) or read its [agent token guide](https://run-pantry.com/docs/agent-work).

1. Start your Pantry installation. For local use, run `rer dev just-every/run-pantry` in a separate folder, open its private RER_OPEN link, and finish setup and your chart of accounts. For hosted Cabin, Pantry must be hosted at a reachable HTTPS address; Cabin cannot reach a Pantry running only on your computer.
2. As the Pantry owner, open **People & settings → Agent access**, enter an agent name such as Cabin and choose **Create agent token**. Copy the token shown once. This is a Pantry agent credential, distinct from Cabin’s own Agent access tokens.
3. In Cabin, open **Books**. Paste the Pantry address without `/app` (use Pantry’s **RER_READY** address locally), paste its token, and choose **Connect Pantry**. Cabin tests access before saving. Success shows **Connected** and enables document/account choices on approved statements. A visible error means you need to repair the address or token. Tokens are encrypted with Cabin’s session secret and excluded from backup archives.
4. Download an approved statement CSV from Cabin, upload the unchanged file in **Pantry → Documents**, then reload Cabin Books and choose that uploaded file. Select payout clearing (asset), dedicated owner funds (ordinary liability) and management income accounts.
5. Choose **Send proposal to Pantry**. Cabin verifies the file against the frozen statement and submits its source evidence. Follow **Review proposal in Pantry** and choose **Approve and post** there. Back in Cabin, **Refresh Pantry status** must show **posted**, with the Pantry journal reference available under **Accounting references**.

Pantry’s API requires that human document upload and posting approval. Uncertain submissions retain their marker and are reconciled by refresh; Cabin never blindly resubmits them.

Owner funds accounting debits clearing for imported net, credits owner liability for gross, debits owner liability for actual channel fees and management fee, and credits management income. The liability's net is the statement owner payout. This does not transfer funds. Choose dedicated owner liability accounts; Pantry's accounts payable control account is reserved for bills. Proposals over Pantry's 200 journal-line / 100 KB limits stop for an accountant's reviewed breakdown.

## QuickBooks Online and Desktop

You do not need Pantry for QuickBooks exports. Cabin has no connected QuickBooks Online app yet; QBO OAuth synchronization needs a future owner developer app. Use these file imports today:

1. In **Books**, open an approved statement’s **QuickBooks Online / Desktop export**. Enter the exact existing settlement asset, owner funds liability and management income account names from your QuickBooks chart. Choose **Prepare QuickBooks exports**.
2. For **QuickBooks Online**, download **QuickBooks Online journal CSV**. It contains Journal No., Journal Date, Account Name, Description, Debits and Credits. Use QuickBooks’ journal-entry import (where available in your region/edition), map the matching headers and review the entry before completing the import. See [Intuit’s journal CSV import guide](https://quickbooks.intuit.com/learn-support/en-sg/help-article/import-or-export-files/import-journal-entries/L4tQBwbs7_SG_en_SG). Use the complete parent:subaccount name for subaccounts.
3. For **QuickBooks Desktop**, download **QuickBooks Desktop IIF** and import that journal through Desktop’s IIF import. Back up the QuickBooks company file first and have your bookkeeper review the result.
4. Check that settlement, imported fees, management income and owner liability match the frozen Cabin statement. Do not import the same journal twice, or import separately after it was already posted through Pantry.

Owner/operator statement CSVs show USD currency, commission as a percentage and the saved approver name. Accounting exports retain the journal debit/credit format required for import; source references remain in the journal memos for audit.

## Hosted email configuration

Before `rer deploy`, provide `OWNER_EMAIL`, `MAIL_PROVIDER` (`sendgrid`, `resend` or `cloudflare`), a verified plain sender address in `MAIL_FROM` (for example `bookings@example.com`), and its `MAIL_API_KEY` through your environment or a private `--env-file`. The deploy declaration treats the provider and sender as private secret bindings; do not commit them. See [hosting setup](/docs/hosting). Session and initial setup secrets are generated by rer. Development never sends email.
