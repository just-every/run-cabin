import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
