import { sharingAllowed } from '../connections/guard'
import { fail, integer, need } from '../model'
import { savedKey,type StripeMode } from './provider-store'

export interface StripeEnv {
 CABIN_PROVIDER_PROPERTY_ID?:string
 DB?: D1Database
 SESSION_SECRET?: string
 DIRECT_STRIPE_MODE?: StripeMode
 DIRECT_STRIPE_KEY?: string
 STRIPE_SECRET_KEY?: string
 STRIPE_TEST_SECRET_KEY?: string
 RER_INSTALLATION_ID?: string
 RER_MANAGEMENT_ORIGIN?: string
 MAIL_RELAY_URL?: string
 MAIL_PROVIDER?: string
}

/** The Stripe API version every Cabin request is written and tested against, whatever the account's default.
 * This version removed payment_method_types; Cabin names its one method, card, with allowed_payment_method_types:
 * a card can be saved for the damage hold, held with manual capture, and reports when that hold expires.
 * https://docs.stripe.com/changelog/endive/2026-09-30/remove-payment-method-types-checkout-sessions */
export const STRIPE_VERSION = '2026-09-30.endive'
export const CARD_ONLY = { 'allowed_payment_method_types[0]': 'card' }

export const MANAGED_STRIPE_LINE = 'Stripe payments, security deposits and identity verification are not available yet on RER Managed hosting because there is no outbound Stripe connection or provider relay.'

// Keep the same detection as channels.managedInstall without importing calendar storage.
function managedInstall(env: StripeEnv) {
 if (String(env.MAIL_PROVIDER) === 'rer') return true
 if (!env.RER_INSTALLATION_ID || !env.RER_MANAGEMENT_ORIGIN) return false
 try { return !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.RER_MANAGEMENT_ORIGIN).hostname) } catch { return true }
}

/** Stripe and key problems are the host's to fix: errors carry host:true so guest pages word them for the guest instead. */
const hostSide=async<T>(work:()=>Promise<T>):Promise<T>=>{try{return await work()}catch(error){throw Object.assign(error as Error,{host:true})}}
export const stripeCredentials=(env:StripeEnv)=>hostSide(()=>credentials(env))
async function credentials(env:StripeEnv){
 const saved=await savedKey(env,env.DIRECT_STRIPE_MODE)
 const selected=env.DIRECT_STRIPE_MODE??saved?.mode
 const key=(env.DIRECT_STRIPE_KEY??saved?.key??(selected==='live'?env.STRIPE_SECRET_KEY:selected==='test'?env.STRIPE_TEST_SECRET_KEY:(env.STRIPE_TEST_SECRET_KEY||env.STRIPE_SECRET_KEY))??'').trim()
 need(!saved?.stored||saved.key||env.DIRECT_STRIPE_KEY,'The saved Stripe key cannot be opened. Enter it again in Direct bookings.',503)
 need(/^sk_(test|live)_[A-Za-z0-9]+$/.test(key),'Connect Stripe in Direct bookings with a secret key from your Stripe dashboard.',503)
 const mode:StripeMode=key.startsWith('sk_live_')?'live':'test'
 need(!selected||selected===mode,'Connect the Stripe key for this booking’s payment mode in Direct bookings.',503)
 return {key,mode}
}
/** Provider calls use the selected installation key; Managed hosting fails before egress. */
export const stripe = (env: StripeEnv, path: string, method = 'GET', fields?: Record<string, string>, idempotencyKey?: string): Promise<any> => hostSide(() => call(env, path, method, fields, idempotencyKey))
async function call(env: StripeEnv, path: string, method: string, fields?: Record<string, string>, idempotencyKey?: string): Promise<any> {
 need(!managedInstall(env), MANAGED_STRIPE_LINE, 409)
 const action=(path.startsWith('/identity/')?'identity:':'payment:')+(method.toUpperCase()==='GET'?'read':'write')
 let propertyId=env.CABIN_PROVIDER_PROPERTY_ID
 if(!propertyId&&env.DB){const reference=fields?.['metadata[stayId]']??fields?.client_reference_id??path.split('/').find(part=>/^(cs_|pi_|vs_)/.test(part))??path.split('/').at(-1);const row=await env.DB.prepare("SELECT property_id FROM cb_direct_stays WHERE id=? OR json_extract(data,'$.checkoutId')=? OR json_extract(data,'$.paymentId')=? OR json_extract(data,'$.deposit.id')=? OR json_extract(data,'$.identity.id')=? LIMIT 1").bind(reference,reference,reference,reference,reference).first<{property_id:string}>();propertyId=row?.property_id;if(!propertyId){const v=await env.DB.prepare("SELECT property_id FROM cb_verifications WHERE id=? OR booking_id=? OR json_extract(data,'$.provider.id')=? LIMIT 1").bind(reference,fields?.['metadata[bookingId]']??reference,reference).first<{property_id:string}>();propertyId=v?.property_id}}
 const {key,mode}=await credentials(env)
 need(/^\/[a-z_]+(?:\/[A-Za-z0-9_]+)*$/.test(path), 'Invalid Stripe API path')
 const url = new URL(`https://api.stripe.com/v1${path}`), verb = method.toUpperCase()
 const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Stripe-Version': STRIPE_VERSION }
 const form = new URLSearchParams(fields)
 if (verb === 'GET') url.search = form.toString()
 else headers['Content-Type'] = 'application/x-www-form-urlencoded'
 if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
 let response: Response
 await sharingAllowed(env.DB, 'stripe',action,propertyId)
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
  return fail(messages[code] || (status === 503 ? 'Stripe rejected the credentials or account permissions. Check the connected key in Direct bookings.' : `Stripe rejected the request (HTTP ${response.status}). Its reason is in your Stripe Dashboard under Developers → Logs.`), status)
 }
 need(result && typeof result === 'object' && !Array.isArray(result), 'Stripe returned an invalid response.', 502)
 need(typeof result.livemode!=='boolean'||result.livemode===(mode==='live'),'Stripe returned an object from a different payment mode.',502)
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

