import { homeDay } from './home-calendar.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'

const day = n => homeDay(n, 'America/New_York')
const live = (s, bookingId) => s.turnovers.find(t => t.bookingId === bookingId && !['draft', 'cancelled'].includes(t.status))
const pending = t => t.dispatch.offers.filter(o => o.generation === t.dispatch.generation && o.status === 'pending')
const capacity = (h, m, values = {}) => h.cmd('cleaner.capacity', { memberId: m.id, homeBase: '100 Main Street, Boone, NC 28607', timeZone: 'America/New_York', availableFrom: '06:00', dailyJobs: 4, dailyMinutes: 600, ...values })
async function configure(h, name, cleaners, values = {}) {
 const home = await h.cmd('property.save', { name, ownerName: 'Morgan Lee', ownerEmail: 'morgan@stay.example', commissionBps: 1500 })
 const settings = await h.cmd('home.settings', { propertyId: home.id, address: `${name}, Boone, NC 28607`, timeZone: 'America/New_York', checkOutTime: '10:00', checkInTime: '16:00', cleanerId: cleaners[0]?.id ?? null, checklist: ['Change linen', 'Clean kitchen', 'Inspect doors'], photosRequired: 1, ...values,
  dispatch: { templateName: 'Clean and inspect', instructions: 'Inspect the patio light; report a fault before arrival.', durationMinutes: 120, rateCents: 14500, startOffsetMinutes: 0, finishBeforeMinutes: 0, approvedCleanerIds: cleaners.map(m => m.id), offerCount: 3, responseMinutes: 120, reminderMinutes: 30, escalationMinutes: 60, ...values.dispatch } })
 return { home, settings }
}
async function drive(h, propertyId, from, minutes) {
 const settings = (await h.accessState()).homeSettings.find(s => s.propertyId === propertyId)
 return h.cmd('home.drive', { propertyId, revision: settings.revision, from, minutes })
}
async function reservation(h, propertyId, start = day(3), end = day(5)) {
 return h.cmd('reservation.request', { propertyId, channel: 'direct', kind: 'stay', guestName: 'Ana Ruiz', start, end })
}
async function respond(h, t, cleaner, action = 'accept', reason = '') {
 const offer = t.dispatch.offers.find(o => o.memberId === cleaner.id && (o.status === 'pending' || o.status === 'accepted') && o.generation === t.dispatch.generation)
 assert.ok(offer, 'cleaner received a current offer')
 return h.cmd(`turnover.${action}`, { id: t.id, revision: t.revision, offerId: offer.id, reason }, cleaner.cookie)
}

