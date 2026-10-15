# Cabin source adaptations

Cabin is composed on the pinned Base foundation, then implements a separate holiday-rental domain. These are source adaptations rather than shared live dependencies on other applications. No sibling checkout is modified at runtime.

| Source | Cabin adaptation |
| --- | --- |
| Base `modules/import-kit/src`, `schema` and `CONTRACT.md` | Copied without its test suite into `src/modules/import-kit`. The D1 engine is used directly for property register plans, original bytes, journal, guarded publication, preserved-conflict reversal and privacy retirement. Its exact exported D1 schemas form migration `0016_import_kit.sql`. |
| Base `modules/d1-transport/index.mjs` and declarations | Copied under the import-kit directory, with the kit’s three transport import paths adjusted to that location. The transport implementation is unchanged. |
| Base native operator auth and portability runtime | Reused directly for sessions, invitations, owner authority, redaction checkpoints and archive transfers. Cabin’s archive policy excludes bearer hashes and retains domain evidence and journal custody. |
| Lanyard `credentials.ts`, `http.ts`, `domain/storage.ts`, `movein/*`, `archive-policy.mjs` | Native session/bearer separation, current-owner version checks, active grant checks, same-batch SQL authority fences, form Origin protection, exact CSV plans, real D1 target adapter and Base archive policy patterns. Cabin grants cleaners and managers rather than workforce staff/payroll roles. |
| Satchel and Barrow foundation patterns | Consulted for native-auth private application structure and operational separation. Cabin retains Base’s shared installer, setup and runtime contracts. |
| Dial `src/core/features/bookings/calendar-file.ts` | RFC 5545 date/text handling informs the file boundary. Cabin imports complete all-day/UTC channel snapshots rather than producing invite files. |
| Dial `src/core/features/bookings/calendar-reconciliation.ts` | Persisted event identity and explicit changed/deleted reconciliation. Cabin never adopts external edits until human review. |
| Glove `src/glove/commands/dispatch.ts` | Exact revision preparation, immutable assignment/checklist snapshots and explicit conflict review before publication. |
| Gasket `src/gasket/checklists.ts` | Checklists captured at an immutable job revision; completion uses the approved list rather than today’s editable template. |
| Terrace `src/terrace/ledger.ts` and `src/terrace/work.ts` | Integer-cent accounting boundaries, formula-safe CSV, authenticated photo evidence and transactional revision guards. Cabin reports entered operational figures and does not claim trust accounting. |

Base foundation pin: `ada9f574d8a7247edc3a1180b593ad182b1fbb37`. Sibling source snapshots are the frozen inputs supplied to this build; no runtime imports reach sibling repositories. The copied Base module has no product fallback or sample backend. CSV and calendar examples are documented import fixtures, never automatically seeded application data.
