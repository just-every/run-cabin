import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'
import { homeDay } from './home-calendar.mjs'

// A small company on Workers Free shares 5,000,000 D1 rows read a day, and the Cron runs 288 times: a quiet
// tick must cost the same few rows whether Cabin holds a month of history or years of it.
const day = n => homeDay(n, 'America/New_York')
const CEILING = 150
const heaviest = r => JSON.stringify(Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 4))

test('CRON-D1: a quiet five-minute tick reads a flat handful of rows however much history is stored', async () => {
 const h = await harness({ entry: 'tests/cron-budget-worker.ts' })
 try {
  const home = await h.cmd('property.save', { name: 'Lake Loft', ownerName: 'Karen', ownerEmail: 'karen@stay.example', commissionBps: 2000 })
  const cleaner = await h.cmd('member.save', { name: 'Luis', email: 'luis@stay.example', role: 'cleaner', active: true })
  await h.cmd('home.settings', { propertyId: home.id, address: '240 Lake Road, Boone, NC', timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: '10:00', cleanerId: cleaner.id, checklist: ['Ready'], photosRequired: 1 })
  const bookings = []
  for (let i = 0; i < 60; i++) bookings.push(await h.cmd('reservation.create', { propertyId: home.id, channel: 'direct', method: 'phone', sourceId: 'CALL-' + i, guestName: 'Guest ' + i, guestEmail: `guest${i}@stay.example`, start: day(10 + i * 3), end: day(12 + i * 3), rentCents: 50000, policyName: 'Flexible', retainedBps: 0, noShowBps: 0 }))
  // Forty settled direct-payment schedules, as a home accumulates them over a year.
  const job = (i, k) => ({ id: `j${i}-${k}`, label: 'Payment ' + k, amountCents: 20000, leadDays: 7, dueAt: '2026-01-01T00:00:00.000Z', status: 'succeeded', attempts: [{ id: `a${i}-${k}`, at: '2026-01-01T00:00:00.000Z', outcome: 'succeeded' }], resolvedAt: '2026-01-01T00:00:00.000Z' })
  for (let i = 0; i < 40; i++) {
   const plan = { id: 'plan-' + i, revision: 'r' + i, propertyId: home.id, bookingId: bookings[i].id, createdAt: '2026-01-01T00:00:00.000Z', authority: { id: 'o', email: '', role: 'owner', isAgent: false, operatorVersion: 0 }, policy: 'Flexible', status: 'cancelled', mode: 'test', jobs: [job(i, 1), job(i, 2), job(i, 3)], assigneeId: 'o', history: [] }
   await h.db.prepare('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?)').bind('collectionPlans', plan.id, plan.revision, JSON.stringify(plan)).run()
  }
  const version = async () => (await h.db.prepare('SELECT version FROM cb_meta WHERE id=1').first()).version
  const records = async () => (await h.db.prepare('SELECT count(*) AS n FROM cb_records').first()).n
  const tick = async () => { const r = await h.send('/__cron-reads'); assert.equal(r.status, 200, r.text); return r.value }
  // The first runs deliver what the bookings queued; after that nothing is due.
  await tick(); await tick()
  assert.ok(await records() >= 400, 'a realistic book of records is stored')
  const before = await version(), small = await tick()
  assert.ok(small.rows <= CEILING, `quiet tick read ${small.rows} rows over ${small.statements} statements: ${heaviest(small)}`)
  assert.equal(await version(), before, 'a quiet tick commits nothing')
  // Years more history, written as settled rows of the kinds the Cron looks at.
  await h.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<3000) INSERT INTO cb_records(kind,id,revision,data) SELECT k.kind,k.kind||'-old-'||n.i,'r',json_object('id',k.kind||'-old-'||n.i,'revision','r','propertyId','p','status','sent','dueAt','2025-01-01T00:00:00.000Z','direction','out') FROM n,(SELECT 'messages' AS kind UNION ALL SELECT 'notices' UNION ALL SELECT 'scheduled' UNION ALL SELECT 'deliveries') k`).run()
  const fill = (sql, ...values) => h.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1500) ${sql}`).bind(...values).run()
  await fill("INSERT INTO cb_direct_stays(id,property_id,token_hash,data) SELECT 'old-'||i,?,'old-'||i,json_object('id','old-'||i,'bookingId','old-'||i,'phase','confirmed','end','2025-01-04','createdAt','2025-01-01T00:00:00.000Z','quote',json_object('depositCents',5000),'deposit',json_object('id','d'||i,'status','canceled'),'refunds',json_array(json_object('status','succeeded'))) FROM n", home.id)
  await fill("INSERT INTO cb_verifications(id,booking_id,property_id,data) SELECT 'old-'||i,'old-'||i,?,json_object('id','old-'||i,'status','verified','retainUntil','2027-01-01T00:00:00.000Z') FROM n", home.id)
  await fill("INSERT INTO cb_report_runs(id,schedule_id,due_at,data) SELECT 'old-'||i,'s','2025-01-01T00:00:'||i,json_object('id','old-'||i,'status','sent','startedAt','2025-01-01T00:00:00.000Z') FROM n")
  await fill("INSERT INTO cb_tax_deliveries(id,report_id,jurisdiction_id,status,data) SELECT 'old-'||i,'r','j'||i,'sent','{}' FROM n")
  await fill("INSERT INTO cb_records(kind,id,revision,data) SELECT 'collectionPlans','old-plan-'||i,'r',json_object('id','old-plan-'||i,'status','cancelled','jobs',json_array(json_object('id','j','status','succeeded','attempts',json_array()))) FROM n")
  const large = await tick()
  assert.ok(large.rows <= CEILING, `quiet tick over ${await records()} records read ${large.rows} rows: ${heaviest(large)}`)
  assert.equal(await version(), before)
 } finally { await h.close() }
})
