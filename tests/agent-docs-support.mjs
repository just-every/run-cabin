import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID, webcrypto } from 'node:crypto'
import { harness } from './harness.mjs'
import { createProtocol } from '../src/modules/agent-door/conformance/protocol.mjs'
import { signJws } from '../src/modules/agent-door/conformance/crypto.mjs'

export const surface = JSON.parse(await readFile('agent-surface.json', 'utf8'))
export const address = name => [name, 'stay.example'].join('@')
export async function docsHarness() {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signer = { privateKey: keys.privateKey, kid: 'synthetic-cabin-1', issuer: 'https://synthetic-business.example', installationId: 'synthetic-cabin-1' }
  const h = await harness({ assets: true, auth: { RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId,
    RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: await webcrypto.subtle.exportKey('jwk', keys.publicKey) }) } })
  const person = { sub: 'synthetic-cabin-owner', email: h.auth.OWNER_EMAIL, cookie: h.owner }, business = 'synthetic-cabin-1'
  const c = createProtocol({ fetch: (url, init) => h.mf.dispatchFetch(url, init), origin: h.origin, surface, signer, person, business,
    consent: 'synthetic-cabin-consent', agentId: 'synthetic-cabin-agent', seq: 0, revision: 0, points: [], listed: new Map() })
  try {
    const home = await h.cmd('property.save', { name: 'Synthetic private rental', ownerName: 'Synthetic private owner', ownerEmail: address('synthetic-cabin-host'), commissionBps: 1500 })
    const cleaner = await h.cmd('member.save', { name: 'Synthetic private cleaner', email: address('synthetic-cabin-cleaner'), role: 'cleaner', active: true })
    const calendar = await h.cmd('calendar.prepare', { propertyId: home.id, channel: 'airbnb', calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-cabin-1\r\nDTSTART;VALUE=DATE:20300520\r\nDTEND;VALUE=DATE:20300524\r\nSUMMARY:Private synthetic stay\r\nEND:VEVENT\r\nEND:VCALENDAR' })
    await h.cmd('calendar.approve', { id: calendar.id, revision: calendar.revision })
    const booking = (await h.state()).bookings[0]
    const turnover = await h.cmd('turnover.prepare', { bookingId: booking.id, cleanerId: cleaner.id, checklist: ['Synthetic inspection'] })
    await h.cmd('turnover.approve', { id: turnover.id, revision: turnover.revision })
    const local = await h.cmd('agent.create', { label: 'Synthetic private draft key' })
    let revision = 0
    const pair = async (team = []) => {
      const iat = Math.floor(Date.now() / 1000)
      const settings = await signJws(signer.privateKey, signer.kid, 'rer-business-settings+jwt', { v: 1, iss: signer.issuer, aud: h.origin, sub: signer.installationId,
        business, email: person.email, owner_id: person.sub, jti: randomUUID(), iat, exp: iat + 300, rev: ++revision,
        values: { display_name: 'Synthetic private business' }, logo: null, team })
      const paired = await h.send('/api/rer/business-settings', { settings })
      assert.equal(paired.status, 200, paired.text)
      return settings
    }
    const settings = await pair()
    return { h, c, pair, home, cleaner, privateValues: [home.id, home.name, home.ownerName, home.ownerEmail, cleaner.id, cleaner.name, cleaner.email,
      booking.id, 'Private synthetic stay', 'Synthetic private business', local.token, h.auth.SESSION_SECRET, h.auth.SETUP_TOKEN, person.cookie, settings] }
  } catch (error) { await h.close(); throw error }
}

const decode = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity])
export function readDocs(text) {
  return {
    tools: [...text.matchAll(/<article data-tool="([^"]+)">([\s\S]*?)<\/article>/g)].map(([, name, html]) => ({ name: decode(name),
      scope: decode(html.match(/<dt>Scope<\/dt><dd>(.*?)<\/dd>/)[1]),
      classes: [...html.matchAll(/data-class="([^"]+)"/g)].map(match => decode(match[1])),
      inputSchema: JSON.parse(decode(html.match(/<pre data-input>([\s\S]*?)<\/pre>/)[1])),
      outputSchema: JSON.parse(decode(html.match(/<pre data-output>([\s\S]*?)<\/pre>/)[1])), html })),
    resources: [...text.matchAll(/data-resource="([^"]+)"/g)].map(match => decode(match[1])),
  }
}
