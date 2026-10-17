import { Dot, Parts, StageHead, Status } from './parts'

const ROWS = [['Listings', '5'], ['Upcoming reservations', '61'], ['Guests', '1,284']] as const
const CHANNELS = [['airbnb', 'Airbnb', '5 listings reconnected'], ['vrbo', 'Vrbo', '4 listings reconnected']] as const

/** Moving in: the host's five homes come across from Hostaway, and Cabin is two commands on their own computer. */
export function MovingIn() {
  return <section id="moving-in" className="stage side flip moving" aria-labelledby="moving-in-title">
    <div className="s-wrap side-row">
      <StageHead id="moving-in" eyebrow={['Moving in']} title={<>Bring your<br />homes with&nbsp;you.</>}>
        Move from Guesty, Hostaway or OwnerRez with listings, reservations, guests and owner balances. Your channel listings and reviews stay where they are.
      </StageHead>
      <div className="moving-art">
        <div className="card import">
          <h3>Importing from Hostaway</h3>
          <p className="import-progress"><span className="import-bar" aria-hidden="true"><span /></span>100%</p>
          <ul className="import-rows">
            {ROWS.map(([label, value]) => <li key={label}><Status tone="ok" /><span>{label}</span><span>{value}</span></li>)}
            <li><Status tone="ok" /><span>Owner balances</span><span><Parts of={['$18,406.22', <span className="muted">matched</span>]} /></span></li>
            {CHANNELS.map(([key, name, line]) => <li key={key}><Status tone="ok" /><span><Dot channel={key} />{name}</span><span>{line}</span></li>)}
            <li><Status tone="amber" /><span><Dot channel="booking" />Booking.com</span><span>1 listing awaiting approval</span></li>
          </ul>
        </div>
        <div className="terminal-chip" role="img" aria-label="Two commands: rer install, then rer setup">
          <span className="terminal-lights" aria-hidden="true"><span /><span /><span /></span>
          <code aria-hidden="true"><span><b>$</b> rer install</span><span><b>$</b> rer setup</span></code>
        </div>
      </div>
    </div>
    <div className="s-wrap">
      <p className="card not-yet"><b>Not yet</b><span>Expedia, hotel room types and built-in dynamic pricing.</span></p>
    </div>
  </section>
}
