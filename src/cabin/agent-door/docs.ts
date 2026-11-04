import type { AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { themeFrame } from '../../base/theme-frame'
import { h } from '../ui/shared'
import { agentCatalogue, type AgentCatalogue } from './catalogue'

const pretty = (value: unknown) => h(JSON.stringify(value, null, 2))
const style = '.rer-themed main{max-width:1040px}.rer-themed nav ul{display:flex;flex-wrap:wrap;gap:12px 24px;list-style:none;padding:0}.rer-themed section{margin-top:32px}.rer-themed article{border:1px solid var(--rer-border,#64748b);border-radius:12px;padding:20px;margin:16px 0}.rer-themed pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.6}.rer-themed code{overflow-wrap:anywhere;font-size:14px}.rer-themed summary{cursor:pointer;padding:12px 0;font-weight:600}.rer-themed h2{font-size:24px}.rer-themed h3{font-size:19px}.rer-themed body{font-size:16px}.rer-themed li{margin:8px 0}.rer-themed dd{overflow-wrap:anywhere}@media(max-width:480px){.rer-themed article{padding:16px}.rer-themed dl{grid-template-columns:1fr;gap:4px}.rer-themed dd{margin-bottom:12px}}'

/** Only static catalogue fields reach this document; even descriptor fixture arguments are excluded. */
export async function renderAgentDocs(catalogue: AgentCatalogue) {
  const frame = await themeFrame({ href: '/rer-theme.css', productName: 'Cabin' })
  const content = `<a href="#catalogue">Skip to tool catalogue</a><header>${frame.brand}<h1>Agent documentation</h1><p>Specialist: ${h(catalogue.specialist)}.</p>
<p>This is the installation's registered surface. Authenticated MCP listings require a complete company policy; scopes, current native visibility and policy still control every call.</p>
<p>Only the installation owner may prepare calendar, turnover and statement drafts. Preparation cannot approve, publish, sign, send, pay or change roles. Public documentation grants no action authority.</p></header>
<nav aria-label="Documentation sections"><ul>${[['catalogue','Tools'],['resources','Resources'],['boundaries','Capabilities'],['limits','Capacity'],['errors','Errors']].map(([id,label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></nav>
<section id="catalogue"><h2>Tools by job</h2>${catalogue.tools.map(tool => `<article data-tool="${h(tool.name)}"><h3>${h(tool.title)}</h3><p><code>${h(tool.name)}</code></p><p>${h(tool.description)}</p>
<dl><dt>Scope</dt><dd>${h(tool.scope)}</dd><dt>Classes</dt><dd>${h(tool.classes.join(', '))}</dd><dt>Effect</dt><dd>${tool.annotations.readOnlyHint ? 'Read only' : 'Internal draft preparation'}</dd><dt>Contract clauses</dt><dd>${h(tool.clauses.join(', '))}</dd></dl>
<details><summary>Input and output schemas</summary><h4>Input</h4><pre data-input>${pretty(tool.inputSchema)}</pre><h4>Output</h4><pre data-output>${pretty(tool.outputSchema)}</pre></details>
<details><summary>Class journey witnesses</summary><ul>${tool.witnesses.map(witness => `<li data-class="${h(witness.class)}"><strong>${h(witness.class)}</strong>: <code>${h(witness.path)}</code>, journey steps ${h(witness.steps.join(', '))}. Assertions: ${witness.assertions.map(assertion => `<code>${h(assertion)}</code>`).join(', ')}.</li>`).join('')}</ul><p>The descriptor supplies expected classes; the journey compares them with actual computed decisions under autonomous and held policies. A witness identifies proof to run, not a guarantee that every wider conformance point is complete.</p></details></article>`).join('')}</section>
<section id="resources"><h2>Declared resources</h2><p>JSON records reapply current role and property visibility. Imported text is untrusted. Active capabilities and credentials are omitted. Missing and restricted records receive the same refusal.</p>${catalogue.resources.map(resource => `<article data-resource="${h(resource.uriTemplate)}"><h3>${h(resource.name)}</h3><p><code>${h(resource.uriTemplate)}</code></p><p>${h(resource.description)}</p><p>Scope: ${h(resource.scope)}. Classes: ${h(resource.classes.join(', '))}. Format: ${h(resource.mimeType)}.</p></article>`).join('') || '<p>No public resource templates are declared.</p>'}</section>
<section id="boundaries"><h2>Capabilities and omissions</h2><dl><dt>Declared</dt><dd>${h(catalogue.capabilities.declared.join(', '))}</dd><dt>Not declared</dt><dd>${h(catalogue.capabilities.refused.join(', ') || 'None')}</dd><dt>Wider families without complete conformance proof</dt><dd>${h(catalogue.capabilities.unscoped.join(', '))}</dd></dl>
<h3>Prompts</h3>${catalogue.prompts.length ? `<ul>${catalogue.prompts.map(prompt => `<li>${h(prompt.name)}: ${h(prompt.description)}</li>`).join('')}</ul>` : '<p>No specialist prompts are declared.</p>'}
<h3>Event types</h3>${catalogue.eventTypes.length ? `<p>${catalogue.eventTypes.map(type => `<code>${h(type)}</code>`).join(', ')}.</p><p>Retained polling requires events:read. Record events and live record subscriptions also require records:read and current native visibility. Removed or restricted records are withheld. Signed webhooks and complete policy decision metadata remain unavailable.</p>` : '<p>No public event types are declared.</p>'}
<p>Grant byte budgets and file-byte accounting remain unavailable in the current Base door. Provider spend reservation is not enforced; the declared journey spends nothing. No provider actions, hosted deployment proof or full rental-surface conformance is claimed.</p>
<h3>Jobs outside tools</h3><ul>${catalogue.notTools.map(item => `<li>${h(item.clauses.join(', '))}: ${h(item.reason)}</li>`).join('')}</ul></section>
<section id="limits"><h2>Installation capacity</h2><dl><dt>Requests per minute per agent</dt><dd data-limit="requestsPerMinute">${h(catalogue.limits.requestsPerMinute)}</dd><dt>MCP request body bytes</dt><dd data-limit="maxBodyBytes">${h(catalogue.limits.maxBodyBytes)}</dd></dl><p>These protect request rate and size. They are separate from company business policy. Per-field bounds are in the tool schemas above.</p></section>
<section id="errors"><h2>Supported errors</h2><p>Tool refusals use stable error metadata. Native business validation codes pass through unchanged; transport responses and resource refusals may instead use JSON-RPC errors.</p><ul>${catalogue.errors.map(error => `<li><code>${h(error.code)}</code> (${h(error.response)}): ${h(error.meaning)}</li>`).join('')}</ul></section>`
  const digest = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(style)))))
  return { html: `<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent documentation · Cabin</title>${frame.head}<style>${style}</style></head><body><main>${content}</main></body></html>`,
    policy: `default-src 'none'; ${frame.policy.replace("style-src 'self'", `style-src 'self' 'sha256-${digest}'`)}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` }
}

export async function agentDocs(request: Request, options: AgentDoorOptions) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD', 'cache-control': 'no-store' } })
  const { html, policy } = await renderAgentDocs(agentCatalogue(options))
  return new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'content-security-policy': policy, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } })
}
