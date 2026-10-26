import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
export async function interruptedMessageJourney({screens=async()=>{},act}={}){
 let hold=false,started,release,phase='before',noticeEmail='';const accepted=[]
 let reached,response
 const arm=()=>{reached=new Promise(r=>{started=r});response=new Promise(r=>{release=r});hold=true}
 const h=await harness({now:'2026-10-26T14:00:00Z',assets:true,auth:{CABIN_TEST_MAIL_EDGE:'true'},outbound:async request=>{
  assert.equal(new URL(request.url).hostname,'mail.cabin.test')
  const message=await request.json()
  if(hold&&(message.subject==='Recovery follow-up'||noticeEmail&&message.to.includes(noticeEmail))){
   hold=false;if(phase==='after')accepted.push(message.deliveryId);started();await response
   if(phase==='before')return new Response('Interrupted before acceptance',{status:503})
  }else accepted.push(message.deliveryId)
  return Response.json({status:'accepted',provider:'synthetic',providerMessageId:'synthetic-cabin-'+message.deliveryId})
 }})
 let sending
 try{
  const home=await h.cmd('property.save',{name:'Cedar Creek Cabin',ownerName:'Morgan Carter',ownerEmail:'morgan@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:home.id,address:'12 Cedar Lane',timeZone:'America/New_York',checkInTime:'16:00',checkOutTime:'10:00',checklist:['Ready']})
  await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',guestName:'Megan Ortiz',guestEmail:'megan@stay.example',start:'2026-11-01',end:'2026-11-04'})
  const page=(await h.send('/app/inbox',undefined,h.owner)).text,thread=page.match(/name="thread" value="([^"]+)"/)[1]
  for(phase of ['before','after']){
   arm();sending=h.cmd('message.compose',{thread,subject:'Recovery follow-up',text:'Please confirm your access is working.'})
   await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(Error('The real send did not reach its provider edge')),15000))])
   let row=(await h.state()).messages.find(m=>m.status==='sending'&&m.subject==='Recovery follow-up')
   assert.ok(row.send.attemptId);assert.ok(row.send.assignedEmail);const id=row.id
   // The network request is held at the acceptance boundary while the durable claim expires.
   await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.send.expiresAt',?) WHERE id=?").bind('2026-10-26T13:59:00Z',id).run()
   await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
   row=(await h.state()).messages.find(m=>m.id===id);assert.equal(row.status,'failed');assert.equal(row.send.state,'uncertain')
   release();await sending;sending=null
   row=(await h.state()).messages.find(m=>m.id===id)
   assert.equal(row.status,'failed','A late provider response never overwrites the assigned uncertain state')
   const before=accepted.filter(value=>value===id).length
   await h.restart();await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'})
   assert.equal(accepted.filter(value=>value===id).length,before)
   await h.cmd('message.retry',{id,revision:row.revision},h.owner,409)
   row=(await h.state()).messages.find(m=>m.id===id)
   await screens(h,'uncertain-'+phase,row)
   const evidence={id,revision:row.revision,outcome:phase==='after'?'accepted':'not_applied',reference:'synthetic-cabin-'+phase,reason:phase==='after'?'Provider receipt confirms the one accepted attempt':'Provider request history confirms no attempt was accepted',confirm:'yes'}
   const manager=await h.person('Manager'+phase,'manager')
   await h.cmd('message.reconcile',evidence,manager.cookie,403)
   const reconciled=act?await act(h,'message.reconcile',evidence):await h.cmd('message.reconcile',evidence)
   row=(await h.state()).messages.find(m=>m.id===id)
   if(phase==='after'){assert.equal(row.status,'sent');assert.equal(accepted.filter(value=>value===id).length,1)}
   else{
    assert.equal(row.status,'failed');assert.equal(row.send.state,'rejected')
    await h.cmd('message.retry',{id,revision:'obsolete'},h.owner,409)
    await h.cmd('message.retry',{id,revision:row.revision})
    row=(await h.state()).messages.find(m=>m.id===id);assert.equal(row.status,'sent');assert.equal(accepted.filter(value=>value===id).length,1)
   }
   await screens(h,'reconciled-'+phase,row)
  }
  // Team notices use the same acceptance boundary and remain assigned without a blind resend.
  for(phase of ['before','after']){
   const cleaner=await h.person('Notice'+phase);noticeEmail=cleaner.email
   const turnover=(await h.state()).turnovers.find(t=>t.status==='unassigned'||t.status==='approved')
   arm();sending=h.cmd('turnover.assign',{id:turnover.id,revision:turnover.revision,cleanerId:cleaner.id})
   await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(Error('Team notice did not reach its provider boundary')),15000))])
   let row=(await h.state()).notices.find(n=>n.status==='sending'&&n.email===noticeEmail);assert.ok(row.send.attemptId)
   await h.db.prepare("UPDATE cb_records SET data=json_set(data,'$.send.expiresAt',?) WHERE id=?").bind('2026-10-26T13:59:00Z',row.id).run()
   await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});release();await sending;sending=null
   row=(await h.state()).notices.find(n=>n.id===row.id);assert.equal(row.status,'failed');assert.equal(row.send.state,'uncertain');assert.equal(row.send.assignedEmail,h.auth.OWNER_EMAIL)
   const count=accepted.filter(id=>id===row.id).length;await h.restart();await(await h.mf.getWorker()).scheduled({cron:'*/5 * * * *'});assert.equal(accepted.filter(id=>id===row.id).length,count)
   noticeEmail=''
  }
 }finally{release?.();if(sending)await sending.catch(()=>{});await h.close()}
}
