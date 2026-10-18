import { reserveCommand } from './reserves'
import { type Context, type Actor, need, text, newId, query, manager, owner, property, exact } from '../model'
import { assertLive } from '../storage'
import { peopleCommand } from '../people'
import { reservationCommand } from '../inventory'
import { ownerRecords, sameEmail, optionalText, numberInput, policyFor, stayDates } from './records'

function usd(value:unknown,label:string){const v=text(value,label,20);need(/^\d+(?:\.\d{1,2})?$/.test(v),`Enter ${label} with at most two decimal places`);return numberInput(Math.round(Number(v)*100),label)}

/** Runs inside the normal operator transaction, including its inventory/version and live-authority guards. */
export async function ownerCommand(c:Context,name:string,input:Record<string,unknown>){
 if(!name.startsWith('owner.'))return undefined
 manager(c.actor);need(!c.actor.isAgent,'Human manager access required',403)
 if(name==='owner.reserve.record')return reserveCommand(c,input)
 const rows=await ownerRecords(c.db)
 const audit=(kind:string,id:string,propertyId:string,result='completed')=>{c.entityId=id;(c.audit??=[]).push({kind,id,propertyId,result})}
 if(name==='owner.policy'){
  const p=property(c,input.propertyId),old=rows.policies.find(r=>r.propertyId===p.id)
  need((old?.revision??'')===(input.revision??''),'Owner agreement changed; reload before saving',409)
  const visibility=text(input.calendarVisibility,'calendar visibility');need(['hidden','availability','stays'].includes(visibility),'Choose calendar visibility')
  const revision=newId(),expenseLimit=input.approvalLimitUsd===undefined?numberInput(input.expenseLimitCents,'expense approval limit in cents'):usd(input.approvalLimitUsd,'expense approval limit'),maxStay=numberInput(input.maxStayNights,'maximum personal stay nights',0,365),notice=numberInput(input.noticeDays,'notice days',0,365),agreement=text(input.agreement,'agreed owner access terms',2000)
  c.queries.push(query('INSERT INTO cb_owner_policies(property_id,email,revision,calendar_visibility,expense_limit_cents,max_stay_nights,notice_days,agreement,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET email=excluded.email,revision=excluded.revision,calendar_visibility=excluded.calendar_visibility,expense_limit_cents=excluded.expense_limit_cents,max_stay_nights=excluded.max_stay_nights,notice_days=excluded.notice_days,agreement=excluded.agreement,updated_at=excluded.updated_at,updated_by=excluded.updated_by',p.id,p.ownerEmail,revision,visibility,expenseLimit,maxStay,notice,agreement,c.now,c.actor.id))
  audit('owner-policy',p.id,p.id);return {id:p.id,revision}
 }
 if(name==='owner.statement.grant'||name==='owner.statement.revoke'){
  const s=c.data.statements.find(s=>s.id===text(input.id,'statement ID')&&s.status==='approved');need(s,'Approved statement not found',404)
  const reason=text(input.reason,'reason for access change',1000)
  // A historical grant is always to the frozen recipient. A new owner cannot receive another owner's statement.
  if(name.endsWith('.grant'))c.queries.push(query('INSERT INTO cb_owner_statement_grants(statement_id,email,granted_at,granted_by,reason) VALUES(?,?,?,?,?) ON CONFLICT(statement_id,email) DO UPDATE SET granted_at=excluded.granted_at,granted_by=excluded.granted_by,reason=excluded.reason,revoked_at=NULL,revoked_by=NULL',s.id,s.ownerEmail.toLowerCase(),c.now,c.actor.id,reason))
  else {need(rows.grants.some(g=>g.statementId===s.id&&!g.revokedAt),'Historical grant not found',404);c.queries.push(query('UPDATE cb_owner_statement_grants SET revoked_at=?,revoked_by=?,reason=? WHERE statement_id=?',c.now,c.actor.id,reason,s.id))}
  audit('owner-statement-grant',s.id,s.propertyId,name.endsWith('.grant')?'active':'revoked');return {id:s.id}
 }
 if(name==='owner.transfer'){
  owner(c.actor);const p=property(c,input.propertyId),reason=text(input.reason,'transfer reason',1000)
  need(Number(input.propertyRevision)===p.revision,'Property changed; reload before transfer',409)
  const ids=Array.isArray(input.retainStatementIds)?input.retainStatementIds:String(input.retainStatementIds??'').split(',').map(s=>s.trim()).filter(Boolean)
  need(ids.length<=100,'Select at most 100 historical statements')
  for(const id of new Set(ids)){
   const s=c.data.statements.find(s=>s.id===id&&s.propertyId===p.id&&sameEmail(s.ownerEmail,p.ownerEmail)&&s.status==='approved');need(s,'Choose approved statements for the departing owner only')
   c.queries.push(query('INSERT INTO cb_owner_statement_grants(statement_id,email,granted_at,granted_by,reason) VALUES(?,?,?,?,?) ON CONFLICT(statement_id,email) DO UPDATE SET granted_at=excluded.granted_at,granted_by=excluded.granted_by,reason=excluded.reason,revoked_at=NULL,revoked_by=NULL',s.id,s.ownerEmail.toLowerCase(),c.now,c.actor.id,reason))
  }
  need(!sameEmail(text(input.ownerEmail,'new owner email',254),p.ownerEmail),'Choose a different owner email')
  const result=await peopleCommand(c,'property.save',{...p,ownerEmail:input.ownerEmail,ownerName:input.ownerName})
  c.queries.push(query('DELETE FROM cb_owner_policies WHERE property_id=?',p.id))
  audit('owner-transfer',p.id,p.id);return result
 }
 if(name==='owner.document.add'){
  const p=property(c,input.propertyId),id=newId(),kind=text(input.kind,'record type');need(kind==='invoice'||kind==='document','Choose invoice or document')
  const title=text(input.title,'record title',200),content=text(input.content,'record content',100000)
  c.queries.push(query('INSERT INTO cb_owner_documents(id,property_id,email,title,kind,content,created_at,created_by) VALUES(?,?,?,?,?,?,?,?)',id,p.id,p.ownerEmail,title,kind,content,c.now,c.actor.id))
  audit('owner-document',id,p.id);return {id}
 }
 if(name==='owner.document.withdraw'){
  const r=rows.documents.find(r=>r.id===text(input.id,'document ID')&&!r.withdrawnAt);need(r,'Document not found',404)
  c.queries.push(query('UPDATE cb_owner_documents SET withdrawn_at=? WHERE id=?',c.now,r.id));audit('owner-document',r.id,r.propertyId,'revoked');return {id:r.id}
 }
 if(name==='owner.expense.request'){
  const p=property(c,input.propertyId),id=newId(),revision=newId(),description=text(input.description,'expense description',1000),amount=input.amountUsd===undefined?numberInput(input.amountCents,'expense cents',1):usd(input.amountUsd,'expense amount'),documentId=optionalText(input.documentId,'invoice ID',100)||null
  if(documentId)need(rows.documents.some(d=>d.id===documentId&&d.propertyId===p.id&&sameEmail(d.email,p.ownerEmail)&&!d.withdrawnAt&&d.kind==='invoice'),'Choose a published invoice for this owner and home')
  need(amount>0,'Enter a positive expense amount');const policy=policyFor(rows.policies,p);need(amount<=policy.expenseLimitCents,'This expense exceeds the owner’s agreed approval limit',409)
  c.queries.push(query('INSERT INTO cb_owner_expenses(id,property_id,email,revision,description,amount_cents,document_id,status,requested_at,requested_by) VALUES(?,?,?,?,?,?,?,\'pending\',?,?)',id,p.id,p.ownerEmail,revision,description,amount,documentId,c.now,c.actor.id))
  audit('owner-expense',id,p.id,'pending');return {id,revision}
 }
 if(name==='owner.expense.withdraw'){
  const r=rows.expenses.find(r=>r.id===text(input.id,'expense ID'));need(r,'Expense not found',404);exact(r,input.revision);need(r.status==='pending','This expense already has a decision',409)
  c.queries.push(query("UPDATE cb_owner_expenses SET status='withdrawn',revision=?,decided_at=?,decision_note=? WHERE id=?",newId(),c.now,text(input.reason,'withdrawal reason',1000),r.id));audit('owner-expense',r.id,r.propertyId,'revoked');return {id:r.id}
 }
 if(name==='owner.stay.cancel'){
  const r=rows.stayRequests.find(r=>r.id===text(input.id,'stay request ID'));need(r,'Stay request not found',404);exact(r,input.revision);need(r.status==='approved'&&r.bookingId,'Choose an approved personal stay',409)
  const booking=c.data.bookings.find(b=>b.id===r.bookingId&&b.propertyId===r.propertyId&&b.kind==='block');need(booking,'Personal stay block not found',409)
  if(booking.status==='confirmed')await reservationCommand(c,'reservation.cancel',{id:booking.id})
  const revision=newId();c.queries.push(query("UPDATE cb_owner_stay_requests SET status='cancelled',revision=?,decided_at=?,decided_by=?,decision_note=? WHERE id=?",revision,c.now,c.actor.id,text(input.reason,'cancellation reason',1000),r.id))
  audit('owner-stay',r.id,r.propertyId,'cancelled');return {id:r.id,revision,status:'cancelled'}
 }
 if(name==='owner.stay.decide'){
  const r=rows.stayRequests.find(r=>r.id===text(input.id,'stay request ID'));need(r,'Stay request not found',404);exact(r,input.revision);need(r.status==='pending','This request already has a decision',409)
  need(input.decision==='approve'||input.decision==='decline','Choose approve or decline')
  const note=text(input.reason,'decision reason',1000);let bookingId:string|null=null
  if(input.decision==='approve'){
   const p=property(c,r.propertyId);need(sameEmail(p.ownerEmail,r.email),'Ownership changed. Decline this request and ask the current owner to request again.',409)
   stayDates(c.data,policyFor(rows.policies,p),r,new Date(c.now))
   const hold=await reservationCommand(c,'reservation.request',{propertyId:p.id,kind:'block',start:r.start,end:r.end,note:'Owner personal stay'})
   need(hold&&'bookingId' in hold&&hold.status==='accepted','Those nights are no longer available. Review the calendar.',409);bookingId=hold.bookingId
  }
  const status=input.decision==='approve'?'approved':'declined',revision=newId()
  c.queries.push(query('UPDATE cb_owner_stay_requests SET status=?,revision=?,decided_at=?,decided_by=?,decision_note=?,booking_id=? WHERE id=?',status,revision,c.now,c.actor.id,note,bookingId,r.id))
  audit('owner-stay',r.id,r.propertyId,status);return {id:r.id,status,bookingId,revision}
 }
 need(false,'Unknown owner operation',404)
}
export async function ownerOperationsState(db:D1Database,actor:Actor){
 if(!['owner','manager'].includes(actor.role)||actor.isAgent)return {policies:[],grants:[],views:[],documents:[],expenses:[],stayRequests:[]}
 await assertLive(db,actor);const rows=await ownerRecords(db);await assertLive(db,actor)
 return {...rows,documents:rows.documents.map(({content:_,...r})=>r)}
}
