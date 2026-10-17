import { fail, integer, need } from '../model'

export interface StripeEnv {
 STRIPE_SECRET_KEY?: string
 STRIPE_TEST_SECRET_KEY?: string
 RER_INSTALLATION_ID?: string
 RER_MANAGEMENT_ORIGIN?: string
 MAIL_RELAY_URL?: string
 MAIL_PROVIDER?: string
}

export const MANAGED_STRIPE_LINE = 'Stripe payments, security deposits and identity verification are not available yet on RER Managed hosting because its provider relay is not available yet.'

// Keep the same detection as channels.managedInstall without importing calendar storage.
function managedInstall(env: StripeEnv) {
 if (String(env.MAIL_PROVIDER) === 'rer') return true
 if (!env.RER_INSTALLATION_ID || !env.RER_MANAGEMENT_ORIGIN) return false
 try { return !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.RER_MANAGEMENT_ORIGIN).hostname) } catch { return true }
}

/** Test mode only. No provider request is made on Managed hosting or without a test secret. */
export async function stripe(env: StripeEnv, path: string, method = 'GET', fields?: Record<string, string>, idempotencyKey?: string): Promise<any> {
 need(!managedInstall(env), MANAGED_STRIPE_LINE, 409)
 const key = (env.STRIPE_TEST_SECRET_KEY || env.STRIPE_SECRET_KEY || '').trim()
 need(key.length > 0, 'Configure STRIPE_TEST_SECRET_KEY with a Stripe test secret key before using payments or identity verification.', 503)
 need(/^sk_test_[A-Za-z0-9]+$/.test(key), 'Stripe test mode requires an sk_test_ secret key. Live keys are not accepted.', 503)
 need(/^\/[a-z_]+(?:\/[A-Za-z0-9_]+)*$/.test(path), 'Invalid Stripe API path')
 const url = new URL(`https://api.stripe.com/v1${path}`), verb = method.toUpperCase()
 const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: 'application/json' }
 const form = new URLSearchParams(fields)
 if (verb === 'GET') url.search = form.toString()
 else headers['Content-Type'] = 'application/x-www-form-urlencoded'
 if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
 let response: Response
 try {
  response = await fetch(url, { method: verb, headers, body: verb === 'GET' ? undefined : form.toString(), redirect: 'manual', signal: AbortSignal.timeout(20_000) })
 } catch { return fail('Could not reach Stripe. Check the connection before trying again.', 502) }
 let result: any
 try { result = await response.json() } catch { return fail(`Stripe returned an unreadable response (HTTP ${response.status}).`, 502) }
 if (!response.ok) {
  // Keep provider text out of logs/errors: it can contain email, card or credential input.
  const code = result?.error?.code || result?.error?.type
  const messages: Record<string, string> = {
   authentication_required: 'The saved card needs the guest to authenticate before Stripe can place this deposit hold.',
   card_declined: 'Stripe declined the card. Ask the guest to use another card.',
   expired_card: 'The saved card has expired. Ask the guest to use another card.',
   insufficient_funds: 'Stripe could not authorize the amount because the card has insufficient funds.',
   payment_intent_unexpected_state: 'Stripe cannot perform this action in the payment’s current state. Refresh the stay before continuing.',
   resource_missing: 'Stripe could not find this payment, customer or verification session.',
   idempotency_error: 'Stripe has an earlier request with different parameters. Reconcile the payment in Stripe before requesting a new action.',
   idempotency_key_in_use: 'Stripe is already processing this request. Refresh the stay to check its result.',
  }
  const status = response.status === 401 || response.status === 403 ? 503 : response.status >= 500 ? 502 : response.status
  return fail(messages[code] || (status === 503 ? 'Stripe rejected the test credentials or account permissions. Check the Stripe test configuration.' : `Stripe rejected the request (HTTP ${response.status}). Check the Stripe test account for details.`), status)
 }
 need(result && typeof result === 'object' && !Array.isArray(result), 'Stripe returned an invalid response.', 502)
 need(result.livemode !== true, 'Stripe returned a live-mode object; this integration accepts test mode only.', 502)
 return result
}

