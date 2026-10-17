All private routes use the installation’s native operator session. The installation owner grants manager and cleaner access by email; a native member account alone grants no Cabin access. Every read, command, photo and CSV checks the current operator and grant. Revocation takes effect on the next request; mutation transactions fence authority again before committing.

`GET /api/cabin/state` returns the current state. `POST /api/cabin/command` accepts `{"name":"command.name","input":{}}` and returns `{"result":...}`. Human POSTs require the exact installation `Origin`; cross-site fetches are refused. This Origin check also protects plain HTML forms and multipart uploads from CSRF. Errors return `{"error":"..."}` with HTTP 400, 401, 403, 404 or 409. Domain money is always an integer number of cents.

The equivalent HTML routes are `/app`, `/app/calendar`, `/app/readiness`, `/app/turnovers`, `/app/maintenance`, `/app/statements`, `/app/people`, `/app/import` and `/app/agent`. Forms POST to `/app/action?name=COMMAND&returnTo=/app/PAGE`. JSON and urlencoded bodies are accepted; forms with photos also accept multipart, with each photo in a `photoFiles` field (up to 256 KB each). Requests are limited to 4,000,000 bytes. Revision UUIDs are opaque strings; property and member revisions are positive integers.

| Command | Input | Authority and result |
| --- | --- | --- |
| `property.save` | `name, ownerName, ownerEmail, commissionBps`; edits add `id, revision` | Owner. Returns the property and its integer revision. Commission is 0–10,000 basis points. |
| `member.save` | `name, email, role, active`; edits add `id, revision` | Owner. Role is `manager` or `cleaner`; `active` is an explicit boolean. Returns the grant. |
| `member.invite` | `id` | Owner. Sends a native invitation for an active grant. Never returns an invitation token. Development mail uses Base’s silent suppression. |
| `calendar.prepare` | `propertyId, channel, calendar` | Owner, manager or agent. Returns the immutable calendar review described below. |
| `calendar.approve` | `id, revision` | Owner or manager. Approves exactly the reviewed revision and records the human’s identity and time. |
| `channel.connect` | `propertyId, channel, url`, optional `intervalMinutes` (15–60, default 15) | Owner or manager. Saves the channel's https iCal link for that home and syncs it at once. Returns `{connection, changes}`. Refused with 409 on RER Managed hosting, which cannot reach channels yet. |
| `channel.sync` | `id` | Owner or manager. Reads that link now. A failed read marks it `stale` with `error` and keeps its last nights. |
| `channel.disconnect` | `id` | Owner or manager. Stops reading the link; its stays remain. |
| `export.publish` | `propertyId` | Owner or manager. Creates or replaces the home's secret export token; old links stop working. |
| `reservation.request` | `propertyId, kind: "stay"\|"block", start, end` (`YYYY-MM-DD`, checkout exclusive); stays add `channel, guestName`, optional `arrivalTime` (`HH:MM`); blocks optional `note` | Owner or manager. Returns the request with `status` `accepted` (and `bookingId`) or `declined` with `reason` and the overlapping booking in `overlaps`. |
| `reservation.cancel` | `id` (booking) | Owner or manager. Cancels a hold or block made in Cabin. Channel stays are cancelled on the channel. |
| `booking.details` | `id`, optional `guestName, arrivalTime` | Owner or manager. Sets or clears a stay's guest name and arrival time. |
| `turnover.prepare` | `bookingId, cleanerId, checklist: string[]` | Owner, manager or agent. Booking must be approved and confirmed; cleaner must have an active cleaner grant. Returns an immutable assignment draft. |
| `turnover.approve` | `id, revision` | Owner or manager. Publishes that exact checklist, cleaner and booking revision, replacing the stay's open dispatched turnover; refused when the stay's turnover is already done. |
| `turnover.assign` | `id, revision, cleanerId` | Owner or manager. Assigns or reassigns an open turnover; the new cleaner gets fresh door-code digits and an email, the previous one is told. |
| `turnover.checkout` | `id` | The assigned cleaner ("Guests have left") or an owner or manager. Records the actual check-out time and who found it, once per open turnover; marking ready records it if nobody did. |
| `turnover.complete` | `id, revision, checks: string[], photos: [{photo, mimeType}], caption` | Only the currently assigned cleaner. `checks` must contain every approved checklist item once. At least the home's required number of photos, up to 12; each `photo` is plain base64 PNG or JPEG, at most 256,000 decoded bytes, with matching MIME type (a single `photo` and `mimeType` is one photo). Returns the completed immutable evidence record. |
| `home.settings` | `propertyId, revision, address, timeZone, checkInTime, checkOutTime, cleanerId?, maintenanceId?, checklist: string[], photosRequired, lockDeviceId?` | Owner or manager. A home's turnover settings; `revision` is the current settings revision (omit for the first save). Every stay is dispatched with them. |
| `task.raise` | `title, note?, blocking, photos?` plus `turnoverId` (cleaner, their own turnover) or `propertyId` or `turnoverId` (manager, who may add `assigneeId`) | A maintenance task with up to 6 photos, assigned to `assigneeId` or the home's maintenance person, who is emailed. |
| `task.assign` | `id, revision, assigneeId, blocking` | Owner or manager. |
| `task.close` | `id, revision, note?, photos?` | Owner, manager or the task's assignee. |
| `statement.prepare` | `propertyId, month, lines: [{description, amountCents}]`, optional `managementFeeCents` | Owner, manager or agent. Month is `YYYY-MM`. Returns a frozen draft including property/owner details and all money totals. |
| `statement.approve` | `id, revision` | Owner or manager. Property terms must still match the reviewed revision. Only one approved statement per property and month. |
| `agent.create` | `label` | Owner. Returns a random bearer token once, its ID and expiry. Credentials expire after 30 days and are bound to the current owner version. Only their hashes are stored. |
| `agent.revoke` | `id` | Owner. Revokes that credential immediately. |
| `privacy.erase` | `entity: "property", id, revision` | Owner. Erases the property, its bookings/calendar reviews, turnover checklist/photo evidence and statements. Also erases the property’s retained move-in source and invalidates older archive checkpoints. Destructive: export anything that must be kept before requesting erasure. |
| `privacy.erase` | `entity: "member", id, revision` | Owner. Erases only an unused, uninvited grant. Grants with turnover or native authentication history must be deactivated instead. |

