# <img src="public/brand/mark.svg" alt="" width="40" height="40"> Cabin

Vacation rental operations for a US host or manager with 3–40 rentals: channel calendar imports, cleaner photo checklists and approved owner statements in USD. MIT licensed. [Target contract](CONTRACT.md) · [first-release scope](ACCEPTANCE.md) · [docs](docs/getting-started.md).

The run site is at **https://run-cabin.com**, with its docs at `/docs` and its Run Cabin page at **https://run-cabin.com/run**. Locally, run `rer dev`, then open `http://127.0.0.1:<port>/`, using the port in the **RER_SITE** address RER prints. Its port differs from **RER_READY**, which serves the installed app and `/app`. The site does not block using or deploying the app.

## Start from a fresh clone

Install Git, then run one line to install the launcher, clone Cabin and start it:

```sh
npx -y @runeditrun/rer dev just-every/run-cabin
```

No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin` does the same and brings its own Node; it changes no shell settings, so if it prints an `export PATH=…` line, run that line to use `rer` again later. To set Cabin up without starting it, use `setup` in place of `dev`.

To start it again later, run `cd run-cabin && rer dev`. RER selects pinned Node 22.20.0 and pnpm 10.12.4, installs dependencies, migrates local D1 and prepares a local owner. First launch can take several minutes. Open the private **RER_OPEN** link from the terminal, confirm the owner on **Finish setup**, and open `/app`. Keep that link private. **RER_READY** is the ordinary app address. Run the same command again if interrupted. Stop with `rer dev --stop` or Ctrl-C.

For a lasting installation with your own mailbox, in place of the one line use `npx -y @runeditrun/rer setup just-every/run-cabin` (enter your email when prompted), then `rer dev` in the `run-cabin` folder. Development mail is silently suppressed. Use the local personas below to try manager and cleaner roles. Hosted installations use email invitations. No provider account or purchased domain is needed locally.

## Do the first jobs

1. **Properties & people:** add a property, owner name/email and commission. Commission is in basis points: 1500 means 15%. The installation owner adds an active cleaner and sends their invitation. Only the owner grants access. Managers operate the portfolio; cleaners see only their own jobs.
2. **Calendar:** under **Channel calendars**, paste each home's Airbnb, Vrbo and Booking.com calendar link; Cabin reads them every 15 to 60 minutes and shows last-synced time and any error. Choose **Create export links** and paste each Cabin link into its channel, so a night booked anywhere closes everywhere. **Take a request** declines any request that overlaps a held night and says why; **Block nights** closes nights for owner stays or maintenance. The grid shows every home by channel. Links are polled, so a channel can still sell a night before it hears; such a collision shows in red. Partner APIs come later. To move in or check a feed by hand, paste a channel's `.ics` file (try the [Airbnb](fixtures/airbnb.ics) and [Booking.com](fixtures/booking-com.ics) fixtures) and approve the exact review. See [Channel calendars](docs/calendars.md).
3. **Turnovers:** set each home's address, times, default cleaner and checklist once. Every stay then makes its own turnover between check-out and the next check-in, a door code for the guest and one for the cleaner, and emails the cleaner the window, address and code; moved or cancelled stays move or cancel them. The cleaner ticks every item and marks the home ready with several photos; broken things become maintenance tasks with photos, and **Readiness** shows which homes are ready for a day. Photos stay private to the job's people and managers. Locally, add the cleaner with email `cleaner@dev.localhost`. Run `rer dev --as cleaner` in another terminal and open its private RER_OPEN link in a separate browser profile. For a local manager use `manager@dev.localhost` and `rer dev --as manager`. Save the matching active team grant as owner first. These personas sign in locally without sending mail; hosted people use invitations.
4. **Inbox:** under **Inbox → Guest email**, enter the address you routed to Cabin with Cloudflare Email Routing. Each guest gets one thread with all their stays: check-in details with their door code, a checkout reminder and a review request go out on time from the stay's dates and move or cancel with it. Guest email lands in the thread with a drafted reply (from your own AI key, or a template) that is sent only when you send it. Texts wait on the owner's US A2P registration and Airbnb, Vrbo and Booking.com messages on partner accounts; the page says so. See [Guest inbox](docs/inbox.md).
5. **Statements:** choose a property and month, enter income/cost descriptions and USD amounts, then prepare. Review the owner, commission and net, approve the frozen revision and download CSV. Positive lines are income, negative lines are costs. Cabin does not collect payments or perform trust accounting.
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

The app can use a workers.dev address independently of run-cabin.com. Keep project, Worker and D1 identities in `deploy.json` and `wrangler.jsonc` stable. Deployment needs a Cloudflare account with a workers.dev subdomain, a scoped Workers/D1 token and a verified Resend sender. Fleet work uses only the RunEditRun account.

Set `MAIL_FROM` in `deploy.json` to your verified sender and commit that configuration. Supply `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `SESSION_SECRET`, `SETUP_TOKEN` and `MAIL_API_KEY` privately from your secret manager. Generate independent random session/setup secrets. Never put secrets in source or command arguments.

```sh
rer deploy --dry-run
rer deploy
rer signin
```

Dry run validates/builds without provider calls. Real deploy provisions resources, applies migrations, uploads the Worker and checks health. Open its returned origin. `rer signin` gives the configured owner a one-time sign-in link if email is not working yet; keep it private. Correct mail configuration before inviting people. Build and deployment do not run tests. Local checks do not prove provider delivery.

## Development

```sh
pnpm run test:cabin
pnpm run test:archive
pnpm run test:site
pnpm run typecheck
rer verify
```

GitHub Verify shards source, types, domain, restore, run site and production runtime checks. Package mode pins `@runeditrun/rer@0.2.40`. Foundation: Base `ada9f574d8a7247edc3a1180b593ad182b1fbb37`. [Source reuse](docs/source-notes.md), [operations](RUN-LOCALLY.md), [agent instructions](AGENTS.md).
