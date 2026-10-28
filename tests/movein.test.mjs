import { erase } from './privacy-flow.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { build } from 'esbuild'
import { harness } from './harness.mjs'

// Native CSV -> authenticated upload -> inert preview -> shared inventory ->
// reconciliation and accountable sign-off -> guarded reversal, for every provider.
test('a host moves native provider exports into reconciled listings, guests and owner balances, then safely undoes', async () => {
 const bundle=await build({entryPoints:['src/cabin/movein/providers/recorded-api.ts'],bundle:true,write:false,platform:'node',format:'esm'})
 const {adaptRecordedApi}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
 let feedText='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'
 const h=await harness({now:'2026-10-17T12:00:00Z',outbound:()=>new Response(feedText,{headers:{'content-type':'text/calendar'}})})
 try{
  for(const provider of ['guesty','hostaway','ownerrez']){
   const api=adaptRecordedApi(provider,JSON.parse(await readFile(`tests/fixtures/movein/api/${provider}.json`,'utf8')))
   assert.deepEqual(api.refusals,[]);assert.ok(api.listings.length&&api.guests.length&&api.stays.length)
   const dir=`tests/fixtures/movein/${provider}`
   const files=await Promise.all((await readdir(dir)).filter(name=>name.endsWith('.csv')).map(async name=>({name,text:await readFile(`${dir}/${name}`,'utf8')})))
   const form=new FormData();form.set('provider',provider);form.set('asOf','2026-10-17')
   for(const file of files)form.append('sourceFiles',new File([file.text],file.name,{type:'text/csv'}))
   // Browser forms include an empty optional supplementary input.
   form.append('sourceFiles',new File([],''))
   const encoded=new Response(form),multipart=new Uint8Array(await encoded.arrayBuffer()),contentType=encoded.headers.get('content-type')
   const denied=await h.mf.dispatchFetch(h.origin+'/app/action?name=import.provider.preview&returnTo=/app/import',{method:'POST',headers:{origin:h.origin,'content-type':contentType},body:multipart})
   assert.equal(denied.status,401)
   const response=await h.mf.dispatchFetch(h.origin+'/app/action?name=import.provider.preview&returnTo=/app/import',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':contentType},body:multipart})
   assert.equal(response.status,200,await response.clone().text())
   let state=await h.accessState(),job=state.importJobs.find(j=>j.provider===provider)
   assert.ok(job,`${provider} preview saved: ${(await response.text()).match(/role="alert"[^>]*>([^<]+)/)?.[1]}`);assert.equal(state.properties.length,0)
   assert.equal(job.plan.refusals.length,0,JSON.stringify(job.plan.refusals))
   assert.ok(job.plan.homes.length>0);assert.ok(job.plan.stays.length>0);assert.ok(job.plan.guests.length>0);assert.ok(job.plan.balances.length>0)
   assert.deepEqual(job.reconciliation.source,{reservations:3,futureNights:7,ownerBalanceCents:175042})
   assert.ok(job.reconciliation.matched,JSON.stringify(job.reconciliation))
   await h.cmd('import.provider.apply',{id:job.id,fingerprint:'not-reviewed'},h.owner,409)
   job=await h.cmd('import.provider.apply',{id:job.id,fingerprint:job.fingerprint})
   state=await h.accessState();assert.equal(state.bookings.length,job.plan.stays.length);assert.equal(state.properties.length,job.plan.homes.length)
   assert.ok(job.reconciliation.matched)
   assert.deepEqual(job.reconciliation.source,job.reconciliation.destination)
   assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_movein_guests').first()).n,job.plan.guests.length)
   assert.equal((await h.db.prepare('SELECT SUM(amount_cents) n FROM cb_opening_balances').first()).n,job.reconciliation.source.ownerBalanceCents)
   for(const home of job.plan.homes)for(const link of home.links)assert.ok(state.connections.some(c=>c.propertyId===`migrate:${provider}:${home.externalId}`&&c.channel===link.channel&&c.url===link.url))
   const first=state.bookings.find(b=>b.status==='confirmed'),exports=state.exports.find(e=>e.propertyId===first.propertyId)
   const feed=await h.send(`/ical/${exports.token}/all.ics`)
   assert.equal(feed.status,200);assert.ok(feed.text.includes(first.start.replaceAll('-','')))
   await h.cmd('import.provider.signoff',{id:job.id,fingerprint:job.fingerprint},h.owner,400)
   const signed=await h.cmd('import.provider.signoff',{id:job.id,fingerprint:job.fingerprint,confirm:'yes'})
   assert.equal(signed.status,'signed-off')
   await h.cmd('import.provider.undo',{id:job.id})
   state=await h.accessState();assert.equal(state.properties.length,0);assert.equal(state.bookings.length,0);assert.equal(state.connections.length,0);assert.ok(state.guests.every(g=>g.erasedAt&&g.identities.length===0&&g.facts.length===0&&g.consents.length===0),'undo leaves no active or personal guest origins')
   assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_opening_balances').first()).n,0)
   assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_movein_guests').first()).n,0)
   // A duplicate source row is named, excluded and remains visible in source
   // counts; unexplained differences cannot be signed off.
   const native=files.find(f=>f.name==='reservations.csv')
   const lines=native.text.trimEnd().split('\n'),badFiles=files.map(f=>f===native?{...f,text:f.text.trimEnd()+'\n'+lines[1].replace('Alex Morgan','Refused duplicate guest')+'\n'}:f)
   const bad=await h.cmd('import.provider.preview',{provider,files:badFiles,asOf:'2026-10-17'})
   assert.ok(bad.plan.refusals.some(r=>r.file===native.name&&r.row>1&&r.externalId))
   assert.ok(!bad.reconciliation.matched)
   const imported=await h.cmd('import.provider.apply',{id:bad.id,fingerprint:bad.fingerprint})
   assert.ok(!(await h.accessState()).bookings.some(b=>b.guestName==='Refused duplicate guest'))
   await h.cmd('import.provider.signoff',{id:bad.id,fingerprint:bad.fingerprint,confirm:'yes'},h.owner,400)
   const explained={id:bad.id,fingerprint:bad.fingerprint,confirm:'yes',refusalsExplanation:'Duplicate exported source row excluded; original reservation retained once.'}
   for(const d of imported.reconciliation.differences)explained[`${d.metric}Explanation`]='Duplicate row in source export; Cabin retains the one original reservation.'
   await h.cmd('import.provider.signoff',explained)
   await h.cmd('import.provider.undo',{id:bad.id})
   // Imported stays reject overlap requests before cutover and undo refuses
   // subsequent native edits or dependent work.
   const again=await h.cmd('import.provider.preview',{provider,files,asOf:'2026-10-17'})
   await h.cmd('import.provider.apply',{id:again.id,fingerprint:again.fingerprint})
   state=await h.accessState();const booking=state.bookings.find(b=>b.status==='confirmed')
   const clash=await h.cmd('reservation.request',{propertyId:booking.propertyId,channel:'direct',start:booking.start,end:booking.end,guestName:'Alex Overlap'})
   assert.equal(clash.status,'declined');assert.equal((await h.accessState()).bookings.length,state.bookings.length)
   const connection=state.connections.find(c=>c.propertyId===booking.propertyId&&c.channel===booking.channel)
   assert.ok(connection,'imported channel connection retained')
   {
    await h.cmd('channel.sync',{id:connection.id})
    assert.ok((await h.accessState()).bookings.some(b=>b.id===booking.id&&b.status==='confirmed'),'empty feed keeps imported hold')
    feedText=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:channel-adopted-${provider}\r\nDTSTART;VALUE=DATE:${booking.start.replaceAll('-','')}\r\nDTEND;VALUE=DATE:${booking.end.replaceAll('-','')}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
    await h.cmd('channel.sync',{id:connection.id})
    const adopted=(await h.accessState()).bookings
    assert.equal(adopted.length,state.bookings.length);assert.equal(adopted.find(b=>b.id===booking.id).source,'feed')
    assert.equal(adopted.find(b=>b.id===booking.id).guestName,booking.guestName)
    feedText='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'
   }
   await h.cmd('booking.details',{id:booking.id,revision:(await h.accessState()).bookings.find(row=>row.id===booking.id).revision,guestName:'A native correction'})
   await h.cmd('import.provider.undo',{id:again.id},h.owner,409)
   // Erasure retires all personal source custody and the opening balance.
   for(const p of (await h.accessState()).properties)await erase(h,{entity:'property',id:p.id,revision:p.revision})
   assert.equal((await h.accessState()).properties.length,0)
   assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM cb_movein_guests').first()).n,0)
  }
 }finally{await h.close()}
})
