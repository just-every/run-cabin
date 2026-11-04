import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'

export const address = name => [name, 'stay.example'].join('@')
export const surface = JSON.parse(await readFile('agent-surface.json', 'utf8'))
export const collections = { homes: 'properties', people: 'members', stays: 'bookings', guests: 'guests', tasks: 'tasks', readiness: 'readinessRecords', statements: 'statements', cases: 'recoveries', calendars: 'calendarDrafts', turnovers: 'turnovers' }
export const roles = {
  manager: ['calendar:read', 'reservations:read', 'inbox:read', 'operations:read', 'finance:read', 'reports:read', 'owners:read', 'access:read', 'identity:read'],
  reservation: ['calendar:read', 'reservations:read'],
  guest_service: ['calendar:read', 'reservations:read', 'inbox:read', 'operations:read', 'access:read'],
  accountant: ['finance:read', 'reports:read'],
  inspector: ['operations:read', 'access:read'],
  cleaner: ['operations:read', 'access:read'],
  maintenance: ['operations:read', 'access:read'],
  rental_owner: ['owners:read'],
}

export async function complete(client, name, args, options = {}) {
  let answer = await client.tool(name, args, options)
  assert.equal(answer.status, 200, JSON.stringify(answer.body))
  if (answer.result?.resultType === 'input_required') {
    assert.equal(answer.result.structuredContent, undefined, 'held reads expose no records before consent')
    assert.ok((await client.decideApproval(answer)).ok)
    answer = await client.tool(name, args, { ...options, requestState: answer.result.requestState })
  }
  assert.equal(errorCode(answer), null, JSON.stringify(answer.body))
  assert.equal(answer.result.isError, false)
  assert.equal(answer.result._meta['com.runeditrun/untrusted'], true)
  return answer
}

export async function saveGrant(h, person, propertyIds, actions, pmsRole = person.pmsRole, active = true) {
  const current = (await h.state()).members.find(row => row.id === person.id)
  const fields = new URLSearchParams({ ...(current ? { id: current.id, revision: current.revision } : {}),
    name: person.name, email: person.email, pmsRole, active: String(active) })
  for (const id of propertyIds) fields.append('propertyIds', id)
  for (const action of actions) fields.append('actions', action)
  const response = await h.mf.dispatchFetch(h.origin + '/app/action?name=member.save&returnTo=/app/people', {
    method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: fields.toString(),
  })
  assert.equal(response.status, 200, await response.text())
  const saved = (await h.state()).members.find(row => row.email === person.email)
  assert.equal(saved.scope.pmsRole, pmsRole)
  assert.deepEqual(saved.scope.propertyIds, propertyIds)
  assert.deepEqual(saved.scope.actions, actions)
  return { ...person, ...saved }
}

export async function parity(h, client, cookie, token) {
  const native = await h.state(cookie), actual = {}
  for (const [kind, collection] of Object.entries(collections)) {
    const listed = await complete(client, 'cabin.records.list', { kind }, { token })
    assert.deepEqual(listed.result.structuredContent.records, native[collection], `${client.person.sub}: ${kind} list equals native HTTP`)
    actual[kind] = listed.result.structuredContent.records
    for (const row of native[collection]) {
      const read = await complete(client, 'cabin.records.read', { kind, id: row.id }, { token })
      assert.deepEqual(read.result.structuredContent.record, row, `${client.person.sub}: ${kind} read equals native HTTP`)
    }
  }
  return actual
}

export async function hidden(client, kind, id, token) {
  const denied = await client.tool('cabin.records.read', { kind, id }, { token })
  const missing = await client.tool('cabin.records.read', { kind, id: 'synthetic-cabin-missing' }, { token })
  assert.equal(denied.status, 200)
  assert.equal(errorCode(denied), 'record_not_found')
  assert.equal(errorCode(missing), errorCode(denied))
  assert.deepEqual(denied.result.content, missing.result.content)
  assert.equal(denied.result.structuredContent, undefined)
  return denied
}
