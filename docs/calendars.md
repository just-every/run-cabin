Cabin keeps each home's Airbnb and Booking.com calendars side by side. You bring in each channel's calendar file, Cabin shows what changed since the last approved copy and any dates where two bookings overlap, and nothing changes until you approve that exact snapshot.

## Bring in a calendar

1. In your Airbnb or Booking.com account, export the home's calendar as an `.ics` file and open it in a text editor.
2. In Cabin, open **Calendar**. Under **Import a channel calendar**, choose the **Property** and the **Channel**.
3. Paste the file's whole contents into **Calendar file (.ics) contents** and choose **Prepare calendar review**.

No channel password or account connection is needed. A file can be up to 200 KB and 300 events. Cabin accepts all-day dates and UTC times; it refuses recurring events and local times without a zone, so export those as single UTC events first.

## Review and approve

Each prepared review appears under **Calendar reviews** with the badge **Needs approval**. It lists every change against the approved copy:

| Change | Meaning |
| --- | --- |
| add | A booking new to this channel's calendar. |
| change | A booking whose dates or title changed, or that is back after a cancellation. |
| cancel | A booking the channel marked cancelled. |
| remove | A booking missing from the new file. |

Overlaps are listed in red with their dates, or "No overlaps found in this snapshot." Checkout days do not count: a stay ending on the 5th does not clash with one starting on the 5th.

When the review looks right, choose **Approve this calendar snapshot**. Cabin records who approved it and when. A cancellation or removal takes effect only then. If the approved bookings change before you approve, the older review can no longer be approved: prepare a fresh one.

## Keep calendars fresh

**Feed freshness** shows when each home's channel calendar was last approved. Calendar files are copies from the moment you export them, so bring in a new file whenever a channel's calendar changes. Approved bookings that overlap across channels are listed at the top of the page: check those dates on both channels and resolve them there.

**Bookings** lists every approved booking with its home, channel and dates.

## Try it with the sample files

The repository includes two sample calendars for one home that deliberately overlap, so you can see a clash: [airbnb.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb.ics) and [booking-com.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/booking-com.ics). [airbnb-cancelled.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb-cancelled.ics) shows a cancellation and [airbnb-removed.ics](https://github.com/just-every/run-cabin/blob/main/fixtures/airbnb-removed.ics) a removal.
