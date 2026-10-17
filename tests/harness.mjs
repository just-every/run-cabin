import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'

const bundles = new Map()
export async function harness(options = {}) {
  // The demo entry keeps the app's own mail sender: a demo suppresses mail itself.
  const entry = options.entry ?? 'tests/worker.ts', plugins = options.entry ? [] : [{ name: 'mail-network-edge', setup(builder) { builder.onResolve({filter:/^\.\/mail\.server\.mjs$/}, () => ({path: join(process.cwd(),'tests/mail-edge.mjs')})) } }]
  if (!bundles.has(entry)) bundles.set(entry, await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'neutral', conditions: ['workerd', 'worker', 'browser'], external: ['node:*', 'cloudflare:*'], target: 'es2023', plugins }))
  const bundle = bundles.get(entry)
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise(r => socket.close(r))
  const dir = options.root ? join(options.root, '.wrangler/state/v3') : await mkdtemp(join(tmpdir(), 'cabin-test-')), origin = `http://127.0.0.1:${port}`, setup = randomBytes(32).toString('hex')
  const auth = { AUTH_LOCAL: 'true', OWNER_EMAIL: 'owner@stay.example', SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: setup, MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@stay.example', ...options.auth, AUTH_ORIGIN: origin }
  const mf = new Miniflare({ ...convertV4MiniflareOptions({ host: '127.0.0.1', port, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'local-foundation-only' }, bindings: auth, ...(options.outbound ? { outboundService: options.outbound } : {}) }), resourcePersistencePath: dir })
  try {
    const db = await mf.getD1Database('DB')
    if (!options.root) for (const file of (await readdir('migrations/core')).filter(f => f.endsWith('.sql')).sort()) await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/' + file, 'utf8')).map(sql => db.prepare(sql)))
    const send = async (path, body, cookie = '', headers = {}) => {
      const response = await mf.dispatchFetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { host: new URL(origin).host, origin, 'content-type': 'application/json', cookie, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' })
      const text = await response.text(); let value
      try { value = JSON.parse(text) } catch { value = text }
      return { status: response.status, value, text, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    const bootstrap = options.owner || options.unclaimed ? null : await send('/auth/bootstrap', { token: auth.SETUP_TOKEN, displayName: 'Jordan Venue' })
    if (bootstrap) assert.equal(bootstrap.status, 303, bootstrap.text)
    const owner = options.owner ?? bootstrap?.cookie
    if (bootstrap) { const ready=await mf.dispatchFetch(origin+'/setup',{method:'POST',headers:{origin,cookie:owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'});assert.equal(ready.status,303) }
    const cmd = async (name, input, cookie = owner, status = 200, headers = {}) => {
      const r = await send('/api/cabin/command', { name, input }, cookie, headers)
      assert.equal(r.status, status, `${name}: ${JSON.stringify(r.value)}`)
      return r.value.result ?? r.value
    }
    const state = async (cookie = owner, status = 200) => { const r = await send('/api/cabin/state', undefined, cookie); assert.equal(r.status, status, JSON.stringify(r.value)); return r.value }
    const confirmMail = async email => {
      const rows = (await db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results
      const message = rows.map(r => JSON.parse(r.message)).find(m => m.to.includes(email))
      assert.ok(message, 'invitation delivered to the local outbox')
      const token = new URL(message.text.match(/http:\/\/[^\s]+\/auth\/confirm\?token=[^\s]+/)[0]).searchParams.get('token')
      const r = await send('/auth/confirm', { token })
      assert.equal(r.status, 303, JSON.stringify(r.value)); return r.cookie
    }
    const person = async (name, role = 'cleaner') => {
      const email = `${name.toLowerCase()}@stay.example`, staff = await cmd('member.save', { name, email, role, active: true })
      await cmd('member.invite', { id: staff.id })
      return { ...staff, cookie: await confirmMail(email) }
    }
    const signIn = async email => { const response = await send('/auth/magic-link', {email}); assert.equal(response.status,202,response.text); return confirmMail(email) }
    return { db, mf, origin, owner, auth, send, cmd, state, person, signIn, close: async () => { await mf.dispose(); if (!options.root) await rm(dir, { recursive: true, force: true }) } }
  } catch (error) { await mf.dispose(); if (!options.root) await rm(dir, { recursive: true, force: true }); throw error }
}

export async function run(fn) { const h = await harness(); try { await fn(h) } finally { await h.close() } }
