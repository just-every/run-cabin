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
declare only tools, policy, pause, audit and idempotency. Events, resources,
prompts and subscriptions are undeclared: their lists are empty or absent and
calls return `capability_not_declared`. Unknown tool names return
`tool_not_found`. The record collections above are read through scoped tools;
there are no public MCP resource links or specialist prompts in this subset.

The copied runtime now exposes consent on tool context and checks current native
resource visibility for events. Those former Base gaps are closed. This adoption
retains Cabin's existing owner-only draft mutation boundary. Native commands
explicitly admit agents for only the three preparations; broad company policy
does not authorize a signature, inspection, provider send, payout or native role
change. Broader tools need their own native authority, durable consent and
provider receipts before they can be declared. No queued provider action,
mail edge, multi-sponsor, timed or dual-host journey, resource refresh or native
owner administration is claimed. BASE-AGENT clauses remain partial and name
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
