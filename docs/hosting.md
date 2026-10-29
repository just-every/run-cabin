Cabin runs locally without provider accounts. To let owners, cleaners and guests reach it from anywhere and receive email, deploy your own installation to Cloudflare. The hosted database starts separately from the one on your computer.

## Prepare Cloudflare and email

1. In your [Cloudflare dashboard](https://dash.cloudflare.com), open **Workers & Pages** and set your account’s `workers.dev` subdomain if this is your first Worker. Cabin can use this address without a purchased domain.
2. Copy the **Account ID**. Under [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens), create a custom token with account permissions **Workers Scripts: Edit** and **D1: Edit**, scoped to your account.
3. Choose a mail provider: `sendgrid`, `resend` or `cloudflare`. Verify your sending address/domain with that provider and obtain its sending API key. Cloudflare mail also needs its **Account ID** as `MAIL_ACCOUNT_ID`. Keep these credentials private. Receiving guest mail through Cloudflare Email Routing needs your own domain on Cloudflare; see [Guest inbox](/docs/inbox).

## Save private deploy inputs

In the Cabin checkout create `.env.cabin` with your own values:

```sh
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-scoped-deploy-token
OWNER_EMAIL=you@example.com
MAIL_API_KEY=your-mail-provider-api-key
```

Set `MAIL_PROVIDER` (`sendgrid`, `resend` or `cloudflare`) and `MAIL_FROM` (a verified sender address) in the plain `vars` block of `wrangler.jsonc`. For `MAIL_PROVIDER=cloudflare`, also set the plain `MAIL_ACCOUNT_ID` to the mail account’s ID; managed mail uses the plain `MAIL_RELAY_URL`. These settings are deployed with the Worker; changing them requires another build and deploy. Connect Stripe directly under **Direct bookings → Connect Stripe**: save a test key, complete the $1 test checkout, then save a live key when ready to charge real guests. See [Direct bookings](/docs/direct-bookings). Server configuration is also supported: `STRIPE_TEST_SECRET_KEY` takes an `sk_test_` key from the [Stripe test API keys page](https://dashboard.stripe.com/test/apikeys), and `STRIPE_SECRET_KEY` takes an `sk_live_` key from the live dashboard. Keep both private. Statement payout import currently supports test-mode paid automatic USD payouts only, even when direct bookings use live mode.

The remaining secret settings are optional; `rer deploy` lists the ones you have not set, and Cabin runs without them:

| Setting | What it turns on |
| --- | --- |
| `STRIPE_TEST_SECRET_KEY`, `STRIPE_SECRET_KEY` | Direct-booking payments, if you prefer server configuration to saving keys under **Direct bookings → Connect Stripe**. |
| `SEAM_API_KEY` | Smart-lock door codes through your Seam account ([Turnovers](/docs/turnovers)). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Texts to guests through your Twilio number ([Guest inbox](/docs/inbox)). |
| `CABIN_WORKER_NAME` | Only for a Cabin on your own domain: the Worker name (such as `cabin-production`) the Inbox setup card shows, since a custom address does not reveal it. A `workers.dev` address needs nothing. |

RER generates and privately saves `SESSION_SECRET` and `SETUP_TOKEN`; you do not have to create them. The initial setup token is used to claim the hosted owner and removed after that claim. Keep `.rer/deploy` private and retained for later updates and removal. `.env*` files are gitignored; do not force-add them.

Stop the local app first if it is running (`rer dev --stop`): a deploy refuses while `rer dev` owns this checkout.

```sh
chmod 600 .env.cabin
rer deploy --env-file .env.cabin --dry-run
rer deploy --env-file .env.cabin
```

The first command builds and checks locally without contacting providers. The second creates resources in your account, applies database migrations, uploads the Worker and secrets, checks health and claims `OWNER_EMAIL` as the hosted owner. If a first deploy stops with a Cloudflare error such as `provider-http-500` or code 10500, run the same command again: rer continues where it stopped. Open the address it prints, request a sign-in email and finish setup. A successful deploy does not prove email delivery: check your mailbox and mail provider before inviting others. If needed, `rer signin --env-file .env.cabin` prints a private one-time owner sign-in link.

The default environment is `production`: its Worker is `cabin-production` and D1 database is `cabin-production-db`. For another environment add `--environment NAME` to each deploy, sign-in, secret update and removal command. For example, environment `trial` uses Worker `cabin-trial` and database `cabin-trial-db`.

## Update a private setting

Change the value in your private file, then apply it without rebuilding:

```sh
rer deploy --set-secret STRIPE_TEST_SECRET_KEY --env-file .env.cabin
```

Use the same pattern with a different declared binding name, such as `SEAM_API_KEY` for smart locks or `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` for texts; the Turnovers and Inbox pages print the exact command with your Worker's environment. For local settings, edit `.dev.vars` instead and restart with `rer dev --stop` then `rer dev`. Mail remains suppressed locally.

## Remove a deployment

Removal is irreversible: it deletes the recorded Worker and all D1, R2, KV and queues that RER created for this environment, with their data. First [back up the hosted database](/docs/backup#back-up-a-hosted-installation), and retain your private settings separately. Local `rer export` does not back up hosted data.

From the same checkout that deployed it, with the same Cloudflare account and `.rer/deploy` records, remove the default production environment:

```sh
rer deploy --remove --yes --env-file .env.cabin
```

For a named environment:

```sh
rer deploy --environment trial --remove --yes --env-file .env.cabin
```

`--yes` confirms permanent deletion. RER reads back every recorded resource and reports **read back: none of them remains** after successful removal. A deployment already empty removes nothing. If readback fails, follow the reported repair and rerun the same removal command; do not delete the local deployment records before confirmation. Other environments and the separate run-cabin.com site are outside this removal.
