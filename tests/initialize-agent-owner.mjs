/** Conformance fixture: only the installation's real owner and command HTTP doors. */
export default async function initialize({ request, origin, claim, displayName, returnTo }) {
  const bootstrap = await request(new URL(claim.path, origin).href, { method: 'POST', redirect: 'manual',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: claim.token, displayName, returnTo }) })
  if (bootstrap.status !== 303) return bootstrap
  const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
  async function command(name, input) {
    const response = await request(new URL('/api/cabin/command', origin).href, { method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, input }) })
    const body = await response.json()
    if (!response.ok || !body.result) throw new Error(`Native fixture ${name} returned HTTP ${response.status}`)
    return body.result
  }
  const home = await command('property.save', { name: 'Pine Ridge Cabin', ownerName: 'Morgan Reed', ownerEmail: 'morgan@example.com', commissionBps: 1500 })
  await command('member.save', { name: 'Ana Diaz', email: 'ana@example.com', role: 'cleaner', active: true })
  const draft = await command('calendar.prepare', { propertyId: home.id, channel: 'airbnb', calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:agent-fixture-stay\r\nDTSTART;VALUE=DATE:20300520\r\nDTEND;VALUE=DATE:20300524\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR' })
  await command('calendar.approve', { id: draft.id, revision: draft.revision })
  return bootstrap
}
