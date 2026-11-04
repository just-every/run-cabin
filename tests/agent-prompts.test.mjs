import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
import { autonomousPolicy, heldPolicy, signJws } from '../src/modules/agent-door/conformance/crypto.mjs'
import { createProtocol, errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'
import { discoverDoor, listedDoor } from '../src/modules/agent-door/conformance/discovery.mjs'
import { refusalPhase } from '../src/modules/agent-door/conformance/subset.mjs'
import { capabilitySet } from '../src/modules/agent-door/capabilities.mjs'

const method = (...parts) => parts.join('/')
const surface = JSON.parse(await readFile('agent-surface.json', 'utf8'))
const list = method('prompts', 'list'), get = method('prompts', 'get')
function success(answer) {
  assert.equal(answer.status, 200)
  assert.equal(answer.body.error, undefined, JSON.stringify(answer.body))
  return answer.result
}

test('Specialist prompts and MCP transport agree under both policies without changing native state', { timeout: 120000 }, async t => {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signer = { privateKey: keys.privateKey, kid: 'synthetic-cabin-1', issuer: 'https://synthetic-business.example', installationId: 'synthetic-cabin-1' }
  const h = await harness({ auth: { RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId,
    RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: await webcrypto.subtle.exportKey('jwk', keys.publicKey) }) } })
  try {
    const person = { sub: 'synthetic-cabin-owner', email: h.auth.OWNER_EMAIL, cookie: h.owner }, business = 'synthetic-cabin-1'
    const iat = Math.floor(Date.now() / 1000)
    const settings = await signJws(signer.privateKey, signer.kid, 'rer-business-settings+jwt', {
      v: 1, iss: signer.issuer, aud: h.origin, sub: signer.installationId, business, email: person.email, owner_id: person.sub,
      jti: randomUUID(), iat, exp: iat + 300, rev: 1, values: { display_name: 'Synthetic rental company' }, logo: null, team: [],
    })
    assert.equal((await h.send('/api/rer/business-settings', { settings })).status, 200)
    const c = createProtocol({ fetch: (url, init) => h.mf.dispatchFetch(url, init), origin: h.origin, surface, signer, person, business,
      consent: 'synthetic-cabin-consent', agentId: 'synthetic-cabin-agent', seq: 0, revision: 0, points: [], listed: new Map() })
    await h.cmd('property.save', { name: 'Synthetic private cabin', ownerName: 'Synthetic host', ownerEmail: ['synthetic-cabin-host', 'stay.example'].join('@'), commissionBps: 1500 })
    const before = await h.state()
    const refused = async (code, options = {}) => {
      for (const version of ['2026-07-28', '2025-11-25']) {
        const answer = await c.mcp(get, { name: 'cabin.records.inspect' }, { version })
        assert.equal(errorCode(answer), code)
        assert.equal(answer.result, undefined, 'a refusal must withhold prompt content')
        const listing = await c.mcp(list, {}, { version })
        if (options.unauthorized) {
          assert.equal(answer.status, 401)
          assert.equal(listing.status, 401)
          assert.equal(listing.result, undefined)
        } else if (options.empty) assert.deepEqual(success(listing).prompts, [])
      }
      assert.deepEqual(await h.state(), before, 'refused retrieval must have no native effect')
    }
    await refused('policy_unset', { empty: true })
    t.diagnostic('PROBE BASE-AGENT-001 unset: authenticated prompt retrieval before policy -> policy_unset and no content or native effect')
    for (const [phase, document] of [['autonomous', autonomousPolicy()], ['held', heldPolicy()]]) {
      await c.adopt(document)
      await discoverDoor(c)
      await listedDoor(c)
      await refusalPhase(c)
      const discovery = success(await c.mcp(method('server', 'discover')))
      assert.deepEqual(discovery._meta['com.runeditrun/capabilities'], capabilitySet(surface.capabilities))
      assert.deepEqual(Object.keys(discovery.capabilities).sort(), ['prompts', 'resources', 'tools'])
      assert.equal(discovery.capabilities.prompts.listChanged, false)
      for (const omitted of [method('roots', 'list'), method('sampling', 'createMessage'), method('logging', 'setLevel')]) {
        const answer = await c.mcp(omitted)
        assert.equal(answer.body.error?.code, -32601)
        assert.equal(answer.result, undefined)
      }
      const baseline = success(await c.mcp(list))
      const names = baseline.prompts.map(prompt => prompt.name)
      assert.ok(names.length > 0)
      assert.equal(new Set(names).size, names.length)
      assert.deepEqual(names, [...names].sort())
      assert.equal(baseline.cacheScope, 'private')
      assert.ok(Number.isFinite(baseline.ttlMs) && baseline.ttlMs >= 0)
      const tools = new Set(success(await c.mcp(method('tools', 'list'))).tools.map(tool => tool.name)), mentioned = new Set()
      for (const version of ['2026-07-28', '2025-11-25']) {
        const initialized = success(await c.mcp('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'synthetic-cabin-1', version: '1' } }, { version }))
        assert.deepEqual(initialized.capabilities, discovery.capabilities)
        assert.deepEqual(success(await c.mcp(list, {}, { version })), baseline)
        for (const prompt of baseline.prompts) {
          const answer = success(await c.mcp(get, { name: prompt.name }, { version }))
          assert.equal(answer.description, prompt.description)
          assert.equal(answer.cacheScope, 'private')
          assert.ok(Number.isFinite(answer.ttlMs) && answer.ttlMs >= 0)
          assert.ok(answer.messages.length > 0)
          for (const message of answer.messages) {
            assert.equal(message.role, 'user')
            assert.equal(message.content.type, 'text')
            assert.ok(message.content.text.trim().length > 0)
            assert.ok(!message.content.text.includes(before.properties[0].name), 'static guidance must not embed native records')
            for (const name of message.content.text.match(/cabin\.[a-z]+\.[a-z]+/g) ?? []) {
              assert.ok(tools.has(name), `prompt refers to unregistered tool ${name}`)
              mentioned.add(name)
            }
          }
          assert.deepEqual(success(await c.mcp(get, { name: prompt.name, arguments: { record: 'synthetic-cabin-untrusted-instruction' } }, { version })), answer,
            'static guidance cannot interpolate caller instructions or execute them')
        }
        const unknown = await c.mcp(get, { name: 'synthetic-cabin-unknown' }, { version })
        assert.equal(unknown.body.error?.code, -32602)
        assert.equal(unknown.result, undefined)
      }
      assert.deepEqual([...mentioned].sort(), [...tools].sort(), 'guidance covers the visible-record tools and all three existing draft preparations')
      assert.deepEqual(await h.state(), before, 'discovery and retrieval must leave seeded native business state unchanged')
      t.diagnostic(`PROBE BASE-AGENT-001 ${phase}: modern and legacy MCP -> deterministic private prompt lists, all registered jobs retrievable, unknown prompt refused; six transport acceptance points and undeclared-family conformance passed`)
      await c.adopt(document, { paused: true })
      await refused('agents_paused', { empty: true })
      await c.adopt(document, { revoked: { agents: [], consents: [c.consent] } })
      await refused(-32001, { unauthorized: true })
      await c.adopt(document, { revoked: { agents: [c.agentId], consents: [] } })
      await refused(-32001, { unauthorized: true })
      t.diagnostic(`PROBE BASE-AGENT-001 ${phase} authority: pause -> agents_paused; revoked consent and agent -> 401, no prompt content or native effect`)
    }
    const blocked = autonomousPolicy()
    blocked.rules = [{ id: 'all', class: '*', do: 'blocked' }]
    await c.adopt(blocked)
    await refused('policy_blocked')
    t.diagnostic('PROBE BASE-AGENT-001 blocked: standard class blocked -> policy_blocked, no prompt content or native effect')
    const failures = c.points.filter(point => !point.ok)
    assert.deepEqual(failures, [])
    t.diagnostic(`Applicable conformance: ${c.points.length} passing points under autonomous and held policies`)
  } finally { await h.close() }
})
