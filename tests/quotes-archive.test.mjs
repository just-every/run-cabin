import test from 'node:test'
import assert from 'node:assert/strict'
import {cp,mkdir,mkdtemp,readFile,rm,symlink} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {quoteHarness} from './quotes-support.mjs'
import {harness} from './harness.mjs'
const exec=promisify(execFile)
test('RES-006 / DATA-001: public archive restore retains quoted terms without reviving links, inventory holds or email', {timeout:240000},async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'cabin-quotes-archive-')),source=join(temporary,'source'),restored=join(temporary,'restored'),archive=join(temporary,'quotes.rer');let h
 try{
  for(const root of [source,restored]){
   await mkdir(root)
   for(const name of ['package.json','pnpm-lock.yaml','OPERATIONS.json','RUN-LOCALLY.md','ACCEPTANCE.md','SEED-COMMAND-CONTRACT.md','OPERATIONS.md','.node-version','wrangler.jsonc','deploy.json','rer-setup.json','scripts','src','migrations'])await cp(name,join(root,name),{recursive:true})
   await symlink(resolve('node_modules'),join(root,'node_modules'),'dir')
  }
  const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};delete env.RER_LOCAL_OPERATION;delete env.RER_LOCAL_STATE_PATH
  await exec(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'],{cwd:source,env,maxBuffer:2e6})
  h=await quoteHarness({root:source});const quote=await h.cmd('quote.issue',h.input),path=await h.link(quote),identity={auth:h.auth,owner:h.owner};await h.close();h=null
  const cli=resolve('node_modules/@runeditrun/rer/global/rer.mjs')
  await exec(process.execPath,[cli,'export','--output',archive],{cwd:source,env,maxBuffer:2e6})
  const bytes=await readFile(archive,'utf8');assert.ok(!bytes.includes(path.split('/').at(-1)),'archive omits the private quote capability');assert.match(bytes,/Alex Rivera/,'business terms remain portable')
  await exec(process.execPath,[cli,'import','--input',archive,'--yes'],{cwd:restored,env,maxBuffer:2e6})
  let outbound=0;h=await harness({root:restored,...identity,outbound:()=>{outbound++;assert.fail('Restored quotes must cause no external action')}})
  const cookie=await h.signIn(h.auth.OWNER_EMAIL),saved=await h.state(cookie)
  assert.equal(saved.staffQuotes.length,1);assert.equal(saved.staffQuotes[0].versions[0].price.totalCents,58300);assert.equal(saved.staffQuotes[0].versions[0].price.cancellationPolicy.retainedBps,5000)
  assert.equal((await h.send(path)).status,404,'old quote link cannot be accepted after restore');assert.equal(saved.bookings.filter(b=>b.status==='confirmed').length,0,'restored quote holds cannot block new inventory')
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(outbound,0)
 }finally{if(h)await h.close();await rm(temporary,{recursive:true,force:true})}
})
