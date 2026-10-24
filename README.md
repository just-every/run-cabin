# <img src="public/brand/mark.svg" alt="" width="40" height="40"> Cabin

Vacation rental operations for a US host or manager with 3–40 rentals: channel calendar imports, cleaner photo checklists and approved owner statements in USD. MIT licensed. [Target contract](CONTRACT.md) · [first-release scope](ACCEPTANCE.md) · [docs](docs/getting-started.md).

The run site is at **https://run-cabin.com**, with its docs at `/docs` and its Run Cabin page at **https://run-cabin.com/run**. Locally, run `rer dev`, then open `http://127.0.0.1:<port>/`, using the port in the **RER_SITE** address RER prints. Its port differs from **RER_READY**, which serves the installed app and `/app`. The site does not block using or deploying the app.

## Start from a fresh clone

Install Git, then run one line to install the launcher, clone Cabin and start it:

```sh
npx -y @runeditrun/rer dev just-every/run-cabin
```

No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin` does the same and brings its own Node; it does not edit your shell files itself. If it ends by printing a line to run, run it: that line puts `rer` on your PATH now and appends the same `export PATH=…` setting to your shell's startup file (`~/.zshrc` for zsh, otherwise `~/.profile` or `~/.bash_profile`), so `rer` also works in new terminals. To set Cabin up without starting it, use `setup` in place of `dev`.

To start it again later, run `cd run-cabin && rer dev`. RER selects pinned Node 22.20.0 and pnpm 10.12.4, installs dependencies, migrates local D1 and prepares a local owner. First launch can take several minutes. Open the private **RER_OPEN** link from the terminal, confirm the owner on **Finish setup**, and open `/app`. Keep that link private. **RER_READY** is the ordinary app address. Run the same command again if interrupted. Stop with `rer dev --stop` or Ctrl-C.

For a lasting installation with your own mailbox, in place of the one line use `npx -y @runeditrun/rer setup just-every/run-cabin` (enter your email when prompted), then `rer dev` in the `run-cabin` folder. Development mail is silently suppressed. Use the local personas below to try manager and cleaner roles. Hosted installations use email invitations. No provider account or purchased domain is needed locally.

## Do the first jobs

1. **Properties & people:** add a property, owner name/email and commission. Enter commission as a percentage, for example 15 for 15%. The installation owner adds an active cleaner and sends their invitation. Only the owner grants access. Managers operate the portfolio; cleaners see only their own jobs.
2. **Calendar:** under **Channel calendars**, paste each home's Airbnb, Vrbo and Booking.com calendar link; Cabin reads them every 15 to 60 minutes and shows last-synced time and any error. Choose **Create export links** and paste each Cabin link into its channel, so a night booked anywhere closes everywhere. **Take a request** declines any request that overlaps a held night and says why; **Block nights** closes nights for owner stays or maintenance. The grid shows every home by channel. Links are polled, so a channel can still sell a night before it hears; such a collision shows in red. Partner APIs come later. To move in or check a feed by hand, paste a channel's `.ics` file (try the [Airbnb](fixtures/airbnb.ics) and [Booking.com](fixtures/booking-com.ics) fixtures) and approve the exact review. See [Channel calendars](docs/calendars.md).
3. **Turnovers:** set each home's address, times, default cleaner and checklist once. Every stay then makes its own turnover between check-out and the next check-in, a door code for the guest and one for the cleaner, and emails the cleaner the window, address and code; moved or cancelled stays move or cancel them. The cleaner ticks every item and marks the home ready with several photos; broken things become maintenance tasks with photos, and **Readiness** shows which homes are ready for a day. Photos stay private to the job's people and managers. Locally, add the cleaner with email `cleaner@dev.localhost`. Run `rer dev --as cleaner` in another terminal and open its private RER_OPEN link in a separate browser profile. For a local manager use `manager@dev.localhost` and `rer dev --as manager`. Save the matching active team grant as owner first. These personas sign in locally without sending mail; hosted people use invitations.
4. **Inbox:** under **Inbox → Guest email**, enter the address you routed to Cabin with Cloudflare Email Routing. Each guest gets one thread with all their stays: check-in details with their door code, a checkout reminder and a review request go out on time from the stay's dates and move or cancel with it. Guest email lands in the thread with a drafted reply (from your own AI key, or a template) that is sent only when you send it. Texts wait on the owner's US A2P registration and Airbnb, Vrbo and Booking.com messages on partner accounts; the page says so. See [Guest inbox](docs/inbox.md).
5. **Statements:** import a home’s Airbnb transaction-history or Vrbo payment-history CSV, review the stay matches and resolve exceptions, then choose its payout month and prepare. Review gross receipts, imported channel fees, management commission and owner payout; approve the frozen revision to email the owner and download its USD CSV. See [Owner statements](docs/statements.md). Under **Books**, send a proposal to [Pantry](https://run-pantry.com), Run Edit Run’s bookkeeping app, or download a QuickBooks Online journal CSV / QuickBooks Desktop IIF. QuickBooks uses file imports; a connected QBO app is not available yet. Cabin records amounts due and does not transfer funds.
6. **Move in:** paste the [Cabin property-register CSV](fixtures/properties.csv), preview its dry run, inspect the plan and approve. The durable journal shows progress. Undo removes unchanged imports and preserves native edits. Read the [format and undo guide](docs/move-in.md). Fixtures document Cabin's input shape; they are not claimed vendor exports.
7. **Agent access:** create a preparation token, copy it once into private configuration, and use the [command API](docs/commands.md). Agents prepare calendar, turnover and statement drafts; people approve. Every approval records its actor and exact revision. Revoke a token to end access immediately.

## Back up, restore and erase

Stop the app before data transfers and keep archives private:

```sh
rer dev --stop
rer export --output exports/cabin.rer
```

Restore into a fresh clone of the **same revision**, before setup or data entry:

```sh
rer install
rer import --input /private/path/cabin.rer --yes
rer setup
rer dev
```

Use the original installation owner's mailbox at setup. Records, photos, statements and import journals travel; sessions, sign-in links, agent credentials, private configuration and development mail do not. Re-enter private configuration and sign in again. Corrupt archives and populated destinations are refused.

The owner can erase a property's personal and operational data in **Properties & people**. This is permanent and also retires its import custody. Export first if retention is required. After erasure, supply a later archive from the same installation: `rer import --input OLD.rer --journal LATER.rer --yes`. Its erasure fence refuses old data. Protect or retire old offline copies: they cannot learn about later erasure themselves. `rer reset --yes` deletes local state/settings but preserves exported archives.

## Deploy

The app can use a workers.dev address independently of run-cabin.com. Keep project, Worker and D1 identities stable. You need a Cloudflare account with a workers.dev subdomain, an API token scoped to Workers Scripts: Edit and D1: Edit, and a verified sender with a mail provider. Fleet work uses only the RunEditRun account.

Provide `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `MAIL_PROVIDER` (`sendgrid`, `resend` or `cloudflare`), `MAIL_FROM` (a verified plain address such as `bookings@example.com`) and `MAIL_API_KEY` privately through your environment or a mode-0600 `--env-file`. `MAIL_FROM` is a secret binding: keep it out of committed configuration. RER generates and saves `SESSION_SECRET` and `SETUP_TOKEN` for you. Connect Stripe on **Direct bookings → Connect Stripe**, test its checkout, then save a live key for real bookings. Server keys are optional: `STRIPE_TEST_SECRET_KEY` (`sk_test_`) or `STRIPE_SECRET_KEY` (`sk_live_`) from your [Stripe Dashboard](https://dashboard.stripe.com/apikeys). Statement payout import currently uses test-mode USD payouts only. Never commit private settings or put secret values in command arguments.

```sh
rer deploy --env-file .env.cabin --dry-run
rer deploy --env-file .env.cabin
rer signin --env-file .env.cabin
```

Dry run validates/builds without provider calls. Real deploy provisions resources, applies migrations, uploads the Worker and checks health. Open its returned origin and request an owner sign-in email. `rer signin` prints a private one-time owner link if mail is not working yet. Correct mail configuration before inviting people. Build and deployment do not run tests. Local checks do not prove provider delivery. See [hosting and removal](docs/hosting.md) for all steps.

To remove the default `production` deployment permanently, first [back up its hosted database](docs/backup.md#back-up-a-hosted-installation), then run from the checkout that deployed it:

```sh
rer deploy --remove --yes --env-file .env.cabin
```

For another environment include the same `--environment NAME` used at deploy. Removal deletes the recorded Worker and every D1, R2, KV and queue RER created for that environment, including their data. It is irreversible. RER reads back each resource and reports **read back: none of them remains**; an already empty deployment removes nothing. Keep `.rer/deploy` until removal is confirmed. Local `rer export` does not back up hosted data.

## Development

```sh
pnpm run test:cabin
pnpm run test:archive
pnpm run test:site
pnpm run typecheck
rer verify
```

GitHub Verify shards source, types, domain, restore, run site and production runtime checks. Package mode pins `@runeditrun/rer@0.2.47`. Foundation: Base `ada9f574d8a7247edc3a1180b593ad182b1fbb37`. [Source reuse](docs/source-notes.md), [operations](RUN-LOCALLY.md), [agent instructions](AGENTS.md).

Run Cabin and review hosting options at https://run-cabin.com/run.
