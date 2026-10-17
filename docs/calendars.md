Cabin keeps every home's Airbnb, Vrbo, Booking.com and direct bookings on one calendar. It reads each channel's calendar link on a schedule and publishes its own link for each channel, so a night booked anywhere closes everywhere. A request for nights that are already held is declined, and Cabin says which stay or block it overlaps.

## The calendar

**Calendar** opens on two weeks of every home, one row per channel. A channel's own stays are coloured bars with the guest's name, arrival time and nights where Cabin knows them. Nights held on any other channel, or by a direct booking or block, show as **Closed** on that channel's row: that is what Cabin's link tells the channel. **Blocked** marks nights a channel or you closed without a guest. Use **Earlier**, **Today** and **Later** to move a week at a time. On a phone the calendar scrolls sideways inside its card, with the home and channel names kept in view.

**Arrivals in the next two weeks** lists each arriving stay. Channels' calendar links rarely carry guest names or times, so open **Guest and arrival time** on a stay to add them; they stay with the stay through later syncs.

## Connect each channel

Under **Channel calendars**, open a home.

1. **Calendars Cabin reads.** In Airbnb, Vrbo or Booking.com, copy the home's export (iCal) link from the calendar sync settings, paste it beside that channel and choose **Connect**. Cabin reads it at once and then every 15, 30 or 60 minutes (15 by default).
2. **Cabin's links for your channels.** Choose **Create export links**. Paste **Paste into Airbnb** into Airbnb's calendar import, and the same for Vrbo and Booking.com. **Any other calendar** lists every held night for any other site.

Each connected channel shows when it last synced, when it last changed, when it syncs next and how many events it carries. If a link fails (the channel is down, the link was replaced, or the file cannot be read), the channel shows **Sync failing** with the reason. Cabin keeps every night that link last held until a good sync, so nothing reopens by accident. **Sync now** tries again at once; **Disconnect** stops reading the link and keeps the stays it brought in.

Each channel's link lists every night held elsewhere and never that channel's own stays, so a stay cancelled on Airbnb is never held closed by its own echo. Guest names and details never leave Cabin: every night reads "Not available". **Replace links** makes new links and stops the old ones working.

Calendar links are polled, so a channel can still sell a night in the minutes before it hears; any such double booking shows in red at the top of the calendar with both stays kept, for you to cancel or move one on its channel. Airbnb, Vrbo and Booking.com partner APIs, which close nights within seconds and answer requests inside each channel, come later.

On RER Managed hosting, Cabin cannot reach the channels yet, so connecting a link says it is not available yet; Cabin's own links for your channels, requests and blocks work there, and you can paste a calendar file instead. On a self-hosted install, links work as described.

## Take a request or block nights

**Take a request** checks a stay request (direct, by phone or email, or one a channel sent you) against every night Cabin holds:

- If any night overlaps a stay or block, Cabin declines it and shows why, for example "Overlaps Airbnb stay Oct 17 → Oct 20". Nothing is held.
- If the nights are free, Cabin holds them at once and every channel's link closes them. A held request for Airbnb, Vrbo or Booking.com becomes that channel's stay when its calendar shows it.

**Block nights** closes nights for an owner stay or maintenance the same way. **Recent requests** lists each decision; **Cancel hold** or **Remove block** reopens the nights. Two people taking the same nights at the same moment cannot both succeed.

Checkout days do not count: a stay ending on the 5th does not overlap one starting on the 5th.

## Review a calendar file

For moving in or checking a feed by hand, paste a channel's `.ics` file under **Review a calendar file**. Cabin lists every change against what it holds for that channel (add, change, cancel, remove) and any overlaps, and nothing changes until you approve that exact review. A file can be up to 200 KB and 300 events; a connected link can be up to 1 MB and 2,000 events. Cabin accepts all-day dates and UTC times; it refuses recurring events and local times without a zone.

The repository includes sample calendars for one home that deliberately overlap: [airbnb.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb.ics) and [booking-com.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/booking-com.ics). [airbnb-cancelled.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb-cancelled.ics) shows a cancellation and [airbnb-removed.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb-removed.ics) a removal.
