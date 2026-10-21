import { reports } from '../reports/ui'
import type { Report } from '../reports/read'
import { taxes } from '../taxes/ui'
import { guests } from '../guests/ui'
import { recoverySetup } from '../recovery/setup'
import { activity } from './activity'
import { ledger } from './ledger'
import { books } from './books'
import { themeFrame } from '../../base/theme-frame'
import branding from '../../branding.json'
import { h, owner, manager } from './shared'
import { direct } from './direct'
import { calendar } from './calendar'
import { reservations } from './requests'
import { channelPage } from './channels'
import { turnovers } from './turnovers'
import { readiness } from './readiness'
import { maintenance } from './maintenance'
import { statements } from './statements'
import { people } from './people'
import { movein, agent } from './admin'
import { inbox } from './inbox'
import { threads } from '../inbox/threads'
import { icon } from './icons'
import { recovery } from './recovery'

export interface Extras { report?:Report; activity?:any; activityParams?:URLSearchParams; identity?: { idpSignIn?: boolean } | null; message?: string; error?: string; result?: any; from?: string | null; thread?: string | null; days?: string | null; home?: string | null; channel?: string | null; reservation?: string | null; request?: string | null }
// The workspace shell: the left rail (brand, home switcher, the pages this
// role may open, the signed-in person and calendar sync), then the page.
// Below 900px the rail folds into a top bar whose menu opens without script.
function tabsFor(s: any): [string, string][][] {
  if (!manager(s)) return [[['turnovers', 'Turnovers'], ...(s.actor.role === 'cleaner' ? [['recovery', 'Stay recovery']] as [string, string][] : []), ['maintenance', 'Maintenance']]]
  return [
    [['calendar', 'Calendar'], ['inbox', 'Inbox'], ['guests', 'Guests'], ['reservations', 'Reservations'], ['readiness', 'Readiness'], ['turnovers', 'Turnovers'], ['recovery', 'Stay recovery'], ['maintenance', 'Maintenance']],
    [['reports', 'Reports'], ['direct', 'Direct bookings'], ['statements', 'Statements'], ['books', 'Books'], ['taxes', 'Lodging taxes'], ['ledger', 'Trust ledger'], ['activity', 'Activity']],
    [['channels', 'Channels'], ['people', 'Properties & people'], ...(owner(s) ? [['import', 'Move in'], ['agent', 'Agent access']] as [string, string][] : [])],
  ]
}
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago` }
/** The rail's sync line: calendar links Cabin polls, else the last approved calendar file. */
function syncLine(s: any): [string, string] {
  const links = s.connections ?? [], failing = links.filter((r: any) => r.status === 'stale').length
  if (failing) return ['bad', `${failing} calendar link${failing === 1 ? '' : 's'} failing`]
  const last = links.map((r: any) => r.lastSuccessAt).filter(Boolean).sort().at(-1)
  if (last) return ['good', `Synced ${ago(last)}`]
  if (links.length) return ['wait', 'Waiting for first sync']
  const file = (s.feeds ?? []).map((f: any) => f.approvedAt).filter(Boolean).sort().at(-1)
  return file ? ['good', `Calendar file approved ${ago(file)}`] : ['', 'No calendar links yet']
}
function rail(s: any, tab: string, brand: string) {
  const drafts = manager(s) ? threads(s).filter(t => t.drafts).length : 0
  const groups = tabsFor(s).map(group => `<div class="nav-group">${group.map(([key, label]) => `<a href="/app/${key}"${key === tab ? ' aria-current="page"' : ''}>${icon(key === 'guests' ? 'people' : key === 'ledger' || key === 'taxes' ? 'books' : key === 'activity' || key === 'reports' ? 'statements' : key)}<span>${h(label)}</span>${key === 'inbox' && drafts ? `<b class="count" title="${drafts} drafted repl${drafts === 1 ? 'y' : 'ies'} waiting">${drafts}</b>` : ''}</a>`).join('')}</div>`).join('')
  const homes = manager(s) && s.properties.length ? `<details class="switcher"><summary>${icon('home')}<span>${s.properties.length === 1 ? h(s.properties[0].name) : `All ${s.properties.length} homes`}</span></summary><div class="switcher-list"><a href="/app/calendar">All homes</a>${s.properties.map((p: any) => `<a href="/app/calendar?home=${encodeURIComponent(p.id)}">${h(p.name)}</a>`).join('')}</div></details>` : ''
  const me = s.members.find((m: any) => m.id === s.actor.memberId)?.name ?? s.actor.email, initials = String(me).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const [tone, sync] = syncLine(s)
  return `<aside class="rail" aria-label="Workspace"><div class="rail-top"><a class="logo" href="/app">${brand}</a><input type="checkbox" id="rail-menu" class="rail-toggle"><label for="rail-menu" class="rail-menu">${icon('menu')}<span>Menu</span></label></div>
  <div class="rail-body">${homes}<nav aria-label="Cabin workspace">${groups}</nav>
  <div class="me"><span class="avatar" aria-hidden="true">${h(initials)}</span><div class="me-text"><strong title="${h(s.actor.email)}">${h(me)}</strong><span class="role">${h(s.actor.role)}</span>${manager(s) ? `<span class="sync ${tone}"><i></i>${h(sync)}</span>` : ''}</div>
  <div class="me-links">${owner(s) ? `<a href="/app/signin"${tab === 'signin' ? ' aria-current="page"' : ''}>${icon('settings')}<span>Sign-in settings</span></a>` : ''}<button type="button" data-signout>${icon('signout')}<span>Sign out</span></button></div></div></div></aside>`
}
/** The owner's sign-in settings, saved by Base's own form handler. */
function signInPage(identity: Extras['identity']) {
  const lead = '<div class="page-heading"><p class="eyebrow">Workspace</p><h1>Sign-in settings</h1><p>How the people you invite sign in. Email links always work for the owner.</p></div>'
  if (!identity) return lead + '<section class="panel"><p class="empty">Sign-in settings could not be read for this session. Sign in again and reopen this page.</p></section>'
  return lead + `<section class="panel narrow"><h2>Identity provider</h2><p>Allow invited people to sign in through your linked identity provider. Email links remain available to the owner.</p><form action="/auth/settings/identity" method="post"><input type="hidden" name="setting" value="identity"><label class="check"><input type="checkbox" name="idpSignIn" value="true"${identity.idpSignIn ? ' checked' : ''}> Allow provider sign-in</label><div class="actions"><button type="submit">Save settings</button></div></form></section>`
}
export async function renderApp(state: any, path: string, extras: Extras = {}): Promise<Response> {
  const tab = path.split('/')[2] || (manager(state) ? 'calendar' : 'turnovers')
  const tabs = tabsFor(state).flat()
  const allowed = tabs.some(([key]) => key === tab) || (tab === 'signin' && owner(state))
  const frame = await themeFrame({ href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor })
  const pages: Record<string, () => string> = { reports: () => reports(extras.report!,state.properties), taxes: () => taxes(state,extras.result), guests: () => guests(state,extras.result), signin: () => signInPage(extras.identity), recovery: () => path === '/app/recovery/setup' && manager(state) ? recoverySetup(state) : recovery(state), inbox: () => inbox(state, extras.thread), activity: () => activity(state,extras.activity??{events:[],next:null},extras.activityParams??new URLSearchParams()), ledger: () => ledger(state), books: () => books(state), direct: () => direct(state), calendar: () => calendar(state, extras), reservations: () => reservations(state, extras.request), channels: () => channelPage(state,extras.result), readiness: () => readiness(state, extras.from), turnovers: () => turnovers(state), maintenance: () => maintenance(state), statements: () => statements(state), people: () => people(state), import: () => movein(state, extras), agent: () => agent(state, extras) }
  const content = !allowed ? '<div class="page-heading"><h1>Page unavailable</h1><p>Your role cannot access this page.</p></div><p><a class="button" href="/app">Open your workspace</a></p>' : pages[tab]()
  return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(tab === 'signin' ? 'Sign-in settings' : tabs.find(([key]) => key === tab)?.[1] ?? branding.name)} · ${h(branding.name)}</title>${frame.head}<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/cabin.css"><link rel="stylesheet" href="/calendar.css"><link rel="stylesheet" href="/ops.css"><link rel="stylesheet" href="/inbox.css"><link rel="stylesheet" href="/movein.css"><link rel="stylesheet" href="/recovery.css"><link rel="stylesheet" href="/ledger.css"><link rel="stylesheet" href="/activity.css"><script src="/cabin.js" type="module"></script></head><body class="cabin" data-person="${h(state.actor.id)}" data-page="${h(path)}${extras.thread ? '?thread=' + encodeURIComponent(extras.thread) : ''}"><a class="skip" href="#main">Skip to content</a><div class="shell">${rail(state, tab, frame.brand)}<div class="work"><main id="main" class="page-${h(tab)}">${extras.error ? `<div class="notice error" role="alert">${h(extras.error)}</div>` : ''}${extras.message ? `<div class="notice" role="status">${h(extras.message)}</div>` : ''}${content}</main><footer>Cabin · Calendar links sync every 15 to 60 minutes; channel partner APIs come later.</footer></div></div></body></html>`, { status: allowed ? 200 : 403, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'referrer-policy':'strict-origin', 'x-content-type-options':'nosniff', 'content-security-policy':`default-src 'self'; ${frame.policy.replace("img-src 'self'", "img-src 'self' blob:")}; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'` } })
}