test('OPS-001: a cancelling cleaner triggers three nearby approved backups; first acceptance wins, revisions and cancellation keep one job', async () => {
 const h = await harness()
 try {
  const cleaners = []
  for (const name of ['Taylor', 'Casey', 'Jules', 'Robin']) cleaners.push(await h.person(name))
  // Public writes share a version guard, so independent setup requests are kept sequential.
  for (const cleaner of cleaners) await capacity(h, cleaner)
  const { home } = await configure(h, '18 Fernwood Lane', cleaners)
  for (const [i, cleaner] of cleaners.entries()) await drive(h, home.id, `base:${cleaner.id}`, 10 + i * 10)
  const request = await reservation(h, home.id)
  let s = await h.accessState(), t = live(s, request.bookingId)
  assert.equal(s.turnovers.filter(j => j.bookingId === request.bookingId).length, 1)
  assert.equal(t.cleanerId, null); assert.equal(pending(t).length, 3)
  assert.ok(!s.codes.some(c => c.turnoverId === t.id && c.status === 'issued'))
  const offered = await h.accessState(cleaners[0].cookie)
  assert.equal(offered.turnovers[0].id, t.id)
  assert.ok(offered.turnovers[0].dispatch.offers.every(o => o.memberId === cleaners[0].id))
  assert.ok(offered.bookings.every(b => !b.guestName && !b.guestEmail))
  t = await respond(h, t, cleaners[0])
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.cleanerId, cleaners[0].id); assert.equal(t.dispatch.acceptedBy, cleaners[0].id)
  const originalCode = s.codes.find(c => c.turnoverId === t.id && c.status === 'issued')
  assert.ok(originalCode)
  t = await respond(h, t, cleaners[0], 'decline', 'My vehicle broke down')
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(pending(t).length, 3)
  assert.deepEqual(new Set(pending(t).map(o => o.memberId)), new Set(cleaners.slice(1).map(m => m.id)))
  assert.equal(s.codes.find(c => c.id === originalCode.id).status, 'revoked')
  assert.ok(s.tasks.some(k => k.turnoverId === t.id && k.status === 'open' && k.blocking))
  const contenders = cleaners.slice(1, 3).map(cleaner => ({ cleaner, offer: pending(t).find(o => o.memberId === cleaner.id) }))
  const race = await Promise.all(contenders.map(({ cleaner, offer }) => h.send('/api/cabin/command', { name: 'turnover.accept', input: { id: t.id, revision: t.revision, offerId: offer.id } }, cleaner.cookie)))
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409])
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.dispatch.offers.filter(o => o.generation === t.dispatch.generation && o.status === 'accepted').length, 1)
  assert.equal(s.codes.filter(c => c.turnoverId === t.id && c.status === 'issued').length, 1)
  assert.ok(s.tasks.filter(k => k.turnoverId === t.id).every(k => k.status === 'closed'))
  const oldRevision = t.revision, winner = cleaners.find(m => m.id === t.cleanerId), oldOffer = t.dispatch.offers.find(o => o.status === 'accepted')
  await h.cmd('reservation.move', { id: request.bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===request.bookingId).revision, start: day(3), end: day(6) })
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.id, offered.turnovers[0].id); assert.equal(t.cleanerId, null)
  assert.equal(t.windowStart.slice(0, 10), day(6)); assert.equal(t.dispatch.rateCents, 14500)
  assert.ok(t.history.some(e => e.action.includes('acceptance invalidated')))
  await h.cmd('turnover.accept', { id: t.id, revision: oldRevision, offerId: oldOffer.id }, winner.cookie, 409)
  const settings = s.homeSettings.find(r => r.propertyId === home.id)
  await h.cmd('home.settings', { ...settings, checklist: ['Change linen', 'Inspect replacement patio light'], dispatch: { ...settings.dispatch, instructions: 'Use new linen in the hall closet.', rateCents: 16000 } })
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.dispatch.instructions, 'Use new linen in the hall closet.'); assert.equal(t.dispatch.rateCents, 16000)
  // Recovery uses the same acceptance and capacity door instead of forcing an assignment.
  await h.cmd('booking.details', { id: request.bookingId,revision:(await h.accessState()).bookings.find(row=>row.id===request.bookingId).revision, guestName: 'Ana Ruiz', guestEmail: 'ana@guest.example' })
  await h.cmd('recovery.settings', { propertyId: home.id, cleanerIds: cleaners.map(m => m.id), auto: false, creditLimitCents: 0, cleaningLimitCents: 0 })
  let recovery = await h.cmd('recovery.open', { bookingId: request.bookingId, trigger: 'cleaner_cancelled', reason: 'Replacement required after changed instructions' })
  recovery = await h.cmd('recovery.propose', { id: recovery.id, revision: recovery.revision, cleanerId: cleaners[1].id, creditCents: 0, extraCleaningCents: 0, why: 'Approved backup with saved route and capacity' })
  recovery = await h.cmd('recovery.approve', { id: recovery.id, revision: recovery.revision })
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.cleanerId, null); assert.equal(t.status, 'unassigned')
  await respond(h, t, cleaners[1])
  s = await h.accessState(); t = live(s, request.bookingId)
  assert.equal(t.cleanerId, cleaners[1].id); assert.ok(s.recoveries.find(r => r.id === recovery.id).acceptedAt)
  await h.cmd('reservation.cancel', { id: request.bookingId ,revision:(await h.accessState()).bookings.find(row=>row.id===request.bookingId).revision})
  s = await h.accessState(); const cancelled = s.turnovers.find(j => j.id === t.id)
  assert.equal(cancelled.status, 'cancelled'); assert.ok(!pending(cancelled).length)
  assert.ok(!s.codes.some(c => c.bookingId === request.bookingId && c.status === 'issued'))
  assert.equal(s.turnovers.filter(j => j.bookingId === request.bookingId).length, 1)
  assert.ok(s.statements.every(statement => statement.netCents === 0), 'offers and replacement never manufacture payable work')
 } finally { await h.close() }
})

