# Cabin demo

`rer demo` runs a throwaway copy of Cabin signed in as the owner of **Blue Ridge
Getaways**, a sample rental business in western North Carolina: twelve homes
with their owners and commission terms, a manager, four cleaners (and one whose
access has ended), Airbnb and Booking.com calendars imported and approved, stays
from three weeks back to four weeks ahead, turnovers finished with checklist
photos, assigned for this week and waiting for approval, owner statements
approved and in review, and three calendar reviews waiting for a person (new
stays, a Booking.com stay that clashes with an Airbnb one, and a cancellation).
The sample data is `src/demo.ts` with `src/cabin/demo/`, made by Cabin's own
commands; it runs once, after the owner exists.

The app and title read **Cabin Demo**. There is no demo bar and no mail outbox:
a sign-in invitation to a manager or cleaner reports as sent and nothing leaves.
Cabin makes no other outbound calls: calendars come in as pasted .ics files. The
demo's data lives in `.rer/demo/` and is deleted when it stops; the checkout's
`.wrangler/state` is never touched.

The hosted demo at https://demo.run-cabin.com gives each visitor their own copy
on rer's native Worker host (`deploy-demo.json`, `.github/workflows/run-demo.yml`).
A copy ends after 60 minutes, 15 idle minutes or on sign-out. Base's guide is
[DEMO.md at rer-v0.2.38](https://github.com/runeditrun/base/blob/rer-v0.2.38/default-seed/DEMO.md).
