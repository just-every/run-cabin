# Cabin command contract

All private routes use the installation’s native operator session. The installation owner grants manager and cleaner access by email; a native member account alone grants no Cabin access. Every read, command, photo and CSV checks the current operator and grant. Revocation takes effect on the next request; mutation transactions fence authority again before committing.

`GET /api/cabin/state` returns the current state. `POST /api/cabin/command` accepts `{"name":"command.name","input":{}}` and returns `{"result":...}`. Human POSTs require the exact installation `Origin`; cross-site fetches are refused. This Origin check also protects plain HTML forms and multipart uploads from CSRF. Errors return `{"error":"..."}` with HTTP 400, 401, 403, 404 or 409. Domain money is always an integer number of cents.

The equivalent HTML routes are `/app`, `/app/calendar`, `/app/turnovers`, `/app/statements`, `/app/people`, `/app/import` and `/app/agent`. Forms POST to `/app/action?name=COMMAND&returnTo=/app/PAGE`. JSON and urlencoded bodies are accepted; photo completion also accepts multipart `photo`, `caption`, `checks`, `id` and `revision`. Requests are limited to 500,000 bytes. Revision UUIDs are opaque strings; property and member revisions are positive integers.

| Command | Input | Authority and result |
| --- | --- | --- |
| `property.save` | `name, ownerName, ownerEmail, commissionBps`; edits add `id, revision` | Owner. Returns the property and its integer revision. Commission is 0–10,000 basis points. |
| `member.save` | `name, email, role, active`; edits add `id, revision` | Owner. Role is `manager` or `cleaner`; `active` is an explicit boolean. Returns the grant. |
| `member.invite` | `id` | Owner. Sends a native invitation for an active grant. Never returns an invitation token. Development mail uses Base’s silent suppression. |
| `calendar.prepare` | `propertyId, channel, calendar` | Owner, manager or agent. Returns the immutable calendar review described below. |
| `calendar.approve` | `id, revision` | Owner or manager. Approves exactly the reviewed revision and records the human’s identity and time. |
| `turnover.prepare` | `bookingId, cleanerId, checklist: string[]` | Owner, manager or agent. Booking must be approved and confirmed; cleaner must have an active cleaner grant. Returns an immutable assignment draft. |
| `turnover.approve` | `id, revision` | Owner or manager. Publishes that exact checklist, cleaner and booking revision. A booking has at most one approved turnover. |
| `turnover.complete` | `id, revision, checks: string[], photo, mimeType, caption` | Only the currently assigned cleaner. `checks` must contain every approved checklist item once. `photo` is plain base64 PNG or JPEG, at most 256,000 decoded bytes, with matching MIME type. Returns the completed immutable evidence record. |
| `statement.prepare` | `propertyId, month, lines: [{description, amountCents}]`, optional `managementFeeCents` | Owner, manager or agent. Month is `YYYY-MM`. Returns a frozen draft including property/owner details and all money totals. |
| `statement.approve` | `id, revision` | Owner or manager. Property terms must still match the reviewed revision. Only one approved statement per property and month. |
| `agent.create` | `label` | Owner. Returns a random bearer token once, its ID and expiry. Credentials expire after 30 days and are bound to the current owner version. Only their hashes are stored. |
| `agent.revoke` | `id` | Owner. Revokes that credential immediately. |
| `privacy.erase` | `entity: "property", id, revision` | Owner. Erases the property, its bookings/calendar reviews, turnover checklist/photo evidence and statements. Also erases the property’s retained move-in source and invalidates older archive checkpoints. Destructive: export anything that must be kept before requesting erasure. |
| `privacy.erase` | `entity: "member", id, revision` | Owner. Erases only an unused, uninvited grant. Grants with turnover or native authentication history must be deactivated instead. |

Move-in commands, fingerprints, jobs, undo reports and CSV fixtures are specified in [move-in.md](move-in.md).

## Calendar semantics

Channels are `airbnb` and `booking.com`, case-insensitively. Upload the complete exported `.ics` contents in `calendar`; no provider credential or network fetch is needed. The importer supports unfolded RFC 5545 text, all-day dates and UTC date-times. Floating local times, recurrences and files without booking UIDs or explicit start/end dates are refused. Expand recurring calendars and export UTC times first. A cancelled event may omit dates only when its UID already belongs to a known booking.

All-day checkout dates are **end-exclusive**: a stay ending on the 5th does not clash with one starting on the 5th. Identical repeated UIDs in one file collapse; conflicting duplicate UIDs are refused. An approved property/channel/UID is reconciled into the existing booking, rather than duplicated.

A prepared review contains `id, revision, propertyId, channel, importedAt, events, changes, clashes, baseline, status, preparedBy, preparedAt`. Each change is `add`, `change`, `cancel` or `remove`. Each clash includes the two booking identifiers and the intersecting dates. Preparation changes no approved booking. Cancellation and removal take effect only when a human approves that exact review. A changed approved booking baseline invalidates an earlier prepared review. Approval stores an independent `{kind, recordId, revision, actorId, at}` record.

Feeds retain both the file import timestamp and approval timestamp. They are snapshots, without automatic polling or a guarantee of source freshness. Review clashes on the channel itself. **Cabin does not prevent double bookings.**

## Completion evidence

Cleaners see only their published jobs, the associated property names and booking dates, and their own grant. Owner contacts, commission terms, other cleaners’ jobs, statements, calendar reviews and import journals are withheld. Photo reads require the same current permission: `GET /api/cabin/turnovers/ID/photo` (or `/api/cabin/photos/PHOTO_ID`). Photo bytes are persisted in D1, authenticated on retrieval and included in installation archives. PNG structure and CRCs or JPEG marker structure are checked; base64 text and a MIME label alone are insufficient. Completion cannot be overwritten or submitted twice. A booking change invalidates completion authority for the old assignment until the manager reviews the job.

## Statement money and CSV

Positive lines are income and negative lines are expenses or adjustments. `grossCents` is the signed sum of all lines, including costs, and must be non-negative. The default management fee applies the property’s commission to this net line sum: `round-half-up(grossCents × commissionBps / 10,000)`, calculated with integer arithmetic. An explicit management fee may be any integer from zero to that sum. `netCents = grossCents - managementFeeCents`. Review that base before approval; Cabin does not infer channel fees or reconcile payments.

Approval freezes owner details, lines, commission and fee. Later property edits do not change the approved CSV. `GET /api/cabin/statements/ID.csv` is restricted to owner/manager sessions and exports all amounts in integer cents, with spreadsheet formula protection on text cells. These are operational statements, not payment processing, trust accounting, bank reconciliation or tax statements.

## Agent door

Use `Authorization: Bearer TOKEN` with `GET /api/cabin/agent/context` and `POST /api/cabin/agent/command`. The only agent commands are `calendar.prepare`, `turnover.prepare` and `statement.prepare`. Bearer routes require a live key; a human cookie cannot substitute. Ordinary human routes require the native session; a bearer token cannot substitute. Agents cannot approve, complete a checklist, manage people, issue invitations or credentials, erase data, or apply/undo imports. A human must inspect and approve the exact prepared revision.
