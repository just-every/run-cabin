import { DatabaseSync } from 'node:sqlite'

export const quote = name => `"${name.replaceAll('"', '""')}"`
export function literal(value) {
  if (value === null) return 'NULL'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return String(value)
  if (ArrayBuffer.isView(value)) return `X'${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')}'`
  if (typeof value === 'string') return `CAST(X'${Buffer.from(value).toString('hex')}' AS TEXT)`
  throw Error('Unsupported SQL backup cell.')
}

// Split SQL without treating quoted text, comments or trigger bodies as commands.
export function statements(sql) {
  const result = []; let start = 0, pos = 0, words = [], depth = 0, trigger = false
  while (pos < sql.length) {
    const c = sql[pos], next = sql[pos + 1]
    if (c === '-' && next === '-') { const end = sql.indexOf('\n', pos); pos = end < 0 ? sql.length : end + 1; continue }
    if (c === '/' && next === '*') { const end = sql.indexOf('*/', pos + 2); if (end < 0) throw Error('Unclosed SQL comment.'); pos = end + 2; continue }
    if (`'"\`[`.includes(c)) {
      const close = c === '[' ? ']' : c; pos++
      let closed = false
      while (pos < sql.length) { if (sql[pos++] === close) { if (sql[pos] === close && close !== ']') { pos++; continue } closed = true; break } }
      if (!closed) throw Error('Unclosed SQL value.')
      continue
    }
    if (/[a-z_]/i.test(c)) {
      const word = /^[a-z_][a-z_0-9]*/i.exec(sql.slice(pos))[0].toUpperCase(); pos += word.length; words.push(word)
      if (words[0] === 'CREATE' && word === 'TRIGGER' && words.length <= 3) trigger = true
      if (trigger && ['BEGIN', 'CASE'].includes(word)) depth++
      if (trigger && word === 'END') depth--
      continue
    }
    pos++
    if (c === ';' && (!trigger || depth === 0)) {
      if (words.length) result.push({ sql: sql.slice(start, pos), words })
      start = pos; words = []; trigger = false; depth = 0
    }
  }
  if (words.length) { if (trigger || depth) throw Error('Incomplete SQL trigger.'); result.push({ sql: sql.slice(start), words }) }
  return result
}

export const objects = db => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").all()
export const columns = (db, name) => db.prepare(`PRAGMA table_xinfo(${quote(name)})`).all().filter(c => c.hidden === 0).map(c => c.name)
export const readRows = (db, name) => db.prepare(`SELECT ${columns(db, name).map(quote).join(',')} FROM ${quote(name)}`).all()
export const insert = (name, row) => `INSERT INTO ${quote(name)} (${Object.keys(row).map(quote).join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`

export function openDump(sql, { triggers = false } = {}) {
  const db = new DatabaseSync(':memory:'); const later = []
  db.exec('PRAGMA foreign_keys=OFF; PRAGMA trusted_schema=OFF;')
  try {
    for (const statement of statements(sql)) {
      const [first, second] = statement.words
      if (['BEGIN', 'COMMIT', 'END'].includes(first)) continue
      if (first === 'PRAGMA' && ['FOREIGN_KEYS', 'DEFER_FOREIGN_KEYS'].includes(second)) continue
      if (first === 'CREATE' && statement.words.slice(1, 3).includes('TRIGGER')) { later.push({ sql: statement.sql, trigger: true }); continue }
      if (first === 'CREATE' && ['INDEX', 'UNIQUE', 'VIEW'].includes(second)) { later.push({ sql: statement.sql, trigger: false }); continue }
      if (first === 'CREATE' && second === 'TABLE' || first === 'INSERT' || first === 'REPLACE' || first === 'DELETE' && statement.words[2] === 'SQLITE_SEQUENCE') db.exec(statement.sql)
      else throw Error('Unsupported statement in hosted SQL dump.')
    }
    for (const entry of later) if (triggers || !entry.trigger) db.exec(entry.sql)
    return { db, deferred: later }
  } catch (error) { db.close(); throw error }
}
