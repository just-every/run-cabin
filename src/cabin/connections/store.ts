import type { Bindings } from '../../auth.server'
import { type Actor, owner, need, query, newId } from '../model'
import { mutate } from '../storage'

export const PROVIDERS = [
 { id: 'calendars', name: 'Calendar providers', destination: 'The calendar hosts you connect below', purpose: 'Read reservations and closed nights', data: 'Calendar URL and request metadata. Cabin export links share unavailable dates with whoever you give the link to.', costs: 'Your channel agreement', source: 'https://www.airbnb.com/help/article/1857' },
 { id: 'mail', name: 'Email', destination: 'Your configured mail provider and the addressed recipients', purpose: 'Invitations, guest messages, work notices, owner statements and tax packets', data: 'Recipient addresses and the message or document you send', costs: 'Your mail provider plan', source: 'https://sendgrid.com/en-us/pricing' },
 { id: 'stripe', name: 'Stripe', destination: 'api.stripe.com', purpose: 'Payments, deposit holds and identity verification', data: 'Guest contact, stay reference, amount, agreement consent and provider identity references. Card and ID entry occurs at Stripe.', costs: 'Stripe processing and Identity fees', source: 'https://stripe.com/pricing' },
 { id: 'seam', name: 'Seam', destination: 'connect.getseam.com', purpose: 'Create, change and remove lock access', data: 'Device ID, door code and its access window', costs: 'Your Seam and lock provider plan', source: 'https://www.seam.co/pricing' },
 { id: 'twilio', name: 'Twilio', destination: 'api.twilio.com', purpose: 'Guest texts', data: 'Phone numbers and message text', costs: 'Twilio messaging and registration fees', source: 'https://www.twilio.com/en-us/sms/pricing/us' },
 { id: 'booking', name: 'Booking.com messaging', destination: 'supply-xml.booking.com', purpose: 'Read and send reservation messages', data: 'Property/reservation IDs and conversation text', costs: 'Your Booking.com partner agreement', source: 'https://partner.booking.com/' },
 { id: 'anthropic', name: 'Anthropic', destination: 'api.anthropic.com', purpose: 'Draft replies for human review', data: 'Scoped stay facts, approved instructions and the last twelve messages; recovery wording has no guest facts', costs: 'Your Anthropic API usage', source: 'https://platform.claude.com/docs/en/about-claude/pricing' },
 { id: 'pantry', name: 'Pantry', destination: 'Your connected Pantry installation', purpose: 'Post approved owner accounting', data: 'Approved journal and matched booking, payout, fee and expense evidence', costs: 'Your hosting costs; Cabin collects nothing', source: 'https://github.com/just-every/run-pantry' },
] as const

export async function sharingState(env: Bindings, actor: Actor) {
 if (actor.isAgent || !['owner', 'manager'].includes(actor.role)) return []
 const rows = (await env.DB.prepare('SELECT id,enabled,revision,changed_at AS changedAt FROM cb_provider_sharing').all<{ id: string; enabled: number; revision: string; changedAt: string }>()).results
 return PROVIDERS.map(p => ({ ...p, enabled: rows.find(r => r.id === p.id)?.enabled !== 0, revision: rows.find(r => r.id === p.id)?.revision ?? '', changedAt: rows.find(r => r.id === p.id)?.changedAt ?? null }))
}
export async function sharingCommand(env: Bindings, actor: Actor, input: Record<string, unknown>) {
 owner(actor)
 const id = String(input.id), enabled = input.enabled === true || input.enabled === 'true'
 need(PROVIDERS.some(p => p.id === id), 'Unknown provider')
 return mutate(env.DB, actor, 'provider.sharing', async c => {
  const old = await env.DB.prepare('SELECT revision FROM cb_provider_sharing WHERE id=?').bind(id).first<{ revision: string }>()
  need((old?.revision ?? '') === input.revision, 'Sharing settings changed. Reload before saving.', 409)
  need(!enabled || input.confirm === 'yes', 'Review the destination and data, then confirm reconnection.')
  const revision = newId()
  c.queries.push(query('INSERT INTO cb_provider_sharing(id,enabled,revision,changed_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,changed_at=excluded.changed_at', id, enabled ? 1 : 0, revision, c.now))
  c.audit = [{ kind: 'provider-sharing', id, revision, result: enabled ? 'reconnected' : 'disconnected' }]
  return { id, enabled, revision }
 })
}
