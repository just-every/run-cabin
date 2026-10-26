Open **Statements** as the owner or a manager. Import an Airbnb transaction-history CSV or a Vrbo payment-history CSV for a home. CSV partner exports are supported now; Airbnb/Vrbo partner payout APIs require the owner's later partner accounts. Only USD is supported. Every monetary value is parsed as integer cents; fees come from provider columns, never a typed percentage.

Airbnb reservation rows use Date, Type, Confirmation code, Start date and Nights (or Check-in / Check-out), Currency, Gross earnings, Host service fee and Amount. Payout summary rows are excluded. Vrbo reservation rows use Date, Reservation ID (or Reservation number), Check-in / Check-out, Currency, Gross booking amount (or Rental amount), Commission, Processing fee and Net amount. Native Vrbo RefID, Your Revenue, Payment Processing Fee and Payable To You exports are supported; traveler Service Fee is distinct from host deductions. ISO and US M/D/YYYY dates work. Include transaction IDs and payout IDs to distinguish split payments. Refund rows carry negative gross and returned fees. Inconsistent gross/fees/net, foreign currency, ambiguous rows and unsupported records stop the import with a visible error.

Cabin matches a source reference to an iCal reservation UID, or the same home's exact channel and stay dates. Ambiguous and unmatched rows remain exceptions. Sync the calendar and confirm the correct candidate; Cabin never guesses a stay. Importing an unchanged provider transaction again does not duplicate it. A changed transaction requires reconciliation rather than silently replacing approved money.

**Import Stripe test payouts** reads Stripe's test-mode paid automatic USD payouts and their balance transactions, including actual fees. Payment intents match Cabin's direct-booking stays. Save a test key under **Direct bookings → Connect Stripe**, or configure `STRIPE_TEST_SECRET_KEY`. This statement import remains test-mode only; it does not import live payouts even if your direct bookings use a live key. Pending charges are not payouts. Stripe cannot attribute manual payouts to charges; non-USD payouts are excluded and Cabin does not invent FX conversions. Stripe-shaped network fixtures cover the USD path; the application does not synthesize settlements.

Choose a payout month and prepare the statement. Gross receipts minus imported channel fees, the home's management commission and reviewed expenses already paid from owner funds gives owner payout. Add those expenses when preparing the monthly statement; each cost is frozen with its description and amount at approval. Commission is half-up integer arithmetic on gross. Every line must match a stay. Approval binds the exact revision, source lines, home owner and commission. Changed data invalidates a draft; approved statements stay frozen. Existing entered adjustment statements remain readable and their API is retained for existing integrations; the payout workflow does not accept typed channel fees.

Approval queues an owner email with a private portal link. Status shows pending, sending, sent (provider accepted), unavailable, suppressed in development, or failed/uncertain. Check the provider before explicitly sending another copy after an uncertain outcome. Local and demo mail stays silently suppressed; there is no application inbox.

## Owner portal

Owners use `/owners/signin`, independently of operator accounts. Their home owner email receives a 20-minute, one-use sign-in link. The confirmation creates a separate HttpOnly session. Owners see only homes currently assigned to their email, those homes' stays, and approved statements whose frozen recipient also matches. Changed ownership removes access immediately and does not disclose the prior owner's statements to a new owner. Owner sessions cannot call operator commands. Operators can preview a home's owner view from Statements.

## Pantry and QuickBooks

