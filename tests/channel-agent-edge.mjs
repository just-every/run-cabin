import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'
import { executeRead } from '../scripts/channel-agent/read-page.mjs'
import { executeJob } from '../scripts/channel-agent/executor.mjs'
import { startSigninViewer } from '../scripts/channel-agent/viewer.mjs'
const recorded=await readFile(new URL('./fixtures/channel-pages/calendar.html',import.meta.url),'utf8')
const reads=await readFile(new URL('./fixtures/channel-pages/reads.html',import.meta.url),'utf8')
export async function channelEdge(){
 let mode='',writes=0,authorize,checkpoint,sourceEdits={}
 const server=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html'});response.end(recorded)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const origin=`http://127.0.0.1:${server.address().port}`
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 async function run(job,{human=false,onViewer}={}){
  const context=await browser.newContext({storageState:job.storageState??undefined,viewport:{width:1440,height:900}})
  await context.route(/https:\/\/(?:www\.)?(?:airbnb|vrbo|booking)\.com\//,async route=>{
   const response=await fetch(origin)
   await route.fulfill({response:undefined,status:200,contentType:'text/html',body:job.kind.startsWith('read-')&&!mode?reads:job.start?(await response.text()).replace(/2026-12-1[012]/g,date=>new Date(Date.parse(job.start+'T00:00:00Z')+(Number(date.slice(-2))-10)*86400000).toISOString().slice(0,10)):await response.text()})
  })
  await context.addInitScript(edits=>localStorage.setItem('sourceEdits',JSON.stringify(edits)),sourceEdits)
  await context.exposeFunction('cabinEdgeAcceptance',()=>{writes++})
  await context.addInitScript(()=>{
   document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('button'):null
    if(!button||!/^(Block|Reopen)/.test(button.textContent.trim()))return
    const snapshot=()=>[...document.querySelectorAll('td')].map(el=>el.textContent).join('|'),before=snapshot()
    queueMicrotask(()=>{if(snapshot()!==before)window.cabinEdgeAcceptance()})
   },true)
  })
  const page=await context.newPage()
  try{
   const listingUrl=job.listingUrl+(mode?'?mode='+mode:'')
   const driver=async ({phase,job:task,observation})=>{
    if(phase==='read'){
     const labels={listingId:'Listing ID',direction:'Direction',reservationId:'Reservation ID',guestName:'Guest',start:'Arrival',end:'Departure',status:'Status',guestEmail:'Email',messageId:'Message ID',text:'Message',sentAt:'Sent at',transactionId:'Transaction ID',payoutId:'Payout ID',date:'Settlement date',currency:'Currency',gross:'Gross',fee:'Fee',net:'Net',type:'Type'}
     const table=observation.tables[0],columns=Object.fromEntries([...observation.required,...observation.optional].filter(k=>table?.headers.includes(labels[k])).map(k=>[k,table.headers.indexOf(labels[k])]))
     if(JSON.stringify(observation).includes('megan@')||JSON.stringify(observation).includes('1000.00'))throw Error('Source values leaked to model')
     return {type:'extract',table:table?.ref,columns}
    }
    const nights=observation.controls.filter(c=>c.tag==='td'),want=task.kind==='close'?'closed':'open'
    const evidence=state=>nights.map(c=>({ref:c.ref,date:c.text.match(/\d{4}-\d{2}-\d{2}/)[0],state}))
    if(nights.every(c=>c.text.includes(' '+want)))return {type:'done',evidence:evidence(want)}
    if(task.kind==='close'&&!driver.baseline){driver.baseline=true;return {type:'baseline',evidence:evidence('open')}}
    const control=observation.controls.find(c=>c.tag==='button'&&c.text.startsWith(task.kind==='close'?'Block':'Reopen'))
    return {type:'click',ref:control.ref}
   }
   const result=await (job.kind.startsWith('read-')?executeRead:executeJob)(page,{...job,listingUrl,readUrl:job.readUrl+(mode?'?mode='+mode:'')},driver,{beforeAction:authorize,onBefore:checkpoint,connect:human?async (page,job,guard)=>{
    const viewer=await startSigninViewer(page,job,guard)
    const host=await browser.newContext(),screen=await host.newPage()
    try{
     await screen.goto(viewer.url)
     await screen.waitForFunction(()=>{const image=document.getElementById('screen');return image.complete&&image.naturalWidth>0})
     // The host interacts with the real local profile viewer through its public UI.
     // The fixture's sign-in positions are observed from the channel page only at this external edge.
     for(const [selector,text] of [['input[type=email]','host@stay.example'],['input[type=password]','fixture-only-password']]){
      if(await page.locator(selector).count()){
       const rect=await page.locator(selector).boundingBox()
       await screen.evaluate(async ({rect,text})=>{await fetch('/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'click',x:Math.round(rect.x+10),y:Math.round(rect.y+10)})});await fetch('/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'type',text})})},{rect,text})
      }
     }
     if(await page.locator('input[type=password]').count()){
      await screen.evaluate(async()=>{await fetch('/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'key',key:'Enter'})})})
      await page.waitForSelector('td')
     }
     if(onViewer)await onViewer(screen)
     await screen.getByRole('button',{name:'Finished',exact:true}).click()
     return await viewer.result
    }finally{await host.close();await viewer.close()}
   }:undefined})
   const storageState=await context.storageState({indexedDB:true})
   return {...result,storageState}
  }finally{await context.close()}
 }
 return {run,set authorize(value){authorize=value},set checkpoint(value){checkpoint=value},get writes(){return writes},set mode(value){mode=value},set sourceEdits(value){sourceEdits=value},close:async()=>{await browser.close();await new Promise(r=>server.close(r))}}
}
export async function provision(h,edge,channels=['airbnb','vrbo','booking.com']){
 const home=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Karen Ortiz',ownerEmail:'karen@stay.example',commissionBps:2000})
 const key=await h.cmd('channelAgent.runner.create',{})
 const runner=async(body,status=200)=>{
  const r=await h.send('/api/cabin/channel-agent/runner',body,'',{authorization:'Bearer '+key.token})
  if(r.status!==status)throw Error(`runner ${r.status}: ${JSON.stringify(r.value)}`)
  return r.value
 }
 edge.checkpoint=(job,before)=>runner({op:'checkpoint',id:job.id,lease:job.lease,before})
 edge.authorize=job=>runner({op:'authorize',id:job.id,lease:job.lease})
 for(const channel of channels){
  await h.cmd('channelAgent.connect',{propertyId:home.id,channel,confirm:'yes',listingId:'lake-loft',listingUrl:`https://www.${channel==='booking.com'?'booking.com':channel+'.com'}/hosting/calendar/lake-loft`})
  const {job}=await runner({op:'claim'})
  const result=await edge.run(job,{human:true})
  if(result.outcome!=='succeeded')throw Error('Recorded host sign-in failed: '+JSON.stringify(result))
  await runner({op:'complete',id:job.id,lease:job.lease,...result})
 }
 return {home,runner,key}
}
