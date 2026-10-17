# Changelog

## Unreleased

- **Homepage.** The run site's homepage follows one stay end to end, on the page structure the owner approved on 17 October 2026: Megan Ortiz's Lake Loft stay from the booking that closes every channel, through her messages, the turnover, a cleaner who cancels the morning she arrives, the payout on the owner's statement and her next stay booked direct, then moving in from another system. Every drawing is HTML; the claims it makes are in `docs/CLAIMS.md`.

## 0.1.0 (18 Oct 2026)

Cabin's first release: vacation-rental operations for US hosts and property managers, a free, open source replacement for the day-to-day work of Guesty, Hostaway or OwnerRez. It runs on your own computer or in your own Cloudflare account, keeps every booking, guest and payout in your own database, is MIT licensed and charges nothing.

### What an owner gets

- **Homes and people.** Add homes with their owner and management commission, and managers and cleaners with separate access. Invite them to sign in (a hosted Cabin emails the invitation). Cleaners see only their own jobs and the Maintenance page.
- **Calendars both ways.** Paste each home's Airbnb, Vrbo and Booking.com calendar links. Cabin reads them every 15 to 60 minutes and shows when each last synced and any error. It publishes its own calendar link per channel, listing every night held anywhere else, direct bookings included. A request for nights already held is declined with the stay it overlaps, and a collision that arrives from two channels is shown in red as a double booking to resolve.
- **Direct bookings.** Each home can have a public booking page with your nightly rate, cleaning and extra-guest fees, minimum and maximum nights, gap rule and state or county lodging tax. Guests sign your rental agreement, pay by card through your own Stripe account, pass a Stripe Identity check if you require one, and have a separate damage deposit held on their card. The hold is released a set time after check-out, or you capture part of it with a reason. A guest can be marked checked out only once their check-in time has passed. The payment receipt itemizes nights, cleaning and taxes and states the hold as it is.
- **Turnovers and door codes.** Every reservation, from any channel or direct, creates its turnover between check-out and the next check-in. The home's cleaner is emailed the window, the address and their own door code, and a moved or cancelled stay re-emails or cancels it. Each stay gets a guest code for its dates. Cleaners tick the checklist and mark the home ready with its required photos from their phone. A job finished after the next guests' check-in stays done and is labelled late. A job reopened because its stay or check-out time changed says why and can be marked ready again.
- **Readiness and maintenance.** Readiness shows, for any day, which homes are ready for their next arrival, with the turnover, photos and door code. A cleaner can report a broken thing with photos: it becomes a task for the home's maintenance person, and a blocking task keeps the home not ready.
- **Guest inbox.** One thread per guest joins their stays and emails. Check-in details with the door code, a checkout reminder and a review request go out on time in the home's time zone. They move with the stay and are sent again only when their words change. Guest email routed to your own address arrives in the thread, and every guest message gets a drafted reply (from your own Anthropic key, or a template) that waits for you to send it.
- **Stay recovery.** When a cleaner cancels or a guest reports a problem, Cabin proposes a backup cleaner, a new door code and a credit within the limits you set. You approve it, or the owner's automatic limit applies, and the case stays open until the home is confirmed ready.
- **Owner statements and portal.** Import Airbnb and Vrbo payout CSVs (and Stripe test payouts); each line is matched to its stay. Prepare a monthly statement with expenses paid from owner funds, approve it, and Cabin freezes it and emails the owner a link. Owners sign in separately and see only their own homes, stays and approved statements.
- **Books.** Post each approved statement once to your own [Pantry](https://run-pantry.com) books with a scoped integration credential, with the matched booking, payout, fee and expense evidence attached. Posting again never posts twice, and revoking the credential in Pantry shows a broken connection. For QuickBooks, download a QuickBooks Online journal CSV or a QuickBooks Desktop IIF file and import it yourself.
- **Move in.** Import homes, reservations, guests, owner balances and channel links from Guesty, Hostaway or OwnerRez CSV reports, or a simple property list. You see a preview with each refused row before anything is saved, then reconcile, sign off, and undo if needed.
- **Agent access.** An owner-made key lets an assistant read and prepare work that only a signed-in person approves.
- **Your data.** Run Cabin with `npx -y @runeditrun/rer dev just-every/run-cabin`, or in your own Cloudflare account with `rer deploy` and your own mail provider. `rer export` and `rer import` back up and restore Cabin on your computer, and `rer run backup:hosted` saves and restores a hosted Cabin.
- Pinned `@runeditrun/rer` 0.2.47.

### Not in this release

The homepage describes some things Cabin does not do yet:

- **Pricing connections.** There is no PriceLabs or Wheelhouse connection, and no single price sent to every channel. Prices are set per home for direct bookings only.
- **QuickBooks sync.** QuickBooks gets export files that a person imports; nothing syncs to QuickBooks Online. Pantry is posted live.
- **Channel messages and partner APIs.** Airbnb, Vrbo and Booking.com messages do not arrive in the inbox, and requests cannot be answered inside the channels. Those need partner accounts. Calendars sync by iCal, so a channel can sell a night before it next reads Cabin's link. Cabin flags the double booking but cannot prevent it.
- **Texts in the inbox.** Twilio texting is built but stays off until you complete Twilio's US A2P registration and add your keys. Guest replies by text need a hosted Cabin.
- **Smart locks.** Door codes are set on the keypad by hand. Pushing them to a lock needs your Seam account.
- **Review replies, lodging-tax filing and trust accounting.** Cabin does not reply to reviews. It records tax-filing references but does not file or remit tax. Statements record what the owner is owed but do not move money. Live Stripe payout matching needs a paid automatic USD payout. Live Guesty, Hostaway or OwnerRez API move-in is not included.
- On RER Managed hosting, provider connections (Stripe, Pantry, channel links) say "not available yet". They work on your own computer and your own Cloudflare account.

### Back up first

Cabin holds guests, owners, bookings and photos. Make a backup before you change anything, and keep it private.

**On your computer**, in your `run-cabin` folder:

```sh
rer dev --stop
rer export --output exports/cabin-before-0.1.0.rer
```

**Hosted**, from the folder you deploy from, with its `.rer` folder and `.env.cabin`:

```sh
rer run backup:hosted -- --env-file .env.cabin --environment NAME
```

Leave out `--environment NAME` if you deployed without one. `rer export` saves only the copy on your computer and refuses a hosted address. The hosted backup is one SQL file in `exports/`, readable only by you, and it never prints a download link. [Back up and restore](docs/backup.md) shows how to restore either into a fresh copy.

**If you ran Cabin from `main` before this release**, back up as above, then `git pull` and `rer dev` on your computer, or `git pull` and `rer deploy --env-file .env.cabin` for a hosted copy. Migrations `0001` to `0021` apply in order, forward only, and keep your data.

### Known issues

- Changing a home's check-out or check-in time reopens any turnover already marked ready whose window it moves, including one for guests who have already left that day. The job says why and can be marked ready again.
- On your computer, `rer dev --as` cannot sign in a cleaner or manager saved with the address of one of rer's built-in personas (`cleaner@dev.localhost`, `manager@dev.localhost`); add them with another address. This is rer's, not Cabin's.

### Fixed before release

- **The calendar names every stay and turnover.** Month (four weeks from today) is the default view. Each bar shows the longest whole-word form of its guest and nights that fits, down to initials, and never a word cut mid-way or a blank bar; selecting a bar opens its details. Turnover chips sit in a lane under the stays with the cleaner and window ("Luis 11 am–Sat 4 pm"), a status dot, and an amber outline when the next guests arrive the same day. A declined request is a dashed red bar in its own lane. Bars for Airbnb and Booking.com calendar stays say **Reserved** or **Blocked** with the channel, since those calendars name no guest.
- **The demo looks like a real business.** Its calendar files are written as Airbnb and Booking.com write them; guest names come from Vrbo and direct requests and from guest details the manager entered. Homes have addresses, times, default cleaners and direct rates; a Vrbo request is declined by Cabin's own overlap check; turnovers, door codes and scheduled messages are made as on any commit; three guests' questions wait with drafted replies.
- **One solid button per decision.** Destructive actions (Deactivate access, Revoke agent access, Disconnect, Cancel hold, Undo) are red outline and secondary ones outline. Sign-in settings open inside the workspace, the guest stay page has the Cabin frame, file inputs look like the other fields, and direct booking settings, approved statements, later turnovers and reassignment fold until opened. The rail fits a 900 px window.

- **A turnover marked ready late stays ready, and a reopened one can be finished.** Marking a home ready after the next guests' check-in time used to say "Marked ready" while Cabin reopened the job in the same moment, and every later **Mark ready** failed with "Records or access changed". Now the job stays done: the cleaner is told at once that it finished after the check-in, the job shows it, and Readiness shows that arrival with "Cleaning finished after this arrival". A job reopened because its stay or check-out changed says when and why, and marking it ready again works: photos it already holds are reused instead of stored twice, and new ones are added after them. Marking ready and reopening can no longer happen in one save: the cleaner would be refused with the reason instead.
- **Claims say what the code does.** The homepage claims table (docs/CLAIMS.md) and CONTRACT.md quote the page's own words for QuickBooks ("the books sync to QuickBooks") and mark it partial: Cabin writes QuickBooks CSV/IIF export files, and nothing syncs. "No double bookings" and the statement card's cleaning line are also partial, and several evidence cells were corrected. The homepage is unchanged.
- **Hosted backup never shows a download link.** `rer run backup:hosted` no longer passes Wrangler's output through, which included a one-hour presigned link to the whole database. It downloads straight to an owner-only file (mode 600 from its first byte), refuses to overwrite one, and prints only the path, row count and size; a Wrangler failure is shown with every link's query string removed.
- **Payment receipts state the damage hold as it is.** The receipt is written after the hold step runs, so a same-day booking's receipt says "Held on card" instead of "Not held yet — authorization needed"; a hold Cabin is still placing reads "Being placed on your saved card", and only a hold that needs the guest asks for their authorization. Receipts itemize nights, cleaning, extra guests and taxes, and the inbox labels them "Direct booking · sent automatically".
- **Scheduled messages are re-sent only when their words change.** A new check-out time no longer sends a second, identical review request marked "These details changed"; a checkout reminder or check-in details whose time or door code changed still go out again, marked Updated.
- **Cleaners see their report was saved.** After **Report it**, the job page says "Reported" and where the manager sees it, and the job lists what that cleaner reported. Marking a home ready and closing a task confirm the same way.
- **The local Twilio card** no longer asks for a 127.0.0.1 webhook: it says guest replies by text need the hosted Cabin (a tunnel does not work, since Cabin checks Twilio's signature against its own address) and how to check outgoing texts locally.
- **One time zone**: Agent access, approval history, statements, calendar reviews and move-in jobs show times in the home's own zone with its label (EDT), like the rest of Cabin.
- **Check-out after check-in only**: a direct-booking guest can be marked checked out only once their check-in time has passed; before that the stay says when.
- **Guest booking pages**: availability no longer lists stays whose checkout day has come, and the quote says when the damage hold is placed (right after payment when arrival is within 48 hours).
- **Docs**: the install line explains the PATH line the installer prints and that it appends to your shell's startup file; Hosting lists every optional setting, including `CABIN_WORKER_NAME`; Statements drops a note about Run Edit Run's own test account; the double period after "a hosted install sends it" is gone.
- **Direct bookings take payment on new Stripe accounts.** Stripe API `2026-09-30.endive` refuses `payment_method_types`, so on an account created on that version every Checkout Cabin started (the $1 connection test and every guest booking) failed with HTTP 400 and no guest could pay. Every Stripe request Cabin makes (Checkout for the stay and the deposit, the deposit hold, its release and capture, Stripe Identity, payouts and balance reads) now sends the `Stripe-Version` Cabin is tested against, `2026-09-30.endive`, and names card through `allowed_payment_method_types`, so accounts on older and newer default versions behave the same.
- **Guest booking page**: when Stripe refuses a checkout the guest is told that nothing was charged and how long their dates stay held, and gets **Try payment again**. Stripe's reason and the advice to look in the Stripe Dashboard stay on the host's Direct bookings page.
- **Smart-lock (Seam) and texts (Twilio) cards** say where the private settings file is (`.dev.vars` in the Cabin folder) and how to restart (`rer dev --stop`, then `rer dev`). Hosted, they name the Worker and print the exact `rer deploy --environment NAME --set-secret NAME --env-file .env.cabin` command instead of sending you to the Cloudflare dashboard.
- **Hosted backup** works for an install.sh install: `rer run backup:hosted -- --env-file .env.cabin [--environment NAME]` saves the hosted database to a file only you can read, and `--restore` loads one into a fresh hosted environment ([Backup](/docs/backup#back-up-a-hosted-installation)).
- **Guest inbox**: a returning guest's message is matched to their upcoming stay once the earlier stay's check-out time has passed, so the drafted reply quotes the right check-in. When a home's check-out time (or a guest's door code) changes after check-in details went out, Cabin re-sends them marked **Updated:** with the corrected code hours, until check-out. Write a message yourself has a subject field.
- **Smaller fixes**: local Inbox no longer says guest email "now arrives" at an address a local Cabin cannot receive; local export links say channels cannot reach them; channel link fields link to Airbnb's, Vrbo's and Booking.com's own calendar-sync steps; Books' Pantry step points at Pantry (or says to connect it first) and QuickBooks exports confirm in their own words; cleaners see door-code guidance meant for them; Readiness reads "Your home is ready" for one home; the owner portal counts only guest stays not yet checked out.
- **Hosting docs**: stop the local app before deploying, and rerun a first deploy that stops on a Cloudflare error.
