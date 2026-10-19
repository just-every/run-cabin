import { type Context,query,sha } from '../model'
import type { ErasureScope } from '../privacy/scope'
import { rows,save } from './store'
import { ACTION,EVIDENCE,type Action } from './types'

// A source table can contain several guests, so withdraw the whole property's
// image and page links on a guest erasure rather than leave a second copy.
export async function channelEvidenceInventory(c:Context,s:ErasureScope){
 if(s.entity==='member')return []
 const actions=(await rows<Action>(c.db,ACTION)).filter(a=>s.properties.has(a.propertyId))
 const ids=new Set(actions.flatMap(a=>[a.beforeSealed,a.afterSealed,`channel-image:${a.id}:before`,`channel-image:${a.id}:after`]).filter(Boolean))
 const evidence=(await rows<{id:string;bodySealed?:string}>(c.db,EVIDENCE)).filter(r=>ids.has(r.id))
 return Promise.all(evidence.map(async r=>({table:EVIDENCE,id:r.id,sha256:await sha(JSON.stringify(r))})))
}
export async function eraseChannelEvidence(c:Context,s:ErasureScope){
 if(s.entity==='member')return
 for(const a of (await rows<Action>(c.db,ACTION)).filter(a=>s.properties.has(a.propertyId))){
  for(const id of [a.beforeSealed,a.afterSealed,`channel-image:${a.id}:before`,`channel-image:${a.id}:after`])if(id)c.queries.push(query('DELETE FROM cb_records WHERE kind=? AND id=?',EVIDENCE,id))
  delete a.beforeSealed;delete a.afterSealed;delete a.readUrl
  if(a.kind.startsWith('read-')&&['queued','running'].includes(a.status)){a.status='cancelled';delete a.lease;delete a.leaseUntil}
  save(c,ACTION,a)
 }
 c.queries.push(query("UPDATE cb_records SET data=json_remove(data,'$.readUrl') WHERE kind='channelAgentReadObservations' AND json_extract(data,'$.propertyId') IN (SELECT value FROM json_each(?))",JSON.stringify([...s.properties])))
}
