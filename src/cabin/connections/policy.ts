import { need } from '../model'

/** These are Cabin operations, not a claim about a provider's account permissions. */
export const ACTIONS: Record<string, readonly string[]> = {
 calendars: ['calendar:read', 'calendar:publish'],
 mail: ['message:send'],
 stripe: ['payment:read', 'payment:write', 'identity:read', 'identity:write'],
 seam: ['access:write'],
 twilio: ['message:send', 'message:receive'],
 booking: ['message:send', 'message:receive'],
 anthropic: ['reply:draft'],
 pantry: ['journal:read', 'journal:write'],
 quickbooks: ['journal:read', 'journal:write'],
}
export interface ProviderPolicy {
 id: string
 revision: string
 enabled: number
 actions: string
 property_ids: string
 credential_sealed: string | null
 changed_by: string
 changed_at: string
}
export const providerPolicy = (db: D1Database, id: string) => db.prepare('SELECT * FROM cb_provider_security WHERE id=?').bind(id).first<ProviderPolicy>()

/** Read immediately before an effect. A saved policy overrides deployment authority. */
export async function requireProviderScope(db: D1Database, id: string, action?: string, propertyId?: string | null) {
 const policy = await providerPolicy(db, id)
 if (!policy) return // Existing deployment bindings and explicit product setup retain their authority.
 need(policy.enabled === 1, 'This provider connection is revoked. Review it in Connections.', 409)
 const actions: string[] = JSON.parse(policy.actions), properties: string[] = JSON.parse(policy.property_ids)
 need(action && actions.includes(action), 'This provider action is outside the owner’s saved grant.', 403)
 need(properties.includes('*') || !!propertyId && properties.includes(propertyId), 'This property is outside the provider’s saved grant.', 403)
}
