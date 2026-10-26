import assert from 'node:assert/strict'
import {qboBooks,qboMapping,syntheticGrant} from './qbo-support.mjs'
export async function populateQboArchive(h){
 const b=await qboBooks(h);await h.cmd('qbo.connect',syntheticGrant);const c=await h.cmd('qbo.catalog',{});const mapping=await qboMapping(h,b.home,c),preview=await h.cmd('qbo.preview',{propertyId:b.home.id,month:'2026-10'}),sent=await h.cmd('qbo.sync',{id:preview.id,revision:preview.revision,consent:true});assert.equal(sent.reconciled,true)
 return {batch:preview,mapping,externalIds:sent.entries.map(e=>e.externalId)}
}
export async function checkQboArchive(h,cookie,proof){
 for(const table of ['cb_qbo_app','cb_qbo_connection','cb_qbo_oauth'])assert.equal((await h.db.prepare('SELECT count(*) AS n FROM '+table).first()).n,0)
 const q=(await h.state(cookie)).qbo,b=q.batches.find(b=>b.id===proof.batch.id);assert.equal(q.connection,null);assert.equal(b.restored,true);assert.deepEqual(b.entries.map(e=>e.externalId),proof.externalIds);assert.ok(q.mappings.every(m=>m.restored))
 await h.cmd('qbo.sync',{id:b.id,revision:b.revision,consent:true},cookie,409)
}
