import type { Bindings } from '../../auth.server'
import { need, owner, query, newId, type Actor } from '../model'
import { mutate } from '../storage'
import { seal, unseal } from '../seal'
import { providerPolicy, ACTIONS } from './policy'
import { sharingAllowed, restorationPaused } from './guard'

export const CREDENTIAL_FIELDS: Record<string, readonly [string, string][]> = {
 seam: [['SEAM_API_KEY', 'Seam API key']],
 twilio: [['TWILIO_ACCOUNT_SID', 'Twilio account SID'], ['TWILIO_AUTH_TOKEN', 'Twilio auth token'], ['TWILIO_FROM', 'Approved sending phone number']],
 booking: [['BOOKING_MESSAGING_USER', 'Booking.com machine user'], ['BOOKING_MESSAGING_PASSWORD', 'Booking.com machine password']],
}
const purpose = (id: string) => `provider-credential:${id}`
const values = (value: unknown) => Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[\s,]+/).filter(Boolean)
function deploymentCredentials(env: Bindings, id: string) {
 const fields = CREDENTIAL_FIELDS[id]
 if (!fields) return null
 const bindings = env as unknown as Record<string, unknown>
 if (!fields.every(([key]) => typeof bindings[key] === 'string' && bindings[key])) return null
 return Object.fromEntries(fields.map(([key]) => [key, String(bindings[key])]))
}
/** Stored credentials override bindings, including a durable revocation or damaged ciphertext. */
export async function configuredCredentials(env: Bindings, id: string): Promise<Record<string, string> | null> {
 const row = await providerPolicy(env.DB, id)
 if (!row) return deploymentCredentials(env, id)
 if (!row.enabled) return null
 if (!row.credential_sealed) return deploymentCredentials(env,id)
 const opened = await unseal(env.SESSION_SECRET, purpose(id), row.credential_sealed)
 need(opened, 'Reconnect this provider: the saved credential cannot be opened.', 503)
 let result: Record<string, string>
 try { result = JSON.parse(opened) } catch { need(false, 'Reconnect this provider: the saved credential is invalid.', 503) }
 need(CREDENTIAL_FIELDS[id]?.every(([key]) => typeof result[key] === 'string' && result[key]), 'Reconnect this provider: the saved credential is incomplete.', 503)
 return result
}
export async function providerCredentials(env: Bindings, id: string, action: string, propertyId?: string | null) {
 const before=await providerPolicy(env.DB,id)
 const credentials = await configuredCredentials(env, id)
 need(credentials, 'Connect this provider in Connections before continuing.', 409)
 await sharingAllowed(env.DB, id, action, propertyId)
 const current=await providerPolicy(env.DB,id)
 need(current?.revision===before?.revision,'The provider connection changed before use. Review its current grant.',409)
 return credentials
}
export async function secureAccount(env: Bindings, id: string) {
 return !!await configuredCredentials(env, id)
}
export async function securitySummary(env: Bindings, id: string) {
 const row = await providerPolicy(env.DB, id)
 return {
  revision: row?.revision ?? '', enabled: row ? row.enabled === 1 : null,
  actions: row ? JSON.parse(row.actions) as string[] : [],
  propertyIds: row ? JSON.parse(row.property_ids) as string[] : [],
  credentialStored: !!row?.credential_sealed,
  deploymentConfigured: !!deploymentCredentials(env, id),
  changedAt: row?.changed_at ?? null,
 }
}
/** Product forms never return credentials, their suffixes or upstream validation responses. */
export async function securityCommand(env: Bindings, actor: Actor, input: Record<string, unknown>) {
 owner(actor)
 const id = String(input.id), operation = String(input.operation)
 need(Object.hasOwn(ACTIONS, id), 'Unknown provider')
 need(['grant', 'credential', 'revoke'].includes(operation), 'Choose a connection operation')
 return mutate(env.DB, actor, `provider.${operation}`, async c => {
  const before = await providerPolicy(env.DB, id)
  need((before?.revision ?? '') === input.securityRevision, 'This connection changed. Reload before saving.', 409)
  let actions = before ? JSON.parse(before.actions) as string[] : [], properties = before ? JSON.parse(before.property_ids) as string[] : [], credential = before?.credential_sealed ?? null
  if (operation !== 'revoke') {
   need(!await restorationPaused(env.DB), 'Review this restored installation before reconnecting providers.', 409)
   need(input.confirm === 'yes', 'Review destination, purpose, data, authority and costs before authorizing this connection.')
   actions = values(input.actions)
   properties = values(input.propertyIds)
   need(actions.length && actions.every(action => ACTIONS[id].includes(action)), 'Choose the provider actions to authorize')
   need(id!=='booking'||!actions.includes('message:receive')||properties.includes('*'),'Receiving the Booking.com queue requires an explicitly authorized all-homes grant')
   need(properties.length && properties.every(propertyId => propertyId === '*' || c.data.properties.some(p => p.id === propertyId)), 'Choose the permitted homes, or all homes')
  }
  if (operation === 'credential') {
   const fields = CREDENTIAL_FIELDS[id]
   need(fields, 'Manage this provider’s credential in its own product settings')
   const secrets: Record<string, string> = {}
   for (const [key, label] of fields) {
    const value = String(input[key] ?? '').trim()
    need(value.length > 0 && value.length <= 1000 && !/[\r\n\u0000]/.test(value), `Enter ${label}`)
    secrets[key] = value
   }
   credential = await seal(env.SESSION_SECRET, purpose(id), JSON.stringify(secrets))
  }
  if (operation === 'revoke') credential = null
  const revision = newId(), enabled = operation === 'revoke' ? 0 : 1
  if(id==='quickbooks'&&operation==='revoke')c.queries.push(query('DELETE FROM cb_qbo_connection'),query('DELETE FROM cb_qbo_app'),query('DELETE FROM cb_qbo_oauth'))
  c.queries.push(query('INSERT INTO cb_provider_security(id,revision,enabled,actions,property_ids,credential_sealed,changed_by,changed_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,actions=excluded.actions,property_ids=excluded.property_ids,credential_sealed=excluded.credential_sealed,changed_by=excluded.changed_by,changed_at=excluded.changed_at', id, revision, enabled, JSON.stringify([...new Set(actions)]), JSON.stringify([...new Set(properties)]), credential, actor.id, c.now))
  c.queries.push(query('INSERT INTO cb_provider_sharing(id,enabled,revision,changed_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,changed_at=excluded.changed_at', id, enabled, newId(), c.now))
  c.audit = [{kind:'provider-connection', id, revision, result:operation === 'revoke' ? 'revoked' : operation === 'credential' ? 'credential-rotated' : 'scoped-grant'}]
  return {id, revision, enabled:!!enabled, credentialStored:!!credential}
 })
}
