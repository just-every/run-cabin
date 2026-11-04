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
declare tools, resources, prompts, policy, pause, audit and idempotency. Events
and subscriptions remain undeclared: their lists are empty or absent
and calls return `capability_not_declared`. Unknown tool names return
`tool_not_found`. The ten record collections above each have a JSON URI template declared in
`agent-surface.json`. Both resource reads and the existing read tools require
`records:read`; local draft keys cannot list or open resources. The three draft
preparations return a `resource_link` to the saved record. Reads reapply native
visibility and omit active capabilities, including for the installation owner.
Customer and imported text has `com.runeditrun/untrusted: true` on its content.
Four static specialist prompts describe visible-record inspection and the existing
calendar, turnover and statement draft preparations. Retrieval returns guidance,
never record content or an executed preparation. The prompts accept no declared
arguments and do not interpolate caller text. They name only registered tools,
retain the installation-owner-only draft boundary and direct human decisions to
the native flow. Discovery and initialization advertise the same prompt family;
listings are deterministic with private cache scope and a zero TTL. Modern and
legacy clients retrieve the same guidance. Unset policy and Pause hide listings;
blocked standard policy refuses retrieval, and revoked admission refuses both.

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
is the remaining BASE-AGENT-003 acceptance gap, not a byte-budget guarantee.
BASE-AGENT-001 covers the transport and declared families; the other Agent surface
clauses retain their own gaps and the pinned ct Agent surface is still a wider target.

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

`tests/agent-prompts.test.mjs` exercises the six BASE-AGENT-001 transport outcomes
and specialist retrieval through the public MCP door under autonomous and held
policies. Its shared discovery conformance checks versions, initialization,
deterministic tool listings, Origin and method-header refusal, body limits and
descriptor agreement. It retrieves every prompt through both supported client
revisions, refuses unknown names and current policy or revoked admission, and
compares nonempty native state before and after. It also checks that events and
subscriptions remain undeclared. The journey runs in push Verify alongside the
existing resource journeys; no hosted deployment or broader rental tool proof is
implied by this transport adoption.
