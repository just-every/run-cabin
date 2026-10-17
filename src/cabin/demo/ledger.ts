// A home's month in owner-statement lines (USD cents): channel payouts, cleaning
// fees in and out, and the month's running costs.
import type { StatementLine } from '../model'
import type { DemoHome } from './portfolio'

const extra = (description: string, amountCents: number): StatementLine => ({ description, amountCents })
const extras = [extra('Repair: replaced dishwasher drain hose', -14250), extra('Firewood delivery (half cord)', -12000), extra('Pest control, quarterly visit', -9500), extra('Replaced two bath towel sets', -6840), extra('HVAC filter change', -4500)]

export function monthLines(home: DemoHome, month: string, seed: number): StatementLine[] {
  const [year, m] = month.split('-').map(Number), days = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const nights = Math.round(days * (0.55 + ((seed * 37) % 30) / 100)), stays = Math.max(3, Math.round(nights / 3.4))
  const viaBooking = home.bookingCom ? Math.round(stays * 0.3) : 0, viaAirbnb = stays - viaBooking
  const share = (n: number) => Math.round(nights * n / stays), cleanerFee = Math.round(home.cleaning * 0.7)
  const lines: StatementLine[] = [{ description: `Airbnb payouts (${viaAirbnb} stays, ${share(viaAirbnb)} nights)`, amountCents: Math.round(share(viaAirbnb) * home.nightly * 97) }]
  if (viaBooking) lines.push({ description: `Booking.com payouts (${viaBooking} stays, ${share(viaBooking)} nights)`, amountCents: Math.round(share(viaBooking) * home.nightly * 85) })
  lines.push({ description: `Cleaning fees collected (${stays} stays)`, amountCents: stays * home.cleaning * 100 }, { description: `Turnover cleaning (${stays} × $${cleanerFee})`, amountCents: -stays * cleanerFee * 100 })
  if (home.hotTub) lines.push({ description: 'Hot tub service and chemicals', amountCents: -8500 })
  if (seed % 3 === 0) lines.push(extras[seed % extras.length])
  lines.push({ description: 'Supplies and restock', amountCents: -(3800 + (seed * 731) % 5200) })
  return lines
}
