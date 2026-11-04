import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { unstable_splitSqlQuery } from 'wrangler'
import { harness } from './harness.mjs'
import { signJws } from '../src/modules/agent-door/conformance/crypto.mjs'
import { createProtocol, errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'

export const surface = JSON.parse(await readFile('agent-surface.json', 'utf8'))
export const address = name => [name, 'stay.example'].join('@')
export const recordUri = (kind, id) => `cabin://${kind}/${encodeURIComponent(id)}`
export const preparations = answer => answer.events.filter(event => event.type.endsWith('.prepared'))
export async function eventList(client, args = {}, options) {
  const answer = await client.tool('cabin.events.list', args, options)
  assert.equal(answer.status, 200)
  assert.equal(errorCode(answer), null, JSON.stringify(answer.body))
  assert.equal(answer.result.isError, false)
  assert.ok(Array.isArray(answer.result.structuredContent.events))
  return answer.result.structuredContent
}
export async function eventHarness(options = {}) {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signer = { privateKey: keys.privateKey, kid: 'synthetic-cabin-1', issuer: 'https://synthetic-business.example', installationId: 'synthetic-cabin-1' }
  const h = await harness({ ...options, auth: { RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId,
    RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: await webcrypto.subtle.exportKey('jwk', keys.publicKey) }) } })
  const owner = { sub: 'synthetic-cabin-owner', email: h.auth.OWNER_EMAIL, cookie: h.owner }, business = 'synthetic-cabin-1'
  const protocol = (person, agentId) => createProtocol({ fetch: (url, init) => h.mf.dispatchFetch(url, init), origin: h.origin, surface, signer,
    person, business, consent: agentId + '-consent', agentId, seq: 0, revision: 0, points: [], listed: new Map() })
  const c = protocol(owner, 'synthetic-cabin-owner-agent')
  let revision = 0
  async function pair(team = []) {
    const iat = Math.floor(Date.now() / 1000)
    const settings = await signJws(signer.privateKey, signer.kid, 'rer-business-settings+jwt', {
      v: 1, iss: signer.issuer, aud: h.origin, sub: signer.installationId, business, email: owner.email, owner_id: owner.sub,
      jti: randomUUID(), iat, exp: iat + 300, rev: ++revision, values: { display_name: 'Synthetic rental company' }, logo: null, team,
    })
    const response = await h.send('/api/rer/business-settings', { settings })
    assert.equal(response.status, 200, response.text)
  }
  return { h, c, owner, protocol, pair, signer, business }
}
export async function eventFixtures(h) {
  const home = await h.cmd('property.save', { name: 'Synthetic pine cabin', ownerName: 'Synthetic host', ownerEmail: address('synthetic-cabin-host'), commissionBps: 1500 })
  const other = await h.cmd('property.save', { name: 'Synthetic private lake', ownerName: 'Other host', ownerEmail: address('synthetic-cabin-other'), commissionBps: 2000 })
  const cleaner = await h.cmd('member.save', { name: 'Synthetic cleaner', email: address('synthetic-cabin-cleaner'), role: 'cleaner', active: true })
  const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-cabin-1\r\nDTSTART;VALUE=DATE:20300520\r\nDTEND;VALUE=DATE:20300524\r\nSUMMARY:Private synthetic guest text and code 975318\r\nEND:VEVENT\r\nEND:VCALENDAR'
  const initial = await h.cmd('calendar.prepare', { propertyId: home.id, channel: 'airbnb', calendar })
  await h.cmd('calendar.approve', { id: initial.id, revision: initial.revision })
  const booking = (await h.state()).bookings.find(row => row.propertyId === home.id)
  assert.ok(booking)
  return { home, other, cleaner, calendar, booking, initial }
}
export function draftOperations(f) {
  return [
    { command: 'calendar.prepare', tool: 'cabin.calendar.prepare', page: 'channels', kind: 'calendars', collection: 'calendarDrafts', input: { propertyId: f.home.id, channel: 'vrbo', calendar: f.calendar } },
    { command: 'turnover.prepare', tool: 'cabin.work.prepare', page: 'turnovers', kind: 'turnovers', collection: 'turnovers', input: { bookingId: f.booking.id, cleanerId: f.cleaner.id, checklist: ['Private synthetic checklist'] } },
    { command: 'statement.prepare', tool: 'cabin.statements.prepare', page: 'statements', kind: 'statements', collection: 'statements', input: { propertyId: f.home.id, month: '2030-05', lines: [{ description: 'Private synthetic rent', amountCents: 10000 }] } },
  ]
}
export async function nativePreparation(h, operation) {
  const before = new Set((await h.state())[operation.collection].map(row => row.id))
  const body = new URLSearchParams(Object.entries(operation.input).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]))
  const response = await h.mf.dispatchFetch(`${h.origin}/app/action?name=${operation.command}&returnTo=${encodeURIComponent('/app/' + operation.page)}`, {
    method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'manual',
  })
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.ok(!html.includes('role="alert"'), 'native preparation reports no form error')
  const added = (await h.state())[operation.collection].filter(row => !before.has(row.id))
  assert.equal(added.length, 1)
  return added[0]
}

