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
  h=await quoteHarness({root:source});const {a,b}=await rooms(h,h.p);const quote=await h.cmd('quote.issue',h.input),path=await h.link(quote),identity={auth:h.auth,owner:h.owner}
  const {inquirySource,sourceInquiry}=await import('./inquiries-support.mjs'),inquiryDoor=await inquirySource(h,{cleaner:false,name:'ZZ synthetic lakeside cabin'})
  await inquiryDoor.settings();await inquiryDoor.read([sourceInquiry],'succeeded',null);await inquiryDoor.review((await h.state()).inquiries[0])
  const inquiryProof=(await h.state()).inquiries[0]
  await h.close();h=null
  const cli=resolve('node_modules/@runeditrun/rer/global/rer.mjs')
  await exec(process.execPath,[cli,'export','--output',archive],{cwd:source,env,maxBuffer:2e6})
  const bytes=await readFile(archive,'utf8');assert.ok(!bytes.includes(path.split('/').at(-1)),'archive omits the private quote capability');assert.match(bytes,/Alex Rivera/,'business terms remain portable')
  await exec(process.execPath,[cli,'import','--input',archive,'--yes'],{cwd:restored,env,maxBuffer:2e6})
  let outbound=0;h=await harness({root:restored,...identity,outbound:()=>{outbound++;assert.fail('Restored quotes must cause no external action')}})
  const cookie=await h.signIn(h.auth.OWNER_EMAIL),saved=await h.state(cookie)
  assert.deepEqual(saved.propertyProfiles.find(p=>p.propertyId===saved.staffQuotes[0].propertyId).inventoryUnits,[a.id,b.id].sort());assert.equal(saved.staffQuotes.length,1);assert.equal(saved.staffQuotes[0].versions[0].price.totalCents,58300);assert.equal(saved.staffQuotes[0].versions[0].price.cancellationPolicy.retainedBps,5000)
  assert.equal((await h.send(path)).status,404,'old quote link cannot be accepted after restore');assert.equal(saved.bookings.filter(b=>b.status==='confirmed').length,0,'restored quote holds cannot block new inventory')
  const restoredInquiry=saved.inquiries.find(q=>q.id===inquiryProof.id)
  assert.equal(restoredInquiry.restorePaused,true);assert.equal(restoredInquiry.deadline,inquiryProof.deadline);assert.equal(restoredInquiry.quoteCents,58325)
  assert.equal(saved.threadCases.find(r=>r.id===inquiryProof.threadId).status,'answered')
  const restoredConversation=saved.messages.filter(m=>m.ref===inquiryProof.threadRef)
  assert.equal(restoredConversation.length,1);assert.equal(restoredConversation[0].text,sourceInquiry.message);assert.ok(restoredConversation.every(m=>m.status==='discarded'))
  await h.cmd('inquiry.review',{id:restoredInquiry.id,revision:restoredInquiry.revision,sourceThreadId:restoredInquiry.sourceThreadId,confirm:'yes'},cookie,409)
  await (await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(outbound,0)
 }finally{if(h)await h.close();await rm(temporary,{recursive:true,force:true})}
})
