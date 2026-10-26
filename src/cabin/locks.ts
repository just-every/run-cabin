import { due } from './locks/jobs'
import { pushLock } from './locks/worker'
import { secureAccount } from './connections/credentials'
import type { Bindings } from '../auth.server'
import { type AccessCode } from './model'
import { load } from './storage'
import { managedInstall } from './channels'
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
export const lockLine = (env: { managed: boolean; lockAccount: boolean }, code: AccessCode) => code.lock.state === 'manual' ? LOCK_LINES.manual : env.managed ? LOCK_LINES.managed : !env.lockAccount ? LOCK_LINES.account : code.lock.state === 'set' ? 'Seam confirmed this code and its scheduled window on the lock. It works only during the displayed hours; check entry on site.' : code.lock.state === 'removed' ? 'Removed from the lock.' : code.lock.state === 'failed' ? `The lock did not take this code: ${code.lock.error}` : 'Sending to the lock…'

export async function pushLocks(env: Bindings) {
 if (managedInstall(env)||!await secureAccount(env,'seam')) return []
 const data=await load(env.DB),results=[]
 for(const code of data.codes.filter(due).sort((a,b)=>(a.lock.at??'').localeCompare(b.lock.at??'')).slice(0,20)){
  try{results.push(await pushLock(env,code.id))}catch{/* A lost claim or storage interruption leaves its durable attempt for reconciliation. */}
 }
 return results
}
