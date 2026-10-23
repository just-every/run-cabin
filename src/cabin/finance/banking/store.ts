import { type Actor,type Context,manager,need,newId,query } from '../../model'
import { assertLive } from '../../storage'
import { hasAction,permitsProperty } from '../../permissions/policy'
import { journals } from '../../ledger/store'
import { bankKinds,type BankData,type BankRecord } from './types'
export async function bankData(db:D1Database):Promise<BankData>{
 const result:BankData={accounts:[],statements:[],assignments:[],matches:[],reconciliations:[],plans:[],cancellations:[]}
 const keys=new Map(Object.entries(bankKinds).map(([key,kind])=>[kind,key as keyof BankData]))
 const rows=await db.prepare(`SELECT kind,data FROM cb_records WHERE kind IN (${Object.values(bankKinds).map(()=>'?').join(',')}) ORDER BY rowid`).bind(...Object.values(bankKinds)).all<{kind:typeof bankKinds[keyof typeof bankKinds];data:string}>()
 for(const row of rows.results)(result[keys.get(row.kind)!] as BankRecord[]).push(JSON.parse(row.data))
 return result
}
export function retain<K extends keyof BankData>(c:Context,data:BankData,key:K,row:BankData[K][number]){
 c.queries.push(query('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?)',bankKinds[key],row.id,row.revision,JSON.stringify(row)))
 ;(data[key] as BankRecord[]).push(row)
 c.entityId=row.id;c.audit??=[];c.audit.push({kind:bankKinds[key],id:row.id,propertyId:row.propertyId,revision:row.revision,result:key==='reconciliations'?'matched':key==='plans'?'approved':'completed'})
 return row
}
export const base=(c:Context,propertyId:string):BankRecord=>({id:newId(),revision:newId(),propertyId,createdBy:c.actor.id,createdAt:c.now})
export async function bankState(db:D1Database,actor:Actor){
 const empty={accounts:[],statements:[],assignments:[],matches:[],reconciliations:[],plans:[],cancellations:[],unassigned:[]}
 if(actor.isAgent||!['owner','manager'].includes(actor.role)||!hasAction(actor,'finance:read'))return empty
 manager(actor);await assertLive(db,actor)
 const all=await bankData(db),result=Object.fromEntries(Object.entries(all).map(([key,rows])=>[key,rows.filter((row:BankRecord)=>permitsProperty(actor,row.propertyId))])) as unknown as BankData
 const unassigned=(await journals(db)).filter(j=>permitsProperty(actor,j.propertyId)&&!all.assignments.some(a=>a.journalId===j.id))
 await assertLive(db,actor);return {...result,unassigned}
}
export function accountIn(data:BankData,id:unknown){const account=data.accounts.find(a=>a.id===id);need(account,'Designated bank account not found',404);return account}
