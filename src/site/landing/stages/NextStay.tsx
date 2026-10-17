import { Status, StageHead } from '../parts'

// Megan's return, booked direct on Tue Nov 3 for July 2027: 4 nights $1,316.00, the 10% Cabin offered her under Stay recovery
// (−$131.60), cleaning $150.00, 9% lodging tax on $1,334.40 ($120.10): $1,454.50.
const LINES = [['4 nights', '$1,316.00'], ['Returning guest 10%', '−$131.60'], ['Cleaning fee', '$150.00'], ['Lodging tax 9%', '$120.10']] as const
const CHECKS = [<>Rental agreement signed</>, <>ID verified</>, <>Damage deposit $500<i>·</i>held, not charged</>]

/** Next stay: Megan books her July return on the host's own site, with the agreement, the ID check and the deposit at checkout. */
export function NextStay() {
  return <section id="next-stay" className="stage side next" aria-labelledby="next-stay-title">
    <div className="s-wrap side-row">
      <StageHead id="next-stay" eyebrow={<>Next stay<i>·</i>Tue Nov&nbsp;3</>} title={<>Next time,<br />she books direct.</>}>
        Your own booking site takes the payment, the rental agreement, the ID check and the damage deposit. No channel fee.
      </StageHead>
      <div className="next-art">
        <p className="float-chip next-closed"><Status tone="amber" glyph="calendar" /><span>Jul&nbsp;10–14<i>·</i>closed on Airbnb, Vrbo, Booking.com</span></p>
        <div className="card checkout">
          <p className="checkout-channel"><span className="dot dot-direct" aria-hidden="true" />Direct</p>
          <h3>Lake Loft</h3>
          <p className="checkout-dates">Sat Jul&nbsp;10 – Wed Jul&nbsp;14, 2027<i>·</i>4&nbsp;nights<i>·</i>4&nbsp;guests</p>
          <p className="checkout-welcome">Welcome back, Megan</p>
          <dl className="checkout-lines">{LINES.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
          <p className="checkout-total"><b>Total</b><b>$1,454.50</b></p>
          <ul className="checkout-checks">{CHECKS.map((check, i) => <li key={i}><Status tone="ok" size="sm" /><span>{check}</span></li>)}</ul>
          <p className="checkout-pay">Pay $1,454.50</p>
          <p className="checkout-stripe">Powered by Stripe</p>
        </div>
      </div>
    </div>
  </section>
}
