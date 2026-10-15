# Cabin property-register move-in kit v1

This named kit imports a property register from a small holiday-rental manager’s spreadsheet. It uses the pinned Base import-kit’s actual D1 adapter: immutable reviewed plans, exact source-byte custody, durable application/provenance journal and guarded undo. It does not infer bookings or create people, invitations, agent credentials, payments or background jobs.

The working fixture is [properties.csv](../fixtures/properties.csv). Preserve these exact columns and their order:

```csv
external_id,name,owner_name,owner_email,commission_bps
home-one,Banksia House,Morgan Lee,morgan@stay.example,1500
home-two,Ocean Loft,Alex Chen,alex@stay.example,1000
```

Identifiers contain 1–100 ASCII letters, digits, underscores or hyphens. Names are at most 160 characters; owner email is required. Commission is an integer number of basis points, from 0 to 10,000. `1500` means 15%. Use stable external IDs. Two properties may have the same owner, but external IDs must be unique within the file. The parser supports RFC 4180 quoted commas and newlines and UTF-8 with an optional BOM. It refuses malformed quoting, wrong columns, duplicate IDs, fractional commission and invalid email. Limits are 100 rows and 100,000 UTF-8 bytes.

1. Sign in as the installation owner. Open `/app/import`, paste the CSV and choose **Preview move-in**, or call `import.preview` with `{csv}`. This performs a dry run; it stores an immutable plan but creates no property.
2. Inspect the returned `properties`, `counts`, `diagnostics` and `conflicts`, together with the `id` and SHA-256 `fingerprint`. Existing external IDs and erased identities cannot be overwritten. Correct the source file and preview again when there is a conflict.
3. Approve the exact stored plan using `import.approve` with `{id,fingerprint}`. Approval records the human actor and exact fingerprint independently. The importer uses the retained plan; it never accepts replacement CSV at approval time. A changed fingerprint or newly conflicting property refuses publication.
4. The result contains `{id,job}`. `GET /api/cabin/state` includes the review and its `jobId`, `state`, checkpoint, total and error. `import.journal` with `{id}` returns the durable job, source originals and applied batch ranges. Job state survives a process restart and is included in installation archives.
5. Each request processes at most ten records. If the job remains `queued` or `applying`, call `import.resume` with `{id}` until `completed`. The same reviewed authority is rechecked inside every batch. Failed requests do not turn partially applied jobs into completed ones.
6. To reverse a completed move-in, call `import.undo` with `{id}`. The result includes `job` and the explicit Base undo `report`. Pristine imported properties are removed. Later native edits and properties with calendar/statement/turnover dependencies are retained and reported; undo never overwrites those changes. Large reversals can require another `import.resume` request. Inspect the report rather than treating `undone` as a claim that every native row was removed.

Commands are owner-only and require the same Origin/CSRF check as other human writes. Agents cannot preview, apply or reverse imports. An import stores the original CSV bytes for source custody and operational review; treat that journal as private owner data. Authorization and collision guards execute in the same real D1 batch as target changes.

Property erasure uses Base’s `retireD1ImportCustody` to remove the erased property’s retained source, originals, effects and reversible before-images, keeping anonymous journal attribution. An affected source CSV becomes unavailable as a whole, including its other rows’ original bytes; other properties’ normalized records and reversible effects remain. Approved review metadata and its job remain addressable; redundant private review-plan bytes are removed. Unapproved plans containing the erased property are withdrawn. The same batch records Base’s archive redaction checkpoint and invalidates in-flight exports/restores, so an older archive cannot resurrect erased records when the later erasure journal is supplied.

For calendar follow-on work, use [airbnb.ics](../fixtures/airbnb.ics) and [booking-com.ics](../fixtures/booking-com.ics) on the same imported property. Prepare each calendar and approve its exact revision. They deliberately overlap, demonstrating a clash flag without claiming prevention. [airbnb-removed.ics](../fixtures/airbnb-removed.ics) is a complete empty snapshot: it proposes removal but cancels no booking until approved. [airbnb-cancelled.ics](../fixtures/airbnb-cancelled.ics) demonstrates explicit cancellation. The dates are fixture dates, not live availability.
