# Cabin contract rulings

### RL-101 — Deferred retained native event privacy split

Date: 4 November 2026. Ruler: ct. New clause: AGENT-007. BASE-AGENT-010 retains its existing acceptance, status, Evidence, Gap and judgment.

Ct's 4 November two-FIX DEFER is recorded as one additive, seed-owned Core clause for the next planned Cabin round. It neither reopens BASE-AGENT-010 nor authorizes a third product FIX, landing of either blocked chain, or weaker erasure or attribution requirements. The lane's supported hold remains pending independent Opus review of these exact additive requirements; this change does not release the hold or submit a landing.

Neither `sx-cabin-c-f20` at `c56da5547f4571abd566a6804fbe918682db6b84` nor `sx-cabin-c-f23` at `eb5d344159e792584181d14bd0c2050dfa4a209a` may land as gated. Both ended independent gates reproduced the same defect: an ordinary native manager prepares a calendar draft; the owner changes that member's email, deactivates them, reviews and completes `privacy.erase`; an admitted owner agent polling `cabin.events.list` still sees the erased actor's retained name and operator id before and after Worker restart under autonomous and approval policies.

The exact gate2 public-door probe used no direct database mutation, application mock, malformed input or timing race. `erased=true` together with `leaksErasedActor=true` was reproduced twice. [Verify 41858724481](https://github.com/just-every/run-cabin/actions/runs/41858724481) was green; that green does not prove this privacy outcome. This supplied provenance is not passing evidence for AGENT-007, whose Evidence cell remains empty and whose status starts missing.

The frozen future-build requirements R1–R5 are in [the AGENT-007 rubric](docs/contract/AGENT-007-rubric.md). The clause requires truthful permitted attribution before erasure, effective completed erasure after ordinary email edits without operator knowledge of the old email, all supported retained reads/replays/refreshes and restart protection under both company policies, plus refusal and lawful-attribution controls. It creates no new retention policy or live-account/field-proof exclusion. Existing Base events, prompts/resources, actor/sponsor, privacy, legal/account/provider and full-category obligations remain intact.

Mechanical generation authorization: remove only the seed-id restriction that throws `Missing legacy acceptance entry` in `src/base/contract-docs.mjs`. Its existing append path must generate the real parsed missing clause with empty Evidence and the honest Gap. Keep selected `--clauses` operation, the original-acceptance-evidence guard, legacy rendering and all other guards. This one-line Base generator delta is for gr to fold into Base; it authorizes no product behavior change. Generated acceptance/claims views remain lander-owned and are restored before the candidate commit; source-lock regeneration follows the final source edits.
