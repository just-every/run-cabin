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
| `CONTROL-001` | 1 | Exact approval retains its actor | `tests/cabin.test.mjs:55` | asserted |
| `CONTROL-001` | 1 | Exact approval retains its revision | `tests/cabin.test.mjs:55` | asserted |
| `CONTROL-001` | 1 | Stale calendar publication cannot replace the current revision | none | none |
| `CONTROL-001` | 1 | Stale statement and duplicate approval preserve the published statement | none | none |
| `CONTROL-001` | 1 | Changed booking and property terms prevent stale turnover or statement publication | none | none |
| `CONTROL-002` | 1 | Held-policy preparation, no pre-approval effect and revocation | none | none |
| `CONTROL-002` | 2 | All-autonomous classified publication and separate person-confirmation door | none | none |
| `SYNC-001` | 1 | Overlap preview lists the clash | `tests/cabin.test.mjs:41` | asserted |
| `SYNC-001` | 1 | Published feed retains import time | `tests/cabin.test.mjs:44` | asserted |
| `SYNC-001` | 1 | Published feed retains approval time | `tests/cabin.test.mjs:44` | asserted |
| `SYNC-001` | 1 | Reimport creates no duplicate bookings | `tests/cabin.test.mjs:47` | asserted |
| `SYNC-001` | 1 | A removed UID becomes canceled | `tests/cabin.test.mjs:54` | asserted |
| `SYNC-001` | 1 | Adjacent checkout and check-in have no clash | `tests/cabin.test.mjs:61` | asserted |
| `SYNC-001` | 1 | Stale baseline and malformed calendar are refused without changing bookings | none | none |
| `SYNC-009` | 1 | External source creates two occupied inventory records | `tests/calendars-sync.test.mjs:19` | asserted |
| `SYNC-009` | 1 | Imported records are channel blocks | `tests/calendars-sync.test.mjs:20` | asserted |
| `SYNC-009` | 1 | Conflicting direct request is declined | `tests/calendars-sync.test.mjs:23` | asserted |
| `SYNC-009` | 1 | Applied polling occurs within the configured interval | none | none |
| `SYNC-009` | 2 | A direct reservation appears in the exported unit calendar within 60 seconds | none | none |
| `SYNC-009` | 2 | Regeneration revokes the old export link | `tests/calendars-sync.test.mjs:53` | asserted |
| `SYNC-009` | 3 | Unreachable feed is stale with an assigned open exception | `tests/calendars-sync.test.mjs:29` | asserted |
| `SYNC-009` | 3 | Malformed source preserves the assigned exception identity | `tests/calendars-sync.test.mjs:37` | asserted |
| `SYNC-009` | 3 | Malformed source preserves the selected assignee | `tests/calendars-sync.test.mjs:37` | asserted |
| `SYNC-009` | 3 | Malformed feed retains both occupied blocks | `tests/calendars-sync.test.mjs:38` | asserted |
| `SYNC-009` | 3 | Recovered connection is successful | `tests/calendars-sync.test.mjs:47` | asserted |
| `SYNC-009` | 3 | Recovered exception has its resolution time | `tests/calendars-sync.test.mjs:47` | asserted |
| `SYNC-009` | 3 | Recovered source has a changed-data timestamp | `tests/calendars-sync.test.mjs:47` | asserted |
| `SYNC-009` | 3 | Recovered source has its fresh next poll | `tests/calendars-sync.test.mjs:47` | asserted |
| `RES-001` | 1 | Twenty-home portfolio is complete | `tests/calendar.test.mjs:32` | asserted |
| `RES-001` | 1 | Property filter leaves one portfolio row | `tests/calendar.test.mjs:36` | asserted |
| `RES-001` | 1 | Channel filter removes the unrelated stay | `tests/calendar.test.mjs:38` | asserted |
| `RES-001` | 1 | An overlapping stay exposes the collision | `tests/calendar.test.mjs:39` | asserted |
| `RES-001` | 1 | Arrival is rendered as 1:30 am EDT | `tests/calendar.test.mjs:42` | asserted |
| `RES-001` | 1 | Departure is rendered as 10 am EST | `tests/calendar.test.mjs:43` | asserted |
| `RES-001` | 1 | Stay details show not-ready state | `tests/calendar.test.mjs:44` | asserted |
| `RES-001` | 1 | Stay details link the blocking maintenance task | `tests/calendar.test.mjs:45` | asserted |
| `RES-001` | 1 | Owner block links to its authoritative record | `tests/calendar.test.mjs:50` | asserted |
| `RES-001` | 1 | Pending payment is visible on an unpaid arrival | `tests/calendar.test.mjs:80` | asserted |
| `RES-001` | 1 | The same calendar source drill-down works on desktop and phone | none | none |
| `RES-002` | 1 | Extension revises the turnover checkout window | `tests/reservations.test.mjs:28` | asserted |
| `RES-002` | 1 | Stay access follows the extension | `tests/reservations.test.mjs:29` | asserted |
| `RES-002` | 1 | Recorded receipt reduces the remaining balance to 59000 cents | `tests/reservations.test.mjs:32` | asserted |
| `RES-002` | 1 | Moving homes selects the new owner | `tests/reservations.test.mjs:40` | asserted |
| `RES-002` | 1 | Moving homes selects the new commission allocation | `tests/reservations.test.mjs:41` | asserted |
| `RES-002` | 1 | Moving homes revokes the old access codes | `tests/reservations.test.mjs:42` | asserted |
| `RES-002` | 1 | One active cleaning task follows the new home | `tests/reservations.test.mjs:44` | asserted |
| `RES-002` | 1 | Cancellation retains the saved 69500-cent charge | `tests/reservations.test.mjs:48` | asserted |
| `RES-002` | 1 | Cancellation shows the 10500-cent refund due | `tests/reservations.test.mjs:49` | asserted |
| `RES-002` | 1 | Cancellation withdraws previously issued access codes | `tests/reservations.test.mjs:51` | asserted |
| `RES-002` | 1 | Cancellation suppresses a demonstrably populated scheduled-message set | none | none |
| `RES-002` | 1 | Repeated channel amendment keeps two revisions | `tests/reservations.test.mjs:64` | asserted |
| `RES-003` | 1 | Exact owner request is approved | `tests/owners.test.mjs:80` | asserted |
| `RES-003` | 1 | Approved personal stay is an inventory block | `tests/owners.test.mjs:80` | asserted |
| `RES-003` | 1 | Occupied maintenance request is declined | `tests/owners.test.mjs:142` | asserted |
| `RES-003` | 1 | Every channel export carries the same owner block | `tests/owners.test.mjs:141` | asserted |
| `RES-003` | 1 | Canceled owner block cancels the cleaning task | `tests/owners.test.mjs:148` | asserted |
| `RES-003` | 1 | Canceling removes the block from every exported channel | `tests/owners.test.mjs:149` | asserted |
| `RES-003` | 1 | One completed owner-use cost posts | `tests/owners.test.mjs:159` | asserted |
| `RES-003` | 1 | Owner-use cost is exactly 8500 cents | `tests/owners.test.mjs:159` | asserted |
| `RES-003` | 1 | Every leg is owner liability or vendor payable, with no guest cash | `tests/owners.test.mjs:159` | asserted |
| `RES-003` | 1 | The resulting calendar state is read after cancellation | none | none |
| `RES-006` | 1 | Issued quote shows its exact advertised total | `tests/reservations.test.mjs:86` | asserted |
| `RES-006` | 1 | Issued quote shows its saved cancellation policy | `tests/reservations.test.mjs:86` | asserted |
| `RES-006` | 1 | Issued quote shows the guest count | `tests/reservations.test.mjs:86` | asserted |
| `RES-006` | 1 | Concurrent quote acceptance creates one processor session | `tests/reservations.test.mjs:96` | asserted |
| `RES-006` | 1 | Concurrent quote acceptance leaves one confirmed booking | `tests/reservations.test.mjs:101` | asserted |
| `RES-006` | 1 | Booking retains the accepted quote revision | `tests/reservations.test.mjs:101` | asserted |
| `RES-006` | 1 | Repeated acceptance returns the existing private booking | `tests/reservations.test.mjs:98` | asserted |
| `RES-006` | 1 | An expired rival releases its hold | `tests/reservations.test.mjs:104` | asserted |
| `RES-006` | 1 | Changed rate or availability cannot silently charge obsolete terms | `tests/reservations.test.mjs:107` | asserted |
| `WEB-001` | 1 | Two properties appear in actual date search | `tests/website.test.mjs:28` | asserted |
| `WEB-001` | 1 | Page editor persists the exact revised page text | `tests/website.test.mjs:25` | asserted |
| `WEB-001` | 1 | Custom domain serves the canonical booking address | `tests/website.test.mjs:35` | asserted |
| `WEB-001` | 1 | Booking at both widths retains the exact advertised total and terms | none | none |
| `WEB-001` | 2 | One booking references its payment intent | `tests/direct.test.mjs:46` | asserted |
| `WEB-001` | 2 | That paid booking reaches confirmed state | `tests/direct.test.mjs:44` | asserted |
| `WEB-001` | 2 | That booking retains verified identity | `tests/direct.test.mjs:44` | asserted |
| `WEB-001` | 2 | Separate damage hold is retained before confirmation | `tests/direct.test.mjs:41` | asserted |
| `WEB-001` | 2 | Signed agreement retains the guest signer | `tests/direct.test.mjs:50` | asserted |
| `WEB-001` | 2 | Signed agreement retains the exact paid total | `tests/direct.test.mjs:50` | asserted |
| `WEB-001` | 3 | Checkout before check-in is refused | none | none |
| `WEB-001` | 3 | Receipt states the actual held-on-card damage authorization | `tests/direct.test.mjs:42` | asserted |
| `WEB-001` | 3 | Receipt itemizes the 75-dollar cleaning fee | `tests/direct.test.mjs:42` | asserted |
| `WEB-001` | 3 | Capture and release retain the entered reason in read-back | none | none |
| `WEB-002` | 1 | External embed completes exactly one reservation | `tests/website.test.mjs:62` | asserted |
| `WEB-002` | 1 | External-site browser journey leaves one booking | `tests/website-browser.test.mjs:77` | asserted |
| `WEB-002` | 1 | WordPress Custom HTML fixture leaves one booking | `tests/website-browser.test.mjs:77` | asserted |
| `WEB-002` | 1 | Both embedded journeys retain the advertised 58300-cent total | `tests/website-browser.test.mjs:77` | asserted |
| `WEB-002` | 1 | Unapproved embedding origins are refused | `tests/website.test.mjs:55` | asserted |
| `WEB-002` | 1 | External embed origin cannot read the private reservation/guest state | `tests/website.test.mjs:56` | asserted |
| `WEB-003` | 1 | Required exact rental terms are displayed | `tests/direct.test.mjs:89` | asserted |
| `WEB-003` | 1 | Signed version is downloadable with signer evidence | `tests/direct.test.mjs:96` | asserted |
| `WEB-003` | 1 | Amended dates invalidate the signature | `tests/direct.test.mjs:104` | asserted |
| `WEB-003` | 1 | Original signed bytes remain unchanged | `tests/direct.test.mjs:106` | asserted |
| `WEB-003` | 1 | Old consent is refused for amended terms | `tests/direct.test.mjs:107` | asserted |
| `WEB-003` | 1 | Both signed document revisions are retained | `tests/direct.test.mjs:110` | asserted |
| `WEB-004` | 1 | Successful provider verification reaches confirmed state | `tests/direct.test.mjs:44` | asserted |
| `WEB-004` | 1 | Failed provider check remains requires-input | `tests/direct.test.mjs:213` | asserted |
| `WEB-004` | 1 | Assigned manual reviewer is retained | `tests/direct.test.mjs:206` | asserted |
| `WEB-004` | 1 | Unresolved verification withholds the issued guest code | `tests/direct.test.mjs:207` | asserted |
| `WEB-004` | 1 | Role-limited identity details are absent | `tests/direct.test.mjs:219` | asserted |
| `WEB-004` | 1 | Erasure withdraws the old verification link | `tests/direct.test.mjs:229` | asserted |
| `WEB-004` | 1 | Erasure removes retained provider details | `tests/direct.test.mjs:232` | asserted |
| `WEB-004` | 1 | Erasure removes the identity decision | `tests/direct.test.mjs:232` | asserted |
| `WEB-004` | 1 | Provider redaction was requested | `tests/direct.test.mjs:232` | asserted |
| `WEB-004` | 1 | Manual review outcome releases the authorized code | `tests/direct.test.mjs:226` | asserted |
| `PAY-002` | 1 | A configured schedule collects the first deposit once after restart | `tests/collection-support.mjs:56` | asserted |
| `PAY-002` | 1 | Failed collection retains failed state | `tests/collection-support.mjs:60` | asserted |
| `PAY-002` | 1 | Failed collection retains a deadline | `tests/collection-support.mjs:60` | asserted |
| `PAY-002` | 1 | Failed collection retains its responsible owner | `tests/collection-support.mjs:60` | asserted |
| `PAY-002` | 1 | Payment reminder resolves after the successful authorized retry | `tests/collection-support.mjs:74` | asserted |
| `PAY-002` | 1 | Changed stay requires renewed consent | `tests/collection-support.mjs:77` | asserted |
| `PAY-002` | 1 | Changed stay recalculates its future due time | `tests/collection-support.mjs:77` | asserted |
| `PAY-002` | 1 | Obsolete consent causes no new processor write | `tests/collection-support.mjs:77` | asserted |
| `PAY-002` | 1 | Cancellation suppresses the final charge after restart | `tests/collection-support.mjs:86` | asserted |
| `PAY-003` | 1 | Partial evidenced capture is read back with the retained reason | none | none |
| `PAY-003` | 1 | Captured amount is the authorized partial amount once | `tests/direct.test.mjs:297` | asserted |
| `PAY-003` | 1 | Remaining damage-hold liability is zero | `tests/direct.test.mjs:297` | asserted |
| `PAY-003` | 1 | Rent refund is posted only once after retry and restart | `tests/direct.test.mjs:303` | asserted |
| `PAY-003` | 1 | Guest receipt states the 110-dollar refund | `tests/direct.test.mjs:307` | asserted |
| `PAY-003` | 1 | Exactly one refund receipt exists | `tests/direct.test.mjs:308` | asserted |
| `PAY-003` | 1 | Refund restores exact owner liability | `tests/direct.test.mjs:304` | asserted |
| `PAY-003` | 1 | Refund restores exact tax liability | `tests/direct.test.mjs:304` | asserted |
| `PAY-003` | 1 | Refund leaves no damage-hold liability | `tests/direct.test.mjs:304` | asserted |
| `PAY-003` | 1 | Cancellation settlement has the saved-policy amount | `tests/direct.test.mjs:327` | asserted |
| `PAY-003` | 1 | Cancellation has the exact remaining owner liability | `tests/direct.test.mjs:330` | asserted |
| `PAY-003` | 1 | Cancellation releases the processor damage authorization | `tests/direct.test.mjs:329` | asserted |
| `PAY-003` | 1 | Every processor callback replay preserves each captured, refunded and released outcome | none | none |
| `PAY-003` | 2 | No-claim checkout releases the authorization within the configured window | none | none |
| `PAY-003` | 2 | Long-stay authorization expiry is renewed or visibly flagged before expiry | `tests/direct.test.mjs:278` | asserted |
| `GUEST-001` | 1 | Two channel identities are merged only by review | `tests/guests.test.mjs:40` | asserted |
| `GUEST-001` | 1 | Unmerge removes the old identity link | `tests/guests.test.mjs:47` | asserted |
| `GUEST-001` | 1 | Unmerge restores the original preference | `tests/guests.test.mjs:47` | asserted |
| `GUEST-001` | 1 | Recorded opt-out remains attached to the right guest | `tests/guests.test.mjs:47` | asserted |
| `GUEST-001` | 1 | Return stay receives the eligible preference in its native view | `tests/guests.test.mjs:81` | asserted |
| `GUEST-001` | 1 | Restricted staff cannot read private guest notes | `tests/guests.test.mjs:43` | asserted |
| `MESSAGE-002` | 1 | Urgent off-shift thread routes to the on-shift manager | `tests/replies.test.mjs:116` | asserted |
| `MESSAGE-002` | 1 | Deadline is computed from the unanswered urgent message | `tests/replies.test.mjs:117` | asserted |
| `MESSAGE-002` | 1 | Private note is never delivered to the guest on the populated thread | `tests/replies.test.mjs:163` | asserted |
| `MESSAGE-002` | 1 | Concurrent reply is refused with collision context | `tests/replies.test.mjs:129` | asserted |
| `MESSAGE-002` | 1 | Handover retains the named reservation | `tests/replies.test.mjs:142` | asserted |
| `MESSAGE-002` | 1 | Handover retains the open field task | `tests/replies.test.mjs:142` | asserted |
| `MESSAGE-002` | 1 | Handover retains the prior guest promise | `tests/replies.test.mjs:142` | asserted |
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
| `GUEST-002` | 1 | Guest sees completed agreement task | `tests/guest-portal.test.mjs:60` | asserted |
| `GUEST-002` | 1 | Guest sees completed identity task | `tests/guest-portal.test.mjs:60` | asserted |
| `GUEST-002` | 1 | Correctly timed access code is displayed to the holder | `tests/guest-portal.test.mjs:47` | asserted |
| `GUEST-002` | 1 | Guest issue report visibly succeeds | `tests/guest-portal.test.mjs:64` | asserted |
| `GUEST-002` | 1 | Another reservation’s ID cannot open the portal | `tests/guest-portal.test.mjs:70` | asserted |
| `GUEST-002` | 1 | Expired portal is refused | `tests/guest-portal.test.mjs:94` | asserted |
| `GUEST-002` | 1 | Canceled stay withdraws the active code | `tests/guest-portal.test.mjs:103` | asserted |
| `GUEST-002` | 1 | Canceled stay withdraws private arrival instructions | `tests/guest-portal.test.mjs:103` | asserted |
| `GUEST-002` | 1 | Canceled stay withdraws its private task/reporting controls | `tests/guest-portal.test.mjs:103` | asserted |
| `OPS-001` | 1 | Exactly one initial turnover exists | `tests/dispatch.test.mjs:40` | asserted |
| `OPS-001` | 1 | Declining the current cleaner opens three eligible backup offers | `tests/dispatch.test.mjs:55` | asserted |
| `OPS-001` | 1 | Exactly one competing backup acceptance wins | `tests/dispatch.test.mjs:62` | asserted |
| `OPS-001` | 1 | Previously open blocking tasks are closed after acceptance | `tests/dispatch.test.mjs:64` | asserted |
| `OPS-001` | 1 | Extension revises the turnover work window | `tests/dispatch.test.mjs:69` | asserted |
| `OPS-001` | 1 | Extension retains the revised cleaning rate | `tests/dispatch.test.mjs:69` | asserted |
| `OPS-001` | 1 | Changed instructions are read back | `tests/dispatch.test.mjs:75` | asserted |
| `OPS-001` | 1 | Cancellation leaves no pending backup offer | `tests/dispatch.test.mjs:89` | asserted |
| `OPS-001` | 1 | Cancellation withdraws previously issued entry codes | `tests/dispatch.test.mjs:90` | asserted |
| `OPS-001` | 1 | No duplicate payable work is manufactured on cancellation | none | none |
| `OPS-001` | 2 | Impossible travel has its visible reason | `tests/dispatch.test.mjs:117` | asserted |
| `OPS-001` | 2 | Only the reachable backup receives the offer | `tests/dispatch.test.mjs:118` | asserted |
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
| `OPS-003` | 1 | Failed arrival remains visibly unready | `tests/readiness.test.mjs:34` | asserted |
| `OPS-003` | 1 | Blocking latch problem is visible | `tests/readiness.test.mjs:35` | asserted |
| `OPS-003` | 1 | The failed restock item is separately read before resolution | none | none |
| `OPS-003` | 1 | Final arrival is visibly ready | `tests/readiness.test.mjs:51` | asserted |
| `OPS-003` | 1 | Named inspector is displayed with the readiness evidence | `tests/readiness.test.mjs:53` | asserted |
| `OPS-003` | 1 | The manager and guest-service team both read the same final readiness evidence | none | none |
| `OPS-004` | 1 | Broken appliance creates an assigned photographed work order | `tests/work-orders.test.mjs:22` | asserted |
| `OPS-004` | 1 | Approved quote and invoice are both read back with their exact evidence | none | none |
| `OPS-004` | 1 | Maintenance inventory refuses a conflicting reservation | `tests/work-orders.test.mjs:27` | asserted |
| `OPS-004` | 1 | Inspected work order is closed | `tests/work-orders.test.mjs:50` | asserted |
| `OPS-004` | 1 | Its maintenance inventory block is canceled | `tests/work-orders.test.mjs:50` | asserted |
| `OPS-004` | 1 | Completed work cost retains the rental owner | `tests/work-orders.test.mjs:41` | asserted |
| `OPS-004` | 1 | Completed work cost is exactly 15000 cents | `tests/work-orders.test.mjs:41` | asserted |
| `OPS-004` | 1 | One future recurring visit exists | `tests/work-orders.test.mjs:51` | asserted |
| `OPS-004` | 1 | One maintenance payable journal exists | `tests/work-orders.test.mjs:53` | asserted |
| `OPS-004` | 1 | Maintenance payable journal is balanced | `tests/work-orders.test.mjs:53` | asserted |
| `OPS-004` | 2 | Cleaner photo report assigns the property maintenance person | `tests/turnovers.test.mjs:105` | asserted |
| `OPS-004` | 2 | Maintenance recipient receives the notice at the test mail edge | `tests/turnovers.test.mjs:106` | asserted |
| `OPS-004` | 2 | The new task retains both the original photo and turnover link | none | none |
| `FIN-001` | 1 | Closed-period correction reverses exact original ledger legs | `tests/ledger.test.mjs:24` | asserted |
| `FIN-001` | 1 | Reversing correction retains the original owner | `tests/ledger.test.mjs:23` | asserted |
| `FIN-001` | 1 | Reversing correction retains the original legal entity | `tests/ledger.test.mjs:23` | asserted |
| `FIN-001` | 1 | Replacement correction links the original journal | `tests/ledger.test.mjs:27` | asserted |
| `FIN-001` | 1 | Deposit journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Earned stay journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Channel fee journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Tax journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Refund journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Owner expense journal is balanced | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Journal retains its reservation and property | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Journal retains its owner and legal entity | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Journal retains its source identity and revision | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | Journal retains its actor and posting time | `tests/ledger.test.mjs:29` | asserted |
| `FIN-001` | 1 | The operator drills every named balance to its source transaction | none | none |
| `FIN-003` | 1 | Exact owner splits are retained | `tests/allocations.test.mjs:28` | asserted |
| `FIN-003` | 1 | Combined fixed and percentage management fees total 20400 cents | `tests/allocations.test.mjs:17` | asserted |
| `FIN-003` | 1 | Reserve reconciles to the allocation | `tests/allocations.test.mjs:18` | asserted |
| `FIN-003` | 1 | Shared cost retains its original invoice evidence | `tests/allocations.test.mjs:71` | asserted |
| `FIN-003` | 1 | Shared cost retains the accountant-reviewed mapping | `tests/allocations.test.mjs:71` | asserted |
| `FIN-003` | 1 | Later agreement does not rewrite the frozen earlier allocation | `tests/allocations.test.mjs:55` | asserted |
| `FIN-004` | 1 | Missing payout prevents close until its source arrives | none | none |
| `FIN-004` | 1 | All four providers’ received settlements are included exactly once | none | none |
| `FIN-004` | 1 | Frozen close opens at 2500 cents | `tests/month-close.test.mjs:29` | asserted |
| `FIN-004` | 1 | Frozen close ends at 23050 cents | `tests/month-close.test.mjs:30` | asserted |
| `FIN-004` | 1 | Frozen close includes 5000 cents of recorded distributions | `tests/month-close.test.mjs:30` | asserted |
| `FIN-004` | 1 | Frozen close includes 2950 cents of refunds | `tests/month-close.test.mjs:30` | asserted |
| `FIN-004` | 1 | Exact statement approval is read back | `tests/month-close.test.mjs:32` | asserted |
| `FIN-004` | 1 | Scheduled owner email is recorded once | `tests/month-close.test.mjs:64` | asserted |
| `FIN-004` | 1 | Correction links the exact earlier statement | `tests/month-close.test.mjs:41` | asserted |
| `FIN-004` | 1 | Correction opens at the prior 23050-cent payable | `tests/month-close.test.mjs:41` | asserted |
| `FIN-004` | 1 | Corrected payable is 24550 cents | `tests/month-close.test.mjs:41` | asserted |
| `FIN-004` | 1 | Original statement CSV bytes remain unchanged | `tests/month-close.test.mjs:52` | asserted |
| `FIN-004` | 1 | Original statement PDF bytes remain unchanged | `tests/month-close.test.mjs:52` | asserted |
| `FIN-004` | 1 | Every individual statement line reconciles to the ledger | none | none |
| `FIN-005` | 1 | Owner portal includes only its home | `tests/owners.test.mjs:41` | asserted |
| `FIN-005` | 1 | Owner portal includes only its approved statement | `tests/owners.test.mjs:41` | asserted |
| `FIN-005` | 1 | Owner performance retains occupied nights and gross | `tests/owners.test.mjs:41` | asserted |
| `FIN-005` | 1 | Owner expense decision is retained as approved | `tests/owners.test.mjs:66` | asserted |
| `FIN-005` | 1 | Owner expense decision does not change the frozen statement payable | `tests/owners.test.mjs:68` | asserted |
| `FIN-005` | 1 | Personal stay is approved as a block | `tests/owners.test.mjs:80` | asserted |
| `FIN-005` | 1 | Personal stay refuses a conflicting guest booking | `tests/owners.test.mjs:81` | asserted |
| `FIN-005` | 1 | Cross-owner URL and export attempts are refused | `tests/owners.test.mjs:45` | asserted |
| `FIN-005` | 1 | Transfer retains exactly the granted historical statement | `tests/owners.test.mjs:102` | asserted |
| `FIN-005` | 1 | New owner can read the future granted statement | `tests/owners.test.mjs:115` | asserted |
| `FIN-005` | 1 | Old owner cannot read the new owner’s future statement | `tests/owners.test.mjs:116` | asserted |
| `FIN-005` | 1 | Revocation withdraws the historical statement grant | `tests/owners.test.mjs:118` | asserted |
| `FIN-007` | 1 | Owner OAuth connection binds the accounting scope | `tests/finance.test.mjs:242` | asserted |
| `FIN-007` | 1 | Changed mappings leave the stale batch unposted | `tests/finance.test.mjs:250` | asserted |
| `FIN-007` | 1 | Repeated month sync retains each journal identity once | `tests/finance.test.mjs:255` | asserted |
| `FIN-007` | 1 | External transaction edit is shown as conflict | `tests/finance.test.mjs:258` | asserted |
| `FIN-007` | 1 | Re-sync does not write a replacement for the external edit | `tests/finance.test.mjs:259` | asserted |
| `FIN-007` | 1 | Month refund and expense values reconcile across every external line | none | none |
| `FIN-007` | 2 | Repeated posting writes one Pantry journal | `tests/finance.test.mjs:51` | asserted |
| `FIN-007` | 2 | Repeated posting retains one attached evidence document | `tests/finance.test.mjs:51` | asserted |
| `FIN-007` | 2 | Revoked Pantry connection becomes broken with its reason | `tests/finance.test.mjs:53` | asserted |
| `FIN-007` | 3 | Downloaded IIF has balanced journal legs | `tests/finance.test.mjs:55` | asserted |
| `FIN-007` | 3 | Authorized QuickBooks CSV content is read back | none | none |
| `REPORT-001` | 1 | Report retains owner-block nights | `tests/finance.test.mjs:68` | asserted |
| `REPORT-001` | 1 | Report retains maintenance-block nights | `tests/finance.test.mjs:68` | asserted |
| `REPORT-001` | 1 | Report denominator is 58 available nights | `tests/finance.test.mjs:68` | asserted |
| `REPORT-001` | 1 | Report retains 13 priced nights | `tests/finance.test.mjs:70` | asserted |
| `REPORT-001` | 1 | Report ADR uses the exact rental cents and priced nights | `tests/finance.test.mjs:70` | asserted |
| `REPORT-001` | 1 | Report RevPAR uses the exact rental cents and available nights | `tests/finance.test.mjs:70` | asserted |
| `REPORT-001` | 1 | Cash report includes actual 142500-cent receipts | `tests/finance.test.mjs:82` | asserted |
| `REPORT-001` | 1 | Cash report includes actual 5000-cent paid costs | `tests/finance.test.mjs:82` | asserted |
| `REPORT-001` | 1 | Cash owner net includes receipts less refund, fees and paid costs | `tests/finance.test.mjs:82` | asserted |
| `REPORT-001` | 1 | Accrual net reconciles each source journal | `tests/finance.test.mjs:78` | asserted |
| `REPORT-001` | 1 | Missing settlement remains a named exception | `tests/finance.test.mjs:74` | asserted |
| `REPORT-001` | 1 | Unpaid collection remains a named exception | `tests/finance.test.mjs:74` | asserted |
| `REPORT-001` | 1 | Unknown price remains a named exception | `tests/finance.test.mjs:74` | asserted |
| `REPORT-001` | 1 | Unmatched payout remains a named exception | `tests/finance.test.mjs:74` | asserted |
| `REPORT-001` | 1 | Reservation exports include every selected source record | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Inventory block exports include every selected source record | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Journal exports include every selected source record | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Payout exports include every selected source record | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Work exports include every selected source record | `tests/finance.test.mjs:80` | asserted |
| `REPORT-001` | 1 | Source drill-downs resolve to their exact record | `tests/finance.test.mjs:79` | asserted |
| `REPORT-001` | 1 | CSV gross equals the report’s 212500 cents | `tests/finance.test.mjs:81` | asserted |
| `REPORT-001` | 1 | CSV owner net equals the report’s 175800 cents | `tests/finance.test.mjs:81` | asserted |
| `REPORT-002` | 1 | All three saved report schedules exist | `tests/finance.test.mjs:113` | asserted |
| `REPORT-002` | 1 | Every saved report retains the original channel filter | `tests/finance.test.mjs:113` | asserted |
| `REPORT-002` | 1 | Revoked owner’s artifact is refused | `tests/finance.test.mjs:119` | asserted |
| `REPORT-002` | 1 | Owner artifact retains its exact property scope | `tests/finance.test.mjs:120` | asserted |
| `REPORT-002` | 1 | Owner artifact retains its data cutoff | `tests/finance.test.mjs:120` | asserted |
| `REPORT-002` | 1 | Owner artifact retains its source version | `tests/finance.test.mjs:120` | asserted |
| `REPORT-002` | 1 | Owner artifact retains its content digest | `tests/finance.test.mjs:120` | asserted |
| `REPORT-002` | 1 | Populated owner artifact excludes other owners’ rows | `tests/finance.test.mjs:124` | asserted |
| `REPORT-002` | 1 | Failed report delivery retains failure state | `tests/finance.test.mjs:137` | asserted |
| `REPORT-002` | 1 | Failed report delivery retains its generated artifact | `tests/finance.test.mjs:137` | asserted |
| `REPORT-002` | 1 | Failed report delivery has a named assignee | `tests/finance.test.mjs:137` | asserted |
| `REPORT-002` | 2 | Interruption before and after acceptance preserves external acceptance count | `tests/finance.test.mjs:153` | asserted |
| `REPORT-002` | 2 | Restart never repeats the uncertain delivery | `tests/finance.test.mjs:156` | asserted |
| `MIGRATE-001` | 1 | Preview leaves the installed property set empty | `tests/movein-register.test.mjs:22` | asserted |
| `MIGRATE-001` | 1 | Preview leaves users and bookings unchanged | `tests/movein-register.test.mjs:22` | asserted |
| `MIGRATE-001` | 1 | Preview names all three refused source rows | `tests/movein-register.test.mjs:24` | asserted |
| `MIGRATE-001` | 1 | Changed fingerprint is refused without applying rows | none | none |
| `MIGRATE-001` | 1 | Move-in journal preserves exact original CSV bytes | `tests/movein-register.test.mjs:36` | asserted |
| `MIGRATE-001` | 1 | Move-in journal retains its completed checkpoint | `tests/movein-register.test.mjs:37` | asserted |
| `MIGRATE-001` | 1 | Undo retains the edited property name | `tests/movein-register.test.mjs:46` | asserted |
| `MIGRATE-001` | 1 | Undo retains the dependent stay | `tests/movein-register.test.mjs:46` | asserted |
| `MIGRATE-001` | 1 | Every retained row has a durable disposition | `tests/movein-register.test.mjs:49` | asserted |
| `MIGRATE-001` | 1 | Erased import sources lose original bytes | `tests/movein-register.test.mjs:56` | asserted |
| `INTERFACE-001` | 1 | Calendar, photo and statement journeys run at both widths with keyboard error recovery | none | none |
| `INTERFACE-001` | 1 | The complete target booking and inbox journeys pass | none | none |
| `INTERFACE-001` | 2 | Scale fixture has 10000 reservations | `tests/interface-scale.mjs:22` | asserted |
| `INTERFACE-001` | 2 | Scale fixture has 100000 guest messages | `tests/interface-scale.mjs:22` | asserted |
| `INTERFACE-001` | 2 | Scale fixture has 15000 turnover tasks | `tests/interface-scale.mjs:22` | asserted |
| `INTERFACE-001` | 2 | Forty homes appear in the timed calendar month | `tests/interface-scale.mjs:26` | asserted |
| `INTERFACE-001` | 2 | Calendar timing is below the two-second limit passed to the assertion | `tests/interface-scale.mjs:24` | asserted |
| `INTERFACE-001` | 2 | Inbox search timing is below the one-second limit passed to the assertion | `tests/interface-scale.mjs:24` | asserted |
| `INTERFACE-001` | 2 | All guest pages have the exact source row count | `tests/interface-scale.mjs:31` | asserted |
| `INTERFACE-001` | 2 | Unique guest IDs equal the exact source count | `tests/interface-scale.mjs:31` | asserted |
| `INTERFACE-001` | 2 | Report includes every source reservation and journal | `tests/interface-scale.mjs:33` | asserted |
| `INTERFACE-001` | 2 | Report gross equals the source fixture | `tests/interface-scale.mjs:34` | asserted |
| `INTERFACE-001` | 2 | Report owner net equals the source fixture | `tests/interface-scale.mjs:34` | asserted |
| `INTERFACE-001` | 2 | Each exported family includes every source ID | `tests/interface-scale.mjs:37` | asserted |
| `INTERFACE-001` | 2 | Exported owner net matches the source ledger | `tests/interface-scale.mjs:38` | asserted |
| `DATA-001` | 1 | Re-exported archive record parts equal the populated source parts | `tests/archive.test.mjs:59` | asserted |
| `DATA-001` | 1 | Re-exported original media bytes equal the populated source archive | `tests/archive.test.mjs:59` | asserted |
| `DATA-001` | 1 | Re-exported financial record parts equal the populated source archive | `tests/archive.test.mjs:59` | asserted |
| `DATA-001` | 1 | Damaged and populated destinations are refused without partial data | none | none |
| `DATA-001` | 1 | Restored jobs and connections remain inactive until exact reauthorization | none | none |
| `DATA-002` | 1 | Erasure withdraws public agreement access | `tests/privacy.test.mjs:27` | asserted |
| `DATA-002` | 1 | Erasure withdraws the saved signed document URL | `tests/privacy.test.mjs:27` | asserted |
| `DATA-002` | 1 | Erasure withdraws private photo access | `tests/privacy.test.mjs:27` | asserted |
| `DATA-002` | 1 | Held legal bytes match the original signed document | `tests/privacy.test.mjs:33` | asserted |
| `DATA-002` | 1 | Erasure removes the guest email | `tests/privacy.test.mjs:35` | asserted |
| `DATA-002` | 1 | Erasure clears retained message text and email | `tests/privacy.test.mjs:35` | asserted |
| `DATA-002` | 1 | Erasure suppresses the populated stay’s future scheduled work | `tests/privacy.test.mjs:35` | asserted |
| `DATA-002` | 1 | Erasure audit retains an anonymized reference | `tests/privacy.test.mjs:36` | asserted |
| `DATA-002` | 1 | Erasure audit excludes the erased email | `tests/privacy.test.mjs:36` | asserted |
| `DATA-002` | 1 | Accounting hold names its retained journal | `tests/privacy.test.mjs:75` | asserted |
| `DATA-002` | 1 | Accounting hold names its end condition | `tests/privacy.test.mjs:75` | asserted |
| `DATA-002` | 1 | Accounting hold names its reason | `tests/privacy.test.mjs:75` | asserted |
| `DATA-002` | 1 | Later erasure journal fences old restore without partial writes | none | none |
| `DATA-003` | 1 | Owner storage retains the guest identity | `tests/data-custody.test.mjs:27` | asserted |
| `DATA-003` | 1 | Owner storage retains the guest conversation | `tests/data-custody.test.mjs:28` | asserted |
| `DATA-003` | 1 | Owner storage retains the exact payout amount | `tests/data-custody.test.mjs:29` | asserted |
| `DATA-003` | 1 | Owner storage retains cleaner photo bytes | `tests/data-custody.test.mjs:30` | asserted |
| `DATA-003` | 1 | Populated request trace contains only the connected provider | `tests/data-custody.test.mjs:33` | asserted |
| `DATA-003` | 2 | Disconnection stops subsequent requests after the prior populated actions | `tests/data-custody.test.mjs:44` | asserted |
| `DATA-003` | 2 | Guest mail count stays unchanged after sharing is withdrawn | `tests/data-custody.test.mjs:57` | asserted |
| `AUDIT-001` | 1 | Human, agent, provider, lock, refund and statement outcomes are each present | none | none |
| `AUDIT-001` | 1 | Portable history includes the agent and provider-linked actions | `tests/audit.test.mjs:30` | asserted |
| `AUDIT-001` | 1 | Erased audit target has its anonymized identity | `tests/audit.test.mjs:38` | asserted |
| `AUDIT-001` | 1 | Erased audit action is retained | `tests/audit.test.mjs:38` | asserted |
| `AUDIT-001` | 1 | Erased audit time is unchanged | `tests/audit.test.mjs:38` | asserted |
| `AUDIT-001` | 1 | Populated audit export excludes the guest email | `tests/audit.test.mjs:31` | asserted |
| `AUDIT-001` | 1 | Populated audit export excludes private message bodies | `tests/audit.test.mjs:31` | asserted |
| `AUDIT-001` | 1 | Populated audit export excludes the guest capability | `tests/audit.test.mjs:31` | asserted |
| `AUDIT-001` | 1 | Populated audit export excludes the agent credential | `tests/audit.test.mjs:31` | asserted |
| `SECURITY-001` | 1 | Provider credential is stored sealed without plaintext | `tests/security.test.mjs:28` | asserted |
| `SECURITY-001` | 1 | Ordinary state excludes the provider credential | `tests/security.test.mjs:29` | asserted |
| `SECURITY-001` | 1 | Rotated credential rejects old provider signatures | `tests/security.test.mjs:57` | asserted |
| `SECURITY-001` | 1 | Forged events are refused before their message is recorded | `tests/security.test.mjs:45` | asserted |
| `SECURITY-001` | 1 | Adversarial guest text cannot expose the entry capability to the model | `tests/security.test.mjs:65` | asserted |
| `SECURITY-001` | 1 | Role-limited ordinary state omits guest access capabilities | `tests/security.test.mjs:69` | asserted |
| `SECURITY-001` | 1 | Revocation stops queued outbound requests | `tests/security.test.mjs:82` | asserted |
| `SECURITY-001` | 1 | Provider history is readable after revocation | `tests/security.test.mjs:85` | asserted |
| `SECURITY-001` | 1 | Provider history excludes both old and rotated credentials | `tests/security.test.mjs:86` | asserted |
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
| `AGENT-003` | 1 | Initial guest confirmation is recorded | `tests/issues.test.mjs:42` | asserted |
| `AGENT-003` | 1 | Before recurrence the case remains open | `tests/issues.test.mjs:44` | asserted |
| `AGENT-003` | 1 | A premature recurrence response is refused | `tests/issues.test.mjs:45` | asserted |
| `AGENT-003` | 1 | After delayed recurrence the case is closed | `tests/issues.test.mjs:51` | asserted |
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
| `OPS-005` | old CABIN-04 evidence pointer | Current-evidence pointer moved to Status; source outcome rows are above | Status | moved |
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
| `OPS-005` | 1 | Every named lock family provisions and revokes its stay code through its provider or device harness | none | none |
| `OPS-005` | 2 | Low battery and offline access create an assigned pre-arrival action | none | none |
| `OPS-005` | 3 | Channel confirmation provisions a code once without staff action | none | none |
| `OPS-005` | 3 | Unresolved payment or identity keeps the code unsent | none | none |
| `OPS-005` | 4 | Each supported lock job reconciles interruption before and after provider acceptance | none | none |
| `OPS-005` | 5 | Guest stay window is retained | `tests/turnovers.test.mjs:38` | asserted |
| `OPS-005` | 5 | Assigned cleaner uses exactly the turnover window | `tests/turnovers.test.mjs:41` | asserted |
| `OPS-005` | 5 | Cleaner notice includes the assigned home address | `tests/turnovers.test.mjs:60` | asserted |
| `OPS-005` | 5 | Cleaner notice includes the assigned cleaner code | `tests/turnovers.test.mjs:60` | asserted |
| `OPS-005` | 5 | Moved stay sends exactly one changed notice | none | none |
| `OPS-005` | 5 | Canceled stay leaves the cancellation notice | `tests/turnovers.test.mjs:129` | asserted |
| `DATA-001` | 2 | Hosted backup creates an owner-only file without a download link | none | none |
| `DATA-001` | 2 | Fresh hosted restore retains the rental records | none | none |
| `WEB-004` | 1 | The configured identity retention period is exercised independently of explicit erasure | none | none |
| `GUEST-002` | 1 | Verified guest portal is used in the phone-width browser journey | `tests/website-browser.test.mjs:127` | asserted |
