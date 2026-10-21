Every guest has one thread in **Inbox**. Their stays from Airbnb, Vrbo, Booking.com or booked direct, the messages Cabin schedules for each stay, the email they send and the replies you send all join it, grouped by stay. Each stay's check-in details, checkout reminder and review request go out on time from the stay's dates. Every message a guest sends gets a drafted reply that waits in the thread: nothing is sent until you send it.

## Give each stay its guest's email

A guest is known by the email on their stay. Direct bookings carry the email the guest booked with. For a stay you take by phone or a channel stay, add it under **Calendar → Arrivals in the next two weeks → Guest, contact and arrival time**, in **Take a request**, or in the thread itself (**Add email to this stay**). Adding it later moves the stay's thread under that email, so a guest who books twice has one thread.

Airbnb, Vrbo and Booking.com calendar links carry no guest contact details. Until the owner's channel partner accounts are connected, a channel stay without an email still gets its thread and its scheduled messages, and each message says plainly that it was not sent and why.

## Receive guest email

Guest email uses a domain you own, with DNS managed by Cloudflare in the same account as your deployed Cabin. A **Worker** is the deployed app. The hosted **Inbox → Guest email** card names your Cabin Worker and its address. A custom-domain install that cannot identify its Worker shows how to find the name in the `rer deploy` output; an operator can also set `CABIN_WORKER_NAME` to the actual name.

