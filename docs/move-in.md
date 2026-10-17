Cabin's property-register move-in kit (version 1) brings in your homes, their owners and your commission on each from one spreadsheet. You preview it first, approve the exact plan, and can undo it while the imported homes are unchanged. It moves homes only: it does not bring in bookings, people, statements or photos.

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

A file holds up to 100 rows and 100,000 bytes of UTF-8 (a byte-order mark is fine). Quoted commas and line breaks are supported. Cabin refuses malformed quoting, wrong columns, duplicate IDs, fractional commission and invalid email, and says which.

## Move in from the app

1. Sign in as the installation owner and open **Move in**.
2. Paste the CSV into **Property register CSV** and choose **Preview move-in**. This is a dry run: Cabin stores the plan and its fingerprint but creates no home.
3. Read the plan under **Import journal**: each home with its owner and commission, and any conflicts. An external ID that already exists, or belongs to an erased home, is never overwritten; correct the file and preview again.
4. Choose **Approve this import**. Cabin records who approved it and applies exactly the plan you read; a changed file cannot be swapped in at this point.
5. Cabin applies ten homes per request. If the journal shows the import still running, choose **Continue approved import** until it reads completed. **Read import journal** shows its progress and the original file.

## Undo

Choose **Undo imported properties** on a completed import. Homes still exactly as imported are removed. Homes you have since edited, or that now have calendars, turnovers or statements, are kept and listed in the undo report: undo never overwrites your later work. A large undo may need **Continue approved import** again.

## Through the command API

The same steps are commands for scripts run as the owner: `import.preview` with `{csv}`, `import.approve` with `{id, fingerprint}`, `import.resume` with `{id}`, `import.journal` with `{id}` and `import.undo` with `{id}`. `GET /api/cabin/state` includes each review with its job state, checkpoint, total and error. Agents cannot preview, apply or undo imports. See the [Command reference](/docs/commands).

## Privacy and archives

An import keeps the original CSV bytes as a record of where your homes came from; treat its journal as private owner data. Erasing a home also removes its retained source and the before-images that undo would use. The whole source CSV becomes unavailable, including its other rows' original bytes, while the other homes stay. Unapproved plans that contain the erased home are withdrawn, and older archives can no longer bring the erased home back when the later archive is supplied (see [Back up, restore and erase](/docs/backup)).

## Next: calendars

With your homes in, bring in their channel calendars: [Channel calendars](/docs/calendars) has sample files to try on any home.
