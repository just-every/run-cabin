import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { docsHarness, readDocs, surface } from './agent-docs-support.mjs'
import { randomUUID } from 'node:crypto'
import { accessToken, autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { createProtocol, errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'
import { runJourney } from '../src/modules/agent-door/conformance/journey.mjs'
import { schemaErrors } from '../src/modules/agent-door/conformance/schema.mjs'

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

test('Discovered specialist jobs preserve native draft authority, policy and retry boundaries under both policies', { timeout: 120000 }, async t => {
  const { h, c, pair, home, cleaner } = await docsHarness()
  try {
    const member = await h.cmd('member.save', { ...cleaner, pmsRole: 'cleaner', propertyIds: [home.id], actions: ['operations:read'] })
    await h.cmd('member.invite', { id: member.id })
    const cookie = await h.signIn(member.email)
    const subject = 'synthetic-cabin-cleaner'
    await pair([{ id: subject, email: member.email, name: member.name, role: 'member', invite: 0 }])
    const staff = createProtocol({ fetch: (url, init) => h.mf.dispatchFetch(url, init), origin: h.origin, surface, signer: c.signer,
      person: { sub: subject, email: member.email, cookie }, business: c.business, consent: 'synthetic-cabin-cleaner-consent',
      agentId: 'synthetic-cabin-cleaner-agent', seq: 0, revision: 0, points: [], listed: new Map() })

    for (const [phase, policy] of [['autonomous', autonomousPolicy()], ['held', heldPolicy()]]) {
      await c.adopt(policy)
      const initialized = await c.mcp('initialize', { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'synthetic-cabin-1', version: '1' } })
      assert.equal(initialized.status, 200)
      const docsPath = initialized.result.instructions.match(/Documentation: (\/[^ .]+)/)?.[1]
      assert.ok(docsPath, 'A new client finds the documentation in initialization instructions')
      const document = await h.send(docsPath)
      assert.equal(document.status, 200)
      const listing = await c.mcp(method('tools', 'list'))
      const tools = listing.result.tools
      assert.deepEqual(readDocs(document.text).tools.map(tool => tool.name), tools.map(tool => tool.name))
      const job = (readOnly, fields) => {
        const matches = tools.filter(tool => tool.annotations.readOnlyHint === readOnly && fields.every(field => Object.hasOwn(tool.inputSchema.properties, field)))
        assert.equal(matches.length, 1, 'A job is discoverable by its published input schema')
        return matches[0]
      }
      // The read job has an additional identifier; distinguish it from the list job.
      const listTool = tools.find(tool => tool.annotations.readOnlyHint && Object.hasOwn(tool.inputSchema.properties, 'kind') && !Object.hasOwn(tool.inputSchema.properties, 'id'))
      assert.ok(listTool)
      const call = async (tool, args) => {
        const before = await h.state()
        let answer = await c.tool(tool.name, args)
        const disposition = phase === 'held' ? answer.decision.classes.some(item => item.class !== 'standard') ? 'approval' : 'review' : 'autonomous'
        assert.equal(answer.decision.disposition, disposition)
        assert.equal(answer.decision.revision, c.revision)
        if (answer.result?.resultType === 'input_required') {
          assert.equal(phase, 'held', 'Autonomous calls never wait for a person')
          assert.deepEqual(await h.state(), before, 'Pending approval changes no native record')
          assert.ok((await c.decideApproval(answer)).ok)
          answer = await c.tool(tool.name, args, { requestState: answer.result.requestState })
        }
        assert.equal(errorCode(answer), null, JSON.stringify(answer.body))
        assert.ok(!answer.result.isError && answer.result.resultType !== 'input_required')
        assert.deepEqual(schemaErrors(tool.outputSchema, answer.result.structuredContent), [])
        return answer
      }
      const rows = async kind => (await call(listTool, { kind })).result.structuredContent.records
      const homes = await rows('homes'), stays = await rows('stays'), people = await rows('people')
      assert.ok(homes.length && stays.length && people.length, 'Discovery works on nonempty native rental records')
      const property = homes.find(row => row.id === stays[0].propertyId)
      assert.ok(property)
      const readTool = job(true, ['kind', 'id'])
      assert.deepEqual((await call(readTool, { kind: 'homes', id: property.id })).result.structuredContent.record, property)
      const jobs = [
        { tool: job(false, ['propertyId', 'channel', 'calendar']), collection: 'calendarDrafts',
          args: { propertyId: property.id, channel: 'vrbo', calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-cabin-discovery\r\nDTSTART;VALUE=DATE:20300610\r\nDTEND;VALUE=DATE:20300612\r\nSUMMARY:Synthetic cabin discovery stay\r\nEND:VEVENT\r\nEND:VCALENDAR' } },
        { tool: job(false, ['bookingId', 'cleanerId', 'checklist']), collection: 'turnovers',
          args: { bookingId: stays[0].id, cleanerId: people.find(row => row.id === member.id).id, checklist: ['Synthetic cabin inspection'] } },
        { tool: job(false, ['propertyId', 'month', 'lines']), collection: 'statements',
          args: { propertyId: property.id, month: '2030-07', lines: [{ description: 'Synthetic cabin draft income', amountCents: 17001 }] } },
      ]
      for (const { tool, collection, args } of jobs) {
        const keyed = { ...args, idempotency_key: randomUUID() }
        const before = await h.state()
        const narrow = await accessToken(c, { scope: 'records:read' })
        assert.equal((await c.tool(tool.name, keyed, { token: narrow })).status, 403)
        const foreign = await accessToken(c, { aud: 'https://synthetic-cabin-sibling.invalid/mcp' })
        assert.equal((await c.tool(tool.name, keyed, { token: foreign })).status, 401)
        const refused = await staff.tool(tool.name, keyed)
        assert.equal(errorCode(refused), 'owner_required')
        assert.deepEqual(await h.state(), before, 'A discovery listing grants neither scope nor native draft authority')

        const prepared = await call(tool, keyed), result = prepared.result.structuredContent
        const after = await h.state(), saved = after[collection].find(row => row.id === result.id)
        assert.equal(after[collection].length, before[collection].length + 1)
        assert.equal(saved.status, 'draft', 'Only a draft is prepared, never a person decision or provider action')
        assert.equal(saved.revision, result.revision)
        assert.equal(saved.propertyId, property.id)
        assert.deepEqual(after.bookings, before.bookings, 'Preparation never allocates or changes a stay')
        const replay = await c.tool(tool.name, keyed)
        assert.deepEqual(replay.result.structuredContent, result)
        const injected = await c.tool(tool.name, { ...keyed, class: 'money', send: true, approve: true, confirmed: true })
        assert.deepEqual(injected.result.structuredContent, result)
        assert.deepEqual(injected.decision.classes, prepared.decision.classes)
        assert.deepEqual(await h.state(), after, 'Retries and confirmation flags create no duplicate or promoted effect')
        const conflict = await c.tool(tool.name, { ...keyed, ...('month' in args ? { month: '2030-08' } : 'checklist' in args ? { checklist: ['Synthetic changed inspection'] } : { channel: 'ical' }) })
        assert.equal(errorCode(conflict), 'idempotency_conflict')
        const stale = await c.tool(tool.name, { ...args, idempotency_key: randomUUID(), expected_revision: after.version - 1 })
        assert.equal(errorCode(stale), 'revision_conflict')
        assert.deepEqual(await h.state(), after, 'Conflicting retries and stale revisions change nothing')
      }
      // The complete policies carry standard drafts as autonomous or review.
      // Their explicit approval variant must also withhold every real mutation.
      await c.adopt({ ...autonomousPolicy(), rules: [
        { id: 'all', class: '*', do: 'autonomous' },
        { id: 'hold-standard', class: 'standard', do: 'approval', approver: ['sponsor'], wait: 'PT1H' },
      ] })
      for (const { tool, collection, args } of jobs) {
        const keyed = { ...args, idempotency_key: randomUUID() }, before = await h.state()
        const pending = await c.tool(tool.name, keyed)
        assert.equal(pending.result.resultType, 'input_required')
        assert.equal(pending.decision.disposition, 'approval')
        assert.deepEqual(await h.state(), before, 'Every discovered draft waits without an effect')
        const flagged = await c.tool(tool.name, { ...keyed, approve: true, confirmed: true })
        assert.equal(flagged.result.resultType, 'input_required')
        const approval = pending.result._meta['com.runeditrun/approval']
        const view = await c.personJson(`/agents/api/approvals/${approval.id}`)
        const bearer = await accessToken(c)
        const forgedPerson = await h.send(`/agents/api/approvals/${approval.id}/approve`, {
          revision: view.approval.revision, summary_sha256: view.approval.summary_sha256,
        }, '', { authorization: `Bearer ${bearer}` })
        assert.equal(forgedPerson.status, 403)
        assert.deepEqual(await h.state(), before, 'An agent bearer and confirmation flags cannot supply a person step')
        assert.ok((await c.decideApproval(pending)).ok)
        const completed = await c.tool(tool.name, keyed, { requestState: pending.result.requestState })
        assert.equal(errorCode(completed), null)
        assert.deepEqual(schemaErrors(tool.outputSchema, completed.result.structuredContent), [])
        const after = await h.state(), result = completed.result.structuredContent
        assert.equal(after[collection].length, before[collection].length + 1)
        assert.equal(after[collection].find(row => row.id === result.id).status, 'draft')
        assert.deepEqual((await c.tool(tool.name, keyed)).result.structuredContent, result)
        assert.deepEqual(await h.state(), after, 'An approved retry executes exactly once')
      }
      for (const [code, document] of [['policy_blocked', { ...autonomousPolicy(), rules: [{ id: 'all', class: '*', do: 'blocked' }] }], ['policy_unset', null]]) {
        await c.adopt(document)
        const before = await h.state()
        for (const { tool, args } of jobs) assert.equal(errorCode(await c.tool(tool.name, { ...args, idempotency_key: randomUUID() })), code)
        assert.deepEqual(await h.state(), before, 'No discovered draft runs under blocked or unanswered policy')
      }
      await c.adopt(policy)
      t.diagnostic(`PROBE BASE-AGENT-013 3-5 ${phase}: MCP initialization and published schemas -> all three discovered owner jobs create drafts; non-owner, narrow-scope, sibling-audience, retry-conflict and stale-revision calls refuse without effects; approval, blocked and unanswered variants cannot run effects or accept an agent as a person`)
    }
    assert.deepEqual(c.points.filter(point => !point.ok), [])
  } finally { await h.close() }
})
