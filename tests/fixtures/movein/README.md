# Synthetic move-in fixtures

All names, contacts, balances and URLs here are synthetic. No provider account was contacted. Reserved `example.com` addresses and calendar links cannot establish a live connection.

Upload every `.csv` in one provider directory, choose that provider, and set cutover to `2026-10-17`:

| Directory | Native report | Additional files |
| --- | --- | --- |
| `guesty/` | Guesty reservations report, configured documented columns | Properties report and `cabin-cutover-guesty.csv` |
| `hostaway/` | Financial Reporting > Rental Activity > Reservations report | `cabin-cutover-hostaway.csv` |
| `ownerrez/` | Reports > Stay Reports > Date Range, CSV projection of official display headers | `cabin-cutover-ownerrez.csv` |

Each bundle normalizes to 2 homes, 3 reservation rows (2 confirmed, 1 canceled), 3 guest records, 7 confirmed future nights, 2 opening balance lines totaling **175042 USD cents**, and 6 retained channel links, with no parser refusals.

The Cabin cutover CSV is explicitly operator-supplied supplemental data. It carries real-source ID mappings, owner terms, verified opening balances, and existing external channel feed URLs that are absent from the native report. OwnerRez's report lacks booking channel/status, so those values are supplemental too. The canceled OwnerRez row represents a report snapshot whose cancellation was verified afterward at cutover; the fixture does not invent a native status column.

`api/*.json` contains harness objects wrapping separate documented API responses. They are synthetic response-shaped projections, not captured real account data. `adaptRecordedApi` is a pure offline adapter, and the application upload path refuses JSON. The Guesty fixture uses current V3 search and includes guest-detail, owner-statement and imported-calendar evidence. Hostaway embeds guests in reservation responses. OwnerRez uses paginated `items` and omitted empty values. No adapter invents owner opening balances or a missing provider endpoint.

See [format profiles, limitations and official sources](../../../docs/move-in-formats.md). From the app root, run `node --test tests/movein.test.mjs` for the public move-in flow and integrated API fixture checks.
