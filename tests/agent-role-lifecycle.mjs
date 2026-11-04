import assert from 'node:assert/strict'
import { accessToken } from '../src/modules/agent-door/conformance/crypto.mjs'
import { complete, parity, saveGrant } from './agent-role-support.mjs'

// Each identity was invited, confirmed and bound by the signed roster in the calling journey.
export async function sponsorLifecycle({ h, owner, manager, peer, home, token, peerToken, protocol, pair, roster, downgraded, held, t }) {
  const client = manager.client
  const peerBefore = await parity(h, peer.client, peer.cookie, peerToken)
  async function unaffected() {
    const peerAfter = await parity(h, peer.client, peer.cookie, peerToken)
    for (const kind of ['homes', 'tasks', 'stays', 'statements']) assert.deepEqual(peerAfter[kind], peerBefore[kind], `another sponsor retains ${kind}`)
    const listed = await complete(owner, 'cabin.records.list', { kind: 'homes' })
    assert.equal(listed.result.structuredContent.records.length, 3, 'native owner retains the whole portfolio')
  }
  async function refused(bearer = token) {
    for (const [name, args] of [
      ['cabin.records.list', { kind: 'homes' }],
      ['cabin.records.read', { kind: 'homes', id: home.id }],
    ]) {
      const answer = await client.tool(name, args, { token: bearer })
      assert.equal(answer.status, 401)
      assert.equal(answer.result, undefined, 'withdrawn admission returns no records')
      assert.ok(!JSON.stringify(answer.body).includes(home.name))
    }
  }

  // Native agent administration is a signed-in owner's action, even with an autonomous policy.
  const retired = protocol(client.person, `synthetic-cabin-retired-${owner.revision}`)
  const retiredToken = await accessToken(retired)
  await complete(retired, 'cabin.records.list', { kind: 'homes' }, { token: retiredToken })
  const revokePath = `/agents/api/agents/${encodeURIComponent(retired.agentId)}/revoke`
  const before = await h.send('/agents/api/agents', undefined, h.owner)
  assert.equal(before.status, 200)
  assert.equal(before.value.agents.find(row => row.id === retired.agentId).revoked, false)
  const bearerAttempt = await h.send(revokePath, {}, h.owner, { authorization: `Bearer ${await accessToken(owner)}` })
  assert.equal(bearerAttempt.status, 403)
  assert.equal(bearerAttempt.value.code, 'person_session_required')
  assert.equal((await h.send(revokePath, {}, manager.cookie)).status, 403)
  const unchanged = await h.send('/agents/api/agents', undefined, h.owner)
  assert.deepEqual(unchanged.value, before.value, 'refused administration changes no agent grant')
  assert.equal((await h.send(revokePath, {}, h.owner)).status, 200)
  assert.equal((await h.send('/agents/api/agents', undefined, h.owner)).value.agents.find(row => row.id === retired.agentId).revoked, true)
  for (const bearer of [retiredToken, await accessToken(retired)]) {
    assert.equal((await retired.tool('cabin.records.read', { kind: 'homes', id: home.id }, { token: bearer })).status, 401)
  }
  assert.deepEqual(await parity(h, client, manager.cookie, token), downgraded, 'revoking one agent leaves its sponsor’s other agent narrowed and usable')
  await unaffected()

  await saveGrant(h, manager, [home.id], ['operations:read'], 'cleaner', false)
  assert.equal((await h.send('/api/cabin/state', undefined, manager.cookie)).status, 403)
  await refused()
  await refused(await accessToken(client))
  await h.restart()
  await refused()
  assert.equal((await retired.tool('cabin.records.list', { kind: 'homes' }, { token: retiredToken })).status, 401)
  await unaffected()

  // Re-admission keeps the exact saved narrow native grant and the revoked agent stays revoked.
  const reactivated = await saveGrant(h, manager, [home.id], ['operations:read'], 'cleaner')
  const readmitted = structuredClone(downgraded)
  const self = readmitted.people.find(row => row.id === manager.id)
  self.revision = reactivated.revision
  self.scope.revision = reactivated.scope.revision
  manager.cookie = await h.signIn(manager.email)
  client.person.cookie = manager.cookie
  assert.deepEqual(await parity(h, client, manager.cookie, token), readmitted)
  const removed = await pair(roster.filter(row => row.id !== manager.sub))
  assert.deepEqual((await h.state(manager.cookie)).properties, downgraded.homes, 'roster removal leaves the narrowed native session usable')
  await refused()
  await refused(await accessToken(client))
  await h.restart()
  await refused()
  await unaffected()

  await pair()
  const staleRoster = await h.send('/api/rer/business-settings', { settings: removed })
  assert.equal(staleRoster.status, 409, 'an older signed roster cannot replace current admission')
  const fresh = protocol(client.person, `synthetic-cabin-readmitted-${owner.revision}`)
  assert.deepEqual(await parity(h, fresh, manager.cookie, await accessToken(fresh)), readmitted)
  assert.deepEqual(await parity(h, client, manager.cookie, token), readmitted)
  assert.equal((await retired.tool('cabin.records.read', { kind: 'homes', id: home.id }, { token: await accessToken(retired) })).status, 401)
  await unaffected()
  t.diagnostic(`PROBE BASE-AGENT-005 3 lifecycle: ${held ? 'held' : 'autonomous'} policy, native owner revokes one agent, suspends sponsor, then removes signed-roster admission -> old and fresh bearers return 401; restart and stale roster cannot restore access; re-admission preserves narrowed reads and permanent agent revocation; peer and owner remain usable`)
}
