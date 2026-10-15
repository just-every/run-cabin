import { authResponse, type Bindings } from '../src/auth.server'
import { cabinResponse } from '../src/cabin/http'
export default {
  async fetch(request: Request, env: Bindings) {
    return await authResponse(request, env) ?? await cabinResponse(request, env) ?? new Response('Not found', { status: 404 })
  },
}
