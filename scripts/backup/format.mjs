import { createHash } from 'node:crypto'
import { excludedTable } from '@runeditrun/rer/modules/portability/catalogue'
import policy from '../../src/cabin/archive-policy.mjs'
import { insert, objects, openDump, quote, readRows } from './sql.mjs'

const prefix = '-- Cabin hosted backup '
const digest = value => createHash('sha256').update(value).digest('hex')
export const portable = name => !excludedTable(name, policy)
export function seal(body) {
  return prefix + JSON.stringify({ kind: 'cabin-hosted-backup', version: 1, product: policy.product, sha256: digest(body) }) + '\n' + body
}
function verifiedBody(text) {
  const newline = text.indexOf('\n'); let metadata
  try { if (!text.startsWith(prefix)) throw Error(); metadata = JSON.parse(text.slice(prefix.length, newline)) } catch { throw Error('Use a versioned Cabin hosted backup; raw SQL dumps cannot be restored.') }
  if (metadata.kind !== 'cabin-hosted-backup' || metadata.version !== 1 || metadata.product !== policy.product) throw Error('Unsupported hosted backup format or product.')
  const body = text.slice(newline + 1)
  if (digest(body) !== metadata.sha256) throw Error('Hosted backup checksum does not match. No remote changes were made.')
  return body
}

export async function validateDatabase(db) {
  const entries = objects(db).filter(o => o.type === 'table'), tables = Object.fromEntries(entries.map(t => [t.name, t.name]))
  for (const table of entries) if (!portable(table.name) && readRows(db, table.name).length) throw Error('Hosted backup contains installation credentials or session rows: ' + table.name)
  if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Hosted backup SQL constraints are invalid.')
  const adapter = { prepare(sql) {
    let params = []
    return {
      bind(...values) { params = values; return this },
      async all() { return { results: db.prepare(sql).all(...params) } },
      async first() { return db.prepare(sql).get(...params) ?? null },
    }
  } }
  await policy.validateStaged({ db: adapter, tables })
  for (const photo of tables.cb_photos ? readRows(db, 'cb_photos') : []) if (digest(photo.bytes) !== photo.sha256) throw Error('Hosted backup photo does not match its evidence.')
}

// Raw downloads never become the deliverable. Rebuild rows with triggers absent;
// immutable journal and audit triggers are restored verbatim only after copying.
export async function sanitizeDump(raw) {
  const { db, deferred } = openDump(raw)
  try {
    const entries = objects(db).filter(o => o.type === 'table')
    for (const table of entries) {
      const rows = portable(table.name) ? readRows(db, table.name).map(row => policy.exportRow(table.name, row)) : []
      db.exec(`DELETE FROM ${quote(table.name)}`)
      for (const row of rows) db.exec(insert(table.name, row))
    }
    for (const entry of deferred) if (entry.trigger) db.exec(entry.sql)
    await validateDatabase(db)
    const schema = objects(db), output = ['PRAGMA defer_foreign_keys=ON;']
    output.push(...schema.filter(o => o.type === 'table').map(o => o.sql + ';'))
    let count = 0
    for (const table of entries) for (const row of readRows(db, table.name)) { output.push(insert(table.name, row)); count++ }
    output.push(...schema.filter(o => o.type !== 'table').map(o => o.sql + ';'))
    return { text: seal(output.join('\n') + '\n'), rows: count }
  } finally { db.close() }
}

export async function openBackup(text) {
  const { db } = openDump(verifiedBody(text), { triggers: true })
  try { await validateDatabase(db); return db } catch (error) { db.close(); throw error }
}
