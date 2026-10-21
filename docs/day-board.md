# Departures on the readiness board

Open **Readiness** and choose a day. **Departures** lists every confirmed stay ending on that date at its own home, including stays with no next arrival or cleaning job. Cancelled stays and inventory blocks do not become guest departures.

Each departure shows its guest, channel and scheduled checkout in the home’s timezone. A reservation’s saved departure time takes precedence over the home’s default checkout time. The board shows the actual timestamp and cleaner-observation or staff-entry source only when the turnover still belongs to that reservation revision. Missing current evidence is labeled unknown; a scheduled checkout never claims the guest has left. Links open the source reservation and any current turnover.

The existing arrival/readiness cards and summary remain below. This is an account-free OPS-008 slice: guest-portal/lock-event checkout and provider-confirmed access state still need their own implementation and provider acceptance. The full clause remains partial.

`tests/readiness.test.mjs` exercises multiple homes across Eastern and Hawaii timezones, cleaner and staff records, an unrecorded departure without a next arrival, cancellation exclusion, source navigation and role limits through the public app and command doors.

## Declined requests

The selected board also lists every declined non-direct stay request whose requested nights include the chosen property-local day (arrival inclusive, checkout exclusive). Each card retains the recorded reason and links to the exact request and the overlapping reservation when retained. Old request links open that record even after it leaves the twelve most recent requests. The recorded reason is historical: a later cancellation of the conflicting stay does not change the original decision. Direct requests, inventory blocks and accepted requests are excluded from this panel.

“Declined in Cabin” describes the local decision only. Channel-side declines, expired requests, provider-confirmed access and guest/lock-event checkout remain open OPS-008 requirements; this panel does not imply an OTA received an answer.
