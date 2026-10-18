import { type Context, type Data, need, text, newId, property, query } from '../model'
import { numberInput, sameEmail } from './records'
/** Custodied reserve reports are source-backed records, never bank transfers or invented ledger entries. */
export async function reserveCommand(c:Context,input:Record<string,unknown>){
 const p=property(c,input.propertyId),sourceId=text(input.documentId,'supporting reserve record'),source=await c.db.prepare('SELECT id FROM cb_owner_documents WHERE id=? AND property_id=? AND email=? COLLATE NOCASE AND withdrawn_at IS NULL').bind(sourceId,p.id,p.ownerEmail).first()
 need(source,'Choose a shared supporting record for this owner and home')
 const raw=String(input.amountUsd??''),cents=input.amountCents===undefined?(need(/^\d+(?:\.\d{1,2})?$/.test(raw),'Enter reserve USD with at most two decimal places'),Math.round(Number(raw)*100)):numberInput(input.amountCents,'reserve cents')
 need(Number.isSafeInteger(cents)&&cents>=0,'Enter a nonnegative reserve balance')
 const effectiveDate=text(input.effectiveDate,'reserve report date',10);need(/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)&&Number.isFinite(Date.parse(effectiveDate))&&new Date(effectiveDate+'T00:00:00Z').toISOString().slice(0,10)===effectiveDate,'Enter a valid reserve report date')
 const id=newId();c.queries.push(query('INSERT INTO cb_owner_reserve_reports(id,property_id,email,amount_cents,effective_date,document_id,note,recorded_at,recorded_by) VALUES(?,?,?,?,?,?,?,?,?)',id,p.id,p.ownerEmail,cents,effectiveDate,sourceId,text(input.note,'reserve scope and reconciliation note',1000),c.now,c.actor.id))
 ;(c.audit??=[]).push({kind:'owner-reserve-report',id,propertyId:p.id,result:'completed'});c.entityId=id;return {id}
}
export async function reserveReports(db:D1Database){return (await db.prepare('SELECT id,property_id AS propertyId,email,amount_cents AS amountCents,effective_date AS effectiveDate,document_id AS documentId,note,recorded_at AS recordedAt FROM cb_owner_reserve_reports ORDER BY effective_date DESC,recorded_at DESC,id DESC').all<any>()).results}
export function scopedReserves(data:Data,email:string,rows:any[]){return rows.filter(r=>data.properties.some(p=>p.id===r.propertyId&&sameEmail(p.ownerEmail,email))&&sameEmail(r.email,email)).map(({email:_,...r})=>r)}