export async function createCheckout(env: StripeEnv, input: { id: string; attempt?: string; token: string; origin: string; email: string; amountCents: number; description: string; lines: Array<{ name: string; amountCents: number }> }) {
 amount(input.amountCents)
 need(input.lines.length > 0 && input.lines.length <= 100, 'Checkout requires between 1 and 100 priced lines')
 need(input.lines.every(line => typeof line.name === 'string' && line.name.trim().length > 0 && Number.isSafeInteger(line.amountCents) && line.amountCents >= 0), 'Every checkout line needs a name and a non-negative amount in cents')
 need(input.lines.reduce((total, line) => total + line.amountCents, 0) === input.amountCents, 'Checkout lines must equal the booking total')
 const back = stayUrl(input.origin, input.token)
 const fields: Record<string, string> = {
  mode: 'payment', customer_creation: 'always', customer_email: input.email, ...CARD_ONLY,
  'payment_intent_data[setup_future_usage]': 'off_session',
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
 return stripe(env, '/checkout/sessions', 'POST', fields, requestKey(env, 'checkout', input.attempt ?? input.id))
}

export async function readCheckout(env: StripeEnv, id: string) {
 return stripe(env, objectPath('checkout/sessions', id), 'GET', { 'expand[0]': 'payment_intent' })
}

export async function createDeposit(env: StripeEnv, input: { id: string; customer: string; paymentMethod: string; amountCents: number; attempt?:string }) {
 return stripe(env, '/payment_intents', 'POST', {
  amount: amount(input.amountCents), currency: 'usd', customer: input.customer, payment_method: input.paymentMethod,
  capture_method: 'manual', off_session: 'true', confirm: 'true', ...CARD_ONLY,
  'metadata[stayId]': input.id, 'metadata[purpose]': 'security_deposit', 'expand[0]': 'latest_charge',
 }, requestKey(env, 'deposit', input.attempt??input.id))
}

export async function readPayment(env: StripeEnv, id: string) {
 return stripe(env, objectPath('payment_intents', id), 'GET', { 'expand[0]': 'latest_charge' })
}

export async function releaseDeposit(env: StripeEnv, id: string, attempt?:string) {
 return stripe(env, `${objectPath('payment_intents', id)}/cancel`, 'POST', { cancellation_reason: 'requested_by_customer' }, requestKey(env, 'release', attempt??id))
}

export async function captureDeposit(env: StripeEnv, id: string, amountCents: number, attempt?:string) {
 return stripe(env, `${objectPath('payment_intents', id)}/capture`, 'POST', { amount_to_capture: amount(amountCents) }, requestKey(env, 'capture-single', attempt??id))
}

export function createRefund(env:StripeEnv,input:{id:string;stayId:string;paymentId:string;amountCents:number}){
 return stripe(env,'/refunds','POST',{payment_intent:input.paymentId,amount:amount(input.amountCents),reason:'requested_by_customer','metadata[stayId]':input.stayId,'metadata[cabinRefundId]':input.id},requestKey(env,'refund',input.id))
}
export function readRefund(env:StripeEnv,id:string){return stripe(env,objectPath('refunds',id))}
/** Search all pages, including after Stripe's idempotency retention window. Never blindly resubmit an uncertain refund. */
export async function paymentRefunds(env:StripeEnv,paymentId:string){
 const rows:any[]=[];let after=''
 for(;;){const page=await stripe(env,'/refunds','GET',{payment_intent:paymentId,limit:'100',...(after?{starting_after:after}:{})});need(Array.isArray(page.data),'Stripe returned an invalid refund list',502);rows.push(...page.data);if(!page.has_more)return rows;need(page.data.length&&page.data.at(-1).id!==after,'Stripe refund pagination did not advance',502);after=page.data.at(-1).id}
}

/** Uses Stripe Identity's hosted verification flow. */
export async function createIdentity(env: StripeEnv, input: { id: string; token: string; origin: string }) {
 return stripe(env, '/identity/verification_sessions', 'POST', {
  type: 'document', 'metadata[stayId]': input.id, client_reference_id: input.id,
  return_url: stayUrl(input.origin, input.token),
 }, requestKey(env, 'identity', input.id))
}

export async function readIdentity(env: StripeEnv, id: string) {
 return stripe(env, objectPath('identity/verification_sessions', id))
}

export async function createDepositCheckout(env:StripeEnv,input:{id:string;attempt:string;token:string;origin:string;customer:string;amountCents:number}){
 const back=stayUrl(input.origin,input.token)
 return stripe(env,'/checkout/sessions','POST',{
  mode:'payment',customer:input.customer,...CARD_ONLY,
  'payment_intent_data[capture_method]':'manual','payment_intent_data[setup_future_usage]':'off_session',
  'metadata[stayId]':input.id,'metadata[purpose]':'security_deposit',
  'payment_intent_data[metadata][stayId]':input.id,'payment_intent_data[metadata][purpose]':'security_deposit',
  'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':amount(input.amountCents),
  'line_items[0][price_data][product_data][name]':'Refundable damage authorization','line_items[0][quantity]':'1',
  success_url:back+'?deposit=1',cancel_url:back,
 },requestKey(env,'deposit-checkout',input.attempt))
}