/** Follow real pending, decided and flagged actions through their person and MCP doors. */
export async function decisionEvents(setup, f, document, t, upgrade = false) {
  const { h, c, owner, protocol } = setup
  const agent = protocol(owner, 'synthetic-cabin-decision-agent')
  const subject = 'synthetic-cabin-decision-observer-' + document.rules[0].do
  const manager = await h.cmd('member.save', { name: 'Synthetic decision observer', email: address(subject),
    pmsRole: 'manager', propertyIds: [f.other.id], actions: ['calendar:read'], active: true })
  await h.cmd('member.invite', { id: manager.id })
  const cookie = await h.signIn(manager.email)
  await setup.pair([{ id: subject, email: manager.email, name: manager.name, role: 'admin', invite: 0 }])
  const outsider = protocol({ sub: subject, email: manager.email, cookie }, subject + '-agent')
  const policy = disposition => ({ ...document, rules: [{ id: 'prepared-action', class: 'standard', agent: agent.agentId,
    do: disposition, ...(disposition === 'approval' ? { approver: ['sponsor'], wait: 'PT1H' } : {}) }, ...document.rules], reviewers: ['sponsor'] })
  let legacyFlag
  if (upgrade) {
    await c.adopt(policy('review'))
    const prepared = await agent.tool('cabin.calendar.prepare', { ...draftOperations(f)[0].input, idempotency_key: randomUUID() })
    const review = (await c.personJson('/agents/api/reviews')).reviews.find(row => row.decision_id === prepared.decision.id)
    assert.equal((await h.send('/agents/api/reviews/' + review.id + '/flag', {}, h.owner)).status, 200)
    legacyFlag = (await eventList(c)).events.find(event => event.uri.endsWith('/' + review.id))
    assert.equal(legacyFlag.type, 'review.flagged')
    assert.equal(legacyFlag.decision, undefined, 'the old Base producer supplies no disposition')
  }
  await c.adopt(policy('approval'))
  const cursor = (await eventList(c)).cursor, expected = []
  for (const action of ['approve', 'reject']) {
    const args = { ...draftOperations(f)[0].input, idempotency_key: randomUUID() }
    const before = (await h.state()).calendarDrafts.length
    const pending = await agent.tool('cabin.calendar.prepare', args)
    assert.equal(pending.result.resultType, 'input_required')
    const handle = pending.result._meta['com.runeditrun/approval']
    const uri = h.origin + '/agents/approvals/' + handle.id
    let event = (await eventList(c, { after: cursor })).events.find(event => event.uri === uri)
    if (upgrade && action === 'approve') {
      assert.equal(event.decision, undefined, 'the pre-upgrade pending event lacks its disposition')
      const original = structuredClone(event)
      const sql = await readFile('migrations/core/0070_cabin_event_decisions.sql', 'utf8')
      await h.db.batch(unstable_splitSqlQuery(sql).map(statement => h.db.prepare(statement)))
      event = (await eventList(c, { after: cursor })).events.find(event => event.uri === uri)
      assert.deepEqual(event, { ...original, decision: 'approval' })
      assert.deepEqual((await eventList(c)).events.find(event => event.id === legacyFlag.id), { ...legacyFlag, decision: 'review' })
    }
    assert.equal(event.type, 'approval.pending')
    assert.equal(event.decision, 'approval')
    assert.deepEqual(event.classes, [{ class: 'standard', facts: { measure: 1 } }])
    assert.equal(event.actor.agent.id, agent.agentId)
    assert.equal(event.actor.for.id, (await h.state()).actor.id)
    assert.equal((await h.state()).calendarDrafts.length, before, 'pending approval has no native effect')
    const hidden = await eventList(outsider, { after: cursor })
    assert.ok(!JSON.stringify(hidden).includes(handle.id))
    const summary = (await c.personJson('/agents/api/approvals/' + handle.id)).approval
    const denied = await h.send('/agents/api/approvals/' + handle.id + '/approve', { revision: summary.revision, summary_sha256: summary.summary_sha256 }, cookie)
    assert.equal(denied.status, 403)
    assert.equal((await h.state()).calendarDrafts.length, before)
    assert.ok(!(await eventList(c, { after: cursor })).events.some(event => event.uri === uri && event.type === 'approval.decided'))
    const decided = await agent.decideApproval(pending, action)
    assert.equal(decided.status, 200)
    const pair = (await eventList(c, { after: event.id })).events.filter(event => event.uri === uri)
    assert.equal(pair.length, 1)
    assert.equal(pair[0].type, 'approval.decided')
    assert.equal(pair[0].decision, 'approval')
    assert.equal(pair[0].state, action === 'approve' ? 'executed' : 'rejected')
    assert.deepEqual(pair[0].classes, event.classes)
    assert.equal(pair[0].actor.person.id, (await h.state()).actor.id)
    assert.equal((await h.state()).calendarDrafts.length, before + (action === 'approve' ? 1 : 0))
    const replay = await agent.tool('cabin.calendar.prepare', args)
    assert.equal(action === 'approve' ? replay.result.isError : errorCode(replay), action === 'approve' ? false : 'approval_rejected')
    assert.deepEqual((await eventList(c, { after: event.id })).events.filter(event => event.uri === uri), pair)
    expected.push(event, ...pair)
  }
  await c.adopt(policy('review'))
  const reviewed = await agent.tool('cabin.calendar.prepare', { ...draftOperations(f)[0].input, idempotency_key: randomUUID() })
  assert.equal(reviewed.result.isError, false)
  const reviews = (await c.personJson('/agents/api/reviews')).reviews
  const review = reviews.find(row => row.decision_id === reviewed.decision.id)
  assert.ok(review)
  const path = '/agents/api/reviews/' + review.id + '/flag'
  assert.equal((await h.send(path, {}, cookie)).status, 403)
  assert.ok(!(await eventList(c, { after: cursor })).events.some(event => event.type === 'review.flagged'))
  assert.equal((await h.send(path, {}, h.owner)).status, 200)
  const flagged = (await eventList(c, { after: cursor })).events.find(event => event.type === 'review.flagged')
  assert.ok(flagged)
  assert.equal(flagged.decision, 'review')
  assert.deepEqual(flagged.classes, [{ class: 'standard', facts: { measure: 1 } }])
  assert.equal(flagged.actor.person.id, (await h.state()).actor.id)
  assert.ok(!JSON.stringify(await eventList(outsider, { after: cursor })).includes(review.id))
  expected.push(flagged)
  const ids = new Set(expected.map(event => event.id))
  const replay = (await eventList(c, { after: cursor })).events.filter(event => ids.has(event.id))
  assert.deepEqual(replay, expected)
  assert.ok(!JSON.stringify(replay).includes('Private synthetic'))
  assert.ok(!JSON.stringify(replay).includes(address('synthetic-cabin-host')))
  for (const event of replay) assert.deepEqual(Object.keys(event).sort(),
    ['actor', 'at', 'classes', 'decision', 'decision_id', 'id', 'type', 'uri', ...(event.type === 'approval.decided' ? ['state'] : [])].sort())
  await h.restart()
  assert.deepEqual((await eventList(c, { after: cursor })).events.filter(event => ids.has(event.id)), replay)
  await c.adopt(policy('review'), { revoked: { agents: [agent.agentId], consents: [] } })
  assert.equal((await agent.tool('cabin.events.list')).status, 401)
  assert.deepEqual((await eventList(c, { after: cursor })).events.filter(event => ids.has(event.id)), replay)
  const adopted = (await eventList(c)).events.findLast(event => event.type === 'policy.adopted')
  t.diagnostic(`PROBE BASE-AGENT-010 6 ${document.rules[0].do}: MCP prepare, native approve or reject and review flag -> exact classes and dispositions, unauthorized person refused without effects, ordered durable replay and revoked agent refused; policy.adopted fields=${Object.keys(adopted).sort().join(',')}`)
}

