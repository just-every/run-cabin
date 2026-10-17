Every guest has one thread in **Inbox**. Their stays from Airbnb, Vrbo, Booking.com or booked direct, the messages Cabin schedules for each stay, the email they send and the replies you send all join it, grouped by stay. Each stay's check-in details, checkout reminder and review request go out on time from the stay's dates. Every message a guest sends gets a drafted reply that waits in the thread: nothing is sent until you send it.

## Give each stay its guest's email

A guest is known by the email on their stay. Direct bookings carry the email the guest booked with. For a stay you take by phone or a channel stay, add it under **Calendar → Arrivals in the next two weeks → Guest, contact and arrival time**, in **Take a request**, or in the thread itself (**Add email to this stay**). Adding it later moves the stay's thread under that email, so a guest who books twice has one thread.

Airbnb, Vrbo and Booking.com calendar links carry no guest contact details. Until the owner's channel partner accounts are connected, a channel stay without an email still gets its thread and its scheduled messages, and each message says plainly that it was not sent and why.

## Receive guest email

Guest email reaches Cabin through an address on your own domain:

1. In Cloudflare, open your domain's **Email → Email Routing**, add a custom address (for example `guests@example.com`) and choose **Send to a Worker**, picking this Cabin's Worker.
2. In Cabin, open **Inbox → Guest email**, enter that address and choose **Save address**.

Mail to that address lands in the sender's thread, tied to their current or next stay. A message sent through a forwarding service that names the guest in **Reply-To** joins the guest's thread too, because that is where a reply goes. Mail to any other address is refused unread. The quoted history a mail app adds under a reply is left out of the thread.

Every message Cabin sends asks guests to reply to this address, so their answers come back to the same thread. On this computer no mail server can reach Cabin; a hosted install receives guest email. Locally, **Try a guest email here** takes a saved email's source (.eml) and puts it through the same receiving code. RER Managed hosting has no domain of yours yet, so guest email cannot reach Cabin there.

## Scheduled messages

Open **Inbox → Scheduled messages** to turn each one on or off, set its timing and write its subject and text:

- **Check-in instructions**, a number of hours before the home's check-in time (24 unless you change it). It carries the guest's own door code, the address and their stay page.
- **Checkout reminder**, hours before the home's check-out time (14: the evening before a 10 am check-out).
- **Review request**, hours after check-out (4).

Times come from the stay's dates and the home's check-in and check-out times in the home's own time zone (**Turnovers → Turnover settings by home**). Use `{guest}`, `{home}`, `{checkin}`, `{checkout}`, `{address}`, `{code}` and `{stay_link}` in a message; they are filled in when it is sent, so a moved stay or a new door code is always current.

- **A moved stay** moves its messages. One that already went out (check-in details for the old dates, say) goes out again with the new details at the new time.
- **A cancelled stay** cancels its messages that have not gone out.
- **A stay booked late** (inside a message's window) gets that message at once. A message whose moment has passed (check-in instructions after check-in, a review request more than a week after check-out) is skipped and says so.

Cabin checks for due messages every five minutes and after every change, so each message goes out within five minutes of its due time. Each one in the thread shows when it was sent and whether it was on time or how many minutes late. Development mode sends no email, and each message says so.

## Drafted replies wait for your nod

When a guest writes, Cabin drafts a reply beside their message:

- **With an AI key**: in **Inbox → Drafted replies**, paste your own Anthropic API key (it is sealed with this install's secret and never shown again; only its last four characters are). The draft is written from the stay's dates, the home's times and address, the guest's door code, their stay page and the thread. It lists the facts it used, and says when something needs you: anything the facts do not settle, and every refund, discount, early check-in, late checkout or safety question. **Test the key** checks it with a made-up stay. On RER Managed hosting AI drafts are not available yet.
- **Without one**, or if the AI provider fails (the draft says so), the draft comes from a template picked by what the guest asked: how to get in, check-out, or anything else.

Edit the draft and choose **Send to guest**, or **Discard draft**. Cabin records who approved exactly which text, and sends it once on the channel the guest wrote on: email replies are threaded under the guest's message. A newer guest message replaces a draft nobody sent. You can also **Write a message yourself** from any thread. A failed send says why and offers **Send again**.

## Texts and channel messages

- **Texts** go through Twilio. US texting from an app needs the owner's A2P 10DLC registration first, so Cabin sends no texts until the owner registers and sets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` as secrets, then points the Twilio number's incoming-message webhook at `https://YOUR-CABIN/inbound/sms`. Then a guest with only a phone number on their stay gets their scheduled messages as texts, and texts from a guest's phone join their thread. Cabin reads only requests Twilio signed with the auth token.
- **Airbnb, Vrbo and Booking.com messages** connect later, with the owner's channel partner accounts. Airbnb and Vrbo publish no messaging API outside their partner programs. For Booking.com, a connectivity partner's machine account (`BOOKING_MESSAGING_USER`, `BOOKING_MESSAGING_PASSWORD`) turns it on: enter each home's Booking.com property ID on the Inbox page and each Booking.com stay's reservation number on the stay; guests' Booking.com messages then arrive every five minutes and replies go back through Booking.com.

Both are tested against responses in Twilio's and Booking.com's documented shapes, not live accounts. Until they are connected the Inbox page says so.

## Who sees what

Owners and managers see every thread. Cleaners see no guest messages, and agents see none. Messages are kept in the installation and included in its exports; erasing a home erases the messages tied to its stays.
