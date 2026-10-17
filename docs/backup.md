Everything Cabin holds lives in your own installation. One command exports it to a single archive you keep; another restores that archive into a fresh copy.

## Export

Stop the app first, then export to a file in the `exports` folder (or anywhere private):

```sh
rer dev --stop
rer export --output exports/cabin.rer
```

Keep archives private: they hold your owners' details, bookings, photos and statements.

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