[Pantry](https://run-pantry.com) is Run Edit Run’s bookkeeping app, installed separately from Cabin. [Get Pantry](https://run-pantry.com/run) and read its [integration credential guide](https://run-pantry.com/docs/integrations).

1. Start Pantry, finish its business setup and create your chart of accounts. Hosted Cabin requires Pantry at a reachable HTTPS address. For local installations, use Pantry’s printed RER_READY address.
2. In Pantry, open **People & settings → Integration credentials**. Name the connection Cabin and select **Journals**, **Documents** and **Post approved sibling records**. Choose **Create integration credential** and copy the value shown once.
3. In Cabin **Books**, enter Pantry’s address without `/app`, paste the integration credential and choose **Connect Pantry**. Cabin checks access before saving and encrypts the credential. It requires no person’s session and keeps working after the Pantry owner signs out.
4. On an approved imported statement, choose payout clearing (asset), dedicated owner funds (ordinary liability) and management income accounts from Pantry’s returned list. Choose **Post once to Pantry**. Cabin uploads the exact statement evidence and posts its balanced journal; the saved card shows the journal ID.
5. Replays keep the original journal. An uncertain submission can be refreshed with its saved identity. Revoke the credential in Pantry to stop access immediately; Cabin shows a broken connection and asks for a replacement credential.

Payout clearing is debited for imported net, owner liability credited for gross and debited for actual channel fees and management fees, and management income credited. Expenses already paid from owner funds debit owner liability and credit clearing. Closing owner liability equals the frozen statement owner payout. These journals do not transfer money. Accounts payable control accounts cannot be used for owner liability.

On RER Managed, provider connections are not available yet. The connector works on self-hosted installations. QuickBooks file exports remain available independently.

## QuickBooks Online and Desktop

You do not need Pantry for QuickBooks exports. File imports remain available alongside the connected QuickBooks Online workflow below:

1. In **Books**, open an approved statement’s **QuickBooks Online / Desktop export**. Enter the exact existing settlement asset, owner funds liability and management income account names from your QuickBooks chart. Choose **Prepare QuickBooks exports**.
2. For **QuickBooks Online**, download **QuickBooks Online journal CSV**. It contains Journal No., Journal Date, Account Name, Description, Debits and Credits. Use QuickBooks’ journal-entry import (where available in your region/edition), map the matching headers and review the entry before completing the import. See [Intuit’s journal CSV import guide](https://quickbooks.intuit.com/learn-support/en-sg/help-article/import-or-export-files/import-journal-entries/L4tQBwbs7_SG_en_SG). Use the complete parent:subaccount name for subaccounts.
3. For **QuickBooks Desktop**, download **QuickBooks Desktop IIF** and import that journal through Desktop’s IIF import. Back up the QuickBooks company file first and have your bookkeeper review the result.
4. Check that settlement, imported fees, management income and owner liability match the frozen Cabin statement. Do not import the same journal twice, or import separately after it was already posted through Pantry or the QuickBooks connector.

Owner/operator statement CSVs show USD currency, commission as a percentage and the saved approver name. Accounting exports retain the journal debit/credit format required for import; source references remain in the journal memos for audit.

## Hosted email configuration

Before `rer deploy`, provide `OWNER_EMAIL`, `MAIL_PROVIDER` (`sendgrid`, `resend` or `cloudflare`), a verified plain sender address in `MAIL_FROM` (for example `bookings@example.com`), and its `MAIL_API_KEY` through your environment or a private `--env-file`. The deploy declaration treats the provider and sender as private secret bindings; do not commit them. See [hosting setup](/docs/hosting). Session and initial setup secrets are generated by rer. Development never sends email.

## Owner permissions and records

Statements includes Owner portal operations. Save the owner's agreed calendar visibility (hidden, availability or stay names), expense approval limit and personal-stay rules. Shared invoice/document text is scoped to that home and owner email. Source-backed reserve reports preserve their amount, effective date, supporting record and correction history; they report funds held elsewhere and do not move money or create a bank balance. Owners download records and see occupancy, approved revenue, their ledger activity, recorded distributions and open maintenance issues.

An owner approves or declines the exact expense revision in the separate portal. A personal-stay request holds no inventory until the manager approves it against current availability, notice and length rules; approval blocks the nights and publishes them through existing calendar links. The manager records cleaning arrangements with that decision. Cancelling the approved stay releases the nights.

Opening an approved statement in the authenticated owner page records a view and displays the owner's name and date on its operator statement card. Downloads record a separate event; API reads and operator previews never count as views. Historical grants retain only selected frozen statements for their original recipient. A new owner receives no previous-owner statements, documents or ledger. Revoke a historical grant to stop its access immediately. Property erasure clears operational owner records and grants, retaining anonymous access history.

## Connected QuickBooks Online

The installation owner opens **Books → QuickBooks settings**, configures an Intuit developer app and registers the displayed callback URI. Use Development credentials for a sandbox. **Authorize at Intuit** records explicit Accounting consent, redirects to Intuit, and accepts only a single-use state issued to that signed-in owner. An existing owner-consented OAuth grant can also be connected. App credentials and rotating tokens are encrypted in installation storage. Neither appears in ordinary state, audit events or portable archives.

Refresh the company accounts, classes and vendors. Approve each property's exact class, owner vendor and complete native ledger account mapping after accountant review. A US company with USD home currency is required. Accounts receivable and accounts payable control accounts are excluded. Trust proceeds remain owner liability; management income uses its separate ledger account. These journal entries record accounting and never move funds.

**Preview month** freezes the property's posted ledger journals, source identities, mappings, debit and credit totals and account balance movement. Deposits, earned revenue, tax liability, settlements, fees, refunds and expenses use their actual ledger sides. Review the lines and explicitly approve **Sync approved batch**. Each request handles at most twenty pending source journals; repeat the same approved batch to continue. A changed month requires a new preview. Overlapping previews reuse the original source identities and cannot create another entry for an already submitted journal.

**Reconcile QuickBooks** reads the external journal IDs and compares dates, amounts, accounts, class, vendor, source memo and QuickBooks version. An external edit or deletion stops that entry with its original identity intact. A rejected journal retains its error and is not automatically resent. An uncertain outcome is looked up before the stable request identity is reused. Resolve accounting differences with the accountant in QuickBooks; Cabin never overwrites a remote edit or creates a replacement to conceal it. Confirmed totals describe the last explicit read.

Disconnecting removes the local OAuth grant and stops new connector requests. Revoke the app at Intuit to revoke the provider's grant. Existing accounting identities remain for reconciliation. Archives carry accounting history and preserve external IDs, but exclude credentials, cached provider directories and outstanding OAuth state. Restored mappings and batches are inactive: reconnect and approve fresh mappings and previews after installation review. QuickBooks requests remain unavailable on RER Managed hosting.

The sandbox journey is `node tests/qbo-sandbox.mjs`. It requires a private grant file through `CABIN_QBO_GRANT_FILE` and the owner's configured app credentials, uses only the Intuit sandbox origin, and writes a redacted receipt to `CABIN_QBO_RECEIPTS`. Before running it, the authorized local runner must refresh the held grant and immediately persist the rotated refresh token through the owner's secret ingester. The journey itself never exchanges the held refresh token. The route journey in `tests/finance.test.mjs` additionally proves interrupted-response readback and revoked access with a fake only at the provider network edge. `tests/qbo-browser.mjs` uses the native forms at 1440 and 390.
