import { Dot, Parts, StageHead, Status } from './parts'

const ROWS = [['Listings', '5'], ['Upcoming reservations', '61'], ['Guests', '1,284']] as const
const CHANNELS = [['airbnb', 'Airbnb', '5 listings reconnected'], ['vrbo', 'Vrbo', '4 listings reconnected']] as const

// The one start line every Run Edit Run page shows, and the alternative for people who already have Node.
const START = 'curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin'
const ALTERNATIVE = 'npx -y @runeditrun/rer dev just-every/run-cabin'

/** A command that wraps only between words, keeping the installer's `install.sh | sh` together. */
function words(line: string) {
  return line.split(/(\S*install\.sh \| sh|\S+)/).map((part, index) => {
    const pipe = /^(.*\/)(install\.sh \| sh)$/.exec(part)
    if (pipe) return <span key={index}><span className="nowrap">{pipe[1]}</span><wbr /><span className="nowrap">{pipe[2]}</span></span>
    return part.trim() ? <span key={index} className="nowrap">{part}</span> : part
  })
}

/** Moving in: the host's five homes come across from Hostaway, and Cabin is one line on their own computer. */
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
        <div className="terminal-chip" role="img" aria-label={`One line: ${START}. Already have Node 22 or later? ${ALTERNATIVE} does the same.`}>
          <span className="terminal-lights" aria-hidden="true"><span /><span /><span /></span>
          <code aria-hidden="true"><span><b>$</b> {words(START)}</span><span className="chip-comment"><b>#</b> {words(`Already have Node 22 or later? ${ALTERNATIVE}`)}</span></code>
        </div>
      </div>
    </div>
    <div className="s-wrap">
      <p className="card not-yet"><b>Not yet</b><span>Expedia, hotel room types and built-in dynamic pricing.</span></p>
    </div>
  </section>
}
