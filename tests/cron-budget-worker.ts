import worker from './worker'
import { runCron } from '../src/cabin/cron'
import type { Bindings } from '../src/auth.server'
// The test worker plus one door: GET /__cron-reads runs the Cron against a D1 binding that adds up
// rows_read, so a test can state what a tick costs. Local D1 reports the same meta.rows_read as hosted D1.
type Stat = { rows: number; statements: number; by: Record<string, number> }
function metered(db: D1Database, stat: Stat): D1Database {
  const count = (sql: string, meta: D1Meta & Record<string, unknown>) => { const rows = Number(meta?.rows_read ?? 0); stat.statements++; stat.rows += rows; const key = sql.replace(/\s+/g, ' ').slice(0, 140); stat.by[key] = (stat.by[key] ?? 0) + rows }
  const wrap = (inner: D1PreparedStatement, sql: string): any => ({
    inner, sql,
    bind: (...values: unknown[]) => wrap(inner.bind(...values), sql),
    run: async () => { const r = await inner.run(); count(sql, r.meta); return r },
    all: async () => { const r = await inner.all(); count(sql, r.meta); return r },
    raw: async () => { const r = await inner.all(); count(sql, r.meta); return r.results.map(row => Object.values(row as object)) },
    first: async (column?: string) => { const r = await inner.all(); count(sql, r.meta); const row = r.results[0] as Record<string, unknown> | undefined; return row === undefined ? null : column === undefined ? row : row[column] },
  })
  const proxy: any = {
    prepare: (sql: string) => wrap(db.prepare(sql), sql),
    batch: async (statements: any[]) => { const results = await db.batch(statements.map(s => s.inner)); results.forEach((r, i) => count(statements[i].sql, r.meta)); return results },
    exec: (sql: string) => db.exec(sql),
    withSession: () => proxy,
  }
  return proxy
}
export default {
  ...worker,
  async fetch(request: Request, env: Bindings) {
    if (new URL(request.url).pathname !== '/__cron-reads') return worker.fetch(request, env)
    const stat: Stat = { rows: 0, statements: 0, by: {} }
    await runCron({ ...env, DB: metered(env.DB, stat) })
    return Response.json(stat)
  },
}
