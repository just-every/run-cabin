import { books } from './books'
import { themeFrame } from '../../base/theme-frame'
import branding from '../../branding.json'
import { h, owner, manager } from './shared'
import { direct } from './direct'
import { calendar } from './calendar'
import { turnovers } from './turnovers'
import { readiness } from './readiness'
import { maintenance } from './maintenance'
import { statements } from './statements'
import { people } from './people'
import { movein, agent } from './admin'

export async function renderApp(state: any, path: string, extras: { message?: string; error?: string; result?: any; from?: string | null } = {}): Promise<Response> {
  const tab = path.split('/')[2] || (manager(state) ? 'calendar' : 'turnovers')
  const tabs = [...(manager(state) ? [['calendar','Calendar'],['readiness','Readiness']] : []), ['turnovers','Turnovers'], ['maintenance','Maintenance'], ...(manager(state) ? [['direct','Direct bookings'],['statements','Statements'],['books','Books'],['people','Properties & people']] : []), ...(owner(state) ? [['import','Move in'],['agent','Agent access']] : [])]
  const allowed = tabs.some(([key]) => key === tab)
  const frame = await themeFrame({ href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor })
  const content = !allowed ? '<h1>Page unavailable</h1><p>Your role cannot access this page.</p><a href="/app">Open your workspace</a>' : tab === 'books' ? books(state) : tab === 'direct' ? direct(state) : tab === 'calendar' ? calendar(state, extras.from) : tab === 'readiness' ? readiness(state, extras.from) : tab === 'turnovers' ? turnovers(state) : tab === 'maintenance' ? maintenance(state) : tab === 'statements' ? statements(state) : tab === 'people' ? people(state) : tab === 'import' ? movein(state, extras) : agent(state, extras)
  return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(tabs.find(([key]) => key === tab)?.[1] ?? branding.name)} · ${h(branding.name)}</title>${frame.head}<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/cabin.css"><link rel="stylesheet" href="/ops.css"><script src="/cabin.js" defer></script></head><body class="cabin"><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/app">${frame.brand}</a><div class="identity"><span>${h(state.actor.email)}</span><span class="badge">${h(state.actor.role)}</span><a href="/auth/settings/identity">Sign-in settings</a><button type="button" data-signout>Sign out</button></div></header><nav aria-label="Cabin workspace">${tabs.map(([key,label]) => `<a href="/app/${key}" ${key === tab ? 'aria-current="page"' : ''}>${h(label)}</a>`).join('')}</nav><main id="main">${extras.error ? `<div class="notice error" role="alert">${h(extras.error)}</div>` : ''}${extras.message ? `<div class="notice" role="status">${h(extras.message)}</div>` : ''}${content}</main><footer>Cabin · Calendar links sync every 15 to 60 minutes; channel partner APIs come later.</footer></body></html>`, { status: allowed ? 200 : 403, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'referrer-policy':'strict-origin', 'x-content-type-options':'nosniff', 'content-security-policy':`default-src 'self'; ${frame.policy}; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` } })
}
