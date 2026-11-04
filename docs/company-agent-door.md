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
declare tools, resources, events, subscriptions, policy, pause, audit and idempotency.
Prompts remain undeclared: their lists are empty or absent
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

Retained preparation polling uses the built-in `cabin.events.list` tool, requiring
an explicit `events:read` scope. Its optional `after` cursor is an event ID;
`limit` defaults to 100 and accepts 1 through 200. Results contain `events` and
`cursor`. Replaying a cursor returns the same retained IDs in commit order,
including after restart. An unknown cursor returns an empty page. A consumer
must deduplicate by event ID; polling does not promise exactly-once delivery.

The guarded native transaction retains changes for the ten existing record
collections: homes, people, stays, guests, tasks, readiness, statements, recovery
cases, calendars and turnovers. Types use the collection name followed by
`.created`, `.updated` or `.removed`. The three existing preparations retain
`calendars.prepared`, `turnovers.prepared` and `statements.prepared`, including
native forms and legacy draft keys. Missing records, including removed records,
are withheld at delivery; retained metadata does not grant access to a tombstone. MCP idempotent retries reuse the recorded outcome
without another preparation event. Each event contains only its stable ID,
type, typed record URI, person or agent-for-person attribution and time. It
contains no calendar text, checklist, statement lines, guest data or capabilities.
Record events additionally require `records:read` and the sponsor's current
native role, action and property visibility at delivery. Events about missing
or restricted records are omitted. Current consent, agent revocation and native
offboarding stop the next polling call; local draft keys gain no event access.
Erasing a native actor retires their record events in the erasure
transaction, so the retained feed cannot restore their name after restart.
The existing internal record adapters enforce this even independently of public
resource-template adoption.

`tests/agent-events.test.mjs` exercises populated native forms and MCP polling
under autonomous and held policies, ordered pagination and identical restart
replay, person and agent attribution, retry and conflicting-key refusal, scope
requirements, changed property and action grants, consent and agent revocation,
and native offboarding. A live subscription is opened with the modern MCP
`subscriptions` method `listen`, requesting `notifications.resourceSubscriptions`
as an array of visible record URIs. The response is a private SSE stream: an
acknowledgment lists accepted URIs, then resource updates carry only a URI and
subscription identity. Both `events:read` and `records:read` are required for
record notifications. The copied runtime rechecks current native visibility,
consent and agent admission on each delivery, closes revoked admissions and
limits streams to two minutes. Reconnect and poll retained IDs to recover after
a disconnect; notifications can repeat and contain no private record body.

The same public-door journey changes a subscribed calendar through its native
approval form, receives the notification within ten seconds under both complete
policies, and checks current authority on already open streams. Other native
record families remain outside this bounded event inventory. Signed Base
integration webhooks with identical IDs and failed-webhook replay need a Base
integrations adapter, which this checkout does not mount. The copied Base
policy event producer still omits class and decision and identifies Business
without an authenticated person. Cabin's existing event callback fills the
already determined disposition on new `approval.pending` and `review.flagged`
events: `approval` and `review`, respectively. It preserves their Base-computed
classes, stable IDs, actor, time and existing visibility checks, copies no
private decision evidence, and never rewrites a tombstone or an existing
decision. `approval.decided` already carries its disposition and final state.

The retained polling journey performs native approval and rejection plus review
flagging, checks exact class and disposition metadata and refusal for an
unrelated person, then replays the same IDs after restart and agent revocation.
Older retained pending and flagged events are not backfilled. These historical
rows, complete policy event metadata, the Base integrations interface and an
authorized receiver remain dependencies for whole-clause completion. API-001 retains its Base publication-scanner and
authorized Zapier receiver dependencies. No provider action or new mutation
authority is introduced.
