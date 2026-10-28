Old reference: `788f46c517989e287d82885783eddb61961d632b`.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| `CABIN-01` | 1 | Existing stay retains its original management terms | `tests/property-register.test.mjs:20` | asserted |
| `CABIN-01` | 1 | New quote uses the amended management version | `tests/property-register.test.mjs:36` | asserted |
| `CABIN-01` | 1 | Both differently zoned properties are exercised through the property editor | none | none |
| `CABIN-01` | 2 | Two homes retain their named rental owners and commissions | none | none |
| `CABIN-01` | 2 | Manager and both cleaner invitations retain scoped property views | none | none |
| `CABIN-01` | 2 | Deactivated cleaner cannot read on the next request | none | none |
| `AUTH-002` | 1 | Every rental role has an allowed action | none | none |
| `AUTH-002` | 1 | Cross-property statement access is refused | `tests/cabin.test.mjs:248` | asserted |
| `AUTH-002` | 1 | Cross-property identity-document access is refused | `tests/cabin.test.mjs:248` | asserted |
| `AUTH-002` | 1 | Credential access is refused for the restricted roles | `tests/cabin.test.mjs:251` | asserted |
| `AUTH-002` | 1 | Revocation stops queued execution | `tests/cabin.test.mjs:269` | asserted |
| `AUTH-002` | 2 | Cross-origin native submission is refused | `tests/cabin.test.mjs:27` | asserted |
| `AUTH-002` | 2 | Another cleaner cannot retrieve the original photo | `tests/cabin.test.mjs:86` | asserted |
| `AUTH-002` | 2 | Cleaner financial mutation is refused without changing state | none | none |
| `CONTROL-001` | 1 | An exact calendar revision records actor and revision | `tests/cabin.test.mjs:55` | asserted |
| `CONTROL-001` | 1 | Stale calendar publication cannot replace the current revision | none | none |
| `CONTROL-001` | 1 | Stale statement and duplicate approval preserve the published statement | none | none |
| `CONTROL-001` | 1 | Changed booking and property terms prevent stale turnover or statement publication | none | none |
| `CONTROL-002` | 1 | Held-policy preparation, no pre-approval effect and revocation | none | none |
| `CONTROL-002` | 2 | All-autonomous classified publication and separate person-confirmation door | none | none |
| `SYNC-001` | 1 | Overlap preview lists the clash | `tests/cabin.test.mjs:41` | asserted |
| `SYNC-001` | 1 | Import and approval timestamps survive publication | `tests/cabin.test.mjs:44` | asserted |
| `SYNC-001` | 1 | Reimport creates no duplicate bookings | `tests/cabin.test.mjs:47` | asserted |
| `SYNC-001` | 1 | A removed UID becomes canceled | `tests/cabin.test.mjs:54` | asserted |
| `SYNC-001` | 1 | Adjacent checkout and check-in have no clash | `tests/cabin.test.mjs:61` | asserted |
| `SYNC-001` | 1 | Stale baseline and malformed calendar are refused without changing bookings | none | none |
| `SYNC-009` | 1 | External feed creates inventory blocks and refuses a direct conflict | `tests/calendars-sync.test.mjs:23` | asserted |
| `SYNC-009` | 1 | Applied polling occurs within the configured interval | none | none |
| `SYNC-009` | 2 | A direct reservation appears in the exported unit calendar within 60 seconds | none | none |
| `SYNC-009` | 2 | Regeneration revokes the old export link | `tests/calendars-sync.test.mjs:53` | asserted |
| `SYNC-009` | 3 | Unreachable feed is stale with an assigned open exception | `tests/calendars-sync.test.mjs:29` | asserted |
| `SYNC-009` | 3 | The malformed feed retains its original exception and assignee | `tests/calendars-sync.test.mjs:37` | asserted |
| `SYNC-009` | 3 | Malformed feed retains both occupied blocks | `tests/calendars-sync.test.mjs:38` | asserted |
| `SYNC-009` | 3 | Recovery records success, resolved exception and fresh timestamps | `tests/calendars-sync.test.mjs:47` | asserted |
| `RES-001` | 1 | Twenty-home portfolio is complete | `tests/calendar.test.mjs:32` | asserted |
| `RES-001` | 1 | Property and channel filters exclude unrelated stays | `tests/calendar.test.mjs:38` | asserted |
| `RES-001` | 1 | An overlapping stay exposes the collision | `tests/calendar.test.mjs:39` | asserted |
| `RES-001` | 1 | Arrival and departure retain EDT and EST correctly | `tests/calendar.test.mjs:42` | asserted |
| `RES-001` | 1 | Unready turnover and issue link are visible | `tests/calendar.test.mjs:44` | asserted |
| `RES-001` | 1 | Owner block links to its authoritative record | `tests/calendar.test.mjs:50` | asserted |
| `RES-001` | 1 | Pending payment is visible on an unpaid arrival | `tests/calendar.test.mjs:80` | asserted |
| `RES-001` | 1 | The same calendar source drill-down works on desktop and phone | none | none |
| `RES-002` | 1 | Extension revises the turnover checkout window | `tests/reservations.test.mjs:28` | asserted |
| `RES-002` | 1 | Stay access follows the extension | `tests/reservations.test.mjs:29` | asserted |
| `RES-002` | 1 | Collected receipts and balance agree | `tests/reservations.test.mjs:32` | asserted |
| `RES-002` | 1 | Moving homes changes frozen owner and commission allocation | `tests/reservations.test.mjs:41` | asserted |
| `RES-002` | 1 | Moving homes revokes the old access codes | `tests/reservations.test.mjs:42` | asserted |
| `RES-002` | 1 | One active cleaning task follows the new home | `tests/reservations.test.mjs:44` | asserted |
| `RES-002` | 1 | Cancellation applies the saved charge and refund-due balance | `tests/reservations.test.mjs:49` | asserted |
| `RES-002` | 1 | Cancellation suppresses future guest messages and access | `tests/reservations.test.mjs:52` | asserted |
| `RES-002` | 1 | Repeated channel amendment keeps two revisions | `tests/reservations.test.mjs:64` | asserted |
| `RES-003` | 1 | Owner request follows inventory and becomes a block | `tests/owners.test.mjs:80` | asserted |
| `RES-003` | 1 | Occupied maintenance request is declined | `tests/owners.test.mjs:142` | asserted |
| `RES-003` | 1 | Every channel export carries the same owner block | `tests/owners.test.mjs:141` | asserted |
| `RES-003` | 1 | Canceled owner block cancels the cleaning task | `tests/owners.test.mjs:148` | asserted |
| `RES-003` | 1 | Canceling removes the block from every exported channel | `tests/owners.test.mjs:149` | asserted |
| `RES-003` | 1 | Completed owner-use cleaning allocates one exact expense without guest cash | `tests/owners.test.mjs:159` | asserted |
| `RES-003` | 1 | The resulting calendar state is read after cancellation | none | none |
| `RES-006` | 1 | Issued quote shows itemized terms and cancellation policy | `tests/reservations.test.mjs:86` | asserted |
| `RES-006` | 1 | One checkout session and confirmed booking result from concurrent acceptance | `tests/reservations.test.mjs:101` | asserted |
| `RES-006` | 1 | Repeated acceptance returns the existing private booking | `tests/reservations.test.mjs:98` | asserted |
| `RES-006` | 1 | An expired rival releases its hold | `tests/reservations.test.mjs:104` | asserted |
| `RES-006` | 1 | Changed rate or availability cannot silently charge obsolete terms | `tests/reservations.test.mjs:107` | asserted |
| `WEB-001` | 1 | Two properties appear in actual date search | `tests/website.test.mjs:28` | asserted |
| `WEB-001` | 1 | Page editor persists the exact revised page text | `tests/website.test.mjs:25` | asserted |
| `WEB-001` | 1 | Custom domain serves the canonical booking address | `tests/website.test.mjs:35` | asserted |
| `WEB-001` | 1 | Booking at both widths retains the exact advertised total and terms | none | none |
| `WEB-001` | 2 | Payment and identity outcome share the one reservation | `tests/direct.test.mjs:44` | asserted |
| `WEB-001` | 2 | Separate damage hold is retained before confirmation | `tests/direct.test.mjs:41` | asserted |
| `WEB-001` | 2 | Signed agreement retains the paid total and signer | `tests/direct.test.mjs:50` | asserted |
| `WEB-001` | 3 | Checkout before check-in is refused | none | none |
| `WEB-001` | 3 | Receipt itemizes cleaning and actual damage authorization | `tests/direct.test.mjs:42` | asserted |
| `WEB-001` | 3 | Capture and release retain the entered reason in read-back | none | none |
| `WEB-002` | 1 | External embed completes exactly one reservation | `tests/website.test.mjs:62` | asserted |
| `WEB-002` | 1 | WordPress and external-site browser journeys complete the same booking | `tests/website-browser.test.mjs:77` | asserted |
| `WEB-002` | 1 | Unapproved embedding origins are refused | `tests/website.test.mjs:55` | asserted |
| `WEB-002` | 1 | Private reservation and guest reads are refused through the external origin | `tests/website.test.mjs:56` | asserted |
| `WEB-003` | 1 | Required exact rental terms are displayed | `tests/direct.test.mjs:89` | asserted |
| `WEB-003` | 1 | Signed version is downloadable with signer evidence | `tests/direct.test.mjs:96` | asserted |
| `WEB-003` | 1 | Amended dates invalidate the signature | `tests/direct.test.mjs:104` | asserted |
| `WEB-003` | 1 | Original signed bytes remain unchanged | `tests/direct.test.mjs:106` | asserted |
| `WEB-003` | 1 | A renewed exact signature is required and retained | `tests/direct.test.mjs:110` | asserted |
| `WEB-004` | 1 | Successful provider verification reaches confirmed state | `tests/direct.test.mjs:44` | asserted |
| `WEB-004` | 1 | Failed provider check remains requires-input | `tests/direct.test.mjs:213` | asserted |
| `WEB-004` | 1 | Assigned manual reviewer is retained | `tests/direct.test.mjs:206` | asserted |
| `WEB-004` | 1 | Unresolved verification withholds the issued guest code | `tests/direct.test.mjs:207` | asserted |
| `WEB-004` | 1 | Role-limited identity details are absent | `tests/direct.test.mjs:219` | asserted |
| `WEB-004` | 1 | Erasure revokes the link and removes provider details | `tests/direct.test.mjs:232` | asserted |
| `WEB-004` | 1 | Manual review outcome releases the authorized code | `tests/direct.test.mjs:226` | asserted |
| `PAY-002` | 1 | A configured schedule collects the first deposit once after restart | `tests/collection-support.mjs:56` | asserted |
| `PAY-002` | 1 | Failed collection has a deadline and assigned follow-up | `tests/collection-support.mjs:60` | asserted |
| `PAY-002` | 1 | Payment reminder resolves after the successful authorized retry | `tests/collection-support.mjs:74` | asserted |
| `PAY-002` | 1 | Stay changes move the future due time without charging obsolete consent | `tests/collection-support.mjs:77` | asserted |
| `PAY-002` | 1 | Cancellation suppresses the final charge after restart | `tests/collection-support.mjs:86` | asserted |
| `PAY-003` | 1 | Partial evidenced capture is read back with the retained reason | none | none |
| `PAY-003` | 1 | Captured amount is the authorized partial amount once | `tests/direct.test.mjs:297` | asserted |
| `PAY-003` | 1 | Remaining damage-hold liability is zero | `tests/direct.test.mjs:297` | asserted |
| `PAY-003` | 1 | Rent refund is posted only once after retry and restart | `tests/direct.test.mjs:303` | asserted |
| `PAY-003` | 1 | Guest refund receipt is the correct amount and appears once | `tests/direct.test.mjs:308` | asserted |
| `PAY-003` | 1 | Tax and owner liabilities reconcile after the refund | `tests/direct.test.mjs:304` | asserted |
| `PAY-003` | 1 | Cancellation uses saved terms and releases its damage hold | `tests/direct.test.mjs:330` | asserted |
| `PAY-003` | 1 | Every processor callback replay preserves each captured, refunded and released outcome | none | none |
| `PAY-003` | 2 | No-claim checkout releases the authorization within the configured window | none | none |
| `PAY-003` | 2 | Long-stay authorization expiry is renewed or visibly flagged before expiry | `tests/direct.test.mjs:278` | asserted |
| `GUEST-001` | 1 | Two channel identities are merged only by review | `tests/guests.test.mjs:40` | asserted |
| `GUEST-001` | 1 | Unmerge restores each identity and preference | `tests/guests.test.mjs:47` | asserted |
| `GUEST-001` | 1 | Recorded opt-out remains attached to the right guest | `tests/guests.test.mjs:47` | asserted |
| `GUEST-001` | 1 | Return stay receives the eligible preference in its native view | `tests/guests.test.mjs:81` | asserted |
| `GUEST-001` | 1 | Restricted staff cannot read private guest notes | `tests/guests.test.mjs:43` | asserted |
| `MESSAGE-002` | 1 | Urgent off-shift thread routes to the on-shift manager | `tests/replies.test.mjs:116` | asserted |
| `MESSAGE-002` | 1 | Deadline is computed from the unanswered urgent message | `tests/replies.test.mjs:117` | asserted |
| `MESSAGE-002` | 1 | Private note is never delivered to the guest on the populated thread | `tests/replies.test.mjs:163` | asserted |
| `MESSAGE-002` | 1 | Concurrent reply is refused with collision context | `tests/replies.test.mjs:129` | asserted |
| `MESSAGE-002` | 1 | Handover preserves reservation, work and promises | `tests/replies.test.mjs:142` | asserted |
| `MESSAGE-002` | 1 | Missed deadline sends complete context through repeated escalation | `tests/replies.test.mjs:150` | asserted |
| `MESSAGE-002` | 2 | Interrupted message submission reconciles across restart without duplicate external effect | none | none |
| `MESSAGE-003` | 1 | Booking confirmation is sent once | `tests/lifecycle.test.mjs:35` | asserted |
| `MESSAGE-003` | 1 | Opt-out suppresses revised queued messages | `tests/lifecycle.test.mjs:47` | asserted |
| `MESSAGE-003` | 1 | Withheld access code stays out of actual generated messages | `tests/lifecycle.test.mjs:32` | asserted |
| `MESSAGE-003` | 1 | Canceled scheduled work is suppressed | `tests/lifecycle.test.mjs:86` | asserted |
| `MESSAGE-003` | 1 | Unavailable chosen channel is assigned to the named manager | `tests/lifecycle.test.mjs:91` | asserted |
| `MESSAGE-003` | 2 | Persisted due message is submitted within five minutes | `tests/lifecycle.test.mjs:75` | asserted |
| `MESSAGE-003` | 2 | A message due across actual restart meets the same due-time limit | none | none |
| `MESSAGE-004` | 1 | Supported reply uses the grounded arrival time | `tests/replies.test.mjs:28` | asserted |
| `MESSAGE-004` | 1 | Undocumented amenity escalates to the named manager | `tests/replies.test.mjs:32` | asserted |
| `MESSAGE-004` | 1 | Exact edited draft is retained | `tests/replies.test.mjs:35` | asserted |
| `MESSAGE-004` | 1 | Compensation without authority stays a draft | `tests/replies.test.mjs:46` | asserted |
| `MESSAGE-004` | 2 | Held-policy reply stays unsent past due time until exact approval | none | none |
| `MESSAGE-004` | 3 | All-autonomous policy computes external, money and commitment for the relevant replies | none | none |
| `GUEST-002` | 1 | Verified guest sees pre-arrival tasks and their completed state | `tests/guest-portal.test.mjs:60` | asserted |
| `GUEST-002` | 1 | Correctly timed access code is displayed to the holder | `tests/guest-portal.test.mjs:47` | asserted |
| `GUEST-002` | 1 | Guest issue report visibly succeeds | `tests/guest-portal.test.mjs:64` | asserted |
| `GUEST-002` | 1 | Another reservation’s ID cannot open the portal | `tests/guest-portal.test.mjs:70` | asserted |
| `GUEST-002` | 1 | Expired portal is refused | `tests/guest-portal.test.mjs:94` | asserted |
| `GUEST-002` | 1 | Canceled portal contains no private instructions or code | `tests/guest-portal.test.mjs:103` | asserted |
| `OPS-001` | 1 | Exactly one initial turnover exists | `tests/dispatch.test.mjs:40` | asserted |
| `OPS-001` | 1 | Declining the current cleaner opens three eligible backup offers | `tests/dispatch.test.mjs:55` | asserted |
| `OPS-001` | 1 | One backup acceptance wins and clears the blocking tasks | `tests/dispatch.test.mjs:64` | asserted |
| `OPS-001` | 1 | Extension revises the turnover window and terms | `tests/dispatch.test.mjs:69` | asserted |
| `OPS-001` | 1 | Changed instructions are read back | `tests/dispatch.test.mjs:75` | asserted |
| `OPS-001` | 1 | Cancellation suppresses offers and access | `tests/dispatch.test.mjs:89` | asserted |
| `OPS-001` | 1 | No duplicate payable work is manufactured on cancellation | none | none |
| `OPS-001` | 2 | Impossible travel is explained and routed to a backup | `tests/dispatch.test.mjs:118` | asserted |
| `OPS-001` | 2 | Daily job capacity failure is explained | `tests/dispatch.test.mjs:122` | asserted |
| `OPS-001` | 2 | No eligible backup produces a visible open task | `tests/dispatch.test.mjs:125` | asserted |
| `EVIDENCE-001` | 1 | Authorized completion retains completed status | `tests/cabin.test.mjs:83` | asserted |
| `EVIDENCE-001` | 1 | Missing checklist items and malformed images are refused without effect | none | none |
| `EVIDENCE-001` | 1 | Another cleaner’s read is refused | `tests/cabin.test.mjs:86` | asserted |
| `EVIDENCE-001` | 1 | Original authenticated photo bytes are retrieved unchanged | `tests/cabin.test.mjs:89` | asserted |
| `EVIDENCE-001` | 1 | Duplicate completion is refused with no second completion | none | none |
| `EVIDENCE-001` | 2 | Late completion remains done | `tests/turnovers.test.mjs:192` | asserted |
| `EVIDENCE-001` | 2 | Changed stay shows its reopening reason | `tests/turnovers.test.mjs:149` | asserted |
| `EVIDENCE-001` | 2 | Recompletion reuses the original photo IDs | `tests/turnovers.test.mjs:154` | asserted |
| `EVIDENCE-001` | 2 | Stored photo count includes only the new addition | `tests/turnovers.test.mjs:155` | asserted |
| `OPS-002` | 1 | Offline work retains the private owner note | `tests/cleaner-mobile.test.mjs:51` | asserted |
| `OPS-002` | 1 | Offline photos remain previewable after the changed job | `tests/cleaner-mobile.test.mjs:57` | asserted |
| `OPS-002` | 1 | A changed job leaves completion uncommitted until current review | `tests/cleaner-mobile.test.mjs:47` | asserted |
| `OPS-002` | 1 | Reviewed completion commits the current job | `tests/cleaner-mobile.test.mjs:61` | asserted |
| `OPS-002` | 1 | The reported issue becomes a durable task | `tests/cleaner-mobile.test.mjs:67` | asserted |
| `OPS-002` | 1 | The cleaner’s accepted assignment is recorded | `tests/cleaner-mobile.test.mjs:77` | asserted |
| `OPS-003` | 1 | Failed access and maintenance keep arrival unready | `tests/readiness.test.mjs:35` | asserted |
| `OPS-003` | 1 | The failed restock item is separately read before resolution | none | none |
| `OPS-003` | 1 | Inspector acceptance and final readiness are visible | `tests/readiness.test.mjs:53` | asserted |
| `OPS-003` | 1 | The manager and guest-service team both read the same final readiness evidence | none | none |
| `OPS-004` | 1 | Broken appliance creates an assigned photographed work order | `tests/work-orders.test.mjs:22` | asserted |
| `OPS-004` | 1 | Approved quote and invoice are both read back with their exact evidence | none | none |
| `OPS-004` | 1 | Maintenance inventory refuses a conflicting reservation | `tests/work-orders.test.mjs:27` | asserted |
| `OPS-004` | 1 | Inspected completion reopens the unit and closes work | `tests/work-orders.test.mjs:50` | asserted |
| `OPS-004` | 1 | Owner expense uses the correct owner and amount | `tests/work-orders.test.mjs:41` | asserted |
| `OPS-004` | 1 | Recurring inspection creates one future task and one balanced payable | `tests/work-orders.test.mjs:53` | asserted |
| `OPS-004` | 2 | Cleaner photo report assigns the property maintenance person | `tests/turnovers.test.mjs:105` | asserted |
| `OPS-004` | 2 | Maintenance recipient receives the notice at the test mail edge | `tests/turnovers.test.mjs:106` | asserted |
| `OPS-004` | 2 | The new task retains both the original photo and turnover link | none | none |
| `FIN-001` | 1 | Closed-period correction reverses exact original ledger legs | `tests/ledger.test.mjs:24` | asserted |
| `FIN-001` | 1 | Correction retains source owner and legal entity | `tests/ledger.test.mjs:27` | asserted |
| `FIN-001` | 1 | Deposit, earning, fee, tax, refund and owner-expense journals are balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Each posted journal has its source and reservation attribution | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | The operator drills every named balance to its source transaction | none | none |
| `FIN-003` | 1 | Exact owner splits are retained | `tests/allocations.test.mjs:28` | asserted |
| `FIN-003` | 1 | Fixed and percentage fees reconcile | `tests/allocations.test.mjs:17` | asserted |
| `FIN-003` | 1 | Reserve reconciles to the allocation | `tests/allocations.test.mjs:18` | asserted |
| `FIN-003` | 1 | Shared invoice retains exact accountant mapping and evidence | `tests/allocations.test.mjs:71` | asserted |
| `FIN-003` | 1 | Later agreement does not rewrite the frozen earlier allocation | `tests/allocations.test.mjs:55` | asserted |
| `FIN-004` | 1 | Missing payout prevents close until its source arrives | none | none |
| `FIN-004` | 1 | All four providers’ received settlements are included exactly once | none | none |
| `FIN-004` | 1 | Frozen close has exact opening, closing, distribution and refund values | `tests/month-close.test.mjs:30` | asserted |
| `FIN-004` | 1 | Exact statement approval is read back | `tests/month-close.test.mjs:32` | asserted |
| `FIN-004` | 1 | Scheduled owner email is recorded once | `tests/month-close.test.mjs:64` | asserted |
| `FIN-004` | 1 | Later correction links the prior statement and revised opening payable | `tests/month-close.test.mjs:41` | asserted |
| `FIN-004` | 1 | Original safe CSV and PDF remain byte-identical | `tests/month-close.test.mjs:52` | asserted |
| `FIN-004` | 1 | Every individual statement line reconciles to the ledger | none | none |
| `FIN-005` | 1 | Each unrelated owner sees only the correct properties, statements and performance | `tests/owners.test.mjs:41` | asserted |
| `FIN-005` | 1 | Owner expense approval is read back without spending or rewriting statements | `tests/owners.test.mjs:66` | asserted |
| `FIN-005` | 1 | Personal stay requires inventory approval and blocks the guest stay | `tests/owners.test.mjs:81` | asserted |
| `FIN-005` | 1 | Cross-owner URL and export attempts are refused | `tests/owners.test.mjs:45` | asserted |
| `FIN-005` | 1 | Transfer retains exactly the granted historical statement | `tests/owners.test.mjs:102` | asserted |
| `FIN-005` | 1 | Future and revoked access follow changed grants | `tests/owners.test.mjs:118` | asserted |
| `FIN-007` | 1 | Owner OAuth connection binds the accounting scope | `tests/finance.test.mjs:242` | asserted |
| `FIN-007` | 1 | Changed mappings leave the stale batch unposted | `tests/finance.test.mjs:250` | asserted |
| `FIN-007` | 1 | Repeated month sync retains each journal identity once | `tests/finance.test.mjs:255` | asserted |
| `FIN-007` | 1 | External transaction edit becomes a conflict without replacement writes | `tests/finance.test.mjs:258` | asserted |
| `FIN-007` | 1 | Month refund and expense values reconcile across every external line | none | none |
| `FIN-007` | 2 | Pantry retains one journal and attached evidence on repeat | `tests/finance.test.mjs:51` | asserted |
| `FIN-007` | 2 | Revoked Pantry connection becomes broken with its reason | `tests/finance.test.mjs:53` | asserted |
| `FIN-007` | 3 | Downloaded IIF has balanced journal legs | `tests/finance.test.mjs:55` | asserted |
| `FIN-007` | 3 | Authorized QuickBooks CSV content is read back | none | none |
| `REPORT-001` | 1 | Owner/maintenance blocks and occupancy denominator reconcile | `tests/finance.test.mjs:68` | asserted |
| `REPORT-001` | 1 | ADR, RevPAR and priced nights reconcile | `tests/finance.test.mjs:70` | asserted |
| `REPORT-001` | 1 | Cash totals reflect actual receipts, refunds and paid expenses | `tests/finance.test.mjs:82` | asserted |
| `REPORT-001` | 1 | Accrual net reconciles each source journal | `tests/finance.test.mjs:78` | asserted |
| `REPORT-001` | 1 | Missing payouts, unpaid stays and unmatched source exceptions are listed | `tests/finance.test.mjs:74` | asserted |
| `REPORT-001` | 1 | Exports contain every selected reservation, block, journal, payout and work row | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Source drill-downs resolve to their exact record | `tests/finance.test.mjs:79` | asserted |
| `REPORT-001` | 1 | Exported gross and owner net match the report | `tests/finance.test.mjs:81` | asserted |
| `REPORT-002` | 1 | Two owner schedules and one team digest preserve the saved filters | `tests/finance.test.mjs:113` | asserted |
| `REPORT-002` | 1 | Revoked owner’s artifact is refused | `tests/finance.test.mjs:119` | asserted |
| `REPORT-002` | 1 | Permitted artifact scope and cutoff are retained | `tests/finance.test.mjs:120` | asserted |
| `REPORT-002` | 1 | Populated owner artifact excludes other owners’ rows | `tests/finance.test.mjs:124` | asserted |
| `REPORT-002` | 1 | Failed send has a retained artifact and assigned follow-up | `tests/finance.test.mjs:137` | asserted |
| `REPORT-002` | 2 | Interruption before and after acceptance preserves external acceptance count | `tests/finance.test.mjs:153` | asserted |
| `REPORT-002` | 2 | Restart never repeats the uncertain delivery | `tests/finance.test.mjs:156` | asserted |
| `MIGRATE-001` | 1 | Preview is inert and names refused rows | `tests/movein-register.test.mjs:24` | asserted |
| `MIGRATE-001` | 1 | Changed fingerprint is refused without applying rows | none | none |
| `MIGRATE-001` | 1 | Resumable apply retains the original source bytes and checkpoint | `tests/movein-register.test.mjs:37` | asserted |
| `MIGRATE-001` | 1 | Undo preserves the native edit and dependent booking | `tests/movein-register.test.mjs:46` | asserted |
| `MIGRATE-001` | 1 | Every retained row has a durable disposition | `tests/movein-register.test.mjs:49` | asserted |
| `MIGRATE-001` | 1 | Erased import sources lose original bytes | `tests/movein-register.test.mjs:56` | asserted |
| `INTERFACE-001` | 1 | Calendar, photo and statement journeys run at both widths with keyboard error recovery | none | none |
| `INTERFACE-001` | 1 | The complete target booking and inbox journeys pass | none | none |
| `INTERFACE-001` | 2 | 10,000 reservations, 100,000 messages and 15,000 tasks are present | `tests/interface-scale.mjs:22` | asserted |
| `INTERFACE-001` | 2 | Forty homes appear in the timed calendar month | `tests/interface-scale.mjs:26` | asserted |
| `INTERFACE-001` | 2 | Calendar under two seconds and inbox search under one second | `tests/interface-scale.mjs:24` | asserted |
| `INTERFACE-001` | 2 | All 400 guest pages enumerate every result without duplication | `tests/interface-scale.mjs:31` | asserted |
| `INTERFACE-001` | 2 | Report rows, ledger gross and owner net reconcile | `tests/interface-scale.mjs:34` | asserted |
| `INTERFACE-001` | 2 | Every exported family and total matches the source records | `tests/interface-scale.mjs:38` | asserted |
| `DATA-001` | 1 | Populated public CLI archive round trip preserves all families, original media and totals | `tests/archive.test.mjs:59` | asserted |
| `DATA-001` | 1 | Damaged and populated destinations are refused without partial data | none | none |
| `DATA-001` | 1 | Restored jobs and connections remain inactive until exact reauthorization | none | none |
| `DATA-002` | 1 | Erasure withdraws photos and agreement public and private reads | `tests/privacy.test.mjs:27` | asserted |
| `DATA-002` | 1 | Held legal bytes match the original signed document | `tests/privacy.test.mjs:33` | asserted |
| `DATA-002` | 1 | Eligible guest facts and scheduled work are erased or suppressed | `tests/privacy.test.mjs:35` | asserted |
| `DATA-002` | 1 | Audit retains anonymized attribution without the email | `tests/privacy.test.mjs:36` | asserted |
| `DATA-002` | 1 | Retained accounting records state expiry and reason | `tests/privacy.test.mjs:75` | asserted |
| `DATA-002` | 1 | Later erasure journal fences old restore without partial writes | none | none |
| `DATA-003` | 1 | Guest, conversation, payout and photo records persist in owner storage | `tests/data-custody.test.mjs:29` | asserted |
| `DATA-003` | 1 | Populated request trace contains only the connected provider | `tests/data-custody.test.mjs:33` | asserted |
| `DATA-003` | 2 | Disconnection stops subsequent requests after the prior populated actions | `tests/data-custody.test.mjs:44` | asserted |
| `DATA-003` | 2 | Guest mail count stays unchanged after sharing is withdrawn | `tests/data-custody.test.mjs:57` | asserted |
| `AUDIT-001` | 1 | Human, agent, provider, lock, refund and statement outcomes are each present | none | none |
| `AUDIT-001` | 1 | Portable history includes the agent and provider-linked actions | `tests/audit.test.mjs:30` | asserted |
| `AUDIT-001` | 1 | Guest erasure preserves action and time with anonymized target | `tests/audit.test.mjs:38` | asserted |
| `AUDIT-001` | 1 | The populated export excludes credentials and personal message bodies | `tests/audit.test.mjs:31` | asserted |
| `SECURITY-001` | 1 | Saved credentials are encrypted and absent from ordinary state | `tests/security.test.mjs:29` | asserted |
| `SECURITY-001` | 1 | Rotated credential rejects old provider signatures | `tests/security.test.mjs:57` | asserted |
| `SECURITY-001` | 1 | Forged events are refused before their message is recorded | `tests/security.test.mjs:45` | asserted |
| `SECURITY-001` | 1 | Adversarial guest text cannot expose the entry capability to the model | `tests/security.test.mjs:65` | asserted |
| `SECURITY-001` | 1 | Role-limited ordinary state omits guest access capabilities | `tests/security.test.mjs:69` | asserted |
| `SECURITY-001` | 1 | Revocation stops queued outbound requests | `tests/security.test.mjs:82` | asserted |
| `SECURITY-001` | 1 | Retained provider history stays readable without credential values | `tests/security.test.mjs:86` | asserted |
| `SECURITY-001` | 1 | Logs, exports and all agent outputs omit every named sensitive field | none | none |
| `HTTP-001` | 1 | Emitted Worker reports actual healthy dependencies | `tests/runtime.mjs:34` | asserted |
| `HTTP-001` | 1 | Installed document contains the Cabin brand | `tests/runtime.mjs:39` | asserted |
| `HTTP-001` | 1 | Unknown document and API doors are true not-found responses | `tests/runtime.mjs:41` | asserted |
| `RUNTIME-001` | 1 | Saved native rental job survives actual development process restart | `tests/launch.test.mjs:54` | asserted |
| `RUNTIME-001` | 1 | Every payment, send and lock boundary reconciles without duplicate external effects | none | none |
| `RUNTIME-001` | 2 | Five-command clean Linux setup reaches a signed-in product job | `tests/launch.test.mjs:54` | asserted |
| `AGENT-001` | 1 | Cleaner cancellation and failed lock are followed through the same recovery case | none | none |
| `AGENT-001` | 2 | Held-policy exact budget and relocation produce backup acceptance, photos and guest confirmation | none | none |
| `AGENT-001` | 2 | New code and corrected owner net are reconciled | none | none |
| `AGENT-001` | 3 | Interrupted held-policy work preserves every unresolved step and balance | none | none |
| `AGENT-003` | 1 | Vendor decline is retained | `tests/issues.test.mjs:34` | asserted |
| `AGENT-003` | 1 | Confirmed guest and delayed recurrence are required before closure | `tests/issues.test.mjs:50` | asserted |
| `AGENT-003` | 1 | Inspected field work resolves both access failure and leaking appliance | none | none |
| `AGENT-003` | 1 | Held company policy decides the exact dispatch classes | none | none |
| `AGENT-003` | 2 | Emergency is immediately escalated to the named host with 911 instructions | `tests/issues.test.mjs:56` | asserted |
| `AGENT-003` | 2 | The populated emergency emits no automated guest safety claim | `tests/issues.test.mjs:58` | asserted |
| `AGENT-005` | 1 | Current and comparison owner net match the reports and journal sources | `tests/finance.test.mjs:175` | asserted |
| `AGENT-005` | 1 | Arrival risks retain stale-provider uncertainty | `tests/finance.test.mjs:193` | asserted |
| `AGENT-005` | 1 | Unrelated owner cannot open the answer or report | `tests/finance.test.mjs:210` | asserted |
| `AGENT-005` | 1 | Exact investigation creates one named durable task | `tests/finance.test.mjs:232` | asserted |
| `AGENT-005` | 1 | Held company policy computes and decides the investigation class | none | none |
| `AGENT-006` | 1 | Changed recipient or booking refuses the old held action revision | none | none |
| `AGENT-006` | 1 | Company policy cap and injected guest instructions cannot widen authority | none | none |
| `AGENT-006` | 1 | Revocation stops repeated uncertain provider writes | `tests/recovery-authority.test.mjs:112` | asserted |
| `AGENT-006` | 2 | Restart retains an explicit uncertain provider outcome | `tests/recovery-authority.test.mjs:113` | asserted |
| `AGENT-006` | 2 | No unauthorized effect occurs while the source remains uncertain | `tests/recovery-authority.test.mjs:112` | asserted |
| `AGENT-006` | 3 | The $75 credit posts the exact balanced owner adjustment | `tests/recovery-authority.test.mjs:70` | asserted |
| `AGENT-006` | 3 | The named company policy makes $75 autonomous and holds $150 for exact approval | none | none |
| `OPEN-001` | 1 | Public source licence and declared package licence are MIT | none | none |
| `OPEN-001` | 1 | Installation needs no author account or key | none | none |
| `OPEN-001` | 1 | Every product area supports 40 homes and 25 staff without an author payment gate | none | none |
| `OPEN-001` | 1 | Provider cost and its source are shown before activation | none | none |
| `CABIN-01` | old CABIN-01 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `SYNC-009` | old CABIN-02 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `WEB-001` | old CABIN-03 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `OPS-001` | old CABIN-04 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `EVIDENCE-001` | old CABIN-05 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `OPS-003` | old CABIN-06 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `MESSAGE-003` | old CABIN-07 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `AGENT-001` | old CABIN-08 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `FIN-004` | old CABIN-09 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `FIN-007` | old CABIN-10 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `MIGRATE-001` | old CABIN-11 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `CONTROL-002` | old CABIN-12 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `DATA-001` | old CABIN-13 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
| `REPORT-001` | old pointer | Cross-clause pointer and measurement boundary moved to Requirement or register | Requirement / register | moved |
| `RUNTIME-001` | old pointer | Cross-clause pointer and measurement boundary moved to Requirement or register | Requirement / register | moved |
