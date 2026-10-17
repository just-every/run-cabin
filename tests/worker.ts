import { authResponse, type Bindings } from '../src/auth.server'
import { cabinResponse } from '../src/cabin/http'
import { directDue } from '../src/cabin/direct/payments'
import { syncDue } from '../src/cabin/channels'
export default {
  async fetch(request: Request, env: Bindings) {
    return await authResponse(request, env) ?? await cabinResponse(request, env) ?? new Response('Not found', { status: 404 })
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    await Promise.all([syncDue(env),directDue(env)])
  },
}
