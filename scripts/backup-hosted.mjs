#!/usr/bin/env node
// Saves a hosted Cabin's database to a private SQL file, or restores one into a
// fresh hosted environment. Run it with `rer run backup:hosted -- ...` from the
// Cabin folder that deployed it: rer supplies the Node and pnpm it keeps off
// PATH, so an install.sh install needs nothing else. The database is the one
// rer created for that environment (.rer/deploy/ENVIRONMENT.json); Cabin keeps
// every record and photo in it and creates no R2 bucket. Credentials come from
// the same --env-file rer deploy uses.
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBackup, sanitizeDump } from './backup/format.mjs'
import { openDump } from './backup/sql.mjs'
import { migrationSeeds, restorePlan } from './backup/restore.mjs'

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

// Wrangler can print presigned download links, SQL cells and credentials on both
// success and failure. Keep all provider output private.
function wrangler(env, list) {
  const bin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  if (!existsSync(bin)) throw Error('Wrangler is not installed in this Cabin folder. Run rer install, then try again.')
  const run = spawnSync(process.execPath, [bin, ...list], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env, WRANGLER_SEND_METRICS: 'false' } })
  if (run.status !== 0) throw Error(`wrangler ${list.slice(0, 3).join(' ')} failed (exit ${run.status ?? 'unavailable'}). Provider details were withheld because they may contain private data.`)
  return run.stdout
}

async function main() {
  const o = args(process.argv.slice(2))
  if (o.restore && !o.yes) stop('Restore requires empty product data and pauses all restored outbound work. Add --yes to confirm.')
  // The archive is checked before even contacting the destination.
  let archive, target, seeded, scratch
  try {
    if (o.restore) {
      const file = resolve(root, o.restore)
      if (!existsSync(file) || !statSync(file).size) throw Error(`${o.restore} is missing or empty.`)
      archive = await openBackup(readFileSync(file, 'utf8'))
    }
    const env = credentials(o.envFile), db = database(o.environment)
    process.umask(0o077)
    scratch = mkdtempSync(join(tmpdir(), 'cabin-hosted-backup-'))
    const raw = join(scratch, 'download.sql')
    if (archive) {
      wrangler(env, ['d1', 'export', db.name, '--remote', '--output', raw])
      chmodSync(raw, 0o600)
      target = openDump(readFileSync(raw, 'utf8'), { triggers: true }).db
      seeded = migrationSeeds(join(root, 'migrations', 'core'))
      const plan = restorePlan(archive, target, seeded), file = join(scratch, 'restore.sql')
      writeFileSync(file, plan, { mode: 0o600, flag: 'wx' })
      // D1's file import ingests in one transaction. The file includes destination
      // guards, row replacement and the restored fence; no raw dump is uploaded.
      wrangler(env, ['d1', 'execute', db.name, '--remote', '--yes', '--file', file])
      console.log(`Restored ${o.restore} into ${db.name}. Sign in again, review restored history and reconnect providers before creating new work. Old charges, messages and access are never replayed.`)
    } else {
      const output = resolve(root, o.output ?? join('exports', `${db.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`))
      if (existsSync(output)) throw Error(`${output} already exists. Name a new file with --output.`)
      mkdirSync(dirname(output), { recursive: true, mode: 0o700 })
      console.log(`Saving ${db.name} (Worker ${db.worker}) to ${output}.`)
      wrangler(env, ['d1', 'export', db.name, '--remote', '--output', raw])
      chmodSync(raw, 0o600)
      const backup = await sanitizeDump(readFileSync(raw, 'utf8'))
      writeFileSync(output, backup.text, { mode: 0o600, flag: 'wx' })
      console.log(`Saved ${backup.rows} rows to ${output} (${statSync(output).size} bytes), readable only by you (mode 600). Keep it private: it holds guests, owners, bookings and photos.`)
    }
  } finally {
    for (const db of [archive, target, seeded]) db?.close()
    if (scratch) rmSync(scratch, { recursive: true, force: true })
  }
}
main().catch(() => { console.error('Hosted backup failed. The file may be damaged, contain active work, or the destination may contain data or use a different schema. Provider output and record values were withheld.'); process.exitCode = 1 })
