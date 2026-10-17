import { links } from '../../shell/links'
import { Icon } from '../parts'

const REPO = 'just-every/run-cabin'
const COMMAND = `npx -y @runeditrun/rer dev ${REPO}`
/** Lines rer prints on a first start (rer 0.2.38: Restart, two of its progress lines, then the ready line). */
const OUTPUT = ['Restart: cd run-cabin && rer dev', 'rer dev: installing dependencies', 'RER_READY http://127.0.0.1:8787']
const OWN: [string, string][] = [['laptop', 'Your own computer or server'], ['people', 'Your guests, your data'], ['export', 'Export any time']]

/** Run it yourself: the one command that clones, sets up and starts it, in a terminal, and what owning it means. */
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
        <div className="terminal" role="img" aria-label={`One command: ${COMMAND}. It prints: ${OUTPUT.join(', ')}`}>
          <div className="terminal-bar" aria-hidden="true"><span /><span /><span /></div>
          <pre aria-hidden="true"><span className="terminal-line"><span className="prompt">$</span>npx -y @runeditrun/rer dev <span style={{ whiteSpace: 'nowrap' }}>{REPO}</span>{'\n'}</span>{OUTPUT.map(line => <span key={line} className="terminal-line">{line}{'\n'}</span>)}</pre>
        </div>
      </div>
    </div>
  </section>
}
