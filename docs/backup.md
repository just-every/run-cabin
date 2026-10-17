Everything Cabin holds lives in your own installation. For a local installation, one command exports an archive and another restores it into a fresh copy. Hosted data needs a separate remote database backup below.

## Export

Stop the app first, then export to a file in the `exports` folder (or anywhere private):

```sh
rer dev --stop
rer export --output exports/cabin.rer
```

Keep archives private: they hold your owners' details, bookings, photos and statements.

## Back up a hosted installation

Local `rer export` reads the local installation. It cannot back up a hosted Cabin, and refuses when you name a hosted address.

Before removing hosting, stop new bookings and operational writes while you capture a consistent backup. Then, from the Cabin folder you deployed from, run:

```sh
rer run backup:hosted -- --env-file .env.cabin
```

For another environment add `--environment NAME`, for example `--environment trial`. This works for an install.sh install: `rer run` uses the Node and pnpm rer keeps for itself, so you need no `pnpm`, `npx` or Node of your own. It reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from `.env.cabin`, finds the environment's database in the deploy record rer keeps in `.rer/deploy`, and saves it with Wrangler to `exports/cabin-ENVIRONMENT-db-DATE.sql`, readable only by you (mode 600). It prints how many rows it saved and refuses an empty backup. Cabin keeps its operational records and turnover photos in that database and creates no R2 storage, so this one file is the whole hosted installation's data. Keep it and a private copy of `.env.cabin` and `.rer/deploy` securely: it holds guests, owners, bookings and photos.

This is a database SQL backup, not a `.rer` archive for `rer import`.

### Restore a hosted backup

Restore into a new, separate hosted environment, never over the one you are replacing:

```sh
rer deploy --environment restored --env-file .env.cabin
rer run backup:hosted -- --restore exports/FILE.sql --environment restored --env-file .env.cabin --yes
```

The first command creates a fresh Cabin with its own Worker and database. The second replaces every table in that new database with the backup. Then sign in to the new address again and re-enter private settings sealed with the old installation's secret: saved Stripe keys and the inbox AI key. Check the homes, stays and statements before pointing guests or a domain at it. See [hosting and irreversible removal](/docs/hosting#remove-a-deployment).

## What an archive holds

| Travels in the archive | Does not travel |
| --- | --- |
| Homes, owners and commission | Sessions and sign-in links |
| Team members and their access | Agent tokens |
| Calendar reviews and bookings | Private configuration |
| Turnover jobs, checklists and photos | Development mail |
| Owner statements and approvals | |
| Move-in journals and their source files | |

## Restore

Restore into a fresh clone of the **same version** of Cabin, before setup or any data entry:

```sh
rer install
rer import --input ~/cabin-backups/cabin.rer --yes
rer setup
rer dev
```

At setup, use the original installation owner's email. Then enter your private configuration again and sign in. Cabin refuses a damaged archive, and refuses to restore over an installation that already has data.

## Erase a home

As the owner, open **Properties & people**, then **Erase property data** on the home's card. This permanently removes the home with its calendars, bookings, turnovers and photos, statements and move-in source. It cannot be undone, so export first if you need to keep anything.

An archive made before the erasure still contains the home. To restore it without bringing the home back, supply a later archive from the same installation as its journal:

```sh
rer import --input OLD.rer --journal LATER.rer --yes
```

Old copies kept offline cannot learn about a later erasure by themselves: protect or retire them.

## Start over

`rer reset --yes` deletes the local data and settings of this copy. Archives you exported are kept.
