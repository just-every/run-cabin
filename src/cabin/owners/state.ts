import { reserveReports, scopedReserves } from './reserves'
import type { Bindings } from '../../auth.server'
import { need, sha, type Statement } from '../model'
import { load } from '../storage'
import { journals } from '../ledger/store'
import { accounts } from '../ledger/types'
import { ownerRecords, policyFor, sameEmail } from './records'

export function reportMonth(value?:string){const month=value??new Date().toISOString().slice(0,7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Use a YYYY-MM report month');return month}
/** Historical grants expose exactly the frozen statement, never today's home, guest records or new owner's ledger. */
export async function portalState(env:Bindings,email:string,requestedMonth?:string){
 const month=reportMonth(requestedMonth),[data,records,ledger,ownerKey]=await Promise.all([load(env.DB),ownerRecords(env.DB),journals(env.DB),sha(email.toLowerCase())])
 const current=data.properties.filter(p=>sameEmail(p.ownerEmail,email)),ids=new Set(current.map(p=>p.id))
 const statements=data.statements.filter(s=>s.status==='approved'&&sameEmail(s.ownerEmail,email)&&(ids.has(s.propertyId)||records.grants.some(g=>g.statementId===s.id&&sameEmail(g.email,email)&&!g.revokedAt)))
 const properties=current.map(p=>({id:p.id,name:p.name,ownerName:p.ownerName,access:'current',policy:policyFor(records.policies,p)}))
 for(const s of statements)if(!properties.some(p=>p.id===s.propertyId))properties.push({id:s.propertyId,name:s.propertyName,ownerName:s.ownerName,access:'historical',policy:undefined as any})
 const bookings=current.flatMap(p=>{
  const policy=policyFor(records.policies,p);if(policy.calendarVisibility==='hidden')return []
  return data.bookings.filter(b=>b.propertyId===p.id&&(policy.calendarVisibility==='stays'||b.status==='confirmed')).map(b=>({id:b.id,propertyId:b.propertyId,channel:policy.calendarVisibility==='stays'?b.channel:'',start:b.start,end:b.end,status:b.status,kind:b.kind??'stay',guestName:policy.calendarVisibility==='stays'?(b.guestName??''):'',summary:records.stayRequests.some(r=>r.bookingId===b.id&&sameEmail(r.email,email))?'Owner personal stay':b.kind==='block'?'Blocked':'Reserved'}))
 })
 const from=month+'-01',endDate=new Date(from+'T00:00:00Z');endDate.setUTCMonth(endDate.getUTCMonth()+1);const to=endDate.toISOString().slice(0,10),days=(Date.parse(to)-Date.parse(from))/86400000
 const performance=current.map(p=>{
  const occupied=new Set<string>();for(const b of data.bookings.filter(b=>b.propertyId===p.id&&b.status==='confirmed'&&(b.kind??'stay')==='stay')){
   const start=b.start.slice(0,10)>from?b.start.slice(0,10):from,end=b.end.slice(0,10)<to?b.end.slice(0,10):to
   for(let t=Date.parse(start);t<Date.parse(end);t+=86400000)occupied.add(new Date(t).toISOString().slice(0,10))
  }
  const approved=statements.filter(s=>s.propertyId===p.id&&s.month===month),regular=approved.filter(s=>s.source!=='recovery')
  return {propertyId:p.id,month,occupiedNights:occupied.size,calendarNights:days,occupancyPercent:Math.round(occupied.size/days*1000)/10,approvedGrossCents:regular.reduce((n,s)=>n+s.grossCents,0),approvedOwnerPayableCents:approved.filter(s=>s.close).at(-1)?.netCents??approved.reduce((n,s)=>n+s.netCents,0),hasApprovedStatement:regular.length>0}
 })
 const scoped=<T extends {propertyId:string;email:string}>(rows:T[])=>rows.filter(r=>ids.has(r.propertyId)&&sameEmail(r.email,email))
 const documents=scoped(records.documents).filter(d=>!d.withdrawnAt).map(({content:_,createdBy:__,email:___,...r})=>r)
 const expenses=scoped(records.expenses).map(({requestedBy:_,email:__,...r})=>({...r,canApprove:r.status==='pending'&&r.amountCents<=policyFor(records.policies,current.find(p=>p.id===r.propertyId)!).expenseLimitCents}))
 const stayRequests=scoped(records.stayRequests).map(({decidedBy:_,email:__,...r})=>r)
 const issues=data.tasks.filter(t=>ids.has(t.propertyId)&&t.status==='open').map(t=>({id:t.id,propertyId:t.propertyId,title:t.title,blocking:t.blocking,raisedAt:t.raisedAt,status:t.status}))
 const ledgerEntries=ledger.filter(j=>ids.has(j.propertyId)&&j.ownerKey===ownerKey).map(j=>({id:j.id,propertyId:j.propertyId,effectiveDate:j.effectiveDate,sourceType:j.sourceType,lines:j.lines.map(l=>({...l,label:accounts[l.account]}))}))
 const ledgerBalances=current.map(p=>({propertyId:p.id,balances:Object.entries(accounts).flatMap(([account,label])=>{
  const legs=ledgerEntries.filter(j=>j.propertyId===p.id).flatMap(j=>j.lines).filter(l=>l.account===account)
  return legs.length?[{account,label,debitCents:legs.reduce((n,l)=>n+l.debitCents,0),creditCents:legs.reduce((n,l)=>n+l.creditCents,0)}]:[]
 })}))
 const version=await env.DB.prepare('SELECT version FROM cb_meta WHERE id=1').first<{version:number}>();need(version?.version===data.version,'Records changed. Refresh your owner portal.',409)
 const blockUses=data.bookings.filter(b=>ids.has(b.propertyId)&&b.blockUse&&(b.blockUse.purpose==='owner'||records.stayRequests.some(r=>r.bookingId===b.id&&sameEmail(r.email,email)))&&sameEmail(b.blockUse.ownerEmail,email)).map(b=>({propertyId:b.propertyId,id:b.id,start:b.start,end:b.end,...b.blockUse!,cleaningStatus:data.turnovers.some(t=>t.bookingId===b.id&&t.status==='completed')?'completed · payable recorded':b.status==='cancelled'?'cancelled · no cleaning charge':'pending completion'}))
 return {blockUses,reserves:scopedReserves(data,email,await reserveReports(env.DB)),email,month,properties,bookings,statements,performance,documents,expenses,stayRequests,issues,ledgerEntries,ledgerBalances}
}
export async function authorizedStatement(env:Bindings,email:string,id:string):Promise<Statement>{
 const s=(await portalState(env,email)).statements.find(s=>s.id===id);need(s,'Approved statement not found',404);return s
}
