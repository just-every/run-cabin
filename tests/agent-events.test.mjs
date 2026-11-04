import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { accessToken, autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'
import { address, draftOperations, eventFixtures, eventHarness, eventList, listen, nativePreparation, preparations, recordUri } from './agent-events-support.mjs'

test('Retained polling replays native and agent draft preparations in order across restart without duplicate retries', { timeout: 120000 }, async t => {
  const { h, c, pair } = await eventHarness()
  try {
    const f = await eventFixtures(h)
    await pair()
    await c.adopt(autonomousPolicy())
    await h.cmd('task.raise', { propertyId: f.home.id, title: 'Synthetic event follow-up', note: 'Private synthetic maintenance note' })
    const turnover = await h.cmd('turnover.prepare', draftOperations(f)[1].input)
    await h.cmd('recovery.open', { bookingId: f.booking.id, turnoverId: turnover.id, trigger: 'guest_problem', reason: 'Private synthetic service report' })
    await h.cmd('reservation.request', { propertyId: f.other.id, channel: 'direct', guestName: 'Private synthetic guest', guestEmail: address('synthetic-cabin-guest'), start: '2030-06-01', end: '2030-06-04' })
    const page = await h.send('/app/readiness?from=2030-05-20', undefined, h.owner)
    const form = page.text.match(/<form[^>]*action="[^"]*name=readiness.chase[^"]*"[^>]*>([\s\S]*?)<\/form>/)
    assert.ok(form, 'the native readiness board offers a follow-up form')
    const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const input = Object.fromEntries([...form[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map(match => [match[1], decode(match[2])]))
    await h.cmd('readiness.chase', { ...input, note: 'Synthetic readiness follow-up' })
    await h.cmd('statement.prepare', draftOperations(f)[2].input)
    const state = await h.state(), retained = (await eventList(c)).events
    for (const [kind, collection] of Object.entries({ homes: 'properties', people: 'members', stays: 'bookings', guests: 'guests', tasks: 'tasks', readiness: 'readinessRecords', statements: 'statements', cases: 'recoveries', calendars: 'calendarDrafts', turnovers: 'turnovers' })) {
      assert.ok(state[collection].length, `${kind} has a real native fixture`)
      for (const row of state[collection]) assert.ok(retained.some(event => event.uri === recordUri(kind, row.id)), `${kind} changes have retained metadata`)
    }
    assert.ok(!JSON.stringify(retained).includes('Private synthetic'))
    t.diagnostic('PROBE BASE-AGENT-010 records: ten nonempty native record collections -> typed retained change metadata without record content')
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
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.home.id], actions: ['calendar:read', 'calendar.prepare'], active: true })
      const authored = await h.cmd('calendar.prepare', draftOperations(f)[0].input, cookie)
      const authoredUri = recordUri('calendars', authored.id)
      const authoredEvent = preparations(await eventList(c)).find(event => event.uri === authoredUri)
      assert.equal(authoredEvent.actor.person.name, manager.name)
      manager = await h.cmd('member.save', { ...manager, active: false })
      assert.equal((await client.tool('cabin.events.list', { after: cursor })).status, 401)
      const input = { entity: 'member', id: manager.id, revision: manager.revision }
      const review = await h.cmd('privacy.review', input)
      const erased = await h.cmd('privacy.erase', { ...input, reviewId: review.reviewId })
      assert.ok(erased.receiptId)
      const retained = await eventList(c, { after: cursor })
      assert.deepEqual(preparations(retained), stable)
      assert.ok(!JSON.stringify(retained).includes(manager.name))
      assert.ok(!JSON.stringify(retained).includes(authoredUri))
      await h.restart()
      assert.deepEqual(preparations(await eventList(c, { after: cursor })), stable)
      assert.equal((await client.tool('cabin.events.list')).status, 401)
      await h.cmd('member.save', { name: manager.name, email: manager.email, role: 'manager', active: true }, h.owner, 409)
      t.diagnostic(`PROBE BASE-AGENT-010 revocation ${document.rules[0].do}: nonempty scoped polling -> current action and property removal hide retained events, restart preserves the fence, consent and agent revocation and native offboarding return 401; owner remains admitted`)
      t.diagnostic(`PROBE BASE-AGENT-010 erasure ${document.rules[0].do}: reviewed native preparer erasure -> historical event retired, erased identity cannot be readmitted or poll after restart`)
    } finally { await h.close() }
  }
})

