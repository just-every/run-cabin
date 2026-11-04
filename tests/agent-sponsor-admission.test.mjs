import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'
import { accessToken, autonomousPolicy, heldPolicy, signJws } from '../src/modules/agent-door/conformance/crypto.mjs'
import { createProtocol, errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'

const surface = JSON.parse(await readFile('agent-surface.json', 'utf8'))
const address = name => [name, 'stay.example'].join('@')

test('Native sponsor offboarding and configured admission exclusions fence fresh Business agents across restart', { timeout: 120000 }, async t => {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signer = { privateKey: keys.privateKey, kid: 'synthetic-cabin-1', issuer: 'https://synthetic-business.example', installationId: 'synthetic-cabin-1' }
  const h = await harness({ auth: { RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId,
    RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: await webcrypto.subtle.exportKey('jwk', keys.publicKey) }) } })
  try {
    const business = 'synthetic-cabin-1'
    const owner = { sub: 'synthetic-cabin-owner', email: h.auth.OWNER_EMAIL, cookie: h.owner }
    const protocol = person => createProtocol({ fetch: (url, init) => h.mf.dispatchFetch(url, init), origin: h.origin, surface, signer, person, business,
      consent: randomUUID(), agentId: randomUUID(), seq: 0, revision: 0, points: [], listed: new Map() })
    const c = protocol(owner)
    const home = await h.cmd('property.save', { name: 'Synthetic cabin', ownerName: 'Synthetic host', ownerEmail: address('synthetic-cabin-host'), commissionBps: 1500 })
    const task = await h.cmd('task.raise', { propertyId: home.id, title: 'Inspect synthetic cabin', note: 'Retain this business record during admission refusals.' })
    // Native invitations and their captured mail confirmations create both accounts and sessions.
    const inactive = await h.person('synthetic-cabin-2', 'manager')
    const excluded = await h.person('synthetic-cabin-3', 'manager')
    const people = [inactive, excluded].map(member => ({ sub: member.name, email: member.email, cookie: member.cookie }))
    const iat = Math.floor(Date.now() / 1000)
    const settings = await signJws(signer.privateKey, signer.kid, 'rer-business-settings+jwt', {
      v: 1, iss: signer.issuer, aud: h.origin, sub: signer.installationId, business, email: owner.email, owner_id: owner.sub,
      jti: randomUUID(), iat, exp: iat + 300, rev: 1, values: { display_name: 'Synthetic rental company' }, logo: null,
      team: people.map(person => ({ id: person.sub, email: person.email, name: person.sub, role: 'member', invite: 0 })),
    })
    const paired = await h.send('/api/rer/business-settings', { settings })
    assert.equal(paired.status, 200, paired.text)
    assert.deepEqual(paired.value.team.map(person => person.state), ['active', 'active'])
    const draft = { propertyId: home.id, channel: 'vrbo', calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-cabin-1\r\nDTSTART;VALUE=DATE:20300601\r\nDTEND;VALUE=DATE:20300604\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR' }
    async function readVisible(client, cookie) {
      const native = await h.state(cookie)
      assert.ok(native.tasks.some(row => row.id === task.id), 'native fixture contains the saved task')
      let read = await client.tool('cabin.records.list', { kind: 'tasks' })
      if (read.result?.resultType === 'input_required') {
        assert.ok((await client.decideApproval(read)).ok, 'the native sponsor approves its exact held read')
        read = await client.tool('cabin.records.list', { kind: 'tasks' }, { requestState: read.result.requestState })
      }
      assert.equal(read.status, 200)
      assert.equal(errorCode(read), null, JSON.stringify(read.body))
      assert.deepEqual(read.result.structuredContent.records, native.tasks)
    }
    async function refuses(person) {
      const native = await h.state(), fingerprint = await c.witness()
      // Every attempt uses a new agent and consent, avoiding an old identity binding as the reason for refusal.
      for (const mutation of [false, true]) {
        const client = protocol(person)
        const token = await accessToken(client)
        const answer = mutation
          ? await client.tool('cabin.calendar.prepare', { ...draft, idempotency_key: randomUUID() }, { token })
          : await client.mcp(['tools', 'list'].join('/'), {}, { token })
        assert.equal(answer.status, 401, JSON.stringify(answer.body))
        assert.equal(answer.body.error.code, -32001, 'typed unauthenticated JSON-RPC refusal')
        assert.equal(answer.result, undefined, 'refusal discloses no records or tools')
        assert.ok(answer.headers.get('www-authenticate')?.includes('resource_metadata='))
      }
      assert.deepEqual(await c.witness(), fingerprint)
      assert.deepEqual(await h.state(), native, 'refused sponsor calls change no native business state')
      await readVisible(c, h.owner)
    }
    // Both identities must first resolve through the signed roster and see real native records.
    for (const policy of [autonomousPolicy, heldPolicy]) {
      await c.adopt(policy())
      for (const person of people) {
        const client = protocol(person)
        await readVisible(client, person.cookie)
        const before = await c.witness()
        const denied = await client.tool('cabin.calendar.prepare', { ...draft, idempotency_key: randomUUID() })
        assert.equal(errorCode(denied), 'owner_required')
        assert.deepEqual(await c.witness(), before, 'a bound non-owner still cannot prepare owner drafts')
      }
    }
    await h.cmd('member.save', { ...inactive, active: false })
    assert.equal((await h.send('/api/cabin/state', undefined, inactive.cookie)).status, 403)
    for (const policy of [autonomousPolicy, heldPolicy]) {
      await c.adopt(policy())
      await refuses(people[0])
      await readVisible(protocol(people[1]), excluded.cookie)
    }
    t.diagnostic('PROBE BASE-AGENT-004 inactive: native invitation, confirmation and signed roster, then member.save active=false -> fresh signed read and draft calls return typed 401 under autonomous and held policies; native state unchanged, admitted owner and other sponsor remain usable')
    const beforeRestart = await c.witness()
    await h.restart({ auth: { AUTH_ALLOW_LIST: h.auth.OWNER_EMAIL } })
    assert.deepEqual(await c.witness(), beforeRestart, 'same installation and business records survive configuration restart')
    assert.ok((await h.state()).members.find(row => row.id === excluded.id).active, 'excluded sponsor remains natively active')
    assert.equal((await h.send('/api/cabin/state', undefined, excluded.cookie)).status, 401)
    assert.equal((await h.send('/api/cabin/state', undefined, inactive.cookie)).status, 401)
    for (const policy of [autonomousPolicy, heldPolicy]) {
      await c.adopt(policy())
      await refuses(people[0])
      await refuses(people[1])
    }
    t.diagnostic('PROBE BASE-AGENT-004 excluded: restart the same installation with the owner-only AUTH_ALLOW_LIST -> active but excluded sponsor and inactive sponsor return typed 401 for fresh signed read and draft calls under both policies; native state unchanged and owner access continues')
    // Another cold start proves that neither refusal is merely an in-memory fence.
    await h.restart()
    for (const policy of [autonomousPolicy, heldPolicy]) {
      await c.adopt(policy())
      await refuses(people[0])
      await refuses(people[1])
    }
    // Remove the configuration fence so it cannot mask a lost native offboarding fence.
    await h.restart({ auth: { AUTH_ALLOW_LIST: [owner.email, ...people.map(person => person.email)].join(',') } })
    const restoredAdmission = await h.state()
    assert.equal(restoredAdmission.members.find(row => row.id === inactive.id).active, false)
    assert.equal(restoredAdmission.members.find(row => row.id === excluded.id).active, true)
    assert.equal((await h.send('/api/cabin/state', undefined, inactive.cookie)).status, 403)
    for (const policy of [autonomousPolicy, heldPolicy]) {
      await c.adopt(policy())
      await refuses(people[0])
      await readVisible(protocol(people[1]), excluded.cookie)
    }
    t.diagnostic('PROBE BASE-AGENT-004 independent fences: restart with both sponsor addresses admitted by configuration -> inactive sponsor still returns typed 401 for fresh signed read and draft calls and native 403, while the active sponsor resumes native and MCP reads under both policies; owner access and native business records remain intact')
    assert.ok(c.points.every(point => point.ok), JSON.stringify(c.points.filter(point => !point.ok)))
  } finally { await h.close() }
})
