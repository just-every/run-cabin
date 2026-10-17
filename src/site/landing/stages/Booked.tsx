import { Dot, StageHead } from '../parts'

// Lake Loft's week with PriceLabs' nightly rates. Megan's three nights (Sat 24, Sun 25, Mon 26) are $305 + $289 + $214 and the
// $150 cleaning fee: $958. Every bar runs from Saturday's afternoon check-in to Tuesday's morning checkout (end-exclusive), so
// Tuesday night stays open.
const DAYS = [['Thu', 22, 248], ['Fri', 23, 262], ['Sat', 24, 305], ['Sun', 25, 289], ['Mon', 26, 214], ['Tue', 27, 198], ['Wed', 28, 205]] as const
const ROWS = [['airbnb', 'Airbnb'], ['vrbo', 'Vrbo'], ['booking', 'Booking.com'], ['direct', 'Direct']] as const
const STAY = '7 / 13'

const LOG = [
  ['ok', '9:41:02', 'Airbnb', 'reservation HMQ4K2Z9 received'],
  ['ok', '9:41:05', 'Vrbo', 'nights closed'],
  ['bad', '9:41:06', 'Booking.com', 'push failed · 429 rate limited'],
  ['ok', '9:41:07', 'Direct', 'nights closed'],
  ['done', '9:41:36', 'Booking.com', 'retried · nights closed'],
] as const

/** Booked: Megan's Airbnb stay lands and the same nights close on Vrbo, Booking.com and the direct site, with the sync log. */
export function Booked() {
  return <section id="booked" className="stage booked" aria-labelledby="booked-title">
    <div className="s-wrap">
      <StageHead id="booked" eyebrow={['Booked', 'Tue Sep\u00a029', '9:41\u00a0PM']} title={<>Booked&nbsp;once. Closed everywhere.</>}>
        Megan books the Lake Loft on Airbnb. Seconds later those nights close on Vrbo, Booking.com and your own site.
      </StageHead>
      <div className="booked-art">
        <div className="card lake-calendar" role="img" aria-label="Lake Loft calendar, Thursday Oct 22 to Wednesday Oct 28, with PriceLabs nightly rates: Thu $248, Fri $262, Sat $305, Sun $289, Mon $214, Tue $198, Wed $205. Megan Ortiz on Airbnb for 3 nights, Saturday to Tuesday, $958. The same nights are closed on Vrbo, Booking.com and Direct.">
          <div className="cal-head" aria-hidden="true">
            <p className="cal-title">Lake Loft</p>
            <p className="cal-range"><span className="wide">Oct&nbsp;22 – 28</span><span className="narrow">Sat&nbsp;24 – Tue&nbsp;27</span></p>
            <p className="cal-source">Rates from PriceLabs</p>
          </div>
          <div className="cal-grid" aria-hidden="true">
            <span className="cal-corner" />
            {DAYS.map(([day, date, rate], i) => <span key={date} className={`cal-day${i < 2 || i > 5 ? ' off-strip' : ''}`} style={{ gridColumn: `${2 + i * 2} / span 2` }}><b>{day}&nbsp;{date}</b><span>${rate}</span></span>)}
            {ROWS.flatMap(([key, name], r) => [
              <span key={key} className="cal-channel" style={{ gridRow: r + 2 }}><Dot channel={key} />{name}</span>,
              ...DAYS.map(([, date], i) => <span key={`${key}-${date}`} className={`cal-cell${i < 2 || i > 5 ? ' off-strip' : ''}`} style={{ gridColumn: `${2 + i * 2} / span 2`, gridRow: r + 2 }} />),
            ])}
            <span className="cal-bar bar-stay" style={{ gridColumn: STAY, gridRow: 2 }}>Megan Ortiz<i>·</i><span className="wide">3 nights<i>·</i></span>$958</span>
            {[3, 4, 5].map(row => <span key={row} className="cal-bar bar-closed" style={{ gridColumn: STAY, gridRow: row }}>Closed</span>)}
          </div>
        </div>
        <div className="card sync-log">
          <h3>Sync log</h3>
          <ol>{LOG.map(([tone, time, channel, text]) => <li key={time} className={`log-${tone}`}>
            <span className="log-dot" aria-hidden="true" /><span className="log-time">{time}</span><i className="narrow" aria-hidden="true">·</i><span className="log-channel">{channel}</span><span className="log-text">{text}</span>
          </li>)}</ol>
          <p className="sync-foot">All channels in sync<i>·</i>34&nbsp;s</p>
        </div>
      </div>
    </div>
  </section>
}
