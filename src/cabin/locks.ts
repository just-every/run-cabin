import type { Bindings } from '../auth.server'
import { type AccessCode, type LockState } from './model'
import { load, mutate, SYSTEM } from './storage'
import { managedInstall } from './channels'
import { instant } from './clock'
import { homeSettings } from './homes'
// Live lock push. Cabin issues every code itself (codes.ts); a home whose smart
// lock is connected through Seam (one API for Schlage, Yale, August, Kwikset,
// igloohome, Nuki and more) gets each code set, moved and removed on the lock.
// The owner's Seam account is a later step: without SEAM_API_KEY, or on RER
// Managed (no provider relay yet), codes are set on the keypad by hand.
export const LOCK_LINES = {
 manual: 'No smart lock is connected for this home yet: set this code on the keypad by hand. Live lock push comes with the owner’s smart-lock account (Seam).',
 account: 'This home names a lock, but no smart-lock account (Seam) is connected to this install yet, so Cabin cannot push the code. Set it on the keypad by hand.',
 managed: 'Live lock push is not available yet on RER Managed hosting: it cannot reach lock providers until RER adds a provider relay. Set this code on the keypad by hand.',
}
export const lockLine = (env: { managed: boolean; lockAccount: boolean }, code: AccessCode) => code.lock.state === 'manual' ? LOCK_LINES.manual : env.managed ? LOCK_LINES.managed : !env.lockAccount ? LOCK_LINES.account : code.lock.state === 'set' ? 'Seam accepted this code for the lock. An accepted code is not a tested door: check it on site.' : code.lock.state === 'removed' ? 'Removed from the lock.' : code.lock.state === 'failed' ? `The lock did not take this code: ${code.lock.error}` : 'Sending to the lock…'
export const lockAccount = (env: Bindings) => !!env.SEAM_API_KEY && !managedInstall(env)

const SEAM = 'https://connect.getseam.com'
async function seam(env: Bindings, path: string, body: Record<string, unknown>) {
 const response = await fetch(SEAM + path, { method: 'POST', headers: { authorization: `Bearer ${env.SEAM_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
 let value: any = null; try { value = await response.json() } catch { /* the status explains it */ }
 if (!response.ok || value?.ok === false) throw Error(value?.error?.message ?? `Seam answered ${response.status}`)
 return value
}
/** One code's next step on its lock: create, update or delete, as Seam's access_codes API takes them. */
async function push(env: Bindings, code: AccessCode, deviceId: string | null): Promise<LockState> {
 const at = new Date().toISOString(), window = { starts_at: new Date(instant(code.validFrom, code.timeZone)).toISOString(), ends_at: new Date(instant(code.validUntil, code.timeZone)).toISOString() }
 try {
  if (code.status === 'revoked') { if (code.lock.providerId) await seam(env, '/access_codes/delete', { access_code_id: code.lock.providerId }); return { state: 'removed', providerId: code.lock.providerId, error: null, at } }
  if (!deviceId) return { state: 'manual', providerId: null, error: null, at }
  if (code.lock.providerId) { await seam(env, '/access_codes/update', { access_code_id: code.lock.providerId, code: code.code, ...window }); return { state: 'set', providerId: code.lock.providerId, error: null, at } }
  const made = await seam(env, '/access_codes/create', { device_id: deviceId, name: `Cabin ${code.holder} ${code.code}`, code: code.code, ...window })
  const id = made?.access_code?.access_code_id; if (typeof id !== 'string') throw Error('Seam did not return an access code id')
  return { state: 'set', providerId: id, error: null, at }
 } catch (error) { return { ...code.lock, state: 'failed', error: (error as Error).message.slice(0, 300), at } }
}
export async function pushLocks(env: Bindings) {
 if (!lockAccount(env)) return []
 const data = await load(env.DB), due = data.codes.filter(r => r.lock.state === 'pending').slice(0, 20), results = []
 for (const code of due) {
  const lock = await push(env, code, homeSettings({ data }, code.propertyId).lockDeviceId)
  results.push(await mutate(env.DB, SYSTEM, 'lock.push', c => { const row = c.data.codes.find(r => r.id === code.id); if (!row || row.revision !== code.revision) return null; row.lock = lock; c.entityId = row.id; return row }).catch(() => null))
 }
 return results
}
