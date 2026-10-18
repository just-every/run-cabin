# External calendar blocking

In Channels, open a home and use Other iCal calendars to connect a public HTTPS calendar URL, give it a name and choose a 15–60 minute interval (15 by default). Several feeds may serve the same home. Each event takes inventory as a block, even when its source names a guest. Equal UIDs in separate feeds stay independent. Changed and removed events reconcile on the next due Cron poll or Sync now; imported blocks create no guest messages, payments, door codes or turnovers.

Each connection shows its last successful fetch, last inventory change and next poll. A failed or malformed response retains the last applied blocks and opens an exception assigned to the connection manager. Use Responsible manager to reassign it to an active manager. Edit calendar link changes the URL or interval without losing blocks or the assignment. Repeated failures retain that assignment; the next good fetch resolves it with a timestamp. Disconnecting stops polling and keeps existing blocks, so it never silently frees nights.

Create export links to publish every held night to another calendar. The Any other calendar link includes all reservations and blocks; channel-specific links omit that channel’s own holds to prevent echoes. Replace links revokes every previous URL immediately. Exports are generated from committed inventory without caching and contain no guest details.

iCal is polled and cannot guarantee against double bookings. RER Managed cannot reach external calendar providers until its provider relay exists; self-hosted installations support this workflow. Cabin names that limitation before connection.

`tests/calendars-sync.test.mjs` exercises multiple feeds, inventory refusal, no guest effects, unreachable and malformed feeds, retained blocks, reassignment, scheduled recovery, changed/removed events and export revocation through public product doors.
