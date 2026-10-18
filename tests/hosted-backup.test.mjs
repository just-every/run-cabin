import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { openBackup, sanitizeDump, seal } from '../scripts/backup/format.mjs'
import { migrationSeeds, restorePlan } from '../scripts/backup/restore.mjs'
import { insert, objects, openDump, readRows } from '../scripts/backup/sql.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function dump(db) {
  const schema = objects(db), tables = schema.filter(o => o.type === 'table')
  return [...tables.map(t => t.sql + ';'), ...tables.flatMap(t => readRows(db, t.name).map(row => insert(t.name, row))), ...schema.filter(o => o.type !== 'table').map(o => o.sql + ';')].join('\n')
}
test('hosted SQL format preserves evidence and identities, retires work, and guards empty restores', async () => {
  const migrations = resolve('migrations/core'), source = migrationSeeds(migrations), target = migrationSeeds(migrations), seeded = migrationSeeds(migrations)
  let archive, roundtrip
  try {
    // Exercise actual product tables and immutable triggers, including generated
    // SQL cells and binary photos, through the delivered backup format.
    for (const db of [source, target, seeded]) db.exec('CREATE TABLE cb_archive_extra (id INTEGER PRIMARY KEY, bytes BLOB, size INTEGER GENERATED ALWAYS AS (length(bytes)) STORED)')
    source.exec(insert('oa_operators', { id: 'operator', email: 'host@stay.example', display_name: 'Host', role: 'owner', status: 'active', version: 1, created_at: 1 }))
    source.exec(insert('oa_bootstrap', { singleton: 1, claim_id: 'operator', claimed_at: 1 }))
    source.exec(insert('oa_sessions', { id: 'session', token_hash: 'private-session-secret', operator_id: 'operator', operator_version: 1, kind: 'native', source_token_id: null, created_at: 1, expires_at: 100, revoked_at: null }))
    source.exec(insert('cb_properties', { id: 'home', name: 'Home', owner_name: 'Host', owner_email: 'host@stay.example', commission_bps: 1000, version: 1 }))
    const records = [
      { id: 'turnover', kind: 'turnovers', data: { id: 'turnover', propertyId: 'home', status: 'completed' } },
      { id: 'send', kind: 'messages', data: { id: 'send', propertyId: 'home', status: 'pending', text: 'Guest code: 1234' } },
      { id: 'charge', kind: 'bookings', data: { id: 'charge', propertyId: 'home' } },
      { id: 'agreement', kind: 'rentalAgreements', data: { id: 'agreement', propertyId: 'home', documents: [{ text: 'Signed terms', sha256: hash('Signed terms') }] } },
    ]
    for (const row of records) source.exec(insert('cb_records', { ...row, revision: 'original', data: JSON.stringify(row.data) }))
    const bytes = Buffer.from([0, 255, 42, 10])
    source.exec(insert('cb_photos', { id: 'photo', turnover_id: 'turnover', position: 0, mime_type: 'image/png', bytes, sha256: hash(bytes), caption: 'Evidence', uploaded_by: 'operator', uploaded_at: '2026-01-01' }))
    source.exec(insert('cb_archive_extra', { id: 1, bytes }))
    source.exec(insert('cb_events', { id: 'event', actor_id: 'operator', actor_role: 'owner', action: 'completed', entity_id: 'turnover', at: '2026-01-01' }))
    source.exec(insert('cb_ledger_journals', { id: 'journal', source_key: 'receipt', property_id: 'home', booking_id: 'charge', owner_key: 'owner', legal_entity: 'Host', effective_date: '2026-01-01', posted_at: '2026-01-01', actor_id: 'operator', source_type: 'receipt', source_id: 'receipt', source_revision: 'original', reversal_of: null, data: JSON.stringify({ lines: [{ debitCents: 100, creditCents: 0 }, { debitCents: 0, creditCents: 100 }] }) }))
    const backup = await sanitizeDump(dump(source))
    archive = await openBackup(backup.text)
    assert.equal(readRows(archive, 'oa_sessions').length, 0)
    assert.equal(readRows(archive, 'oa_operators')[0].id, 'operator')
    assert.deepEqual(Buffer.from(readRows(archive, 'cb_photos')[0].bytes), bytes)
    assert.equal(archive.prepare('SELECT size FROM cb_archive_extra').get().size, bytes.length)
    const saved = readRows(archive, 'cb_records').map(row => ({ ...row, data: JSON.parse(row.data) }))
    assert.equal(saved.find(r => r.id === 'charge').data.restorePaused, true)
    assert.equal(saved.find(r => r.id === 'send').data.status, 'discarded')
    assert.equal(saved.find(r => r.id === 'agreement').data.documents[0].text, 'Signed terms')
    assert.ok(readRows(archive, 'cb_provider_sharing').every(row => row.enabled === 0))
    target.exec(insert('oa_operators', { id: 'deployment-owner', email: 'host@stay.example', display_name: 'New deployment', role: 'owner', status: 'active', version: 1, created_at: 2 }))
    target.exec(insert('oa_bootstrap', { singleton: 1, claim_id: 'deployment-owner', claimed_at: 2 }))
    target.exec(insert('oa_sessions', { id: 'bootstrap-session', token_hash: 'target-session-secret', operator_id: 'deployment-owner', operator_version: 1, kind: 'native', source_token_id: null, created_at: 2, expires_at: 100, revoked_at: null }))
    target.exec(insert('oa_limits', { key: 'bootstrap-rate-bucket', window: 1, count: 1 }))
    target.exec(insert('oa_operators', { id: 'extra', email: 'staff@stay.example', display_name: 'Staff', role: 'member', status: 'active', version: 1, created_at: 3 }))
    assert.throws(() => restorePlan(archive, target, seeded), /additional operators/)
    target.exec("DELETE FROM oa_operators WHERE id='extra'")
    const plan = restorePlan(archive, target, seeded)
    target.exec(insert('cb_properties', readRows(source, 'cb_properties')[0]))
    target.exec('BEGIN;')
    assert.throws(() => target.exec(plan), /CHECK constraint failed/)
    target.exec('ROLLBACK; DELETE FROM cb_properties;')
    target.exec('BEGIN;'); target.exec(restorePlan(archive, target, seeded)); target.exec('COMMIT;')
    assert.equal(readRows(target, 'cb_restore_review')[0].reviewed, 0)
    assert.equal(readRows(target, 'oa_operators')[0].id, 'operator')
    assert.equal(readRows(target, 'oa_sessions').length, 0)
    assert.throws(() => restorePlan(archive, target, seeded), /empty product data/)
    assert.throws(() => target.exec("DELETE FROM cb_events"), /permanent/)
    await assert.rejects(openBackup(backup.text.replace('PRAGMA', 'PRAGMX')), /checksum/)
    // A recomputed transport hash cannot turn active work into a valid archive.
    const unsafe = openDump(backup.text.slice(backup.text.indexOf('\n') + 1)).db
    try {
      unsafe.exec("UPDATE cb_records SET data=json_set(data,'$.status','pending') WHERE id='send'")
      await assert.rejects(openBackup(seal(dump(unsafe))), /active provider work/)
    } finally { unsafe.close() }
    for (const damage of ['document', 'ledger', 'photo']) {
      const broken = openDump(backup.text.slice(backup.text.indexOf('\n') + 1)).db
      try {
        if (damage === 'document') broken.exec("UPDATE cb_records SET data=json_set(data,'$.documents[0].text','Changed terms') WHERE id='agreement'")
        if (damage === 'ledger') broken.exec("UPDATE cb_ledger_journals SET data=json_set(data,'$.lines[0].debitCents',200)")
        if (damage === 'photo') broken.exec("UPDATE cb_photos SET bytes=X'00'")
        await assert.rejects(openBackup(seal(dump(broken))), /signed evidence|not balanced|photo does not match/)
      } finally { broken.close() }
    }
    roundtrip = await openBackup((await sanitizeDump(dump(target))).text)
    assert.deepEqual(readRows(roundtrip, 'cb_photos'), readRows(archive, 'cb_photos'))
  } finally { for (const db of [archive, roundtrip, source, target, seeded]) db?.close() }
})