Move-in commands, fingerprints, jobs, undo reports and CSV fixtures are specified in [Move in your homes](/docs/move-in).

## Calendar semantics

Channels are `airbnb`, `vrbo`, `booking.com` and, for requests, `direct`, case-insensitively. Upload the complete exported `.ics` contents in `calendar`, or connect the channel's link with `channel.connect`. The importer supports unfolded RFC 5545 text, all-day dates and UTC date-times. Floating local times, recurrences and files without booking UIDs or explicit start/end dates are refused. A cancelled event may omit dates only when its UID already belongs to a known booking. Events titled "Not available", "Blocked", "Closed" or similar are blocks (`kind: "block"`); others are stays, and a title such as "Reserved - Ana Ruiz" sets `guestName`.

All-day checkout dates are **end-exclusive**: a stay ending on the 5th does not clash with one starting on the 5th. Identical repeated UIDs in one file collapse; conflicting duplicate UIDs are refused. An approved property/channel/UID is reconciled into the existing booking, rather than duplicated.

A prepared review contains `id, revision, propertyId, channel, importedAt, events, changes, clashes, baseline, status, preparedBy, preparedAt`. Each change is `add`, `change`, `cancel` or `remove`. Each clash includes the two booking identifiers and the intersecting dates. Preparation changes no approved booking. A changed approved booking baseline invalidates an earlier prepared review. Approval stores an independent `{kind, recordId, revision, actorId, at}` record.

