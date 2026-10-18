Cabin can move homes, owners, guests, reservations and opening owner balances from Guesty, Hostaway or OwnerRez exports. You preview a saved plan, import its accepted rows, compare source totals with the saved Cabin records, then sign off the cutover. The original homes-only property-register kit remains available under **Property-register CSV · homes only**.

## Provider exports

1. Sign in as the installation owner and open **Move in**. Select Guesty, Hostaway or OwnerRez and the cutover date used for future-night and opening-balance reconciliation.
2. Select the original native exports together under **Native export files**. Add a supplementary cutover CSV for ownership, commissions, opening balances and iCal links missing from the exports. OwnerRez's Date Range export also needs supplementary reservation rows identifying channel and status. Use the exact supported report headings and cutover columns in [Move-in formats](/docs/move-in-formats); Cabin does not guess missing provider fields.
3. Choose **Preview exports**. This stores the source mapping, accepted rows, row refusals and fingerprint without creating homes, guests or reservations.
4. Review **Source → Cabin**, then expand the homes, reservations, guests and opening-balance tables. In a preview, the Cabin column represents the accepted plan. Refused rows show their file, row, record kind, source ID where available, and reason. Correct the files and preview again, or import the accepted records with the refusals explicitly excluded.
5. Choose **Import accepted records**. This applies exactly the saved fingerprint. Reconciliation now compares source totals with the imported records actually saved in Cabin: reservation count, confirmed future nights from the cutover date, and opening owner balances.
6. Explain every source-to-Cabin difference and account for every refused row, tick the review confirmation, then choose **Sign off cutover**. Sign-off records your explanations and time; an import with unexplained differences or refusals cannot be signed off.

Opening balances are cutover amounts, not recreated historical statements. Review the imported reservations on the shared calendar: confirmed imported stays block availability. Retained iCal links support ongoing calendar refresh on a self-hosted installation. RER managed hosting cannot refresh outbound iCal feeds; file imports still work there.

**Provider APIs are not connected.** Export imports work independently. The documented API adapters have been exercised only with recorded synthetic fixtures; live provider acceptance requires owner accounts. These fixtures are test evidence, not customer data or a live connection.

## Undo a provider import

Choose **Undo provider import** on an imported or signed-off job. Undo checks that the imported records remain unchanged and have no later dependent work before removing them. If a later change prevents undo, Cabin reports the conflict rather than overwriting that work. The job and its review evidence remain visible after undo.

## Provider command API

The owner can use `import.provider.preview` with `provider`, `asOf` (`YYYY-MM-DD`) and source files; the app submits files as repeated `sourceFiles` fields in a multipart form. The saved job includes its normalized plan, source-column mappings, refusals, fingerprint and reconciliation. Use `import.provider.apply` with `{id, fingerprint}` to import that plan, and `import.provider.undo` with `{id}` to undo it.

Use `import.provider.signoff` with `id`, `fingerprint`, `confirm: "yes"` and the relevant explanation fields: `reservationsExplanation`, `futureNightsExplanation`, `ownerBalanceCentsExplanation`, and `refusalsExplanation`. A metric explanation is required when that metric differs; the refusals explanation is required when any row was refused. `GET /api/cabin/state` includes saved provider jobs alongside the original property-register jobs. Agents cannot perform move-in commands.

## Property-register kit

The property-register kit (version 1) brings in homes, owners and commissions from one spreadsheet. It does not import bookings, guests, balances, statements or photos. You preview it first, approve the exact plan, and can undo it while imported homes are unchanged.

## The CSV

Save your register as a CSV with exactly these five columns, in this order. The working example is [properties.csv](https://github.com/just-every/run-cabin/blob/main/fixtures/properties.csv):

```csv
external_id,name,owner_name,owner_email,commission_bps
home-one,Seabreeze Cottage,Morgan Lee,morgan@stay.example,1500
home-two,Ocean Loft,Alex Chen,alex@stay.example,1000
```

| Column | Rule |
| --- | --- |
| `external_id` | Your own stable ID for the home: 1–100 ASCII letters, digits, underscores or hyphens, unique in the file. |
| `name` | The home's name, at most 160 characters. |
| `owner_name` | The owner's name. Two homes may share an owner. |
| `owner_email` | Required, and must be a valid email address. |
| `commission_bps` | Whole basis points from 0 to 10,000: `1500` means 15%. |

A file holds up to 100 rows and 100,000 bytes of UTF-8 (a byte-order mark is fine). Quoted commas and line breaks are supported. Cabin refuses the file for malformed quoting or wrong columns. It lists invalid fields, fractional commissions, invalid email and later duplicate-ID rows as refused rows, with their source line and reason; those rows are excluded from the saved plan. Correct the CSV and preview again, or approve only its accepted properties.

## Move in with the property-register kit

1. Sign in as the installation owner and open **Move in**.
2. Paste the CSV into **Property register CSV** and choose **Preview move-in**. This is a dry run: Cabin stores the plan and its fingerprint but creates no home.
3. Read the plan under **Import journal**: each accepted home with its normalized owner and commission, every refused row and its source line, the fingerprint, and any conflicts. These remain visible when you reload the page. An external ID that already exists, or belongs to an erased home, is never overwritten; correct the file and preview again.
4. Choose **Approve this import**. Cabin records who approved it and applies exactly the plan you read; a changed file cannot be swapped in at this point.
5. Cabin applies ten homes per request. If the journal shows the import still running, choose **Continue approved import** until it reads completed. **Read import journal** shows its progress, original source availability and saved undo dispositions. The command journal includes the exact original bytes, including the byte-order mark and line endings.

## Undo

Choose **Undo imported properties** on a completed import. Homes still exactly as imported are removed. Homes you have since edited, or that now have calendars, turnovers, statements, owner work, tax records or ledger history, are kept and listed in the undo report: undo never overwrites your later work. A large undo may need **Continue approved import** again.

## Through the command API

The same steps are commands for scripts run as the owner: `import.preview` with `{csv}`, `import.approve` with `{id, fingerprint}`, `import.resume` with `{id}`, `import.journal` with `{id}` and `import.undo` with `{id}`. `GET /api/cabin/state` includes each review with its job state, checkpoint, total and error. Agents cannot preview, apply or undo imports. See the [Command reference](/docs/commands).

## Privacy and archives

An import keeps the original CSV bytes as a record of where your homes came from; treat its journal as private owner data. Erasing a home also removes its retained source and the before-images that undo would use. The whole source CSV becomes unavailable, including its other rows' original bytes, while the other homes stay. Unapproved plans that contain the erased home are withdrawn, and older archives can no longer bring the erased home back when the later archive is supplied (see [Back up, restore and erase](/docs/backup)).

## Next: calendars

With your homes in, bring in their channel calendars: [Channel calendars](/docs/calendars) has sample files to try on any home.
