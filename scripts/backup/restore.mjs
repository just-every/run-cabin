import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import policy from '../../src/cabin/archive-policy.mjs'
import { portable } from './format.mjs'
import { columns, insert, literal, objects, quote, readRows } from './sql.mjs'
import { freshIdentity } from './fresh-identity.mjs'

export function migrationSeeds(directory) {
  const db = new DatabaseSync(':memory:')
  try {
    for (const name of readdirSync(directory).filter(n => n.endsWith('.sql')).sort()) db.exec(readFileSync(join(directory, name), 'utf8'))
    return db
  } catch (error) { db.close(); throw error }
}
const images = (db, name) => readRows(db, name).map(row => Object.values(row).map(literal).join(',')).sort()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Produce one D1 import, with the empty-data and snapshot guards in the same
// atomic ingestion as the paused rows. There is no preceding clear operation.
export function restorePlan(archive, target, seeded) {
  const sourceObjects = objects(archive), targetObjects = objects(target)
  const tables = targetObjects.filter(o => o.type === 'table' && portable(o.name))
  const sourceTables = sourceObjects.filter(o => o.type === 'table' && portable(o.name))
  if (!same(tables.map(t => [t.name, t.sql]), sourceTables.map(t => [t.name, t.sql]))) throw Error('Backup and destination schemas differ. Use a fresh deployment of the same Cabin edition.')
  const identity = freshIdentity(archive, target, seeded)
  const seedNames = new Set(objects(seeded).filter(o => o.type === 'table').map(o => o.name))
  for (const table of tables) {
    if (policy.replaceableTables.includes(table.name) || identity.replaced.has(table.name)) continue
    const wanted = seedNames.has(table.name) ? images(seeded, table.name) : []
    if (!same(images(target, table.name), wanted)) throw Error('Restore requires empty product data; destination contains ' + table.name + '.')
  }
  // Refuse local credentials/sessions that would be invalidated by replacing
  // operator identities, including foreign-key actions through excluded tables.
  const affected = new Set(tables.map(t => t.name)), protectedNames = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const table of targetObjects.filter(o => o.type === 'table' && /\bREFERENCES\b/i.test(o.sql))) {
      for (const fk of target.prepare(`PRAGMA foreign_key_list(${quote(table.name)})`).all()) if (affected.has(fk.table)) {
        if (!portable(table.name)) protectedNames.add(table.name)
        if (!affected.has(table.name)) { affected.add(table.name); changed = true }
      }
    }
  }
  for (const name of protectedNames) if (!identity.retired.has(name) && readRows(target, name).length) throw Error('Fresh destination contains installation identity dependents: ' + name + '.')
  const guard = 'cb_backup_guard_' + randomUUID().replaceAll('-', '')
  const sql = ['PRAGMA defer_foreign_keys=ON;', `CREATE TABLE ${quote(guard)} (ok INTEGER NOT NULL CHECK(ok=1));`]
  const assert = condition => sql.push(`INSERT INTO ${quote(guard)} VALUES(CASE WHEN (${condition}) THEN 1 ELSE 0 END);`)
  // Detect schema changes or newly added product tables after the read-only check.
  assert(`(SELECT count(*) FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>${literal(guard)})=${targetObjects.length}`)
  for (const object of targetObjects) assert(`EXISTS(SELECT 1 FROM sqlite_master WHERE type=${literal(object.type)} AND name=${literal(object.name)} AND sql=${literal(object.sql)})`)
  for (const name of new Set([...tables.map(table => table.name), ...identity.guarded])) {
    const rows = readRows(target, name), names = columns(target, name)
    assert(`(SELECT count(*) FROM ${quote(name)})=${rows.length}`)
    for (const row of rows) assert(`EXISTS(SELECT 1 FROM ${quote(name)} WHERE ${names.map(n => `${quote(n)} IS ${literal(row[n])}`).join(' AND ')})`)
  }
  for (const name of protectedNames) if (!identity.retired.has(name)) assert(`NOT EXISTS(SELECT 1 FROM ${quote(name)})`)
  const triggers = targetObjects.filter(o => o.type === 'trigger' && affected.has(o.tbl_name))
  sql.push(...triggers.map(t => `DROP TRIGGER ${quote(t.name)};`))
  for (const name of identity.retired) sql.push(`DELETE FROM ${quote(name)};`)
  for (const table of tables) sql.push(`DELETE FROM ${quote(table.name)};`)
  for (const table of sourceTables) for (const row of readRows(archive, table.name)) sql.push(insert(table.name, row))
  sql.push(...triggers.map(t => t.sql + ';'), `DROP TABLE ${quote(guard)};`)
  return sql.join('\n') + '\n'
}
