import { withDemo } from './modules/demo/index.mjs'
import { rejectedResponse } from './base/rejected-response'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { authResponse, runtimeBindings, type Bindings } from './auth.server'
import { identity } from './identity'
import { cabinResponse } from './cabin/http'
import { directDue } from './cabin/direct/payments'
import { syncDue } from './cabin/channels'
import { settle } from './cabin/settle'
import { emailHandler, pollChannels } from './cabin/inbox/inbound'
import { seedDemo } from './demo'

const api = new Hono<{ Bindings: Bindings }>()
api.get('/health', (context) => context.json({ status: 'ok', ...deploymentHealth(context.env) }))

// Start documents keep their own cache policy and add no-transform, so no proxy
// rewrites the HTML React hydrates (Cloudflare's email address obfuscation
// honours it; src/base/hydration/README.md).
function noTransform(response: Response): Response {
  const headers = new Headers(response.headers), policy = headers.get('cache-control')
  headers.set('cache-control', policy ? `${policy}, no-transform` : 'no-transform')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default withDemo<Bindings, ExportedHandler<Bindings>>({
  async fetch(request, env, execution) {
    const asset = await staticAssetResponse(request, env)
    if (asset) return asset
    // Sign-in settings open inside the workspace (/app/signin); Base still saves them.
    const { pathname } = new URL(request.url)
    if (pathname === '/auth/settings/identity' && request.method === 'GET' && /text\/html/.test(request.headers.get('accept') ?? '')) return new Response(null, { status: 303, headers: { location: '/app/signin' } })
    const auth = await authResponse(request, env)
    if (auth) return auth
    const cabin = await cabinResponse(request, env)
    if (cabin) return cabin
    // The installed variant: the Lobby at / and the public claim state it reads.
    // Local dev serves the saved origin's data at its own port (RER_DEV_ORIGIN).
    const state = await setupStateResponse(request, runtimeBindings(env))
    if (state) return state
    const lobby = await lobbyResponse(request, runtimeBindings(env), identity)
    if (lobby) return lobby
    return rejectedResponse(request, await dispatch(request, () => api.fetch(request, env, execution), async () => noTransform(await start.fetch(request))))
  },
  // Cron polls every connected channel calendar whose interval is due (SYNC-009),
  // then sends turnover emails, pushes door codes the new stays made (OPS-001, OPS-005)
  // and sends the guest messages that have fallen due (MESSAGE-003).
  async scheduled(_controller, env, execution) {
    execution.waitUntil(Promise.all([syncDue(runtimeBindings(env)),directDue(runtimeBindings(env)),pollChannels(runtimeBindings(env)).catch(error => console.error('Cabin channel messages', error.message))]).then(() => settle(runtimeBindings(env))))
  },
  // Cloudflare Email Routing delivers the inbox address here: guest email and replies (MESSAGE-001).
  async email(message, env) {
    await emailHandler(message, runtimeBindings(env))
  },
} satisfies ExportedHandler<Bindings>, { seed: seedDemo })
