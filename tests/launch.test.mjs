import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
const exec = promisify(execFile), launcher = resolve('node_modules/@runeditrun/rer/global/rer.mjs')

test('a fresh public-source clone installs, migrates and opens with rer dev', { timeout: 600000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(),'cabin-clone-')), root = join(folder,'run-cabin')
  const env = { ...process.env, CI:'true', WRANGLER_SEND_METRICS:'false' }
  delete env.RER_LOCAL_OPERATION; delete env.RER_LOCAL_STATE_PATH
  try {
    await exec('git',['clone','--no-local',resolve('.'),root],{env})
    const started = await exec(process.execPath,[launcher,'dev','--cwd',root,'--detach','--json'],{env,maxBuffer:2000000})
    const ready = started.stdout.split('\n').filter(Boolean).map(line => {try{return JSON.parse(line)}catch{return {}}}).find(line=>line.event==='ready')
    assert.ok(ready?.url,'rer dev emits its ready address without manual setup')
    const health = await fetch(ready.url+'/health')
    assert.equal(health.status,200)
    const result = await health.json(); assert.equal(result.status,'ok')
  } finally {
    await exec(process.execPath,[launcher,'dev','--cwd',root,'--stop'],{env,maxBuffer:1000000}).catch(()=>{})
    await rm(folder,{recursive:true,force:true})
  }
})