function objectPath(resource: string, id: string) {
 need(/^[A-Za-z0-9_]+$/.test(id), 'Invalid Stripe object ID')
 return `/${resource}/${id}`
}
function stayUrl(origin: string, token: string) {
 let url: URL
 try { url = new URL(origin) } catch { return fail('Configure a valid booking origin.', 503) }
 need(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'Configure a valid booking origin.', 503)
 return `${url.origin}/book/stay/${encodeURIComponent(token)}`
}
const requestKey = (env: StripeEnv, operation: string, id: string) => `cabin:${env.RER_INSTALLATION_ID || 'self'}:${operation}:${id}`
const amount = (value: number) => String(integer(value, 'Amount in cents', 1, 99_999_999))

export async function createCheckout(env: StripeEnv, input: { id: string; token: string; origin: string; email: string; amountCents: number; description: string; lines: Array<{ name: string; amountCents: number }> }) {
 amount(input.amountCents)
 need(input.lines.length > 0 && input.lines.length <= 100, 'Checkout requires between 1 and 100 priced lines')
 need(input.lines.every(line => typeof line.name === 'string' && line.name.trim().length > 0 && Number.isSafeInteger(line.amountCents) && line.amountCents >= 0), 'Every checkout line needs a name and a non-negative amount in cents')
 need(input.lines.reduce((total, line) => total + line.amountCents, 0) === input.amountCents, 'Checkout lines must equal the booking total')
 const back = stayUrl(input.origin, input.token)
 const fields: Record<string, string> = {
  mode: 'payment', customer_creation: 'always', customer_email: input.email,
  'payment_method_types[0]': 'card', 'payment_intent_data[setup_future_usage]': 'off_session',
  'metadata[stayId]': input.id, 'payment_intent_data[metadata][stayId]': input.id,
  'payment_intent_data[description]': input.description,
  client_reference_id: input.id, success_url: `${back}?paid=1`, cancel_url: back,
  expires_at: String(Math.ceil(Date.now() / 1000) + 30 * 60),
 }
 input.lines.forEach((line, index) => {
  fields[`line_items[${index}][price_data][currency]`] = 'usd'
  fields[`line_items[${index}][price_data][unit_amount]`] = String(line.amountCents)
  fields[`line_items[${index}][price_data][product_data][name]`] = line.name
  fields[`line_items[${index}][quantity]`] = '1'
 })
 return stripe(env, '/checkout/sessions', 'POST', fields, requestKey(env, 'checkout', input.id))
}

export async function readCheckout(env: StripeEnv, id: string) {
 return stripe(env, objectPath('checkout/sessions', id), 'GET', { 'expand[0]': 'payment_intent' })
}

export async function createDeposit(env: StripeEnv, input: { id: string; customer: string; paymentMethod: string; amountCents: number }) {
 return stripe(env, '/payment_intents', 'POST', {
  amount: amount(input.amountCents), currency: 'usd', customer: input.customer, payment_method: input.paymentMethod,
  capture_method: 'manual', off_session: 'true', confirm: 'true', 'payment_method_types[0]': 'card',
  'metadata[stayId]': input.id, 'metadata[purpose]': 'security_deposit', 'expand[0]': 'latest_charge',
 }, requestKey(env, 'deposit', input.id))
}

export async function readPayment(env: StripeEnv, id: string) {
 return stripe(env, objectPath('payment_intents', id), 'GET', { 'expand[0]': 'latest_charge' })
}

export async function releaseDeposit(env: StripeEnv, id: string) {
 return stripe(env, `${objectPath('payment_intents', id)}/cancel`, 'POST', { cancellation_reason: 'requested_by_customer' }, requestKey(env, 'release', id))
}

export async function captureDeposit(env: StripeEnv, id: string, amountCents: number) {
 return stripe(env, `${objectPath('payment_intents', id)}/capture`, 'POST', { amount_to_capture: amount(amountCents) }, requestKey(env, 'capture-single', id))
}

/** Uses Stripe Identity's real test-mode verification flow, never a local simulated result. */
export async function createIdentity(env: StripeEnv, input: { id: string; token: string; origin: string }) {
 return stripe(env, '/identity/verification_sessions', 'POST', {
  type: 'document', 'metadata[stayId]': input.id, client_reference_id: input.id,
  return_url: stayUrl(input.origin, input.token),
 }, requestKey(env, 'identity', input.id))
}

export async function readIdentity(env: StripeEnv, id: string) {
 return stripe(env, objectPath('identity/verification_sessions', id))
}
