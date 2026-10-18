import { verificationAccessBlocked } from './verification/records'
import { type AccessCode, type Context, type HomeSettings, newId, need } from './model'
import { instant } from './clock'
// Door codes: Cabin issues a four-digit code for each stay (the guest's, valid
// check-in to check-out) and for each assigned turnover (the cleaner's, valid
// for at most six hours after checkout). No two codes at a home overlap in time with the same
// digits. Pushing them to a smart lock is locks.ts; without a lock account the
// code is set on the keypad by hand, and the page says so.
const random = () => { const n = new Uint32Array(1); crypto.getRandomValues(n); return n[0] }
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
const overlapping = (a: { validFrom: string; validUntil: string }, b: { validFrom: string; validUntil: string }) => a.validFrom < b.validUntil && b.validFrom < a.validUntil
export function digits(c: Context, propertyId: string, window: { validFrom: string; validUntil: string }) {
 const taken = new Set(c.data.codes.filter(r => r.propertyId === propertyId && r.status === 'issued' && overlapping(r, window)).map(r => r.code))
 for (;;) { const code = String(random() % 10_000).padStart(4, '0'); if (!taken.has(code) && !/^(\d)\1{3}$/.test(code) && !'0123456789876543210'.includes(code)) return code }
}
const lockFor = (s: HomeSettings) => ({ state: s.lockDeviceId ? 'pending' : 'manual', providerId: null, error: null, at: null }) as AccessCode['lock']
export function issue(c: Context, s: HomeSettings, fields: Pick<AccessCode, 'bookingId' | 'turnoverId' | 'holder' | 'memberId' | 'validFrom' | 'validUntil'>) {
 need(fields.holder!=='guest'||!verificationAccessBlocked(c.data,fields.bookingId),'Guest identity verification must be resolved before issuing access.',409)
 const row: AccessCode = { id: newId(), revision: newId(), propertyId: s.propertyId, ...fields, code: digits(c, s.propertyId, fields), timeZone: s.timeZone, status: 'issued', reason: null, link: fields.holder === 'guest' ? token() : null, lock: lockFor(s), createdAt: c.now }
 c.data.codes.push(row); return row
}
export function move(c: Context, s: HomeSettings, row: AccessCode, validFrom: string, validUntil: string) {
 if (row.validFrom === validFrom && row.validUntil === validUntil && row.timeZone === s.timeZone) {
  if (s.lockDeviceId && row.lock.state === 'manual') row.lock = { ...row.lock, state: 'pending', error: null }
  return false
 }
 Object.assign(row, { validFrom, validUntil, timeZone: s.timeZone, revision: newId() })
 if (s.lockDeviceId || row.lock.providerId) row.lock = { ...row.lock, state: 'pending', error: null }
 return true
}
export function revoke(row: AccessCode, reason: string) {
 if (row.status === 'revoked') return
 Object.assign(row, { status: 'revoked', reason, revision: newId() })
 if (row.lock.providerId) row.lock = { ...row.lock, state: 'pending', error: null }
}
/** Scheduled, active, expired or revoked, now, at the home. */
export function codeState(row: AccessCode, now = Date.now()) {
 if (row.status === 'revoked') return 'revoked'
 return now < instant(row.validFrom, row.timeZone) ? 'scheduled' : now < instant(row.validUntil, row.timeZone) ? 'active' : 'expired'
}
