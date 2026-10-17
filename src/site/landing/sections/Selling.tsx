import { Feature, Icon, Status, Tick } from '../parts'

/** A direct booking at checkout: three nights, the cleaning fee, Maine's 9% lodging tax on both, and what the guest signs. */
export function DirectBookings() {
  return <Feature id="direct" eyebrow="Direct bookings" title={<>Your own<br />booking site.</>}
    label="Checkout for Saltbox on the Bay, Nov 7 to 10, 3 nights, 4 guests: $215 times 3 nights $645.00, cleaning fee $120.00, Maine lodging tax at 9% $68.85, total $833.85. Rental agreement signed, ID verified, a $500 damage deposit held but not charged, and a Pay $833.85 button powered by Stripe"
    art={<div className="card checkout">
      <p className="checkout-head"><b>Saltbox on the Bay</b><i>·</i>Nov&nbsp;7–10<i>·</i>3&nbsp;nights<i>·</i>4&nbsp;guests</p>
      <dl className="lines">
        <div><dt>$215 × 3 nights</dt><dd>$645.00</dd></div>
        <div><dt>Cleaning fee</dt><dd>$120.00</dd></div>
        <div><dt>Lodging tax (ME 9%)</dt><dd>$68.85</dd></div>
      </dl>
      <p className="checkout-total"><b>Total</b><b>$833.85</b></p>
      <ul className="checks">
        <li><span className="tick-disc"><Tick /></span>Rental agreement signed</li>
        <li><span className="tick-disc"><Tick /></span>ID verified</li>
        <li><span className="tick-disc"><Tick /></span><span>Damage deposit $500<i>·</i>held, not charged</span></li>
      </ul>
      <p className="button-pay">Pay $833.85</p>
      <p className="powered">Powered by Stripe.</p>
    </div>}>
    Guests book you directly and pay with Stripe. The rental agreement, ID check and damage deposit happen at checkout.
  </Feature>
}

const RATES = [['Wed', 21, 172], ['Thu', 22, 189], ['Fri', 23, 265], ['Sat', 24, 279], ['Sun', 25, 168]] as const

/** Desert Casita's next five nights from the pricing tool, the house rules, and a one-night gap opened below the minimum. */
export function Pricing() {
  return <Feature id="pricing" flip eyebrow="Pricing" title={<>Rates that<br />follow demand.</>}
    label="Rates for Desert Casita synced from PriceLabs: Wednesday Oct 21 $172, Thursday $189, Friday $265, Saturday $279, Sunday $168. Rules: 2-night minimum, pet fee $75, weekend plus 15%. Oct 26: a 1-night gap opened to fill at $149"
    art={<div className="card rates">
      <div className="rates-head"><p className="card-title big">Desert Casita</p><p className="chip chip-green"><span className="dot" /><span>PriceLabs<i>·</i>synced</span></p></div>
      <ul className="rate-days">{RATES.map(([day, date, rate]) => <li key={date} className={day === 'Fri' || day === 'Sat' ? 'peak' : undefined}><span>{day}</span><span>{date}</span><b>${rate}</b></li>)}</ul>
      <ul className="rules">
        <li><Icon name="bed" />2-night minimum</li>
        <li><Icon name="paw" />Pet fee $75</li>
        <li><Icon name="calendar" />Weekend +15%</li>
      </ul>
      <p className="note note-amber"><Status tone="warn" size="sm" /><span>Oct&nbsp;26<i>·</i>1-night gap opened to fill<i>·</i>$149</span></p>
    </div>}>
    Connect PriceLabs or Wheelhouse, set minimum nights, gap rules and fees, and every channel gets the same price.
  </Feature>
}
