import { h, form, hidden, owner } from '../ui/shared'
import { CREDENTIAL_FIELDS } from './credentials'

const labels:Record<string,string>={'calendar:read':'Read channel calendars','calendar:publish':'Publish blocked nights','message:send':'Send messages','message:receive':'Receive messages','payment:read':'Read payments and settlements','payment:write':'Create or change payments','identity:read':'Read verification outcomes','identity:write':'Start or redact identity checks','access:write':'Set and revoke lock access','reply:draft':'Draft replies from saved facts','journal:read':'Read accounting records','journal:write':'Post approved journals and evidence'}
export function securityForms(state: any, provider: any) {
 const security = provider.security
 if (!security) return ''
 const current = security.enabled === null ? 'Configured by the installation owner' : security.enabled ? 'Owner-authorized connection' : 'Revoked connection'
 const summary = `<p><strong>Authority:</strong> ${h(current)}. ${security.credentialStored ? 'Encrypted credential saved; its value is never shown.' : security.deploymentConfigured ? 'A deployment credential is configured.' : ''} ${security.changedAt ? `Changed ${h(security.changedAt)}.` : ''}</p>`
 if (!owner(state)) return summary
 const queueNote=provider.id==='booking'?'<p>Receiving the Booking.com queue needs all current and future homes because its provider queue covers the whole connected account.</p>':''
 const scopes = () => `<fieldset><legend>Permitted Cabin actions</legend>${provider.allowedActions.map((action: string) => `<label class="check"><input type="checkbox" name="actions" value="${h(action)}" ${security.actions.includes(action) ? 'checked' : ''}> ${h(labels[action]??action)}</label>`).join('')}</fieldset><fieldset><legend>Permitted homes</legend><label class="check"><input type="checkbox" name="propertyIds" value="*" ${security.propertyIds.includes('*') ? 'checked' : ''}> All current and future homes</label>${state.properties.map((p: any) => `<label class="check"><input type="checkbox" name="propertyIds" value="${h(p.id)}" ${security.propertyIds.includes(p.id) ? 'checked' : ''}> ${h(p.name)}</label>`).join('')}</fieldset><label class="check"><input type="checkbox" name="confirm" value="yes" required> I reviewed this provider’s destination, purpose, data, costs and these action/home limits.</label>`
 const base = hidden('id', provider.id) + hidden('securityRevision', security.revision)
 const grant = form('provider.sharing', 'channels', base + hidden('operation', 'grant') + scopes(), 'Allow selected actions and homes')
 const fields = CREDENTIAL_FIELDS[provider.id]
 const credential = fields ? `<details><summary>Save or rotate provider credential</summary><p>Use a provider-side credential limited to the required account, devices and operations. Saving does not prove a live provider connection. Replace all fields to rotate. Revoke the old key at the provider too.</p>${form('provider.sharing', 'channels', base + hidden('operation', 'credential') + fields.map(([key, label]) => `<label>${h(label)}<input type="password" name="${h(key)}" autocomplete="new-password" maxlength="1000" required></label>`).join('') + scopes(), 'Save encrypted connection', 'autocomplete="off"')}</details>` : '<p>Stripe, AI and Pantry credentials are managed in their own product settings; this authorization limits their use.</p>'
 const revoke = form('provider.sharing', 'channels', base + hidden('operation', 'revoke'), 'Revoke connection and remove saved credential')
 return summary + queueNote + grant + credential + revoke
}
