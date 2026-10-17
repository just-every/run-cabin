import { Dot, StageHead, Status } from '../parts'

// Lake Loft's October for its owner, Karen Whitfield. Gross $1,104 + $812 + $690 + $958 = $3,564.00. Channel and card fees
// $273.39 = Airbnb 3% of $958 ($28.74) + Booking.com 15% of $1,104 ($165.60) + Vrbo 8% of $690 ($55.20) + Stripe 2.9% + 30¢
// on the direct $812 ($23.85). Cleaning 4 × $150; management 20% of gross; the hot tub filter; payout $1,913.81. Lodging tax
// 9% on the stays the host remits (Booking.com and direct, $1,916): $172.44; Airbnb and Vrbo collect and remit their own.
const STAYS = [
  ['Oct 2–5', 'J. Chen', 'booking', 'Booking.com', '$1,104.00'],
  ['Oct 9–11', 'D. Patel', 'direct', 'Direct', '$812.00'],
  ['Oct 16–18', 'R. Alvarez', 'vrbo', 'Vrbo', '$690.00'],
  ['Oct 24–27', 'M. Ortiz', 'airbnb', 'Airbnb', '$958.00'],
] as const
const LINES = [['Gross rent', '$3,564.00'], ['Channel and card fees', '−$273.39'], ['Cleaning', '−$600.00'], ['Management 20%', '−$712.80'], ['Hot tub filter', '−$64.00']] as const
const AFTER = [
  ['ok', 'check', 'QuickBooks', 'synced Oct 31'],
  ['pine', 'eye', 'Owner portal', 'Karen viewed Nov 1'],
  ['amber', 'doc', 'Lodging tax 9% · $172.44', 'filed Nov 1'],
] as const

/** Dotted connectors, each ending in the page's one arrowhead at [x, y, angle]; drawn in the SVG's own units. */
const Flow = ({ className, box, lines }: { className: string; box: string; lines: [string, number, number, number][] }) => <svg className={`flow ${className}`} viewBox={box} aria-hidden="true">
  {lines.map(([d, x, y, angle]) => <g key={d}><path className="flow-line" d={d} /><path className="flow-head" transform={`translate(${x} ${y}) rotate(${angle})`} d="M-5.5-5.5 0 0l-5.5 5.5" /></g>)}
</svg>

/** Payout: Airbnb's payout is matched to Megan's stay and lands on the owner's October statement, then the books, the portal and the tax. */
export function Payout() {
  return <section id="payout" className="stage payout" aria-labelledby="payout-title">
    <div className="s-wrap">
      <StageHead id="payout" eyebrow={<>Payout<i>·</i><span className="nowrap">Sun Oct 25 → Sun Nov 1</span></>} title={<>Every payout, accounted for.</>}>
        Airbnb’s payout matches Megan’s stay to the cent and lands on the owner’s October statement.
      </StageHead>
      <div className="payout-art">
        <div className="card payout-card">
          <p className="payout-label"><Dot channel="airbnb" /><b>Airbnb payout</b><i>·</i>Oct&nbsp;25</p>
          <p className="payout-amount">$929.26</p>
          <p className="payout-meta">HMQ4K2Z9<i>·</i>M. Ortiz</p>
          <p className="payout-meta">$958.00 – host fee $28.74</p>
          <p className="payout-matched"><Status tone="ok" />Matched</p>
        </div>
        <Flow className="flow-in" box="0 -8 100 16" lines={[['M4 0H94', 94, 0, 0]]} />
        <Flow className="flow-down" box="-8 0 16 56" lines={[['M0 3V50', 0, 50, 90]]} />
        <div className="card statement">
          <h3>Owner statement<i>·</i>October 2026</h3>
          <p className="statement-sub">Lake Loft<i>·</i>Karen Whitfield</p>
          <ul className="statement-stays">{STAYS.map(([dates, guest, key, channel, amount]) => <li key={dates} className={key === 'airbnb' ? 'is-matched' : undefined}>
            <span className="stay-dates">{dates}</span><span className="stay-guest">{guest}</span><span className="stay-channel"><Dot channel={key} />{channel}</span><span className="stay-amount">{amount}</span>
          </li>)}</ul>
          <dl className="statement-lines">{LINES.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
          <p className="statement-total"><b>Owner payout</b><b>$1,913.81</b></p>
        </div>
        <Flow className="flow-out" box="0 0 98 388" lines={[['M3 139H34V53H92', 92, 53, 0], ['M3 195H92', 92, 195, 0], ['M3 249H34V335H92', 92, 335, 0]]} />
        <Flow className="flow-down" box="-8 0 16 56" lines={[['M0 3V50', 0, 50, 90]]} />
        <ul className="payout-after">{AFTER.map(([tone, glyph, title, line]) => <li key={title} className="card">
          <Status tone={tone} glyph={glyph} /><span><b>{title.split(' · ').map((part, i) => <span key={part}>{i > 0 && <i>·</i>}{part}</span>)}</b><span>{line}</span></span>
        </li>)}</ul>
      </div>
    </div>
  </section>
}
