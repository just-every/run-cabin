import type { Bindings } from '../../auth.server'
import { need } from '../model'
import { csvCell } from '../statements'
import { portalState } from './state'
export async function ownerDocument(env:Bindings,email:string,id:string){
 const row=await env.DB.prepare('SELECT d.title,d.content FROM cb_owner_documents d JOIN cb_properties p ON p.id=d.property_id WHERE d.id=? AND d.email=? COLLATE NOCASE AND p.owner_email=? COLLATE NOCASE AND d.withdrawn_at IS NULL').bind(id,email,email).first<{title:string;content:string}>()
 need(row,'Record not found',404);return row
}
export async function ownerRecordsCsv(env:Bindings,email:string,propertyId:string,month?:string){
 const s=await portalState(env,email,month),home=s.properties.find(p=>p.id===propertyId&&p.access==='current');need(home,'Home not found',404)
 const rows:unknown[][]=[['Cabin owner records',home.name,s.month],['Performance month','Occupied guest nights','Calendar nights','Occupancy percent','Approved gross USD cents','Approved owner payable USD cents']]
 for(const p of s.performance.filter(p=>p.propertyId===propertyId))rows.push([p.month,p.occupiedNights,p.calendarNights,p.occupancyPercent,p.hasApprovedStatement?p.approvedGrossCents:'No approved statement',p.approvedOwnerPayableCents])
 rows.push([],['Expense','Description','Amount USD cents','Status','Requested','Decision date','Decision note'])
 for(const r of s.expenses.filter(r=>r.propertyId===propertyId))rows.push([r.id,r.description,r.amountCents,r.status,r.requestedAt,r.decidedAt,r.decisionNote])
 rows.push([],['Open issue','Title','Blocks readiness','Raised'])
 for(const r of s.issues.filter(r=>r.propertyId===propertyId))rows.push([r.id,r.title,r.blocking?'Yes':'No',r.raisedAt])
 rows.push([],['Personal stay','Arrival','Checkout','Status','Decision'])
 for(const r of s.stayRequests.filter(r=>r.propertyId===propertyId))rows.push([r.id,r.start,r.end,r.status,r.decisionNote])
 rows.push([],['Ledger entry','Effective date','Recorded transaction','Account','Debit USD cents','Credit USD cents'])
 for(const r of s.ledgerEntries.filter(r=>r.propertyId===propertyId))for(const l of r.lines)rows.push([r.id,r.effectiveDate,r.sourceType,l.label,l.debitCents,l.creditCents])
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
