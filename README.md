# Cabin

Holiday-rental operations for an Australian host or manager with 3–40 short-stay properties: calendar imports, cleaner photo checklists and approved owner statements. MIT licensed. [First-release scope](ACCEPTANCE.md).

The run site is **local for now**. Run `rer dev`, then open `http://127.0.0.1:<port>/run`, using the port in the **RER_SITE** address RER prints. Its port differs from **RER_READY**, which serves the installed app and `/app`. `https://run-cabin.com` goes live once its domain is registered. Registration does not block using or deploying the app.

## Start from a fresh clone

Install Git and Node 22 or newer, then install the launcher once:

```sh
npx -y @runeditrun/rer cli install
export PATH="$HOME/.local/bin:$PATH"
git clone https://github.com/just-every/run-cabin.git
cd run-cabin
rer dev
```

RER selects pinned Node 22.20.0 and pnpm 10.12.4, installs dependencies, migrates local D1 and prepares a local owner. First launch can take several minutes. Open the private **RER_OPEN** link from the terminal, confirm the owner on **Finish setup**, and open `/app`. Keep that link private. **RER_READY** is the ordinary app address. Run the same command again if interrupted. Stop with `rer dev --stop` or Ctrl-C.

For a lasting installation with your own mailbox, before the first launch in a fresh clone use `rer install`, `rer setup` (enter your email when prompted), then `rer dev`. Development mail is silently suppressed. Use the local personas below to try manager and cleaner roles. Hosted installations use email invitations. No provider account or purchased domain is needed locally.

## Do the first jobs

1. **Properties & people:** add a property, owner name/email and commission. Commission is in basis points: 1500 means 15%. The installation owner adds an active cleaner and sends their invitation. Only the owner grants access. Managers operate the portfolio; cleaners see only their own jobs.
2. **Calendar:** paste each channel's exported `.ics` file for the same property. Prepare and inspect changes and clashes, then approve each exact snapshot. Try the documented [Airbnb](fixtures/airbnb.ics) and [Booking.com](fixtures/booking-com.ics) fixtures. Feed freshness shows the last approved import time. Refresh manually from the source: files can lag and **Cabin never prevents double bookings**. Edits, cancellations and removals need a fresh human approval.
3. **Turnovers:** choose a departing booking, active cleaner and checklist. Prepare, review and approve the assignment. The cleaner signs in, checks every item and uploads a JPEG or PNG photo (up to 256 KB) with a caption. Photos stay private to the assigned cleaner and managers. Locally, add the cleaner with email `cleaner@dev.localhost`. Run `rer dev --as cleaner` in another terminal and open its private RER_OPEN link in a separate browser profile. For a local manager use `manager@dev.localhost` and `rer dev --as manager`. Save the matching active team grant as owner first. These personas sign in locally without sending mail; hosted people use invitations.
4. **Statements:** choose a property and month, enter income/cost descriptions and AUD amounts, then prepare. Review the owner, commission and net, approve the frozen revision and download CSV. Positive lines are income, negative lines are costs. Cabin does not collect payments or perform trust accounting.
5. **Move in:** paste the [Cabin property-register CSV](fixtures/properties.csv), preview its dry run, inspect the plan and approve. The durable journal shows progress. Undo removes unchanged imports and preserves native edits. Read the [format and undo guide](docs/move-in.md). Fixtures document Cabin's input shape; they are not claimed vendor exports.
6. **Agent access:** create a preparation token, copy it once into private configuration, and use the [command API](docs/commands.md). Agents prepare calendar, turnover and statement drafts; people approve. Every approval records its actor and exact revision. Revoke a token to end access immediately.

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
pnpm run typecheck
rer verify
```

GitHub Verify shards source, types, domain, restore and production runtime checks. Package mode pins `@runeditrun/rer@0.2.22`. Foundation: Base `ada9f574d8a7247edc3a1180b593ad182b1fbb37`. [Source reuse](docs/source-notes.md), [operations](RUN-LOCALLY.md), [agent instructions](AGENTS.md).
