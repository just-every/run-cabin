import { links } from '../../shell/links'
import { Icon } from '../parts'

const COMMANDS = ['git clone https://github.com/just-every/run-cabin.git cabin', 'cd cabin', 'rer install', 'rer setup', 'rer dev']
const OWN: [string, string][] = [['laptop', 'Your own computer or server'], ['people', 'Your guests, your data'], ['export', 'Export any time']]

/** Run it yourself: the five commands in a terminal, and what owning it means. */
export function Ownership() {
  return <section id="ownership" className="feature ownership" aria-labelledby="ownership-title">
    <div className="site-wrap feature-row">
      <div className="feature-copy">
        <p className="eyebrow">Ownership</p>
        <h2 id="ownership-title">Yours, start<br />to finish.</h2>
        <p className="feature-body"><a href={links.run}>Run Cabin</a> on your own computer or server and keep every booking, guest and payout. Export everything, any time.</p>
        <ul className="own-list">{OWN.map(([icon, text]) => <li key={text}><Icon name={icon} />{text}</li>)}</ul>
      </div>
      <div className="feature-art">
        <div className="terminal" role="img" aria-label={`Five commands: ${COMMANDS.join(', ')}`}>
          <div className="terminal-bar" aria-hidden="true"><span /><span /><span /></div>
          <pre aria-hidden="true">{COMMANDS.map(line => <span key={line} className="terminal-line"><span className="prompt">$</span>{line}{'\n'}</span>)}</pre>
        </div>
      </div>
    </div>
  </section>
}
