# Native page reads and volume proof

`readPageData(db, actor, path, url)` in `src/cabin/pages/index.ts` is the
read model for the calendar, inbox and reports HTML GET doors. It is not a
mutation context, archive representation, report input set or `/api/cabin/state`
replacement. Those doors must keep their complete source records.

Integration:

- Call the loader before `snapshot` on `/app/calendar`, `/app/inbox` and
  `/app/reports` (also normalize the manager `/app` alias to calendar).
- Let `snapshot` take its supplied `data` instead of calling `load`, retain the
  existing secret masking, `assertLive` and final `projectState` boundary, and
  spread its returned metadata into the rendered state. Inbox metadata already
  crosses `projectState` including the previews and latest incoming message.
- Omit unrelated ledger/books/privacy/import/channel-agent/tax/owner-operation
  read builders on these pages. Reports use their existing separate `readReport`
  and sharing read. Never use these selected page records as report inputs.
- Calendar `balanceBookingIds` identifies visible reservations/detail records
  for balance reads. Direct stay lookup should use the selected booking ids;
  do not fetch every historical direct stay to render a calendar month.
- Keep `calendarSources`: it carries historical channel/source coverage without
  fetching every historical booking body. Availability must still become
  unknown for an unconnected source even when its booking is outside this month.
- The shell inbox badge must use `inboxDraftThreads`, a scoped aggregate of
  all pending conversation roots, rather than rebuilding `threads` from the
  selected page. A selected page is not the portfolio count.

Migrations 0061 and 0062 add ordinary property, booking-reference, status and
covering message-activity expression indexes. Search selects matching reviewed
threads before aggregating their complete activity. Scoped search counts use the
same redacted text as the rendered conversation, including access codes from
records outside the selected page.
The page version is checked again after all reads, including its pending badge;
a concurrent commit returns a visible refusal to reload. No secondary content store,
FTS tables or archive changes are involved. Inbox query parameters are `q`,
`page`, `thread`, and `messages`; matching uses a literal case-insensitive
substring, including retained message text/subject/contact/ref and booking
name/contact/reference/property. Reviewed guest roots determine thread identity;
sharing an email alone never merges reservation histories. Guest pages contain
25 results and message pages 50 records, with exact totals and previous/next
links. The newest message page comes first. Drafts participate in those explicit
pages, while the reply channel always comes from the actual latest incoming
message, not the historical page being read.

Calendar reads retain preceding occupied stays for readiness, the actual next
arrival, all open blockers, source freshness, pending work and latest completed
cover photos. Collision discovery sorts per home and sweeps the active stays;
its result is reused for both the warning and the grid.

Native business-form POST failures restore the submitted editable fields for the same person,
action and record from one-use browser session storage, open a containing details
panel and focus the server refusal. A command allowlist excludes all connection, provider, key and credential forms.
Forms with password, file, URL, key/token/secret/signing/credential fields are
excluded entirely; one-time codes and hidden authority/revision fields are never
stored. Sign-out also clears the one-use record. The stored values are removed on
the very next page load, including success and role-revocation responses.

Run the standalone committed `node tests/interface-scale.mjs` on the exact
candidate outside push Verify. It seeds actual D1 data and measures real HTTP
calendar/search/report/export routes. Timing results and a clause-completion
claim require that run plus the separate 1440/390 browser journeys; source alone
does not establish INTERFACE-001 completion.
