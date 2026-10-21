import type { Actor } from '../../model'
import { need } from '../../model'
import { pageBase, records, inIds, scoped } from '../../pages/core'
/** Recipient and ownership decisions need current people/terms, never message bodies. */
export async function reportDirectory(db:D1Database,actor:Actor){
 const data=await pageBase(db,actor)
 await records(db,data,['managementTerms','homeSettings'],inIds("json_extract(data,'$.propertyId')"),[scoped(data)])
 need((await db.prepare('SELECT version FROM cb_meta WHERE id=1').first<{version:number}>())?.version===data.version,'Records changed while report access was loading. Reload and review.',409)
 return data
}
