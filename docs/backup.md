Everything Cabin holds lives in your own installation. For a local installation, one command exports an archive and another restores it into a fresh copy. Hosted data needs a separate remote database backup below.

## Export

Stop the app first, then export to a file in the `exports` folder (or anywhere private):

```sh
rer dev --stop
rer export --output exports/cabin.rer
```

Keep archives private: they hold your owners' details, bookings, photos and statements.

## Back up a hosted installation

Local `rer export` reads the local installation. It cannot back up a hosted Cabin, and `--origin` does not turn it into a hosted export.

Before removing hosting, stop new bookings and operational writes while you capture a consistent backup. In Cloudflare’s dashboard open **Storage & databases → D1**, select this environment’s database and confirm its name against the deployment record in `.rer/deploy`. The default production name is `cabin-production-db`; an environment named `trial` uses `cabin-trial-db`.

With `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` privately available in your shell, run from the Cabin checkout:

```sh
mkdir -p exports
pnpm exec wrangler d1 export cabin-production-db --remote --output exports/cabin-production.sql
chmod 600 exports/cabin-production.sql
```

For another environment, replace the database name and output filename with that environment’s. Wrangler reads the credentials from your environment; it does not read `.env.cabin` automatically. Confirm the export succeeded and that the SQL file is nonempty before removal. Keep it and a private copy of the deploy configuration securely. Cabin stores its operational records and photos in D1; if you have extended your installation with other storage, back that up separately.

This is a database SQL backup for administrator recovery with Wrangler, not a `.rer` archive for `rer import`. Restore into a separately prepared D1 database with `wrangler d1 execute DATABASE --remote --file BACKUP.sql`, review the data there and re-establish private settings and sign-in before serving users. Do not restore over a populated installation. See [hosting and irreversible removal](/docs/hosting#remove-a-deployment).

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
