import { Feature, Status, Tick } from '../parts'

/** Maple House's October: rent less channel fees, cleaning and the 20% management fee is the owner's payout. */
export function OwnerStatements() {
  return <Feature id="statements" eyebrow="Owner statements" title={<>Every payout,<br />accounted for.</>}
    label="Owner statement for October 2026, Maple House, owner Karen Whitfield: gross rent $8,420.00, channel fees minus $1,263.00, cleaning minus $720.00, management at 20% minus $1,684.00, owner payout $4,753.00. QuickBooks synced. An Airbnb payout of $1,912.40 matched to 3 stays"
    art={<div className="card statement">
      <p className="card-title big">Owner statement<i>·</i>October 2026</p>
      <p className="muted statement-sub">Maple House<i>·</i>Karen Whitfield</p>
      <dl className="lines">
        <div><dt>Gross rent</dt><dd>$8,420.00</dd></div>
        <div><dt>Channel fees</dt><dd>−$1,263.00</dd></div>
        <div><dt>Cleaning</dt><dd>−$720.00</dd></div>
        <div><dt>Management 20%</dt><dd>−$1,684.00</dd></div>
      </dl>
      <p className="statement-total"><b>Owner payout</b><b>$4,753.00</b></p>
      <p className="chip chip-green solid-check"><span className="tick-disc solid"><Tick /></span><span>QuickBooks<i>·</i>synced</span></p>
      <p className="payout-row"><Status tone="money" /><span>Airbnb payout $1,912.40<i>·</i>matched to 3 stays ✓</span></p>
    </div>}>
    Airbnb, Vrbo and Stripe payouts match to their stays. Owners get a statement and a portal, and the books sync to QuickBooks.
  </Feature>
}

const ROWS = [['Listings', '12'], ['Upcoming reservations', '184'], ['Guests', '2,316'], ['Owner balances', '$41,208.55 · matched'], ['Airbnb', '9 listings reconnected']] as const

/** Moving a whole portfolio from Hostaway: what came across, and the one channel listing still waiting. */
export function MoveIn() {
  return <Feature id="move-in" flip eyebrow="Move in" title={<>Bring your<br />rentals with you.</>}
    label="Importing from Hostaway, 100% done: 12 listings, 184 upcoming reservations, 2,316 guests, owner balances of $41,208.55 matched, 9 Airbnb listings reconnected; one Booking.com listing awaiting approval"
    art={<div className="card import">
      <p className="card-title big">Importing from Hostaway</p>
      <p className="progress"><span className="progress-bar"><span /></span>100%</p>
      <ul className="import-rows">{ROWS.map(([label, value]) => <li key={label}><span className="tick-disc solid"><Tick /></span><span>{label}</span><span>{value}</span></li>)}
        <li className="pending"><Status tone="warn" size="sm" /><span>Booking.com<i>·</i>1 listing awaiting approval</span></li>
      </ul>
    </div>}>
    Move from Guesty, Hostaway or OwnerRez with your listings, reservations, guests and owner balances. Channels reconnect to the same listings.
  </Feature>
}
