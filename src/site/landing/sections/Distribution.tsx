import { Channel, Feature, Icon, Initials, Status } from '../parts'

const DAYS = [['Fri', 16], ['Sat', 17], ['Sun', 18], ['Mon', 19], ['Tue', 20], ['Wed', 21], ['Thu', 22], ['Fri', 23]] as const

/** Lake Loft's week across the three channels: the Airbnb stay closes Vrbo, and a Vrbo request that overlaps it is declined. */
export function Channels() {
  return <Feature id="channels" eyebrow="Channels" title={<>One calendar.<br />No double bookings.</>}
    label="Lake Loft's calendar from Friday Oct 16 to Friday Oct 23: M. Ortiz on Airbnb for 3 nights from Oct 17, J. Chen on Booking.com for 2 nights from Oct 21, Vrbo blocked for those dates, and a Vrbo request for Oct 19 to 21 declined because it overlaps Airbnb"
    art={<div className="channels-art">
      <div className="card calendar">
        <p className="card-title">Lake Loft</p>
        <div className="cal-grid">
          <span className="cal-corner" />
          {DAYS.map(([day, date]) => <span key={date} className="cal-day">{day}<b>{date}</b></span>)}
          <span className="cal-channel" style={{ gridRow: 2 }}><Channel name="Airbnb" /></span>
          <span className="cal-row" style={{ gridColumn: '2 / span 8', gridRow: 2 }} />
          <span className="cal-bar bar-airbnb" style={{ gridColumn: '3 / span 4', gridRow: 2 }}>M. Ortiz<i>·</i>3 nights</span>
          <span className="cal-channel" style={{ gridRow: 3 }}><Channel name="Vrbo" /></span>
          <span className="cal-row" style={{ gridColumn: '2 / span 8', gridRow: 3 }} />
          <span className="cal-bar bar-blocked" style={{ gridColumn: '3 / span 7', gridRow: 3 }}>Blocked</span>
          <span className="cal-channel" style={{ gridRow: 4 }}><Channel name="Booking.com" /></span>
          <span className="cal-row" style={{ gridColumn: '2 / span 8', gridRow: 4 }} />
          <span className="cal-bar bar-booking" style={{ gridColumn: '7 / span 3', gridRow: 4 }}>J. Chen<i>·</i>2 nights</span>
        </div>
      </div>
      <p className="chip chip-red"><Status tone="bad" size="sm" /><span>Vrbo request Oct 19–21 declined<i>·</i>overlaps Airbnb</span></p>
    </div>}>
    Cabin connects to Airbnb, Vrbo and Booking.com both ways. Book a night anywhere and it closes everywhere.
  </Feature>
}

/** Megan Ortiz's thread for the same Lake Loft stay: her question, Cabin's drafted reply waiting for a nod, and the scheduled check-in message. */
export function GuestInbox() {
  return <Feature id="inbox" flip eyebrow="Guest inbox" title={<>Every guest,<br />one inbox.</>}
    label="A message thread with Megan Ortiz, Airbnb guest at Lake Loft for Oct 17 to 20. She asks to check in early; a drafted reply says cleaning wraps at 1 pm so she is welcome from 2 pm, with Send and Edit; check-in details are scheduled for Saturday at 10:00 am"
    art={<div className="card thread">
      <div className="thread-head">
        <Initials size="lg">MO</Initials>
        <div><p className="thread-name">Megan Ortiz</p><p className="thread-stay"><Channel name="Airbnb" /><i>·</i>Lake Loft<i>·</i>Oct 17–20</p></div>
        <Icon name="dots" className="thread-more" />
      </div>
      <div className="thread-body">
        <p className="bubble">Any chance we can check in early?</p>
        <p className="bubble-time">Fri 6:12 pm</p>
        <div className="draft">
          <p className="draft-label"><Icon name="sparkle" />Draft</p>
          <p className="draft-text">Hi Megan! Cleaning wraps at 1 pm, so you are welcome from 2 pm.</p>
          <p className="draft-actions"><span className="button-send">Send</span><span className="button-edit">Edit</span></p>
        </div>
      </div>
      <p className="thread-foot"><Icon name="clock" /><span>Check-in details<i>·</i>Sat 10:00 am<i>·</i>scheduled</span></p>
    </div>}>
    Airbnb, Vrbo, Booking.com, text and email in one thread per guest. Scheduled messages go out on time, and drafted replies wait for your nod.
  </Feature>
}
