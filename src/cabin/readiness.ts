import type { AccessCode, Booking, Data, Property, Task, Turnover } from './model'
import { codeState } from './codes'
import { homeSettings } from './homes'
import { checkoutInstant, validCompletion } from './turnover-window'
import { instant } from './clock'
// Is each home ready for its next guests on or after a day? Ready means the
// turnover before that arrival is done with its photos and no blocking
// maintenance task is open. Anything Cabin cannot see (no turnover recorded
// before the arrival, a cleaning not yet done) is shown as such, never as ready.
export interface HomeReadiness { property: Property; state: 'ready' | 'not-ready' | 'unknown'; reasons: string[]; arrival: Booking | null; turnover: Turnover | null; blockers: Task[]; guestCode: AccessCode | null; codeState: string | null }
const stay = (b: Booking) => (b.kind ?? 'stay') === 'stay' && b.status === 'confirmed'
const live = (t: Turnover) => t.status !== 'draft' && t.status !== 'cancelled'
export function homeReadiness(s: Pick<Data, 'properties' | 'bookings' | 'turnovers' | 'tasks' | 'codes' | 'homeSettings' | 'members'>, p: Property, day: string, now = Date.now()): HomeReadiness {
 const stays = s.bookings.filter(b => b.propertyId === p.id && stay(b)).sort((a, b) => a.start.localeCompare(b.start))
 const arrival = stays.find(b => b.start.slice(0, 10) >= day) ?? null
 const before = arrival ? stays.filter(b => b.end.slice(0, 10) <= arrival.start.slice(0, 10)).at(-1) : stays.filter(b => b.end.slice(0, 10) <= day).at(-1)
 const turnover = (before && s.turnovers.find(t => t.bookingId === before.id && live(t))) || null
 const blockers = s.tasks.filter(t => t.propertyId === p.id && t.status === 'open' && t.blocking)
 const reasons: string[] = []
 const cleaner = turnover?.cleanerId ? s.members.find(m => m.id === turnover.cleanerId)?.name ?? 'the cleaner' : null
 if (!turnover) reasons.push(before ? 'No turnover recorded after the last stay' : arrival ? 'No turnover recorded before this arrival' : 'No stays recorded yet')
 else if (!before || (turnover.status === 'completed' && !validCompletion(turnover, before, homeSettings(s, p.id)))) reasons.push('Cleaning must be done after the preceding stay checks out')
 else if (now < checkoutInstant(homeSettings(s, p.id), before)) reasons.push('The preceding guests have not checked out yet')
 else if (turnover.status === 'unassigned') reasons.push('No cleaner assigned')
 else if (turnover.status === 'approved') reasons.push(`Cleaning not done yet (${cleaner})`)
 else if (!turnover.completion || (turnover.completion.photos?.length ?? (turnover.completion.photoId ? 1 : 0)) < (turnover.photosRequired ?? 1)) reasons.push('Photos missing')
 if (turnover?.status === 'completed' && arrival && Date.parse(turnover.completion?.completedAt ?? '') > instant(`${arrival.start.slice(0, 10)}T${arrival.arrivalTime ?? homeSettings(s, p.id).checkInTime}`, homeSettings(s, p.id).timeZone)) reasons.push('Cleaning finished after this arrival')
 for (const t of blockers) reasons.push(`Blocked: ${t.title}`)
 const guestCode = arrival ? s.codes.find(r => r.bookingId === arrival.id && r.holder === 'guest' && r.status === 'issued') ?? null : null
 if (arrival && !guestCode && arrival.end.slice(0, 10) >= day) reasons.push('No door code issued')
 const state = !reasons.length ? 'ready' : turnover || blockers.length ? 'not-ready' : 'unknown'
 return { property: p, state, reasons, arrival, turnover, blockers, guestCode, codeState: guestCode ? codeState(guestCode, now) : null }
}
export function portfolio(s: Parameters<typeof homeReadiness>[0], day: string, now = Date.now()) {
 const homes = s.properties.map(p => homeReadiness(s, p, day, now))
 return { homes, ready: homes.filter(h => h.state === 'ready').length, total: homes.length }
}
