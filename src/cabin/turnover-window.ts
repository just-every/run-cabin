import type { Booking, HomeSettings, Turnover } from './model'
import { instant, wall } from './clock'

/** Checkout is a wall time at the home, never the server's midnight. */
export const checkoutTime = (s: HomeSettings, b: Booking) => `${b.end.slice(0, 10)}T${s.checkOutTime}`
export const checkoutInstant = (s: HomeSettings, b: Booking) => instant(checkoutTime(s, b), s.timeZone)

/** A completed cleaning belongs to the preceding stay and must follow it. */
export function validCompletion(t: Turnover, b: Booking, s: HomeSettings) {
 const checkout = checkoutInstant(s, b)
 return b.status === 'confirmed' && t.bookingRevision === b.revision && !!t.completion
  && Date.parse(t.completion.completedAt) >= checkout
  && (!t.checkedOut || Date.parse(t.checkedOut.at) >= checkout)
}

/** Cleaner access lasts up to six hours, ending sooner for the next arrival. */
export function cleaningAccess(s: HomeSettings, t: Turnover) {
 const start = instant(t.windowStart!, s.timeZone)
 const end = Math.min(start + 6 * 60 * 60 * 1000, instant(t.windowEnd!, s.timeZone))
 return { validFrom: t.windowStart!, validUntil: wall(end, s.timeZone) }
}
