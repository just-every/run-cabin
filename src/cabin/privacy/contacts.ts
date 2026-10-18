import { phoneOf } from '../inbox/threads'
import { need, query, sha, type Context } from '../model'
import type { ErasureScope } from './scope'
export const contactKey=(value:string)=>value.includes('@')?value.trim().toLowerCase():phoneOf(value)??value.trim().toLowerCase()
export async function fenceContacts(c:Context,s:ErasureScope){
 for(const value of s.values.filter(v=>v.includes('@')||/^\+?[\d ().-]{6,}$/.test(v)))c.queries.push(query("INSERT OR IGNORE INTO cb_erasure_fences(entity,id_hash,at) VALUES('contact',?,?)",await sha(contactKey(value)),c.now))
}
/** Call at the final mail/SMS network boundary, including manually retried jobs.
 * A fresh read prevents retained accounting or later imports reusing a contact. */
export async function assertContactsAllowed(db:D1Database,values:(string|null|undefined)[]){
 const hashes=await Promise.all(values.filter((v):v is string=>typeof v==='string'&&!!v).map(v=>sha(contactKey(v))))
 need(!await db.prepare("SELECT 1 FROM cb_erasure_fences WHERE entity='contact' AND id_hash IN (SELECT value FROM json_each(?))").bind(JSON.stringify(hashes)).first(),'Recipient contact was erased. Automatic and queued delivery is blocked.',409)
}
