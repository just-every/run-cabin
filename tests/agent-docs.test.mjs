import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { docsHarness, readDocs, surface } from './agent-docs-support.mjs'
import { autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { runJourney } from '../src/modules/agent-door/conformance/journey.mjs'

const method = (...parts) => parts.join('/')
test('Public agent documentation matches MCP and computed class journeys without disclosing native data', { timeout: 120000 }, async t => {
  const { h, c, privateValues } = await docsHarness()
  try {
    const before = await h.state()
    const response = await h.send('/docs/agents?synthetic-cabin-1=untrusted', undefined, '', { authorization: 'Bearer synthetic-cabin-2' })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /text\/html/)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
    assert.match(response.headers.get('content-security-policy'), /form-action 'none'/)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal((await h.send('/docs/agents', undefined, h.owner)).text, response.text)
    for (const value of [...privateValues, 'synthetic-cabin-2']) assert.ok(!response.text.includes(value), 'No native or credential value enters public documentation')
    assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(response.text))
    assert.deepEqual(await h.state(), before, 'Documentation has no native effects')
    const head = await h.mf.dispatchFetch(h.origin + '/docs/agents', { method: 'HEAD' })
    assert.equal(head.status, 200); assert.equal(await head.text(), '')
    const post = await h.send('/docs/agents', {})
    assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD')
    const docs = readDocs(response.text)
    for (const [phase, policy] of [['autonomous', autonomousPolicy()], ['held', heldPolicy()]]) {
      await c.adopt(policy)
      const listed = await c.mcp(method('tools', 'list'))
      const templates = await c.mcp(method('resources', 'templates', 'list'))
      const discover = await c.mcp(method('server', 'discover'))
      assert.equal(listed.status, 200); assert.ok(listed.result.tools.length)
      assert.deepEqual(docs.tools.map(tool => tool.name), listed.result.tools.map(tool => tool.name))
      assert.deepEqual(docs.resources, templates.result.resourceTemplates.map(resource => resource.uriTemplate))
      for (const tool of listed.result.tools) {
        const documented = docs.tools.find(row => row.name === tool.name)
        assert.deepEqual(documented.inputSchema, tool.inputSchema)
        assert.deepEqual(documented.outputSchema, tool.outputSchema)
        assert.equal(documented.scope, tool._meta['com.runeditrun/scope'])
        assert.deepEqual(documented.classes, tool._meta['com.runeditrun/classes'])
        for (const cls of documented.classes) {
          const steps = surface.journey.filter(step => step.tool === tool.name && step.expect.some(expected => expected.class === cls))
          assert.ok(steps.length, `${tool.name} has a nonempty class witness`)
          for (const step of steps) assert.ok(documented.html.includes(`BASE-AGENT-006.2.{phase}.${step.id}`))
        }
      }
      const initialized = await c.mcp('initialize', { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'synthetic-cabin-1', version: '1' } })
      assert.equal(initialized.status, 200)
      assert.equal(initialized.result.instructions, discover.result.instructions)
      assert.ok(discover.result.instructions.includes('/docs/agents'))
      for (const tool of docs.tools) assert.ok(discover.result.instructions.includes(`${tool.name} (${tool.scope}; ${tool.classes.join(', ')})`))
      for (const value of privateValues) assert.ok(!discover.result.instructions.includes(value))
      const metadata = discover.result._meta
      for (const [key, value] of Object.entries(metadata['com.runeditrun/limits'])) assert.ok(response.text.includes(`data-limit="${key}">${value}</dd>`))
      for (const value of metadata['com.runeditrun/capabilities'].refused) assert.ok(response.text.includes(value))
      c.listed = new Map(listed.result.tools.map(tool => [tool.name, tool]))
      await runJourney(c, phase, { held: phase === 'held' })
      assert.deepEqual(c.points.filter(point => !point.ok), [], 'Every documented class is checked against a real MCP decision')
      for (const tool of docs.tools) for (const cls of tool.classes) assert.ok(surface.journey.some(step => step.tool === tool.name && step.expect.some(expected => expected.class === cls)
        && c.points.some(point => point.ok && point.id === `BASE-AGENT-006.2.${phase}.${step.id}`)))
      assert.equal((await h.send('/docs/agents')).text, response.text, 'Public metadata is independent of policy and private effects')
    }
    t.diagnostic('PROBE BASE-AGENT-013 1: GET /docs/agents and authenticated MCP listings under autonomous and held policies -> exact tool names, schemas, scopes, templates and capacity; no private values')
    t.diagnostic('PROBE BASE-AGENT-013 2: declared specialist journey under both policies -> every documented class witness matches its actual nonempty native decision')

    // Exercise the same public renderer with changed definitions at the metadata edge.
    const bundled = await build({ stdin: { contents: "export { cabinAgentOptions } from './src/cabin/agent-door/index.ts'; export { agentCatalogue } from './src/cabin/agent-door/catalogue.ts'; export { agentDocs } from './src/cabin/agent-door/docs.ts'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', external: ['cloudflare:*'] })
    const { cabinAgentOptions, agentCatalogue, agentDocs } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
    const options = () => cabinAgentOptions({ AUTH_ORIGIN: 'https://synthetic-cabin.example', DB: { prepare() { throw Error('Documentation must never query private state') } } })
    const missing = structuredClone(surface); missing.tools.pop()
    assert.throws(() => agentCatalogue(options(), missing), /descriptor drift/)
    const changed = options(); changed.tools[0].scope = 'synthetic-cabin-3'
    assert.throws(() => agentCatalogue(changed), /metadata drift/)
    const noWitness = structuredClone(surface); noWitness.journey = noWitness.journey.filter(step => step.tool !== noWitness.tools[0].name)
    assert.throws(() => agentCatalogue(options(), noWitness), /missing class witness/)
    const badWitness = structuredClone(surface); badWitness.journey[0].expect[0].class = 'destructive'
    assert.throws(() => agentCatalogue(options(), badWitness), /class witness drift/)
    const hostile = '</pre><img src=x onerror="synthetic-cabin-4">&\''
    const escaped = options(); escaped.tools[0].description = hostile; escaped.resources[0].description = hostile
    escaped.tools[0].outputSchema = { type: 'object', description: hostile }
    const rendered = await agentDocs(new Request('https://synthetic-cabin.example/docs/agents'), escaped)
    const text = await rendered.text()
    assert.equal(rendered.status, 200); assert.ok(!text.includes(hostile)); assert.ok(!text.includes('<img src=x'))
    assert.ok(text.includes('&lt;/pre&gt;&lt;img')); assert.ok(text.includes('&amp;'))
    assert.ok(readDocs(text).tools.some(tool => tool.outputSchema.description === hostile))
    t.diagnostic('PROBE BASE-AGENT-013 metadata: changed registry and missing or wrong class fixtures -> drift refusal; hostile descriptions and schema text -> escaped inert content; private database access -> never called')
  } finally { await h.close() }
})
