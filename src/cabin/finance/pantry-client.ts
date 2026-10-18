import { sharingAllowed } from '../connections/guard'
import type { Bindings } from '../../auth.server'
import { need, text } from '../model'
import { managedInstall } from '../channels'

export type Account = { id: string; code: string; name: string; type: string; subtype: string; active: number; revision?: string }
export type Connection = { origin: string; token: string }
export const PANTRY_MANAGED = 'Pantry connections are not available yet on RER Managed hosting.'
export function pantryAvailable(env: Bindings) { need(!managedInstall(env), PANTRY_MANAGED, 409) }

/** Accept a bare public HTTPS origin. Loopback HTTP is only for a local Cabin. */
export function pantryOrigin(value: unknown, env: Bindings) {
 let url: URL
 try { url = new URL(text(value, 'Pantry origin', 500)) } catch { need(false, 'Enter a valid Pantry origin'); }
 const host = url!.hostname.replace(/^\[|\]$/g, '').toLowerCase()
 need(!host.endsWith('.'), 'Use a Pantry hostname without a trailing dot')
 const loopback = ['localhost', '127.0.0.1', '::1'].includes(host)
 need(!url!.username && !url!.password && url!.pathname === '/' && !url!.search && !url!.hash, 'Use the Pantry origin only, without credentials, a path or a query')
 if (loopback) need(env.AUTH_LOCAL === 'true' && ['http:', 'https:'].includes(url!.protocol), 'Loopback Pantry requires a local Cabin installation')
 else {
  need(url!.protocol === 'https:', 'Pantry requires HTTPS')
  need(host.includes('.') && !host.includes(':') && !/\.(localhost|local|internal|home|lan|test|invalid|arpa)$/.test(host), 'Use a public Pantry hostname')
  if (/^\d+(?:\.\d+){3}$/.test(host)) {
   const [a, b] = host.split('.').map(Number)
   need(!(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b)), 'Private network Pantry addresses are not allowed')
  }
 }
 return url!.origin
}

const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
const unbase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
async function tokenKey(env: Bindings) {
 need(typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 16, 'Configure SESSION_SECRET before connecting Pantry', 503)
 const key = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cabin:pantry-token:${env.SESSION_SECRET}`))
 return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function seal(env: Bindings, token: string, origin: string) {
 const iv = crypto.getRandomValues(new Uint8Array(12)), key = await tokenKey(env)
 const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(origin) }, key, new TextEncoder().encode(token))
 return `v1.${base64(iv)}.${base64(new Uint8Array(bytes))}`
}
export async function connection(env: Bindings): Promise<Connection | null> {
 const row = await env.DB.prepare("SELECT origin,token FROM cb_finance_connections WHERE id='pantry'").first<Connection>()
 if (!row) return null
 const origin = pantryOrigin(row.origin, env)
 try {
  const [version, iv, encrypted] = row.token.split('.')
  need(version === 'v1' && iv && encrypted, 'Stored credential format is invalid')
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: new TextEncoder().encode(origin) }, await tokenKey(env), unbase64(encrypted))
  return { origin, token: new TextDecoder().decode(bytes) }
 } catch { need(false, 'Reconnect Pantry: its encrypted credential cannot be opened', 503) }
}


export class PantryError extends Error {
 constructor(message: string, readonly status: number) { super(message) }
}
/** Never expose a credential, upstream body or redirected URL in a failure. */
export async function pantry<T>(env: Bindings, conn: Connection, path: string, body?: unknown, key?: string): Promise<T> {
 pantryAvailable(env)
 await sharingAllowed(env.DB, 'pantry')
 let response: Response
 try {
  response = await fetch(conn.origin + '/api/pantry/integration/v1' + path, {
   method: body === undefined ? 'GET' : 'POST', redirect: 'manual', signal: AbortSignal.timeout(20_000),
   headers: { authorization: `Bearer ${conn.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': key! }) },
   ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
 } catch { throw new PantryError('Pantry could not be reached. Refresh this saved entry to check its status.', 502) }
 if (!response.ok) {
  const message = response.status === 401 ? 'Pantry credential is invalid or revoked. Replace it with an integration credential.'
   : response.status === 403 ? 'Pantry credential needs journals:write, documents:write and post scopes.'
   : response.status === 409 ? 'Pantry refused this entry because its accounting period, record or idempotency key conflicts. Review it in Pantry.'
   : `Pantry refused the request (HTTP ${response.status}). Check the connection and accounting accounts.`
  throw new PantryError(message, response.status)
 }
 try { return await response.json() as T } catch { throw new PantryError('Pantry returned an unreadable response. Refresh this saved entry to check its status.', 502) }
}
export async function context(env: Bindings, conn: Connection) {
 const [state] = await Promise.all([
  pantry<{ accounts: Account[] }>(env, conn, '/state'),
  pantry(env, conn, '/journals?limit=1'),
  pantry(env, conn, '/documents?limit=1'),
 ])
 need(Array.isArray(state.accounts) && state.accounts.every(a => a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.code === 'string'), 'Pantry returned an invalid account list', 502)
 return state
}
export const pantryMessage = (error: unknown) => error instanceof Error && 'status' in error ? error.message : 'Pantry could not confirm this saved entry. Refresh its status after restoring access.'
