import { owner, need, type Actor } from '../model'
import { assertLive } from '../storage'
import { documentDownload } from '../agreements/ui'
export async function privacyDownload(db:D1Database,actor:Actor,path:string):Promise<Response|null>{
 const match=path.match(/^\/api\/cabin\/privacy\/(receipts|holds)\/([\w-]+)(?:\/document\/([\w-]+))?$/)
 if(!match)return null
 owner(actor);need(!actor.isAgent,'Human owner access required',403);await assertLive(db,actor)
 const table=match[1]==='receipts'?'cb_privacy_receipts':'cb_privacy_holds',row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(match[2]).first<any>();need(row,'Erasure record not found',404)
 if(match[1]==='holds'){
  need(row.payload&&!row.released_at,'Retained document not found',404);const data=JSON.parse(row.payload)
  if(match[3]){need(row.source_table==='cb_records:rentalAgreements','Signed agreement not found',404);const document=data.documents.find((d:any)=>d.id===match[3]);need(document,'Signed version not found',404);await assertLive(db,actor);return documentDownload(data,document)}
 }
 await assertLive(db,actor)
 return new Response(match[1]==='receipts'?row.data:row.payload,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="cabin-${match[1]}-${match[2]}.json"`,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
}
