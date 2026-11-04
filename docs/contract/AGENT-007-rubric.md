# AGENT-007 frozen future-build rubric

Frozen by ct on 4 November 2026 under [RL-101](../../RULINGS.md#rl-101--deferred-retained-native-event-privacy-split). These are requirements for the next planned Cabin round, not evidence that any outcome passes. AGENT-007 starts missing with empty Evidence; BASE-AGENT-010 is unchanged.

Use ordinary supported public doors, current native authority and an admitted MCP reader. Company policy determines dispositions; autonomous and approval are the two required policy runs, not product defaults. Apply current event, record and visibility scopes throughout. Reader entitlement to a record alone never permits retention of an erased actor's identity. Cover every supported retained-event read, cursor replay and refresh, including other personal actor metadata covered by the completed erasure.

| Requirement | Frozen outcome |
| --- | --- |
| R1 | Public native preparation emits one permitted typed event with nonempty, accurate person attribution, also accurate in replay before erasure. Preserve another person's lawful attribution for currently entitled readers. |
| R2 | Under autonomous company policy, an ordinary native manager prepares a calendar draft; the owner uses supported `member.save` to edit that member's email and deactivate them, then reviews and completes `privacy.erase`. Admitted MCP `cabin.events.list`, cursor replay and refresh expose no erased actor name, operator id or other personal actor metadata covered by the completed erasure. The operator need not supply the old email. |
| R3 | Repeat the same full public-door preparation, supported email edit/deactivation, reviewed erasure completion and admitted retained-event read/replay/refresh sequence under approval company policy, with no erased actor identifier exposed. |
| R4 | After Worker restart, retained-event read, cursor replay and refresh under both policies still expose no erased actor name, operator id or other personal actor metadata covered by the completed erasure. |
| R5 | Unauthorized or unreviewed erasure is refused. Unchanged-state readback confirms no retained-event or other-person attribution change. Positive controls show lawful un-erased attribution remains accurate for currently entitled readers and current event, record and visibility scopes still govern delivery. |

## Supplied failure provenance

Both ended independent gates for `sx-cabin-c-f20` (`c56da5547f4571abd566a6804fbe918682db6b84`) and `sx-cabin-c-f23` (`eb5d344159e792584181d14bd0c2050dfa4a209a`) reproduced retained erased-actor name and operator-id disclosure after the ordinary native preparation, member email edit/deactivation and completed reviewed erasure sequence, before and after Worker restart under both policies. The exact gate2 public-door probe used no direct database mutation, application mock, malformed input or timing race; `erased=true` plus `leaksErasedActor=true` was reproduced twice. [Verify 41858724481](https://github.com/just-every/run-cabin/actions/runs/41858724481) was green and does not prove this privacy outcome.

The two-FIX DEFER remains in force. Neither blocked chain may land as gated; this rubric does not reopen BASE-AGENT-010, authorize a third product FIX or release the supported hold pending independent Opus review. It adds no retention policy, live-account exclusion or field-proof exclusion and preserves all existing Base and full-category obligations.