test('OPS-001: travel conflicts, daily jobs, hours and changed addresses route to eligible backups or show a manager the reason', async () => {
 const h = await harness()
 try {
  const primary = await h.person('Primary'), backup = await h.person('Backup')
  await capacity(h, primary, { dailyJobs: 2 }); await capacity(h, backup)
  const a = await configure(h, '18 Fernwood Lane', [primary, backup], { checkInTime: '12:00', dispatch: { offerCount: 1 } })
  const b = await configure(h, '225 Deerfield Road', [primary, backup], { checkOutTime: '12:00', checkInTime: '14:00', dispatch: { offerCount: 1 } })
  const c = await configure(h, '129 Oak Street', [primary, backup], { checkOutTime: '14:00', checkInTime: '16:00', dispatch: { offerCount: 1 } })
  const d = await configure(h, '555 Hardin Street', [primary, backup], { checkOutTime: '17:00', checkInTime: '20:00', dispatch: { offerCount: 1 } })
  for (const { home } of [a, b, c, d]) for (const cleaner of [primary, backup]) await drive(h, home.id, `base:${cleaner.id}`, 15)
  await drive(h, b.home.id, a.home.id, 180)
  await drive(h, c.home.id, a.home.id, 15)
  const one = await reservation(h, a.home.id), two = await reservation(h, b.home.id), three = await reservation(h, c.home.id)
  let s = await h.accessState(), t = live(s, one.bookingId)
  await respond(h, t, primary)
  // Offers are rechecked when accepted: the earlier offer cannot bypass the newly accepted route.
  s = await h.accessState(); t = live(s, two.bookingId)
  const old = pending(t).find(o => o.memberId === primary.id)
  if (old) await h.cmd('turnover.accept', { id: t.id, revision: t.revision, offerId: old.id }, primary.cookie, 409)
  await h.cmd('turnover.offers', { id: t.id, revision: t.revision })
  s = await h.accessState(); t = live(s, two.bookingId)
  assert.ok(t.dispatch.reasons.some(r => /Cannot reach/.test(r)))
  assert.deepEqual(pending(t).map(o => o.memberId), [backup.id]); await respond(h, t, backup)
  s = await h.accessState(); t = live(s, three.bookingId); await respond(h, t, primary)
  const four = await reservation(h, d.home.id)
  s = await h.accessState(); t = live(s, four.bookingId)
  assert.ok(t.dispatch.reasons.some(r => /Daily capacity exceeded/.test(r)))
  // The backup also needs a known onward route; missing travel becomes an explicit manager task.
  assert.ok(t.dispatch.reasons.some(r => /Drive time missing/.test(r)))
  assert.equal(pending(t).length, 0); assert.ok(s.tasks.some(k => k.turnoverId === t.id && k.status === 'open'))
  await drive(h, d.home.id, b.home.id, 20)
  s = await h.accessState(); t = live(s, four.bookingId); assert.deepEqual(pending(t).map(o => o.memberId), [backup.id])
  // A changed address invalidates its entered drive time rather than guessing a route.
  const settings = s.homeSettings.find(r => r.propertyId === d.home.id)
  await h.cmd('home.settings', { ...settings, address: '601 Hardin Street, Boone, NC 28607' })
  s = await h.accessState(); t = live(s, four.bookingId)
  const currentOffer = pending(t).find(o => o.memberId === backup.id)
  if (currentOffer) await h.cmd('turnover.accept', { id: t.id, revision: t.revision, offerId: currentOffer.id }, backup.cookie, 409)
  assert.ok(t.dispatch.reasons.some(r => /Drive time missing/.test(r)))
  await drive(h, d.home.id, c.home.id, 15)
  const profile = s.cleanerProfiles.find(p => p.id === primary.id)
  await capacity(h, primary, { revision: profile.revision, dailyJobs: 8, dailyMinutes: 300 })
  s = await h.accessState(); t = live(s, four.bookingId)
  assert.ok(t.dispatch.reasons.some(r => /Daily hours exceeded/.test(r)))
 } finally { await h.close() }
})

test('OPS-001: near-arrival offers remind once on the scheduled door and infeasible arrival deadlines escalate', async () => {
 const h = await harness()
 try {
  const cleaner = await h.person('Reminder'); await capacity(h, cleaner, { availableFrom: '00:00' })
  const zone = 'America/New_York', local = ms => new Date(ms).toLocaleString('sv-SE', { timeZone: zone }).slice(0, 16).replace(' ', 'T')
  const now = Date.now(), date = local(now).slice(0, 10), arrival = local(now + 22 * 60000)
  const { home } = await configure(h, '18 Fernwood Lane', [cleaner], { checkOutTime: '00:00', checkInTime: arrival.slice(11), dispatch: { durationMinutes: 15, escalationMinutes: 5, responseMinutes: 5, reminderMinutes: 4, offerCount: 1 } })
  await drive(h, home.id, `base:${cleaner.id}`, 1)
  const departing = await reservation(h, home.id, day(-2), date)
  await reservation(h, home.id, arrival.slice(0, 10), day(2))
  let s = await h.accessState(), t = live(s, departing.bookingId)
  assert.equal(pending(t).length, 1); assert.ok(pending(t)[0].reminderAt)
  const count = s.notices.filter(n => n.recordId === t.id && n.subject.startsWith('Reminder:')).length
  assert.equal(count, 1)
  await (await h.mf.getWorker()).scheduled({ cron: '*/5 * * * *' })
  s = await h.accessState(); assert.equal(s.notices.filter(n => n.recordId === t.id && n.subject.startsWith('Reminder:')).length, count)
  const settings = s.homeSettings.find(r => r.propertyId === home.id)
  await h.cmd('home.settings', { ...settings, dispatch: { ...settings.dispatch, durationMinutes: 30 } })
  s = await h.accessState(); t = live(s, departing.bookingId)
  assert.equal(pending(t).length, 0); assert.ok(t.dispatch.escalatedAt)
  assert.ok(s.tasks.some(k => k.turnoverId === t.id && k.blocking && k.status === 'open'))
 } finally { await h.close() }
})
