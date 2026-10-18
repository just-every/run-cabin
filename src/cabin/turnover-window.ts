import type { Booking, HomeSettings, Turnover } from './model'
import { instant, wall } from './clock'

/** Checkout is a wall time at the home, never the server's midnight. */
export const checkoutTime = (s: HomeSettings, b: Booking) => `${b.end.slice(0, 10)}T${b.departureTime ?? s.checkOutTime}`
export const checkoutInstant = (s: HomeSettings, b: Booking) => instant(checkoutTime(s, b), s.timeZone)

/** A completed cleaning belongs to the preceding stay and must follow it. */
export function validCompletion(t: Turnover, b: Booking, s: HomeSettings) {
 const checkout = checkoutInstant(s, b)
 return b.status === 'confirmed' && t.bookingRevision === b.revision && !!t.completion
  && Date.parse(t.completion.completedAt) >= checkout
  && (!t.checkedOut || Date.parse(t.checkedOut.at) >= checkout)
}

/** Why a completed cleaning no longer counts for its stay, or null while it still does. */
export function staleCompletion(t: Turnover, b: Booking, s: HomeSettings, windowStart: string, oldZone: string) {
 if (b.status !== 'confirmed' || t.bookingRevision !== b.revision) return 'the stay before it changed'
 if (oldZone !== s.timeZone) return 'the home’s time zone changed'
 // A job approved by hand takes its first window at the next commit; only a moved window counts.
 if ((t.windowStart && t.windowStart !== windowStart) || !validCompletion(t, b, s)) return 'the check-out time changed after it was marked ready'
 return null
}

/** Marked ready after the next guests' check-in: kept, and shown as finished late. */
export const finishedLate = (t: Turnover, s: HomeSettings) => !!(t.status === 'completed' && t.completion && t.nextBookingId && t.windowEnd && Date.parse(t.completion.completedAt) > instant(t.windowEnd, s.timeZone))

/** Cleaner access lasts up to six hours, ending sooner for the next arrival. */
export function cleaningAccess(s: HomeSettings, t: Turnover) {
 const start = instant(t.windowStart!, s.timeZone)
 const end = Math.min(start + 6 * 60 * 60 * 1000, instant(t.windowEnd!, s.timeZone))
 return { validFrom: t.windowStart!, validUntil: wall(end, s.timeZone) }
}
