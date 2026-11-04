import surface from '../../../agent-surface.json'
import type { AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { capabilitySet, offers } from '../../modules/agent-door/capabilities.mjs'
import { describeTool, registry } from '../../modules/agent-door/registry.ts'
import { eventsTool } from '../../modules/agent-door/events.ts'
import type { Runtime } from '../../modules/agent-door/types.ts'

const same = (left: readonly string[], right: readonly string[]) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
const journeyPath = 'src/modules/agent-door/conformance/journey.mjs'

// This is the stable door error reference; native business refusals pass through unchanged.
const errors = [
  ['HeaderMismatch', '400', 'Transport headers disagree with the request.'],
  ['UnsupportedProtocolVersion', '400', 'The response lists supported protocol versions.'],
  ['unauthenticated', '401', 'Missing, expired or revoked authority; includes the resource metadata challenge.'],
  ['insufficient_scope', '403', 'The challenge names the required scope.'],
  ['Origin refused', '403', 'The request Origin differs from this installation.'],
  ['Body too large', '413', 'The MCP request exceeds the body byte limit.'],
  ['rate_limited', '429', 'Per-agent request capacity exceeded; honor Retry-After.'],
  ['tool_not_found', '400', 'The requested tool is not exposed.'],
  ['resource_unavailable', '200', 'Missing and restricted resources have the same refusal.'],
  ['capability_not_declared', '200', 'The requested optional family is not declared.'],
  ...['policy_unset', 'policy_unavailable', 'policy_blocked', 'agents_paused', 'approval_required', 'approval_rejected', 'approval_expired',
    'approval_evidence_changed', 'self_escalation', 'idempotency_key_required', 'idempotency_conflict', 'revision_conflict',
    'invalid_arguments', 'output_invalid', 'owner_required', 'native_access_revoked', 'local_credential_revoked', 'record_not_found']
    .map(code => [code, 'tool refusal', 'No successful effect is reported. Inspect the decision and error metadata.']),
].map(([code, response, meaning]) => ({ code, response, meaning }))

/** Project definitions only. Never call a classifier, a resource reader or a tool. */
export function agentCatalogue(options: AgentDoorOptions, descriptor = surface) {
  const capabilities = capabilitySet(options.capabilities)
  // The built-in polling tool is registered by the door itself when events are declared.
  const tools = [...registry(options).filter(tool => tool.exposure !== 'invoke'),
    ...offers(options.capabilities, 'events') ? [eventsTool({ options } as unknown as Runtime)] : []].sort((a, b) => a.name.localeCompare(b.name))
  if (!same(tools.map(tool => tool.name), descriptor.tools.map(tool => tool.name)) ||
    !same(capabilities.declared, descriptor.capabilities) || options.specialist !== descriptor.specialist) throw new Error('Agent catalogue descriptor drift')
  const templates = offers(options.capabilities, 'resources') ? [...options.resources ?? []].sort((a, b) => a.uriTemplate.localeCompare(b.uriTemplate)) : []
  if (!same(templates.map(resource => resource.uriTemplate), descriptor.resources)) throw new Error('Agent catalogue resource drift')
  const catalogue = tools.map(tool => {
    const declared = descriptor.tools.find(row => row.name === tool.name)!
    if (tool.scope !== declared.scope || tool.readOnly !== declared.readOnly || !same(tool.classes, declared.classes) || !same(tool.clauses, declared.clauses)) throw new Error('Agent catalogue tool metadata drift')
    const steps = descriptor.journey.filter(step => step.tool === tool.name)
    if (steps.some(step => step.expect.some(expected => !tool.classes.includes(expected.class as typeof tool.classes[number])))) throw new Error('Agent catalogue class witness drift')
    const witnesses = tool.classes.map(cls => {
      const matching = steps.filter(step => step.expect.some(expected => expected.class === cls))
      if (!matching.length) throw new Error('Agent catalogue missing class witness')
      return { class: cls, path: journeyPath, steps: matching.map(step => step.id),
        assertions: matching.map(step => `BASE-AGENT-006.2.{phase}.${step.id}`) }
    })
    return { ...describeTool(tool), scope: tool.scope, classes: [...tool.classes], clauses: [...tool.clauses], witnesses }
  })
  return { specialist: options.specialist, capabilities, tools: catalogue,
    resources: templates.map(({ uriTemplate, name, description, mimeType, scope, classes }) => ({ uriTemplate, name, description, mimeType, scope, classes })),
    prompts: offers(options.capabilities, 'prompts') ? (options.prompts ?? []).map(({ name, title, description }) => ({ name, title, description })) : [],
    eventTypes: offers(options.capabilities, 'events') ? ['calendars.prepared', 'turnovers.prepared', 'statements.prepared'] : [], limits: { ...options.limits }, errors,
    notTools: (options.notTools ?? []).map(({ clauses, reason }) => ({ clauses, reason })),
  }
}
export type AgentCatalogue = ReturnType<typeof agentCatalogue>

/** A stranger can locate the documentation using authenticated discovery alone. */
export function catalogueInstructions(catalogue: AgentCatalogue) {
  return `Documentation: /docs/agents. Registered jobs: ${catalogue.tools.map(tool => `${tool.name} (${tool.scope}; ${tool.classes.join(', ')})`).join('; ')}. Only the installation owner can prepare drafts; no provider actions are exposed.`
}