1. Open [Cloudflare Email Routing](https://dash.cloudflare.com/?to=/:account/email-service/routing), choose your domain and enable routing. Follow Cloudflare's DNS setup; review existing mail records before changing a domain already used for email. See [Cloudflare's routing guide](https://developers.cloudflare.com/email-service/get-started/route-emails/).
2. Create a routing rule for your chosen guest address. Choose **Send to a Worker** and select the exact Worker named on Cabin's Guest email card. Save the rule.
3. Save the same address in **Inbox → Guest email**. Cabin uses it as the reply address on outgoing guest messages.
4. **Check it works:** email that address from a personal mailbox, then reload Inbox. The incoming email and an unsent draft should appear. Send from a stay's guest email to match that stay. Send a reply from Cabin and check that mailbox for delivery.

Mail to another address is refused unread. A forwarding service's **Reply-To** determines the guest's thread when present. Quoted reply history is omitted.

Locally, first save an address on the Guest email card. **Try a guest email here** then appears. In your mail app choose Show original, View source or Download original, copy the full .eml source including headers and paste it there. This imports a real incoming message, matched by sender; it tests parsing and drafting, not internet delivery. The local app receives no internet mail and sends no email. RER Managed hosting cannot receive guest mail yet; scheduled emails still go out.

## Scheduled messages

Open **Inbox → Scheduled messages** to turn each one on or off, set its timing and write its subject and text:

- **Check-in instructions**, a number of hours before the home's check-in time (24 unless you change it). It carries the guest's own door code, the address and their stay page.
- **Checkout reminder**, hours before the home's check-out time (14: the evening before a 10 am check-out).
- **Review request**, hours after check-out (4).

Times come from the stay's dates and the home's check-in and check-out times in the home's own time zone (**Turnovers → Turnover settings by home**). Use `{guest}`, `{home}`, `{checkin}`, `{checkout}`, `{address}`, `{code}` and `{stay_link}` in a message; they are filled in when it is sent, so a moved stay or a new door code is always current.

- **A moved stay** moves its messages. One that already went out (check-in details for the old dates, say) goes out again with the new details at the new time, its subject starting **Updated:**.
- **A changed door code or code hours** (a new check-out time for the home, say) sends the check-in details again with the corrected code and hours, marked **Updated:**, until the stay checks out.
- **A cancelled stay** cancels its messages that have not gone out.
- **A stay booked late** (inside a message's window) gets that message at once. A message whose moment has passed (check-in instructions after check-in, a review request more than a week after check-out) is skipped and says so.

Cabin checks for due messages every five minutes and after every change, so each message goes out within five minutes of its due time. Each one in the thread shows when it was sent and whether it was on time or how many minutes late. Development mode sends no email, and each message says so.

## Drafted replies wait for your nod

With no AI key, templates provide saved arrival details or checkout time. Early check-in, changes and questions outside those facts carry a **Needs you** note and a reply saying you will check. Confirm the answer before sending.

To connect AI in **Inbox → Drafted replies**:

1. Cabin supports the direct Anthropic API. An **Anthropic API key** authorizes paid Claude requests on your account; other provider keys do not work. Create a key for one workspace on [Anthropic's API keys page](https://platform.claude.com/settings/keys) and copy it when shown.
2. Set up [API billing](https://platform.claude.com/settings/billing), paste the key in Cabin and save. The key is encrypted with this installation's secret; only its final four characters are shown later.
3. Keep the default model. A **model** is the Claude version writing the reply. **Advanced AI settings** lets you enter another structured-output-capable model's API ID from [Anthropic's model list](https://platform.claude.com/docs/en/about-claude/models/overview). **Workspace ID** is blank for an ordinary single-workspace key; a key covering multiple workspaces needs the chosen ID from [Anthropic Workspaces](https://platform.claude.com/settings/workspaces).
4. Add a confirmed stay in Calendar, then choose **Test a reply**. Cabin sends that saved stay's real details to Anthropic and asks about early check-in. Success shows the actual reply and a host-approval flag; a failure explains what needs fixing. Nothing is sent to the guest or added to their thread.

Anthropic bills separately for text read and written in tokens, small pieces of text. Both drafts and tests cost money. At the default Opus 5.5 rates of $4 per million input tokens and $20 per million output tokens, a 2,000-input / 300-output-token request costs about $0.014 USD. Longer threads cost more; see [current API prices](https://platform.claude.com/docs/en/about-claude/pricing) and your billing limits.

AI drafts use the saved stay details and conversation, show their supporting facts and flag questions requiring you. If Anthropic fails, Cabin shows the failure and leaves an empty reply for you to write. On RER Managed hosting AI drafts are unavailable.

Edit and **Send to guest**, or **Discard draft**. Cabin records who approved the exact text and sends it once on the guest's channel; email replies remain threaded. A newer guest message replaces an unsent draft. **Write a message yourself** composes a reply with a subject you choose (email only; it defaults to the guest's last subject or “About your stay”); failed sends explain why and offer **Send again**.

## Texts and channel messages

**Texts are not connected until you bring your own Twilio account.** Twilio is a paid phone and text provider. For US ten-digit numbers, carriers require business and message-use registration, called **A2P 10DLC**. Cabin does not register you or purchase a number.

1. Get a paid [Twilio account](https://console.twilio.com/) and texting number. Complete [Twilio's registration guide](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart) and wait for approval; number, registration and message fees apply.
2. Copy the **Account SID** and **Auth Token** from the Twilio Console and your approved number including +1, as `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Locally, open `.dev.vars` in your Cabin folder (the folder you run `rer dev` in, for example `run-cabin/.dev.vars`; `open -e .dev.vars` opens it on a Mac), add one line for each, such as `TWILIO_FROM=+12075550123`, save, and restart with `rer dev --stop` then `rer dev`. On your own Cloudflare deployment, add the same three lines to `.env.cabin` and run `rer deploy --set-secret NAME --env-file .env.cabin` once for each name from the Cabin folder you deployed from, adding the `--environment` you deployed with (the page names your Worker and prints the exact command). This changes only that secret, without rebuilding, and later deploys from `.env.cabin` keep it. Use rer rather than the Cloudflare dashboard.
3. In the number's Twilio Messaging settings, set **A message comes in** to **Webhook**, **POST**, using the full `/inbound/sms` URL shown on Cabin's page. It must be a public HTTPS deployment; localhost cannot receive replies.
4. Add your phone to a test stay, text the Twilio number and reload Inbox. The text should join that guest's thread. Send a reply and check your phone. Saved credentials alone do not prove carrier approval or delivery. Cabin checks Twilio's request signature.

On RER Managed hosting texts are unavailable because it cannot connect to Twilio. Use email for now.

- **Airbnb, Vrbo and Booking.com messages** connect later, with the owner's channel partner accounts. Airbnb and Vrbo publish no messaging API outside their partner programs. For Booking.com, a connectivity partner's machine account (`BOOKING_MESSAGING_USER`, `BOOKING_MESSAGING_PASSWORD`) turns it on: enter each home's Booking.com property ID on the Inbox page and each Booking.com stay's reservation number on the stay; guests' Booking.com messages then arrive every five minutes and replies go back through Booking.com.

Both are tested against responses in Twilio's and Booking.com's documented shapes, not live accounts. Until they are connected the Inbox page says so.

## Who sees what

Owners and managers see every thread. Cleaners see no guest messages, and agents see none. Messages are kept in the installation and included in its exports; erasing a home erases the messages tied to its stays.

## Approved replies and early arrivals

Under Reply authority and approved instructions, save a responsible manager, reply deadline, approved property instruction and optional automatic rule per home. Automatic replies require the saved AI key, an allowed topic, model confidence, local hours and unchanged sources. They render saved facts or the exact approved instruction; money, safety and changes need a person. Uncertain drafts and missed deadlines notify the manager without sending the guest reply. The thread keeps sources, confidence, authority and delivery outcome. A source change fences an old draft; discard it and write a current reply.

Approve an early check-in from its guest thread only after the preceding turnover is complete with photos and no blocking work remains. Confirm the manual keypad is ready. The exact reservation revision changes with one approval, moves guest and cleaner access windows and sends one guest update. Connected lock acceptance still depends on the owner’s lock account; manual keypads must be set by hand.

## Team routing and response accountability

Under **Inbox → Team routing, shifts and response deadlines**, an owner or manager sets how a guest-service team shares the inbox. Until the first team setting is saved no thread is routed or escalated; after that, every guest message that arrives opens a **case** on its thread.

- **Routes.** A route names a manager for one home (or all homes) and for any thread or urgent threads only. The most specific match wins: a home beats all homes, urgent beats any.
- **Shifts.** A shift gives a manager days and a start and end time at the home's own clock. An end before the start runs past midnight. A routed manager who has shifts but is off shift is replaced by whoever is on shift at that moment; with nobody on shift the escalation manager takes the thread. A manager with no shifts is always available to their routes. Until per-property staff scopes exist (AUTH-002) every active manager can see every thread.
- **Urgency and labels.** A guest who says they are locked out or that a door code does not work, or who reports a safety problem, makes the thread urgent and labelled. Anyone can change urgency and labels from the thread.
- **Deadlines.** A normal thread must be answered within the normal minutes and an urgent one within the urgent minutes, counted from the guest's unanswered message (default 240 and 30). Only a person's reply that Cabin can send answers it: scheduled messages, drafts and failed sends do not.
- **Escalation.** When the deadline passes, the escalation manager is emailed the guest's message, the reservation, labels, assignee, every private note and open promise, the handovers and the home's open tasks. This repeats every escalation interval (default 30 minutes) until a person presses **Accept this thread** and becomes accountable. With no escalation manager the thread says nobody will be notified.
- **Private notes and promises.** A note is saved on the case, shown only to owners and managers and never turned into a message to the guest. Mark a note as a promise to carry it into handovers until it is marked kept.
- **Collisions.** **I'm replying** tells everyone you are answering for five minutes; a reply you send does the same for two minutes. Another person's reply in that time is refused, naming you.
- **Templates.** Saved reply templates become an editable draft in the thread; nothing is sent until a person sends it.
- **Handover.** Hand a thread to the next person with a summary. Cabin keeps the reservation, the home's open tasks and the open promises with the handover, starts a fresh response window and the next person must accept the thread.

A guest's erasure removes their name, notes and handover text from their case. An archive restore keeps cases; their deadlines are not paused. Cases do not cover channel replies Cabin cannot send (MESSAGE-001) or channel request deadlines (SYNC-008): when those arrive as threads they route through the same cases.
