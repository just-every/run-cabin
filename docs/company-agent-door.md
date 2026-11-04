## Company agent access

Cabin serves the shared Base agent door at `/mcp`, the standard discovery and
metadata paths, `/api/rer/agent-policy` and `/agents`. It uses the installation's
owner-claim key ring and signed Business owner and team identities. Native
sessions, property and action grants remain authoritative.

The current integration is bounded. It reads visible homes, people, stays,
guests, tasks, readiness records, statements, recovery cases, calendar drafts
and turnovers. Imported descriptions are untrusted. Capabilities, door codes
and credentials are omitted. Personal records require the sensitive class.
Missing and restricted records have the same response.

The owner-sponsored coordinator prepares calendar, turnover and statement drafts through the
existing native command service. These drafts do not approve, publish, sign,
send, pay or attest physical readiness. The native record and activity retain
the agent's name and sponsor. Existing local bearer keys retain only draft
scopes through this door; their original context endpoint remains available.

Business subjects bind to the setup owner's operator ID or an existing admitted
team operator ID. Business never creates a substitute Cabin grant. A native
owner first grants the person's role and properties through Properties & people;
the signed roster then binds that admitted identity. Unknown, inactive,
allow-list-excluded and unadmitted people cannot sponsor an agent. Changing
either email cannot move an established binding. A signed team binding also
retains the native member-grant ID; a changed address cannot select another
person's grant. Business owner maps to owner,
Business team admin to policy editor, and member to no policy role; a local
promotion does not create a Business role.

The runtime is copied from Base `2135c394939f4a737adabdc8003b0e667b31ac5a`,
with the released `@runeditrun/rer` 0.2.91 CLI. The production door and descriptor
declare tools, resources, events, policy, pause, audit and idempotency.
Prompts and subscriptions remain undeclared: their lists are empty or absent
and calls return `capability_not_declared`. Unknown tool names return
`tool_not_found`. The ten record collections above each have a JSON URI template declared in
`agent-surface.json`. Both resource reads and the existing read tools require
`records:read`; local draft keys cannot list or open resources. The three draft
preparations return a `resource_link` to the saved record. Reads reapply native
visibility and omit active capabilities, including for the installation owner.
Customer and imported text has `com.runeditrun/untrusted: true` on its content.
There are no specialist prompts in this subset.

The copied runtime now exposes consent on tool context and checks current native
resource visibility for events. Those former Base gaps are closed. This adoption
retains Cabin's existing owner-only draft mutation boundary. Native commands
explicitly admit agents for only the three preparations; broad company policy
does not authorize a signature, inspection, provider send, payout or native role
change. Broader tools need their own native authority, durable consent and
provider receipts before they can be declared. No queued provider action,
mail edge, timed or dual-host journey, resource refresh or native owner
administration is claimed. Grant byte budgets and file-byte accounting remain
unavailable in the pinned Base door; resources expose JSON records only. This
is the remaining BASE-AGENT-003 acceptance gap, not a byte-budget guarantee. BASE-AGENT clauses remain partial and name
these gaps; the pinned ct Agent surface is still a wider target.

`agent-surface.json` declares the bounded registry and its normal `rer verify`
journey. Its initializer claims the disposable installation owner through the
manifest's real setup-token POST, then uses native commands for rental fixtures.
The declared tools make no provider requests, so no test network edge is declared.
There is no provider cost registration or enforced spend reservation. The
journey declares `spend: {none: true}`.

Backups retain door audit, events and historical decisions. They omit signed
Business bindings, policy, agent admission and replay state; pending approvals
expire and saved Undo payloads are removed. Restoring an archive requires fresh
Business pairing and policy before any new agent action.

