import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile,spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp,rm,readFile,mkdir } from 'node:fs/promises'
import { join,resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium,expect } from '@playwright/test'
const exec=promisify(execFile),launcher=resolve('node_modules/@runeditrun/rer/global/rer.mjs')
async function stopOwned(app){
 if(!app||app.exitCode!==null||app.signalCode!==null)return
 const exited=new Promise(r=>app.once('exit',r));app.kill('SIGINT')
 let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned rer dev did not stop after SIGINT')),30000)})])}finally{clearTimeout(timer)}
}

test('a fresh public-source clone installs, sets up, signs in and preserves a native product job across rer dev restart',{timeout:900000},async()=>{
 const evidence=process.env.CABIN_OPEN_SHOTS??'./test-results/free-source';await mkdir(evidence,{recursive:true})
 const folder=await mkdtemp(join(tmpdir(),'cabin-source-')),root=join(folder,'run-cabin'),env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}
 delete env.RER_LOCAL_OPERATION;delete env.RER_LOCAL_STATE_PATH
 for(const key of Object.keys(env))if(/^(GH_|GITHUB_|RER_CLOUD_)/.test(key)||key.endsWith('_CLOUD'))delete env[key]
 let app,browser
 const command=async args=>{try{return await exec(process.execPath,[launcher,...args,'--cwd',root,'--json'],{env,maxBuffer:2000000})}catch(error){const failures=String(error.stdout??'').split('\n').flatMap(line=>{try{const v=JSON.parse(line);return v.event==='error'?[{code:v.code,step:v.step,message:String(v.message??'').replace(/https?:\/\/\S+/g,'[address]').replace(/[A-Za-z0-9_-]{24,}/g,'[opaque]').split('\n').filter(v=>!/secret|token|password|authorization|RER_OPEN/i.test(v)).join(' ')}]:[]}catch{return []}});const captured=await readFile(join(root,'.seed/installer/install.log'),'utf8').catch(()=>'');const diagnostic=captured.split('\n').slice(-60).filter(v=>!/secret|token|password|authorization|RER_OPEN/i.test(v)).join('\n').replace(/https?:\/\/\S+/g,'[address]').replace(/[A-Za-z0-9_-]{24,}/g,'[opaque]');throw new Error('Source lifecycle '+args[0]+' failed with exit '+error.code+'; sanitized diagnostic '+JSON.stringify(failures)+'; redacted capture tail '+diagnostic)}}
 const start=async()=>{
  app=spawn(process.execPath,[launcher,'dev','--cwd',root,'--foreground','--json'],{cwd:root,env,stdio:['ignore','pipe','pipe']})
  let buffer='',timer
  return new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(new Error('Source rer dev readiness timed out')),600000)
   app.once('exit',code=>{clearTimeout(timer);reject(new Error('Owned rer dev exited before readiness: '+code))})
   app.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const v=JSON.parse(line);if(v.event==='ready'&&v.url&&v.openUrl){clearTimeout(timer);resolve(v)}}catch{}}})
   // Never print RER_OPEN, private settings, command output or development credentials.
   app.stderr.on('data',()=>{})
  })
 }
 try{
  // A consumer source checkout needs only this exact tree, not unpublished historical blobs from a filtered builder clone.
  await exec('git',['clone','--no-local','--depth','1',resolve('.'),root],{env})
  await exec('git',['config','user.name','Run Edit Run fleet'],{cwd:root,env});await exec('git',['config','user.email','synthetic-cabin-fleet@stay.example'],{cwd:root,env})
  await command(['install'])
  await command(['setup','--owner-email','synthetic-cabin-owner@stay.example','--non-interactive'])
  browser=await chromium.launch({headless:true,...(process.env.CABIN_CHROMIUM?{executablePath:process.env.CABIN_CHROMIUM}:{}),args:['--use-mock-keychain','--password-store=basic',...(process.env.CABIN_CHROMIUM?['--no-sandbox']:[])]})
  let propertyId,bookingId,planId
  for(let pass=0;pass<2;pass++){
   const ready=await start();const health=await fetch(ready.url+'/health');assert.equal(health.status,200);assert.equal((await health.json()).status,'ok')
   const context=await browser.newContext({viewport:{width:1440,height:1000}})
   const destinations=new Set();context.on('request',request=>destinations.add(new URL(request.url()).origin))
   try{
    const page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(ready.openUrl);await page.waitForURL(url=>['/setup','/app','/app/calendar'].includes(url.pathname))
    if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox',{name:'I confirm this owner account is ready to use.'}).check();await page.getByRole('button',{name:'Finish setup',exact:true}).click()}
    const state=async()=>{const r=await context.request.get(ready.url+'/api/cabin/state');assert.equal(r.status(),200);return r.json()}
    const cmd=async(name,input)=>{const r=await context.request.post(ready.url+'/api/cabin/command',{headers:{origin:ready.url},data:{name,input}});assert.equal(r.status(),200,name);return (await r.json()).result}
    if(!pass){
     const p=await cmd('property.save',{name:'Synthetic Cabin Runtime',ownerName:'Synthetic Owner',ownerEmail:'owner@stay.example',commissionBps:1500});propertyId=p.id
     for(let n=2;n<=40;n++)await cmd('property.save',{name:'Synthetic Cabin Home '+n,ownerName:'Synthetic Owner',ownerEmail:'owner@stay.example',commissionBps:1500})
     for(let n=1;n<=25;n++){const member=await cmd('member.save',{name:'Synthetic Cabin Staff '+n,email:'synthetic-cabin-'+n+'@stay.example',role:'manager',active:true});await cmd('member.invite',{id:member.id})}
     const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10)
     const b=await cmd('reservation.create',{propertyId,channel:'direct',method:'phone',sourceId:'synthetic-cabin-runtime-1',guestName:'Synthetic Runtime Guest',guestEmail:'guest@stay.example',start:date(10),end:date(12),rentCents:10000,feesCents:0,taxCents:0,policyName:'Guest-reviewed runtime stay',retainedBps:0,noShowBps:0});bookingId=b.id
     planId=(await cmd('direct.collection.create',{bookingId,depositCents:3000,balanceDays:3,assigneeId:(await state()).actor.id})).id
    }
    const s=await state();assert.equal(s.properties.length,40);assert.equal(s.members.filter(m=>m.active).length,25);assert.equal(s.properties.filter(p=>p.id===propertyId).length,1);assert.equal(s.bookings.filter(b=>b.id===bookingId).length,1);assert.equal(s.direct.collections.find(p=>p.id===planId).status,'consent_required')
    await page.goto(ready.url+'/app/direct');await expect(page.getByRole('heading',{name:'Payments · scheduled collection',exact:true})).toBeVisible()
    if(!pass){
     const areas=await page.getByRole('navigation',{name:'Cabin workspace'}).getByRole('link').evaluateAll(links=>links.map(a=>({path:new URL(a.href).pathname,name:a.textContent.trim()})))
     assert.ok(areas.length>0,'the installed workspace exposes its product areas')
     for(const width of [1440]){
      await page.setViewportSize({width,height:1000})
      for(const area of areas){
       const response=await page.goto(ready.url+area.path);assert.equal(response.status(),200,area.name)
       await expect(page.locator('main h1')).toBeVisible()
       await expect(page.locator('main')).not.toContainText(new RegExp('license key|upgrade to|payment required|paid tier','i'))
       await page.screenshot({path:join(evidence,area.path.split('/').at(-1)+'-'+width+'.png')})
      }
     }
    }
   assert.deepEqual([...destinations],[ready.url],'the browser needs only its local installation')
   }finally{await context.close()}
   await stopOwned(app);app=undefined
  }
  console.log('Source lifecycle PASS on '+process.platform+': clean clone, rer install, setup and dev, native owner sign-in, 40 homes, 25 invited active staff, every linked product area at 1440, saved reservation and schedule, and owned-process restart without duplicate product jobs')
 }catch(error){
  if(String(error?.message??'').startsWith('Source lifecycle '))throw error
  throw new Error('Owner source lifecycle assertion failed; private browser entry withheld.')
 }finally{
  if(browser)await browser.close();await stopOwned(app);await rm(folder,{recursive:true,force:true})
 }
})
