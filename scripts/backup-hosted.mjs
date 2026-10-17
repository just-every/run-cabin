#!/usr/bin/env node
// Saves a hosted Cabin's database to a private SQL file, or restores one into a
// fresh hosted environment. Run it with `rer run backup:hosted -- ...` from the
// Cabin folder that deployed it: rer supplies the Node and pnpm it keeps off
// PATH, so an install.sh install needs nothing else. The database is the one
// rer created for that environment (.rer/deploy/ENVIRONMENT.json); Cabin keeps
// every record and photo in it and creates no R2 bucket. Credentials come from
// the same --env-file rer deploy uses.
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const usage = `Usage, from the Cabin folder:
  rer run backup:hosted -- [--environment NAME] [--env-file .env.cabin] [--output exports/FILE.sql]
  rer run backup:hosted -- --restore exports/FILE.sql --environment NEW --env-file .env.cabin --yes`

function args(argv) {
  const out = { environment: 'production', envFile: '.env.cabin' }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], value = () => { const v = argv[++i]; if (!v || v.startsWith('--')) stop(`${flag} needs a value.`); return v }
    if (flag === '--') continue // rer run X -- ARGS passes the separator through
    else if (flag === '--environment') out.environment = value()
    else if (flag === '--env-file') out.envFile = value()
    else if (flag === '--output') out.output = value()
    else if (flag === '--restore') out.restore = value()
    else if (flag === '--yes') out.yes = true
    else if (flag === '--help' || flag === '-h') { console.log(usage); process.exit(0) }
    else stop(`Unknown option ${flag}.`)
  }
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(out.environment)) stop('Name the environment you deployed, such as production or trial.')
  return out
}
function stop(message, code = 2) { console.error(`${message}\n${usage}`); process.exit(code) }

function credentials(file) {
  const path = resolve(root, file), env = {}
  if (!existsSync(path)) stop(`No ${file} in this Cabin folder. Use the private file you deploy with: --env-file FILE.`)
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  const picked = { CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN }
  for (const [name, value] of Object.entries(picked)) if (!value) stop(`${file} has no ${name}. Add the value you deploy with.`)
  return picked
}

function database(environment) {
  const path = join(root, '.rer', 'deploy', `${environment}.json`)
  if (!existsSync(path)) stop(`This Cabin folder holds no ${environment} deployment (${join('.rer', 'deploy', `${environment}.json`)}). Run this from the folder that deployed it, with its --environment.`, 1)
  const record = JSON.parse(readFileSync(path, 'utf8'))
  const names = Object.entries(record?.owned?.d1 ?? {}).filter(([, entry]) => entry?.status === 'created').map(([name]) => name)
  if (record?.kind !== 'rer-deploy-owner-state' || names.length !== 1) stop(`The ${environment} deployment record does not name exactly one database rer created.`, 1)
  const buckets = Object.keys(record.owned.r2 ?? {})
  if (buckets.length) stop(`This deployment also has R2 storage (${buckets.join(', ')}), which this command does not save.`, 1)
  return { name: names[0], worker: record.worker }
}

// Wrangler's own output is never shown: `d1 export` prints a presigned link that
// downloads the whole database for an hour, and any failure text is shown with
// every URL's query string removed. Cabin prints only what it saved and where.
const hideLinks = text => text.replace(/https?:\/\/[^\s"'<>]+/g, url => url.replace(/[?#].*$/, '?[removed]'))
function wrangler(env, list) {
  const bin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  if (!existsSync(bin)) stop('Wrangler is not installed in this Cabin folder. Run rer install, then try again.', 1)
  const run = spawnSync(process.execPath, [bin, ...list], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env, WRANGLER_SEND_METRICS: 'false' } })
  if (run.status !== 0) { console.error(hideLinks(`${run.stdout ?? ''}${run.stderr ?? ''}`).trim()); console.error(`wrangler ${list.slice(0, 3).join(' ')} failed (exit ${run.status}). Nothing else was changed.`); process.exit(1) }
  return run.stdout
}

const o = args(process.argv.slice(2)), env = credentials(o.envFile), db = database(o.environment)
if (o.restore) {
  const file = resolve(root, o.restore)
  if (!existsSync(file) || !statSync(file).size) stop(`${o.restore} is missing or empty.`, 1)
  if (!o.yes) stop(`Restoring replaces every table in ${db.name} (Worker ${db.worker}) with ${o.restore}. Add --yes to confirm.`)
  console.log(`Clearing ${db.name}, then loading ${o.restore} into it.`)
  // The dump recreates every table, so the fresh deployment's own tables go first.
  const names = JSON.parse(wrangler(env, ['d1', 'execute', db.name, '--remote', '--json', '--command', "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"]))[0].results.map(r => r.name)
  if (names.length) wrangler(env, ['d1', 'execute', db.name, '--remote', '--yes', '--command', `PRAGMA defer_foreign_keys=ON; ${names.map(n => `DROP TABLE IF EXISTS "${n.replace(/"/g, '""')}";`).join(' ')}`])
  wrangler(env, ['d1', 'execute', db.name, '--remote', '--yes', '--file', file])
  console.log(`Restored ${o.restore} into ${db.name}. Sign in again, then enter private settings (Stripe, AI keys) again: they were sealed with the old installation's secret.`)
} else {
  const output = resolve(root, o.output ?? join('exports', `${db.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`))
  if (existsSync(output)) stop(`${output} already exists. Name a new file with --output.`, 1)
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 })
  console.log(`Saving ${db.name} (Worker ${db.worker}) to ${output}.`)
  // Files the export creates are owner-only from their first byte.
  process.umask(0o077)
  wrangler(env, ['d1', 'export', db.name, '--remote', '--output', output])
  chmodSync(output, 0o600)
  const sql = readFileSync(output, 'utf8'), rows = (sql.match(/^INSERT INTO/gm) ?? []).length
  if (!rows) { console.error(`${output} holds no rows. Do not remove hosting on the strength of it.`); process.exit(1) }
  console.log(`Saved ${rows} rows to ${output} (${statSync(output).size} bytes), readable only by you (mode 600). Keep it private: it holds guests, owners, bookings and photos.`)
}