The 30 October 2026 disposable production check used the normal CLI command
`SEED_VERIFY_SHARD=runtime node node_modules/@runeditrun/rer/global/rer.mjs verify`.
It reported `Agent door conformance: 883/883 points passed.` and
`verify: complete (exit 0)`. All ten specialist steps passed in autonomous and
held phases, with standard and sensitive class coverage, input injection, blocked
classes, unanswered and paused policy, revision conflict, replay, consent
revocation and audit agreement. The runtime shard's emitted-Worker HTTP check
and its existing cleaner, quote and booking-site browser journeys also passed.
Unknown-subject and changed-email sponsor probes passed. Inactive and allow-list-excluded sponsor fixtures remain undeclared and received no passing points. This proves the declared subset; it does not promote the wider rental clauses.

The public-door resource journeys in `tests/agent-resources.test.mjs` compare
nonempty owner and scoped cleaner reads with the native HTTP state, test identical
missing and restricted refusals, and read each prepared draft back under autonomous
and held policies. Sensitive content stays withheld until its sponsor approves.
Revoking consent after classification expires the pending read; native offboarding
ends the next read without affecting the owner. The public CLI archive journey
retains native history, expires saved read approvals and requires fresh Business
pairing and policy. Neither restoration nor an old local key restores admission.

The public `/docs/agents` page projects the same runtime registry used by MCP,
including its enriched schemas, scopes and classes. MCP discovery and initialize
instructions name these registered jobs and point to the public documentation. Class witnesses come from
`agent-surface.json` journey steps and the shared class assertions in
`src/modules/agent-door/conformance/journey.mjs`. Registry names, scope, class,
contract and witness drift are refused instead of publishing a second tool list.
The page includes declared resource templates, configured request capacity,
stable error responses and explicit capability omissions. It never invokes a
classifier, tool or resource reader and includes no fixture arguments or private
records. It requires no sign-in and creates no admission or action authority.

`tests/agent-docs.test.mjs` compares the public page with authenticated listings,
executes its class witnesses under autonomous and held policies, and checks
metadata drift, escaping and private-data omission. `tests/agent-docs-browser.mjs`
checks keyboard navigation and schema disclosure at desktop width and records
the same document at desktop and phone widths. Both run in push Verify.
Acceptance points 3–5 across the wider rental surface remain incomplete; this
page does not expand the three existing owner-only draft preparations.

Retained preparation polling uses the built-in `cabin.events.list` tool, requiring
an explicit `events:read` scope. Its optional `after` cursor is an event ID;
`limit` defaults to 100 and accepts 1 through 200. Results contain `events` and
`cursor`. Replaying a cursor returns the same retained IDs in commit order,
including after restart. An unknown cursor returns an empty page. A consumer
must deduplicate by event ID; polling does not promise exactly-once delivery.

The native transaction retains `calendars.prepared`, `turnovers.prepared` and
`statements.prepared` for the three existing preparations, including native
forms and legacy draft keys. MCP idempotent retries reuse the recorded outcome
without another preparation event. Each event contains only its stable ID,
type, typed record URI, person or agent-for-person attribution and time. It
contains no calendar text, checklist, statement lines, guest data or capabilities.
Record events additionally require `records:read` and the sponsor's current
native role, action and property visibility at delivery. Events about missing
or restricted records are omitted. Current consent, agent revocation and native
offboarding stop the next polling call; local draft keys gain no event access.
Erasing a native preparer retires their preparation events in the erasure
transaction, so the retained feed cannot restore their name after restart. The
erasure covers each sign-in identity the grant has used, including one held
before an address change.
The existing internal record adapters enforce this even independently of public
resource-template adoption.

`tests/agent-events.test.mjs` exercises populated native forms and MCP polling
under autonomous and held policies, ordered pagination and identical restart
replay, person and agent attribution, retry and conflicting-key refusal, scope
requirements, changed property and action grants, consent and agent revocation,
and native offboarding. Complete record-change coverage, subscriptions and the
10-second notification journey, signed Base integration webhooks with identical
IDs and failed-webhook replay, and complete approval, review and policy event
acceptance remain unproved. Existing shared decision events do not establish
those broader guarantees. API-001 retains its Base publication-scanner and
authorized Zapier receiver dependencies. No provider action or new mutation
authority is introduced.
