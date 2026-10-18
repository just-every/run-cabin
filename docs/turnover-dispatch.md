# Reservation-triggered turnover dispatch

OPS-001 extends the existing reservation-to-turnover workflow. Each confirmed
stay retains one live turnover. A booking amendment revises that job; cancellation
cancels it, withdraws offers and revokes access. Cleaner acceptance, declines,
expired offers, replacement and booking changes remain in the job's history.

## Configure through Cabin

1. In **Properties & people**, save each cleaner's daily jobs, work-and-drive
   minutes, home-base address, time zone and daily starting time. A shared team
   account can carry the team's combined capacity.
2. In **Turnovers → Turnover settings by home**, enter the property address,
   time zone, checkout/checkin times, checklist and photo requirements. Enable
   acceptance and routing, then save a named template, instructions, work
   duration, USD rate, timing offsets, approved cleaners and response deadlines.
   The default cleaner must belong to this approved list.
3. In that home's **Saved drives**, enter one-way drive minutes from the relevant
   cleaner home bases and other properties. Each link opens Google Maps with
   the actual entered origin and destination. The manager supplies the minutes;
   Cabin does not call a routing API or invent travel times or distances. Save
   the reverse direction separately when needed.

Saved drives retain both address strings. Moving a property or home base makes
its old travel figures unusable until the manager saves the drive again. Missing
capacity, missing travel, excess jobs/hours and an unreachable work window are
shown as specific reasons and route to an eligible backup or a blocking manager
task. There is no silent capacity override.

Existing homes without an acceptance template keep their established direct
assignment behavior. Their cards explicitly say that acceptance and capacity
routing are unconfigured. Enabling the template revises unfinished jobs into
offers; completed work retains its evidence and original rate snapshot.

## Offers and first acceptance

The manager can offer to the default cleaner followed by backups, or to up to
three eligible approved cleaners at once. For three offers, “nearby” means the
manager-entered one-way minutes from the cleaner's saved home base. It is not a
geographic-distance claim. Fewer than three receive an offer if fewer are
eligible; remaining problems stay visible.

An offer includes the address, real directions link, window, checklist,
instructions, work minutes, USD rate and response deadline. An offer reserves
neither capacity nor a payable expense and provides no door code. Acceptance
rechecks current authority, booking revision, offer generation, response
deadline, route and daily capacity. Only the winner receives the assignment and
cleaner access; the other offers are withdrawn and their recipients notified.
The existing transactional workspace version guard rejects concurrent winners.

The assigned cleaner can cancel their acceptance with a reason. Cabin revokes
their access, alerts the manager and opens a new round for eligible approved
backups, excluding that cleaner. The next acceptance wins the same turnover;
replacement does not manufacture another payable job. A manager can explicitly
reopen exhausted offers after addressing their causes.

Work/checklist, rate, address, time zone or booking changes invalidate prior
acceptance. The replacement offer must be accepted before completion. Finished
jobs keep their saved template, rate and evidence; a booking change that already
invalidates completion continues to reopen the existing job under the established
completion rules.

## Timing and escalation

Work starts no earlier than checkout plus the saved offset and must finish
before the next arrival minus the saved arrival buffer. The route planner fits
each cleaner's same-day jobs from their home base, in window order, counting
travel and work against their saved hours. Capacity days use the cleaner's
home-base time zone. Missing durations on another assigned legacy job require
manager review rather than assuming a duration.

Offers expire at the earlier of their configured response deadline and the
latest time that still leaves work duration plus the escalation buffer before
arrival. Each pending offer receives one reminder before that deadline. An
expired or declined offer opens the next eligible backup; a decline, exhausted
list or infeasible deadline raises a blocking **Turnover needs a manager** task.
An accepted but unfinished job receives one completion reminder and escalates
before arrival. Accepting a viable replacement resolves the dispatch task;
completion and cancellation also close it.

Reservation commands reconcile dispatch in their commit. The scheduled worker
also advances deadlines and delivers queued notices without waiting for a
booking edit. Message records use the existing delivery system and show its
actual sent, suppressed, unavailable or failed state. Queuing is not proof of
delivery. No independent mail provider, routing service or automatically posted
expense is introduced by dispatch.

## Command doors

- `cleaner.capacity`: `memberId`, existing profile `revision` when editing,
  `homeBase`, `timeZone`, `availableFrom`, `dailyJobs`, `dailyMinutes`.
- `home.settings`: existing settings fields plus `dispatch` containing
  `templateName`, `instructions`, `durationMinutes`, `rateCents`,
  `startOffsetMinutes`, `finishBeforeMinutes`, `approvedCleanerIds`, `offerCount`
  (`1` or `3`), `responseMinutes`, `reminderMinutes`, `escalationMinutes`.
  Omitting dispatch preserves an existing template.
- `home.drive`: `propertyId` for the destination, settings `revision`, `from`
  (another property ID or `base:MEMBER_ID`), and one-way `minutes`.
- `turnover.accept`: job `id`, current `revision`, and the cleaner's `offerId`.
- `turnover.decline`: the same identifiers plus `reason`; also cancels the
  cleaner's accepted job while it remains open.
- `turnover.offers`: job `id` and current `revision`; manager-only explicit
  reopening of the approved offer pool.
- `turnover.assign`: existing job identifiers and `cleanerId`; configured jobs
  request that eligible cleaner's acceptance instead of silently assigning.

Cleaner snapshots include only their current offers/assignments, their own
profile and offers, and permitted operational property details. They omit
other cleaners' offers, guest contact details and guest access codes. Managers
and owners configure templates, routes and capacity. Bearer preparers retain
their existing draft-only scope.

## Verification

`tests/dispatch.test.mjs` exercises the normal command and scheduled worker
doors with the existing mail transport boundary: three-backup cancellation,
concurrent first acceptance, stale offer refusal, amendment and cancellation,
rate/instruction revision, route and capacity refusal, stale addresses, and a
single near-arrival reminder followed by manager escalation. It introduces no
application mocks or permanent pinned-copy tests. Runtime and browser evidence
are recorded by the parent task after integration; writing these tests alone
does not establish that they passed or that hosted email was delivered.
