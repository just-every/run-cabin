import { erase } from './privacy-flow.mjs'
import { archiveEdge, populateArchive, checkRestored } from './archive-records.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { harness } from './harness.mjs'
const exec = promisify(execFile)
const cli = resolve('node_modules/@runeditrun/rer/global/rer.mjs')
const command = async (cwd, args, expected = 0) => {
  let result
  // These commands own a separate checkout, not the parent verify operation.
  const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }
  delete env.RER_LOCAL_OPERATION
  delete env.RER_LOCAL_STATE_PATH
  try { result = { ...await exec(process.execPath, [cli, ...args], { cwd, env, maxBuffer: 2e6 }), code: 0 } }
  catch (error) { result = error }
  assert.equal(result.code, expected, `${args[0]}: ${result.stdout ?? ''} ${result.stderr ?? ''}`)
}
async function checkout(root) {
  await mkdir(root)
  for (const name of ['package.json','pnpm-lock.yaml','OPERATIONS.json','RUN-LOCALLY.md','ACCEPTANCE.md','SEED-COMMAND-CONTRACT.md','OPERATIONS.md','.node-version','wrangler.jsonc','deploy.json','rer-setup.json','scripts','src','migrations']) await cp(name, join(root,name), { recursive: true })
  await symlink(resolve('node_modules'), join(root,'node_modules'), 'dir')
}
test('DATA-001: public CLI archive round trip refuses damaged or populated stores and respects erasure', { timeout: 240_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'cabin-archive-')), source=join(temporary,'source'), restored=join(temporary,'restored'), erased=join(temporary,'erased')
  let h
  try {
    for (const path of [source,restored,erased]) await checkout(path)
    await exec(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'], { cwd:source, env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}, maxBuffer:2e6 })
    h=await harness({root:source,outbound:archiveEdge})
    const preview=await h.cmd('import.preview',{csv:'external_id,name,owner_name,owner_email,commission_bps\nhome-one,Temporary property,Temporary host,temporary@stay.example,1500\n'})
    await h.cmd('import.approve',{id:preview.id,fingerprint:preview.fingerprint})
    const p=(await h.state()).properties[0]
    const cleaner=await h.person('Taylor')
    const d=await h.cmd('calendar.prepare',{propertyId:p.id,channel:'Airbnb',calendar:'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:archive-stay\r\nDTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260105\r\nSUMMARY:Archive stay\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'})
    await h.cmd('calendar.approve',{id:d.id,revision:d.revision})
    const booking=(await h.state()).bookings[0]
    const turnover=await h.cmd('turnover.prepare',{bookingId:booking.id,cleanerId:cleaner.id,checklist:['Linen changed']})
    await h.cmd('turnover.approve',{id:turnover.id,revision:turnover.revision})
    await h.cmd('turnover.complete',{id:turnover.id,revision:turnover.revision,checks:turnover.checklist,photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png',caption:'Linen ready'},cleaner.cookie)
    const proof=await populateArchive(h,p,cleaner)
    const key=await h.cmd('agent.create',{label:'Excluded secret'})
    const agentHash=(await h.db.prepare('SELECT token_hash FROM cb_agent_keys').first()).token_hash
    const identity={auth:h.auth,owner:h.owner}
    await h.close();h=null
    const old=join(temporary,'before.rer'),later=join(temporary,'later.rer'),again=join(temporary,'again.rer')
    await command(source,['export','--output',old])
    const bytes=await readFile(old,'utf8');assert.ok(bytes.includes('Temporary property'));assert.ok(!bytes.includes('Excluded secret'));assert.ok(!bytes.includes(agentHash));assert.ok(!bytes.includes(key.token));assert.ok(!bytes.includes(proof.sealed));for(const token of proof.privateLinks)assert.ok(!bytes.includes(token), 'Private capability remained in '+bytes.split('\n').filter(Boolean).map(JSON.parse).filter(r=>r.kind==='part').flatMap(r=>r.items).filter(i=>JSON.stringify(i).includes(token)).map(i=>i.table+':'+i.row?.kind+':'+Object.entries(JSON.parse(i.row?.data??'{}')).filter(([k,v])=>JSON.stringify(v).includes(token)).map(([k])=>k).join(',')).join(','))
    await command(restored,['import','--input',old,'--yes'])
    await command(restored,['export','--output',again])
    let outbound=0;h=await harness({root:restored,...identity,outbound:()=>{outbound++;return new Response('Refused',{status:599})}}); const signed=await h.signIn(h.auth.OWNER_EMAIL); const saved=await h.state(signed); assert.equal(saved.turnovers.find(t=>t.id===turnover.id).status,'completed'); assert.ok(saved.importJobs.some(j=>j.status==='completed')); assert.equal((await h.send(`/api/cabin/turnovers/${turnover.id}/photo`,undefined,signed)).status,200); await checkRestored(h,signed,proof);assert.equal(outbound,0);await h.close();h=null
    const rows=text=>text.split('\n').filter(Boolean).map(JSON.parse).filter(r=>r.kind==='part')
    assert.ok(rows(bytes).length>0);assert.deepEqual(rows(await readFile(again,'utf8')),rows(bytes))
    await command(restored,['import','--input',old,'--yes'],4)
    const corrupt=join(temporary,'corrupt.rer');await writeFile(corrupt,bytes.replace('Temporary property','Changed property'),{mode:0o600})
    // Checksum damage is a transfer failure (1); restore policy conflicts remain 4.
    await command(erased,['import','--input',corrupt,'--yes'],1)
    h=await harness({root:source,...identity});await erase(h,{entity:'property',id:p.id,revision:p.revision},await h.signIn(h.auth.OWNER_EMAIL));await h.close();h=null
    await command(source,['export','--output',later])
    await command(erased,['import','--input',old,'--journal',later,'--yes'],4)
    await command(erased,['import','--input',later,'--yes'])
    const proxy=await getPlatformProxy({configPath:join(erased,'wrangler.jsonc'),persist:{path:join(erased,'.wrangler/state/v3')},remoteBindings:false})
    try { assert.equal(await proxy.env.DB.prepare('SELECT id FROM cb_properties WHERE id=?').bind(p.id).first(),null); assert.equal((await proxy.env.DB.prepare('SELECT COUNT(*) AS n FROM cb_photos').first()).n,0) }
    finally { await proxy.dispose() }
  } finally { if(h)await h.close();await rm(temporary,{recursive:true,force:true}) }
})
