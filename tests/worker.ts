import { authResponse, type Bindings } from '../src/auth.server'
import { cabinResponse } from '../src/cabin/http'
import { emailHandler } from '../src/cabin/inbox/inbound'
import { runCron } from '../src/cabin/cron'
import { cabinAgentResponse, cabinBusinessSettings } from '../src/cabin/agent-door/index'
export default {
  async fetch(request: Request, env: Bindings) {
    return await cabinBusinessSettings(env).handle(request) ?? await cabinAgentResponse(request, env)
      ?? await authResponse(request, env) ?? await cabinResponse(request, env) ?? new Response('Not found', { status: 404 })
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    await runCron(env)
  },
  async email(message: ForwardableEmailMessage, env: Bindings) { await emailHandler(message, env) },
}
