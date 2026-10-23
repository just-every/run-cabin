import { type Context, type Actor, manager, need, newId, query, sha } from '../model'
import { assertLive } from '../storage'
import { accounts, type Journal, type Leg } from './types'
const pending = new WeakMap<Context,Journal[]>()
export async function journals(db:D1Database):Promise<Journal[]> {
 return (await db.prepare('SELECT data FROM cb_ledger_journals ORDER BY posted_at,id').all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
export async function contextJournals(c:Context){let rows=pending.get(c);if(!rows){rows=await journals(c.db);pending.set(c,rows)}return rows}
export async function post(c:Context,input:{settlement?:Journal['settlement'];manualReceipt?:Journal['manualReceipt'];sourceKey:string;propertyId:string;bookingId:string;effectiveDate:string;sourceType:string;sourceId:string;sourceRevision:string;lines:Leg[];correctionOf?:string;reversalOf?:string;ownerKey?:string;legalEntity?:string}) {
 const rows=await contextJournals(c)
 const existing=rows.find(r=>r.sourceKey===input.sourceKey);if(existing)return existing
 const p=c.data.properties.find(p=>p.id===input.propertyId),setting=c.data.ledgerSettings.find(s=>s.propertyId===input.propertyId)
 const original=input.reversalOf?rows.find(j=>j.id===input.reversalOf):undefined
 if(original){need(input.propertyId===original.propertyId&&input.bookingId===original.bookingId&&input.ownerKey===original.ownerKey&&input.legalEntity===original.legalEntity&&JSON.stringify(input.lines)===JSON.stringify(original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents}))),'A reversal must preserve the exact original scope and invert every line',409)}
 else {need(p&&setting,'Set the home’s ledger legal entity before posting',409);need((['maintenance-expense','agreement-expense'].includes(input.sourceType)&&input.bookingId==='')||c.data.bookings.some(b=>b.id===input.bookingId&&b.propertyId===p.id),'Choose a reservation belonging to this home',409)}
 need(/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)&&Number.isFinite(Date.parse(input.effectiveDate+'T00:00:00Z'))&&new Date(input.effectiveDate+'T00:00:00Z').toISOString().slice(0,10)===input.effectiveDate,'Use a valid effective date')
 need(!await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(input.effectiveDate.slice(0,7)).first(),'This accounting period is closed. Post a linked reversal in an open period.',409)
 const lines=input.lines.filter(l=>l.debitCents||l.creditCents)
 need(lines.length>=2&&lines.every(l=>Object.hasOwn(accounts,l.account)&&Number.isSafeInteger(l.debitCents)&&Number.isSafeInteger(l.creditCents)&&l.debitCents>=0&&l.creditCents>=0&&!(l.debitCents&&l.creditCents)),'Use positive integer USD cents on one side of each ledger line')
 const dr=lines.reduce((n,l)=>n+l.debitCents,0),cr=lines.reduce((n,l)=>n+l.creditCents,0)
 need(Number.isSafeInteger(dr)&&Number.isSafeInteger(cr)&&dr===cr,'Debits must equal credits')
 const row:Journal={...input,lines,id:newId(),legalEntity:input.legalEntity??setting!.legalEntity,ownerKey:input.ownerKey??await sha((c.data.bookings.find(b=>b.id===input.bookingId)?.managementTerms?.ownerEmail??p!.ownerEmail).trim().toLowerCase()),postedAt:c.now,actorId:c.actor.id}
 c.queries.push(query('INSERT INTO cb_ledger_journals(id,source_key,property_id,booking_id,owner_key,legal_entity,effective_date,posted_at,actor_id,source_type,source_id,source_revision,reversal_of,data) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',row.id,row.sourceKey,row.propertyId,row.bookingId,row.ownerKey,row.legalEntity,row.effectiveDate,row.postedAt,row.actorId,row.sourceType,row.sourceId,row.sourceRevision,row.reversalOf??null,JSON.stringify(row)))
 rows.push(row);return row
}
export async function ledgerState(db:D1Database,actor:Actor) {
 if(!['owner','manager'].includes(actor.role)||actor.isAgent)return {journals:[],periods:[]}
 manager(actor);await assertLive(db,actor)
 const rows=await journals(db),periods=(await db.prepare('SELECT month,closed_at AS closedAt,actor_id AS actorId FROM cb_ledger_periods ORDER BY month').all()).results
 await assertLive(db,actor);return {journals:rows,periods}
}
