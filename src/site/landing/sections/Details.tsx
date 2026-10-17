import { Icon } from '../parts'

const DETAILS: [string, string, string, string][] = [
  ['card', 'green', 'Damage deposits', 'Held on the card, released after checkout.'],
  ['receipt', 'amber', 'Lodging tax', 'Collected and filed by state and county.'],
  ['person', 'blue', 'Owner portal', 'Owners see stays and statements any time.'],
  ['wrench', 'green', 'Maintenance', 'Broken things become tasks with photos.'],
  ['bubble', 'amber', 'Review replies', 'Thank-yous and replies sent on schedule.'],
  ['clock', 'blue', 'Activity log', 'Every change, message and payout, recorded.'],
]

/** Six smaller things done properly, as a 3×2 grid of cards. */
export function Details() {
  return <section id="details" className="details" aria-labelledby="details-title">
    <div className="site-wrap">
      <p className="eyebrow">Also included</p>
      <h2 id="details-title">The quiet details.</h2>
      <ul className="details-grid">{DETAILS.map(([icon, tone, title, body]) => <li key={title} className="card detail"><span className={`detail-icon ${tone}`}><Icon name={icon} /></span><h3>{title}</h3><p>{body}</p></li>)}</ul>
    </div>
  </section>
}