/** Consume the public live transport without waiting for the whole SSE response. */
export async function listen(h, client, uris, options = {}) {
  const { accessToken } = await import('../src/modules/agent-door/conformance/crypto.mjs')
  const { VERSION } = await import('../src/modules/agent-door/conformance/protocol.mjs')
  const abort = new AbortController(), method = ['subscriptions', 'listen'].join('/')
  const response = await client.request('/mcp', { method: 'POST', signal: abort.signal, headers: {
    Origin: h.origin, Authorization: `Bearer ${options.token ?? await accessToken(client)}`,
    'Content-Type': 'application/json', 'MCP-Protocol-Version': VERSION, 'Mcp-Method': method,
  }, body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params: {
    notifications: { resourceSubscriptions: uris }, _meta: { 'io.modelcontextprotocol/protocolVersion': VERSION },
  } }) })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  const reader = response.body.getReader(), decoder = new TextDecoder(), messages = []
  let buffer = '', done = false, error
  const pump = (async () => {
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
          const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
          if (data) messages.push(JSON.parse(data))
        }
      }
    } catch (cause) { if (!abort.signal.aborted) error = cause }
    finally { done = true }
  })()
  const wait = async (predicate, timeout = 10000) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      if (error) throw error
      const match = messages.find(predicate)
      if (match) return match
      if (done) throw new Error('Subscription completed before the expected notification')
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw new Error('Subscription notification was not delivered within 10 seconds')
  }
  const close = async () => { abort.abort(); await reader.cancel().catch(() => {}); await pump }
  try {
    const ack = await wait(message => message.method === ['notifications', 'subscriptions', 'acknowledged'].join('/'))
    return { messages, ack, wait, close }
  } catch (cause) { await close(); throw cause }
}
