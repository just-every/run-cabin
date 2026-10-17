import type { Bindings } from '../auth.server'
import { themeFrame } from '../base/theme-frame'
import branding from '../branding.json'
import { mutate, SYSTEM } from './storage'
import { openCase } from './recovery/cases'
import { load } from './storage'
import { homeSettings } from './homes'
import { codeState } from './codes'
import { between, when } from './clock'
import { h } from './ui/shared'
// The guest's stay page: a secret link per stay (the guest code's token) that
// shows the home, the address, check-in and check-out, and the door code with
// the times it works. A cancelled stay's link says so and shows no code.
const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow'}
export async function guestStayResponse(request: Request, env: Bindings) {
 const token = new URL(request.url).pathname.match(/^\/stay\/([0-9a-f]{48})$/)?.[1]
 if (!['GET', 'POST'].includes(request.method) || !token) return new Response('Not found', { status: 404, headers })
 const data = await load(env.DB), code = data.codes.find(r => r.holder === 'guest' && r.link === token)
 const booking = code && data.bookings.find(b => b.id === code.bookingId), home = code && data.properties.find(p => p.id === code.propertyId)
 if (!code || !booking || !home) return new Response('Not found', { status: 404, headers })
 let reported = false
 if (request.method === 'POST') {
  if (request.headers.get('origin') !== env.AUTH_ORIGIN || Number(request.headers.get('content-length') ?? 0) > 8000) return new Response('Request refused', { status: 403, headers })
  const reader = request.body?.getReader(); let source = '', size = 0
  if (reader) { const decoder = new TextDecoder(); try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8000) { await reader.cancel(); return new Response('Problem report is too large', { status: 413, headers }) } source += decoder.decode(value, { stream: true }) } source += decoder.decode() } finally { reader.releaseLock() } }
  const form = new URLSearchParams(source), reason = (form.get('reason') ?? '').trim()
  if (!reason || reason.length > 2000 || code.status !== 'issued' || booking.status !== 'confirmed') return new Response('Enter a problem of up to 2000 characters for your active stay.', { status: 400, headers })
  try { await mutate(env.DB, SYSTEM, 'recovery.guest.report', c => {
   const current = c.data.codes.find(r => r.link === token && r.status === 'issued'), b = current && c.data.bookings.find(b => b.id === current.bookingId && b.status === 'confirmed')
   if (!b) throw new Error('Stay changed')
   const turnover = c.data.turnovers.find(t => t.nextBookingId === b.id && t.status !== 'cancelled') ?? c.data.turnovers.find(t => t.bookingId === b.id && t.status !== 'cancelled')
   if (!turnover) throw new Error('No turnover')
   openCase(c, b, turnover, 'guest_problem', reason)
  }); reported = true } catch { return new Response('Your stay changed. Reload before reporting the problem.', { status: 409, headers }) }
 }
 const s = homeSettings({ data }, home.id), state = codeState(code), frame = await themeFrame({ href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor })
 const body = code.status === 'revoked' ? `<p class="notice">This stay was cancelled, so this door code no longer works. Contact your host with any questions.</p>`
  : `<div class="code-card"><p class="eyebrow">Your door code</p><p class="code">${h(code.code)}</p><p class="chip ${state === 'active' ? 'chip-good' : ''}"><span class="dot"></span>${h(state === 'active' ? 'Active now' : state === 'scheduled' ? 'Not active yet' : 'Expired')}</p><p>Works ${h(between(code.validFrom, code.validUntil))}.</p></div>
   <dl class="facts"><dt>Check in</dt><dd>${h(when(code.validFrom))}</dd><dt>Check out</dt><dd>${h(when(code.validUntil))}</dd><dt>Address</dt><dd>${s.address ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(s.address)}" rel="noreferrer">${h(s.address)}</a>` : 'Your host will send the address.'}</dd></dl>
   <p class="muted">${code.lock.state === 'set' ? 'This code is set on the door lock.' : 'Your host sets this code on the door keypad before you arrive.'}</p>`
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your stay at ${h(home.name)}</title>${frame.head}<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/cabin.css"><link rel="stylesheet" href="/ops.css"></head><body class="cabin guest"><main id="main"><p class="eyebrow">Your stay</p><h1>${h(home.name)}</h1>${body}${reported ? '<p class="notice" role="status">Problem reported. Your host has a recovery case and will follow up.</p>' : ''}${code.status === 'issued' ? '<section class="panel"><h2>Report a problem</h2><p>Your host reviews the problem and approves the response. For an emergency, contact local emergency services.</p><form method="post"><label>What needs attention?<textarea name="reason" rows="4" maxlength="2000" required></textarea></label><button type="submit">Report to your host</button></form></section>' : ''}</main></body></html>`, { headers: { ...headers, 'content-security-policy': `default-src 'self'; ${frame.policy}; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` } })
}