A connected link (`connections` in the state) applies the same reconciliation without a review on every successful read: by the Worker's Cron every five minutes for each link whose `nextPollAt` has passed, or on `channel.sync`. It records `status` (`pending`, `ok` or `stale`), `error`, `lastAttemptAt`, `lastSuccessAt`, `lastChangeAt`, `nextPollAt` and `events`. A failed read never releases nights. Holds made with `reservation.request` are never removed by a feed; a feed stay on the same channel and dates adopts the hold.

Every confirmed booking and block holds its nights. `reservation.request` declines any overlap; commits are serialised, so two concurrent requests cannot both hold a night. `GET /ical/TOKEN/CHANNEL.ics` (`airbnb`, `vrbo`, `booking-com` or `all`) needs no session: it lists every future held night except that channel's own, as all-day `Not available` events without guest details. Polled links leave a window in which a channel can sell a night before it hears; overlapping stays are then kept and shown, never overwritten.

## Completion evidence

Turnovers are dispatched by Cabin itself: every commit that adds, moves or cancels a stay (a channel sync, an approved calendar file, a request) creates, moves or cancels that stay's one turnover, its guest door code and its cleaner's door code, and writes the cleaner's email; emails are sent right after the commit and retried by the Cron. The state read includes `homeSettings`, `codes` (door codes with their windows and lock state), `notices` (each email and whether it was sent) and `tasks`. Guests open their code at `GET /stay/TOKEN`, the secret link on their stay's guest code.

Cleaners see only their published jobs, the associated property names, addresses and booking dates (no guest names), their own door codes, the tasks they raised or were given, and their own grant. Owner contacts, commission terms, other cleaners' jobs, guest codes, statements, calendar reviews and import journals are withheld. Agents never see door codes. Photo reads require the same current permission: `GET /api/cabin/turnovers/ID/photo` (the first photo) or `/api/cabin/photos/PHOTO_ID`. Photo bytes are persisted in D1, authenticated on retrieval and included in installation archives. PNG structure and CRCs or JPEG marker structure are checked; base64 text and a MIME label alone are insufficient. Completion cannot be overwritten or submitted twice.

## Statement money and CSV

Positive lines are income and negative lines are expenses or adjustments. `grossCents` is the signed sum of all lines, including costs, and must be non-negative. The default management fee applies the property’s commission to this net line sum: `round-half-up(grossCents × commissionBps / 10,000)`, calculated with integer arithmetic. An explicit management fee may be any integer from zero to that sum. `netCents = grossCents - managementFeeCents`. Review that base before approval; Cabin does not infer channel fees or reconcile payments.

Approval freezes owner details, lines, commission and fee. Later property edits do not change the approved CSV. `GET /api/cabin/statements/ID.csv` is restricted to owner/manager sessions and exports all amounts in integer cents, with spreadsheet formula protection on text cells. These are operational statements, not payment processing, trust accounting, bank reconciliation or tax statements.

## Agent door

Use `Authorization: Bearer TOKEN` with `GET /api/cabin/agent/context` and `POST /api/cabin/agent/command`. The only agent commands are `calendar.prepare`, `turnover.prepare` and `statement.prepare`. Bearer routes require a live key; a human cookie cannot substitute. Ordinary human routes require the native session; a bearer token cannot substitute. Agents cannot approve, complete a checklist, manage people, issue invitations or credentials, erase data, or apply/undo imports. A human must inspect and approve the exact prepared revision.

Direct-booking settings and payment/deposit actions are documented in [Direct bookings](/docs/direct-bookings). Owner/manager session commands: `direct.configure`, `direct.refresh`, `direct.deposit.release`, `direct.deposit.capture` (amount in cents, reason and evidence required after checkout), and `direct.tax.filed` (state/county confirmation reference). Bearer agents cannot use these commands. Public guest forms live under `/book`; stay links are private capabilities.
