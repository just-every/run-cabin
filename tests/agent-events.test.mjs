import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { accessToken, autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'
import { address, draftOperations, eventFixtures, eventHarness, eventList, nativePreparation, preparations, recordUri } from './agent-events-support.mjs'

test('Retained polling replays native and agent draft preparations in order across restart without duplicate retries', { timeout: 120000 }, async t => {
  const { h, c, pair } = await eventHarness()
  try {
    const f = await eventFixtures(h)
    await pair()
    for (const document of [autonomousPolicy(), heldPolicy()]) {
      await c.adopt(document)
      const listed = await c.mcp(['tools', 'list'].join('/'))
      assert.ok(listed.result.tools.some(tool => tool.name === 'cabin.events.list'))
      const discovery = await c.mcp(['server', 'discover'].join('/'))
      assert.ok(discovery.result._meta['com.runeditrun/capabilities'].declared.includes('events'))
      const start = (await eventList(c)).cursor, expected = []
      for (const operation of draftOperations(f)) {
        const row = await nativePreparation(h, operation)
        expected.push({ uri: recordUri(operation.kind, row.id), kind: 'person' })
        const args = { ...operation.input, idempotency_key: randomUUID() }
        const first = await c.tool(operation.tool, args)
        assert.equal(errorCode(first), null, JSON.stringify(first.body))
        const saved = first.result.structuredContent
        expected.push({ uri: recordUri(operation.kind, saved.id), kind: 'agent' })
        const after = preparations(await eventList(c, { after: start }))
        const replay = await c.tool(operation.tool, args)
        assert.deepEqual(replay.result.structuredContent, saved)
        assert.deepEqual(preparations(await eventList(c, { after: start })), after, 'MCP retry cannot append another preparation event')
        const conflict = await c.tool(operation.tool, { ...args, idempotency_key: args.idempotency_key, ...(operation.kind === 'statements' ? { month: '2030-06' } : operation.kind === 'calendars' ? { channel: 'ical' } : { checklist: ['Different checklist'] }) })
        assert.equal(errorCode(conflict), 'idempotency_conflict')
        assert.deepEqual(preparations(await eventList(c, { after: start })), after)
      }
      const page = await eventList(c, { after: start, limit: 200 }), events = preparations(page)
      assert.equal(events.length, 6)
      assert.deepEqual(events.map(event => ({ uri: event.uri, kind: event.actor.kind })), expected)
      const person = (await h.state()).actor.id
      for (const event of events) {
        assert.deepEqual(Object.keys(event).sort(), ['actor', 'at', 'id', 'type', 'uri'])
        assert.match(event.id, /^[a-f0-9-]{36}$/)
        assert.ok(Number.isFinite(Date.parse(event.at)))
        assert.equal(event.type, event.uri.split('://')[1].split('/')[0] + '.prepared')
        if (event.actor.kind === 'person') assert.deepEqual(event.actor.person, { id: person, name: 'Jordan Venue' })
        else {
          assert.equal(event.actor.agent.id, c.agentId)
          assert.equal(event.actor.agent.name, 'Agent door conformance')
          assert.deepEqual(event.actor.for, { id: person, name: 'Jordan Venue' })
          assert.equal(event.actor.label, 'Agent door conformance for Jordan Venue')
        }
      }
      assert.ok(!JSON.stringify(events).includes('Private synthetic'))
      assert.ok(!JSON.stringify(events).includes('975318'))
      assert.ok(!JSON.stringify(events).includes(address('synthetic-cabin-host')))
      const paginated = []; let after = start
      for (let i = 0; i < page.events.length; i++) {
        const next = await eventList(c, { after, limit: 1 })
        assert.equal(next.events.length, 1)
        paginated.push(next.events[0]); after = next.cursor
      }
      assert.deepEqual(paginated, page.events)
      const cursor = events[0].id
      const replay = await eventList(c, { after: cursor })
      await h.restart()
      assert.deepEqual(await eventList(c, { after: cursor }), replay, 'durable IDs and order survive a Worker restart')
      assert.deepEqual((await eventList(c, { after: events.at(-1).id })).events, [])
      assert.deepEqual(await eventList(c, { after: 'synthetic-cabin-unknown' }), { events: [], cursor: 'synthetic-cabin-unknown' })
      const noEvents = await c.tool('cabin.events.list', {}, { token: await accessToken(c, { scope: 'records:read drafts:write' }) })
      assert.equal(errorCode(noEvents), 'insufficient_scope')
      assert.ok(!noEvents.result?.structuredContent)
      assert.deepEqual(preparations(await eventList(c, {}, { token: await accessToken(c, { scope: 'events:read' }) })), [])
      t.diagnostic(`PROBE BASE-AGENT-010 polling ${document.rules[0].do}: native preparation forms and MCP drafts -> six ordered metadata-only events, exact actor attribution, paginated and restart replay, one effect on retry, explicit scope gates`)
    }
    const legacy = await h.cmd('agent.create', { label: 'Synthetic legacy coordinator' })
    const legacyRead = await c.tool('cabin.events.list', {}, { token: legacy.token })
    assert.equal(errorCode(legacyRead), 'insufficient_scope')
    const local = await h.send('/api/cabin/agent/command', { name: 'calendar.prepare', input: draftOperations(f)[0].input }, '', { authorization: `Bearer ${legacy.token}` })
    assert.equal(local.status, 200, local.text)
    const localEvent = preparations(await eventList(c)).find(event => event.uri === recordUri('calendars', local.value.result.id))
    assert.equal(localEvent.actor.kind, 'agent')
    assert.deepEqual(localEvent.actor.agent, { id: `cabin-key:${legacy.id}`, name: 'Synthetic legacy coordinator' })
    assert.equal(localEvent.actor.label, 'Synthetic legacy coordinator for Jordan Venue')
  } finally { await h.close() }
})

test('Delivery rechecks current property and record scopes and stops revoked consent or agents under both policies', { timeout: 120000 }, async t => {
  for (const document of [autonomousPolicy(), heldPolicy()]) {
    const { h, c, protocol, pair } = await eventHarness()
    try {
      const f = await eventFixtures(h)
      let manager = await h.cmd('member.save', { name: 'Synthetic scoped manager', email: address('synthetic-cabin-manager'), pmsRole: 'manager', propertyIds: [f.home.id], actions: ['calendar:read', 'operations:read', 'finance:read'], active: true })
      await h.cmd('member.invite', { id: manager.id })
      const cookie = await h.signIn(manager.email)
      await pair([{ id: 'synthetic-cabin-manager', email: manager.email, name: manager.name, role: 'admin', invite: 0 }])
      await c.adopt(document)
      const client = protocol({ sub: 'synthetic-cabin-manager', email: manager.email, cookie }, 'synthetic-cabin-scoped-agent')
      const cursor = (await eventList(c)).cursor
      const expected = []
      for (const operation of draftOperations(f)) {
        const row = await h.cmd(operation.command, operation.input)
        expected.push(recordUri(operation.kind, row.id))
        const forbidden = await client.tool(operation.tool, { ...operation.input, idempotency_key: randomUUID() })
        assert.equal(errorCode(forbidden), 'owner_required', 'event access does not widen draft authority')
      }
      const hidden = await h.cmd('calendar.prepare', { propertyId: f.other.id, channel: 'airbnb', calendar: f.calendar })
      const before = await eventList(client, { after: cursor })
      assert.deepEqual(preparations(before).map(event => event.uri), expected)
      assert.ok(!JSON.stringify(before).includes(hidden.id))
      const stable = preparations(await eventList(c, { after: cursor }))
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.home.id], actions: ['operations:read'], active: true })
      assert.deepEqual(preparations(await eventList(client, { after: cursor })).map(event => event.uri), expected.filter(uri => uri.startsWith('cabin://turnovers/')))
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.other.id], actions: ['calendar:read', 'operations:read', 'finance:read'], active: true })
      const revoked = await eventList(client, { after: cursor })
      assert.ok(expected.every(uri => !revoked.events.some(event => event.uri === uri)))
      await h.restart()
      const restarted = await eventList(client, { after: cursor })
      assert.ok(expected.every(uri => !restarted.events.some(event => event.uri === uri)))
      assert.deepEqual(preparations(await eventList(c, { after: cursor })), stable)
      for (const revocation of [{ agents: [], consents: [client.consent] }, { agents: [client.agentId], consents: [] }]) {
        await c.adopt(document, { revoked: revocation })
        const denied = await client.tool('cabin.events.list', { after: cursor })
        assert.equal(denied.status, 401)
        assert.ok(!denied.result?.structuredContent)
        assert.ok(expected.every(uri => !JSON.stringify(denied.body).includes(uri)))
        assert.ok(preparations(await eventList(c, { after: cursor })).length)
      }
      await c.adopt(document)
      manager = await h.cmd('member.save', { ...manager, active: false })
      assert.equal((await client.tool('cabin.events.list', { after: cursor })).status, 401)
      assert.deepEqual(preparations(await eventList(c, { after: cursor })), stable)
      t.diagnostic(`PROBE BASE-AGENT-010 revocation ${document.rules[0].do}: nonempty scoped polling -> current action and property removal hide retained events, restart preserves the fence, consent and agent revocation and native offboarding return 401; owner remains admitted`)
    } finally { await h.close() }
  }
})
