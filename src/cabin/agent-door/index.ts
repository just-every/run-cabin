import { createAgentDoor, type Trust, type AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { principal } from '../credentials'
import { cabinPeople, cabinTeam } from './people'
import { cabinResources } from './records'
import { cabinTools } from './tools'
import { agentDocs } from './docs'
import { agentCatalogue, catalogueInstructions } from './catalogue'

const limits = { requestsPerMinute: 600, maxBodyBytes: 1048576 }

const notTools = [
  { clauses: ['MIGRATE-001', 'MIGRATE-002', 'MIGRATE-003', 'MIGRATE-004', 'MIGRATE-005', 'MIGRATE-006', 'MIGRATE-007'], reason: 'import-door' as const },
  { clauses: ['MOBILE-001'], reason: 'device' as const },
  { clauses: ['INTERFACE-001', 'SITE-002'], reason: 'screen' as const },
  { clauses: ['HTTP-001', 'RUNTIME-001', 'OPEN-001', 'DATA-001'], reason: 'installation' as const },
]

function trust(env: Bindings): Trust | null {
  const issuer = env.RER_OWNER_CLAIM_ISSUER, installationId = env.RER_OWNER_CLAIM_INSTALLATION_ID
  const publicKeys = env.RER_OWNER_CLAIM_PUBLIC_KEYS
  if (![issuer, installationId, publicKeys, env.RER_OWNER_CLAIM_APP_ORIGIN].some(Boolean)) return null
  if (!issuer || !installationId || !publicKeys) throw new Error('Incomplete agent door trust configuration')
  if (env.RER_OWNER_CLAIM_APP_ORIGIN && env.RER_OWNER_CLAIM_APP_ORIGIN !== env.AUTH_ORIGIN) throw new Error('Agent door origin differs from owner claim origin')
  return { issuer, installationId, appOrigin: env.AUTH_ORIGIN, publicKeys: JSON.parse(publicKeys) }
}

export function cabinAgentOptions(original: Bindings): AgentDoorOptions {
  const env = runtimeBindings(original)
  return { seed: 'cabin', name: 'Cabin', specialist: 'rental operations coordinator',
    db: env.DB, origin: env.AUTH_ORIGIN, trust: trust(env), people: cabinPeople(env),
    capabilities: ['tools', 'resources', 'events', 'policy', 'pause', 'audit', 'idempotency'],
    tools: cabinTools(env), resources: cabinResources(env), notTools, limits,
    // Existing local keys retain only the three draft verbs; they cannot gain resource scopes.
    async localCredentials(request) {
      if (!request.headers.get('authorization')?.startsWith('Bearer cabin_')) return null
      try {
        const actor = await principal(request, env, true)
        const key = await env.DB.prepare('SELECT label FROM cb_agent_keys WHERE id=?').bind(actor.keyId).first<{ label: string }>()
        return { sponsor: { id: actor.id }, agent: { id: `cabin-key:${actor.keyId}`, name: key!.label }, scopes: ['drafts:write'] }
      } catch { return null }
    },

  }
}

export function cabinAgentDoor(env: Bindings) {
  const options = cabinAgentOptions(env), door = createAgentDoor(options)
  return { ...door, async handle(request: Request) {
    const response = await door.handle(request)
    if (new URL(request.url).pathname !== '/mcp' || !response?.ok || !response.headers.get('content-type')?.includes('application/json')) return response
    // Discovery and initialize share the public registry projection, never fixture arguments.
    const body = await response.clone().json() as { result?: { instructions?: string } }
    if (typeof body.result?.instructions !== 'string') return response
    body.result.instructions += ' ' + catalogueInstructions(agentCatalogue(options))
    return Response.json(body, { status: response.status, headers: response.headers })
  } }
}

/** Unconfigured installations still serve their native health and installation pages. */
export async function cabinAgentResponse(request: Request, env: Bindings): Promise<Response | null> {
  const path = new URL(request.url).pathname
  if (path === '/docs/agents') return agentDocs(request, cabinAgentOptions(env))
  if (!['/mcp', '/agents', '/api/rer/agent-policy', '/api/rer/agent-decisions', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(path)
    && !path.startsWith('/agents/api/') && !/^\/agents\/approvals\/[^/]+$/.test(path)) return null
  return cabinAgentDoor(env).handle(request)
}

export function cabinBusinessSettings(original: Bindings) {
  const env = runtimeBindings(original)
  const binding = trust(env)
  return createBusinessSettings({ db: env.DB, trust: binding ? { v: 1, issuer: binding.issuer, audience: binding.appOrigin, subject: binding.installationId, email: env.OWNER_EMAIL, keys: binding.publicKeys } : null,
    business: { settings: 1, values: ['display_name'], team: { roles: { admin: 'manager', member: 'cleaner' } } }, team: cabinTeam(env) })
}
