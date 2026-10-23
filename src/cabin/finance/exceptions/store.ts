import { type Context,type Actor,query } from '../../model'
import { assertLive } from '../../storage'
import { hasAction,permitsProperty } from '../../permissions/policy'
import type { FinancialCase } from './types'
export async function financialCases(db:D1Database):Promise<FinancialCase[]>{
 return (await db.prepare("SELECT data FROM cb_records WHERE kind='financialCases' ORDER BY rowid").all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
export function saveCase(c:Context,row:FinancialCase){
 c.queries.push(query("INSERT INTO cb_records(kind,id,revision,data) VALUES('financialCases',?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data",row.id,row.revision,JSON.stringify(row)))
 c.entityId=row.id;c.audit??=[];c.audit.push({kind:'financialCases',id:row.id,propertyId:row.propertyId,bookingId:row.bookingId,revision:row.revision,result:row.status})
 return row
}
export async function caseState(db:D1Database,actor:Actor){
 if(actor.isAgent||actor.role!=='owner'||!hasAction(actor,'finance:read'))return []
 await assertLive(db,actor)
 const rows=(await financialCases(db)).filter(r=>permitsProperty(actor,r.propertyId))
 await assertLive(db,actor);return rows
}
