import { rooms } from './capacity-support.mjs'
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
  h=await quoteHarness({root:source});const {a,b}=await rooms(h,h.p)
  let cfg=await h.cmd('direct.cancellation.save',{propertyId:h.p.id,revision:h.home.revision,dateBasis:'arrival',start:h.input.start,end:h.input.end,policyName:'Saved dated half charge',retainedBps:5000,noShowBps:10000})
  const quote=await h.cmd('quote.issue',h.input),path=await h.link(quote)
  const signed=await h.accept(quote,path,{homeRevision:cfg.revision,inventoryRevision:quote.versions[0].price.inventoryRevision});assert.equal(signed.status,200,signed.text)
  const originalStay=(await h.state()).direct.stays[0],signedPolicy=structuredClone(originalStay.quote.cancellationPolicy),signedText=originalStay.signature.text
  const dated=cfg.cancellationRevisions[0]
  cfg=await h.cmd('direct.cancellation.save',{propertyId:h.p.id,revision:cfg.revision,dateBasis:'arrival',policyId:dated.id,start:dated.start,end:dated.end,policyName:'New full charge',retainedBps:10000,noShowBps:10000})
  const pending=await h.cmd('quote.issue',{...h.input,start:quote.versions[0].price.end,end:new Date(Date.parse(quote.versions[0].price.end)+3*86400000).toISOString().slice(0,10),hold:true})
  const pendingPath=await h.link(pending),identity={auth:h.auth,owner:h.owner};await h.close();h=null
  const cli=resolve('node_modules/@runeditrun/rer/global/rer.mjs')
  await exec(process.execPath,[cli,'export','--output',archive],{cwd:source,env,maxBuffer:2e6})
  const bytes=await readFile(archive,'utf8');assert.ok(!bytes.includes(path.split('/').at(-1)),'archive omits the private quote capability');assert.ok(!bytes.includes(pendingPath.split('/').at(-1)),'archive omits the pending private quote capability');assert.match(bytes,/Alex Rivera/,'business terms remain portable')
  await exec(process.execPath,[cli,'import','--input',archive,'--yes'],{cwd:restored,env,maxBuffer:2e6})
  let outbound=0;h=await harness({root:restored,...identity,outbound:()=>{outbound++;assert.fail('Restored quotes must cause no external action')}})
  const cookie=await h.signIn(h.auth.OWNER_EMAIL),saved=await h.state(cookie)
  assert.deepEqual(saved.propertyProfiles.find(p=>p.propertyId===saved.staffQuotes[0].propertyId).inventoryUnits,[a.id,b.id].sort());assert.equal(saved.staffQuotes.length,2);assert.equal(saved.staffQuotes[0].versions[0].price.totalCents,58300);assert.equal(saved.staffQuotes[0].versions[0].price.cancellationPolicy.retainedBps,5000)
  assert.equal((await h.send(path)).status,404,'old quote link cannot be accepted after restore');assert.equal((await h.send(pendingPath)).status,404);assert.deepEqual(saved.bookings.filter(b=>b.status==='confirmed').map(b=>b.id),[originalStay.bookingId],'only the signed reservation remains; restored quote holds cannot block new inventory')
  assert.equal(saved.bookings.find(b=>b.id===originalStay.bookingId).restorePaused,true,'the signed reservation needs explicit review before service restarts')
  const restoredStay=saved.direct.stays.find(s=>s.id===originalStay.id);assert.deepEqual(restoredStay.quote.cancellationPolicy,signedPolicy);assert.equal(restoredStay.signature.text,signedText);assert.equal(restoredStay.restored,true)
  assert.equal(saved.direct.homes[0].cancellationRevisions[0].policy.retainedBps,10000)
  assert.equal((await h.send('/book/stay/'+signed.value.token)).status,404,'restored signed capability stays inactive')
  await h.restart();const restarted=await h.state(cookie);assert.deepEqual(restarted.direct.stays.find(s=>s.id===originalStay.id).quote.cancellationPolicy,signedPolicy);assert.equal(restarted.direct.stays.find(s=>s.id===originalStay.id).signature.text,signedText)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(outbound,0)
 }finally{if(h)await h.close();await rm(temporary,{recursive:true,force:true})}
})