test('Subscribed native record changes notify within ten seconds and current authority fences each delivery', { timeout: 120000 }, async t => {
  for (const document of [autonomousPolicy(), heldPolicy()]) {
    const { h, c, pair, protocol } = await eventHarness()
    const streams = []
    try {
      const f = await eventFixtures(h)
      let manager = await h.cmd('member.save', { name: 'Synthetic subscription manager', email: address('synthetic-cabin-listener'), pmsRole: 'manager', propertyIds: [f.home.id], actions: ['calendar:read', 'operations:read', 'finance:read'], active: true })
      await h.cmd('member.invite', { id: manager.id })
      const cookie = await h.signIn(manager.email)
      await pair([{ id: 'synthetic-cabin-listener', email: manager.email, name: manager.name, role: 'admin', invite: 0 }])
      await c.adopt(document)
      const client = protocol({ sub: 'synthetic-cabin-listener', email: manager.email, cookie }, 'synthetic-cabin-listener-agent')
      const calendar = draftOperations(f)[0]
      const draft = await nativePreparation(h, calendar), uri = recordUri('calendars', draft.id)
      const homeUri = recordUri('homes', f.home.id), missing = recordUri('calendars', 'synthetic-cabin-missing')
      const hidden = await h.cmd('calendar.prepare', { ...calendar.input, propertyId: f.other.id })
      const hiddenUri = recordUri('calendars', hidden.id)
      const owner = await listen(h, c, [uri, homeUri]); streams.push(owner)
      let scoped = await listen(h, client, [uri, homeUri, hiddenUri, missing]); streams.push(scoped)
      assert.deepEqual(scoped.ack.params.notifications.resourceSubscriptions, [uri, homeUri])
      const noEvents = await listen(h, c, [uri], { token: await accessToken(c, { scope: 'records:read' }) }); streams.push(noEvents)
      const noRecords = await listen(h, c, [uri], { token: await accessToken(c, { scope: 'events:read' }) }); streams.push(noRecords)
      assert.ok(!noRecords.ack.params.notifications.resourceSubscriptions)
      const before = (await eventList(c)).cursor, started = Date.now()
      // The real native form changes a record that both admitted agents subscribed to.
      const body = new URLSearchParams({ id: draft.id, revision: draft.revision })
      const approved = await h.mf.dispatchFetch(`${h.origin}/app/action?name=calendar.approve&returnTo=%2Fapp%2Fchannels`, {
        method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body,
      })
      assert.equal(approved.status, 200)
      assert.ok(!(await approved.text()).includes('role="alert"'))
      const changed = (await eventList(c, { after: before })).events.find(event => event.uri === uri)
      assert.equal(changed.type, 'calendars.updated')
      const notification = await scoped.wait(message => message.method === ['notifications', 'resources', 'updated'].join('/'))
      const elapsed = Date.now() - started
      assert.ok(elapsed < 10000, `native change delivered after ${elapsed} ms`)
      assert.equal(notification.params.uri, uri)
      assert.deepEqual(Object.keys(notification.params).sort(), ['_meta', 'uri'])
      assert.ok(!JSON.stringify(scoped.messages).includes('Private synthetic'))
      const ownerChanges = () => owner.messages.filter(message => message.method === ['notifications', 'resources', 'updated'].join('/')).length
      const mark = ownerChanges()
      const delivered = scoped.messages.length
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.home.id], pmsRole: 'manager', actions: ['calendar:read', 'operations:read', 'finance:read'], propertyIds: [f.other.id], active: true })
      // A subsequent owner-visible update is a barrier after the scoped grant was removed.
      await h.cmd('property.save', { ...f.home, name: 'Synthetic changed home' })
      await owner.wait(message => message.method === ['notifications', 'resources', 'updated'].join('/') && message.params.uri === homeUri)
      await new Promise(resolve => setTimeout(resolve, 1300))
      assert.ok(ownerChanges() > mark)
      assert.equal(scoped.messages.length, delivered, 'existing subscription delivers nothing after property removal')
      assert.deepEqual(noEvents.messages.filter(message => message.method === ['notifications', 'resources', 'updated'].join('/')), [])
      assert.deepEqual(noRecords.messages.filter(message => message.method === ['notifications', 'resources', 'updated'].join('/')), [])
      const polled = await eventList(client, { after: before })
      assert.ok(!polled.events.some(event => event.uri === uri || event.uri === homeUri))
      await scoped.close()
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.home.id], pmsRole: 'manager', actions: ['calendar:read', 'operations:read', 'finance:read'], propertyIds: [f.home.id], active: true })
      for (const revoked of [{ agents: [], consents: [client.consent] }, { agents: [client.agentId], consents: [] }]) {
        await c.adopt(document)
        scoped = await listen(h, client, [uri]); streams.push(scoped)
        await c.adopt(document, { revoked })
        const complete = await scoped.wait(message => message.result?.resultType === 'complete')
        assert.ok(complete.id)
        assert.ok(!scoped.messages.some(message => message.method === ['notifications', 'resources', 'updated'].join('/')))
        assert.equal((await client.tool('cabin.events.list')).status, 401)
        assert.ok((await eventList(c)).events.length)
        await scoped.close()
      }
      await c.adopt(document)
      scoped = await listen(h, client, [uri]); streams.push(scoped)
      manager = await h.cmd('member.save', { ...manager, propertyIds: [f.home.id], pmsRole: 'manager', actions: ['calendar:read', 'operations:read', 'finance:read'], active: false })
      await scoped.wait(message => message.result?.resultType === 'complete')
      assert.ok(!scoped.messages.some(message => message.method === ['notifications', 'resources', 'updated'].join('/')))
      t.diagnostic(`PROBE BASE-AGENT-010 subscription ${document.rules[0].do}: native calendar approval -> notification in ${elapsed} ms; current property, event and record scopes, consent, agent revocation and offboarding fence polling and existing streams`)
    } finally { for (const stream of streams) await stream.close(); await h.close() }
  }
})
