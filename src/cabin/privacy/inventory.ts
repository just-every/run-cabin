import { channelEvidenceInventory } from '../channel-agent/retention'
import { sha, type Context } from '../model'
import { inScope, type ErasureScope } from './scope'
/** The review binds source bytes and original file hashes too: previews can be
 * added without touching a reservation's own revision. No raw source is copied
 * into a review or its completion receipt. */
export async function erasureInventory(c:Context,s:ErasureScope){
 const parents=new Set([...c.data.turnovers,...c.data.tasks,...c.data.propertyProfiles].filter(r=>inScope(s,r)).map(r=>r.id))
 for(const t of c.data.tasks)if(t.turnoverId&&parents.has(t.turnoverId))parents.add(t.id)
 const files=(await c.db.prepare('SELECT id,turnover_id,sha256 FROM cb_photos WHERE turnover_id IN (SELECT value FROM json_each(?)) OR uploaded_by=? OR uploaded_by=(SELECT id FROM oa_operators WHERE email=(SELECT email FROM cb_members WHERE id=?)) ORDER BY id').bind(JSON.stringify([...parents]),s.entity==='member'?s.id:'',s.entity==='member'?s.id:'').all<any>()).results
 const provider=(await c.db.prepare('SELECT * FROM cb_provider_moveins ORDER BY id').all<any>()).results
 const register=(await c.db.prepare('SELECT * FROM cb_import_reviews ORDER BY id').all<any>()).results
 const sourceHashes=await Promise.all([...provider.map(r=>({table:'cb_provider_moveins',row:r})),...register.map(r=>({table:'cb_import_reviews',row:r}))].filter(r=>s.values.some(v=>JSON.stringify(r.row).toLowerCase().includes(v.toLowerCase()))).map(async r=>({table:r.table,id:r.row.id,sha256:await sha(JSON.stringify(r.row))})))
 const related=[...c.data.turnovers,...c.data.tasks,...c.data.messages,...c.data.scheduled,...c.data.codes,...c.data.notices].filter(r=>inScope(s,r)).map(r=>({id:r.id,revision:r.revision}))
 return {attachments:files,sources:[...sourceHashes,...await channelEvidenceInventory(c,s)],operationalRecords:related,identityDigest:await sha(JSON.stringify(s.values))}
}
