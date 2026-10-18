import type { Bindings } from '../../auth.server'
import { need, text, newId, query, guard, exact } from '../model'
import { load } from '../storage'
import { overlaps } from '../inventory'
import { ownerRecords, sameEmail, optionalText, policyFor, stayDates } from './records'
import { ownerBatch, ownerEvent } from './activity'

export async function ownerAction(env:Bindings,email:string,name:string,input:Record<string,unknown>){
 const [data,rows]=await Promise.all([load(env.DB),ownerRecords(env.DB)]),now=new Date().toISOString()
 const current=(id:string)=>{const p=data.properties.find(p=>p.id===id&&sameEmail(p.ownerEmail,email));need(p,'Home not found',404);return p}
 const queries=[guard('(SELECT version FROM cb_meta WHERE id=1)=?',data.version)];let result:{id:string;status:string;revision:string};let propertyId:string;let kind:string
 if(name==='expense.decide'){
  const r=rows.expenses.find(r=>r.id===text(input.id,'expense ID')&&sameEmail(r.email,email));need(r,'Expense not found',404)
  const p=current(r.propertyId);exact(r,input.revision);need(r.status==='pending','This expense already has a decision',409)
  need(input.decision==='approve'||input.decision==='decline','Choose approve or decline')
  if(input.decision==='approve')need(r.amountCents<=policyFor(rows.policies,p).expenseLimitCents,'Your agreed approval limit does not cover this expense. Ask your manager.',403)
  const status=input.decision==='approve'?'approved':'declined',revision=newId(),note=optionalText(input.note,'decision note')
  queries.push(query('UPDATE cb_owner_expenses SET status=?,revision=?,decided_at=?,decision_note=? WHERE id=?',status,revision,now,note,r.id))
  result={id:r.id,status,revision};propertyId=p.id;kind='owner-expense'
 }else if(name==='stay.request'){
  const p=current(text(input.propertyId,'home ID')),dates=stayDates(data,policyFor(rows.policies,p),{start:input.start,end:input.end})
  need(!data.bookings.some(b=>b.propertyId===p.id&&b.status==='confirmed'&&overlaps(b,dates)),'Those nights are unavailable. Choose another date.',409)
  const id=newId(),revision=newId(),note=optionalText(input.note,'stay note')
  queries.push(query("INSERT INTO cb_owner_stay_requests(id,property_id,email,revision,start,end,note,status,requested_at) VALUES(?,?,?,?,?,?,?,'pending',?)",id,p.id,email,revision,dates.start,dates.end,note,now))
  result={id,status:'pending',revision};propertyId=p.id;kind='owner-stay'
 }else if(name==='stay.cancel'){
  const r=rows.stayRequests.find(r=>r.id===text(input.id,'stay request ID')&&sameEmail(r.email,email));need(r,'Stay request not found',404);current(r.propertyId);exact(r,input.revision)
  need(r.status==='pending','Ask your manager to cancel an approved personal stay',409)
  const revision=newId();queries.push(query("UPDATE cb_owner_stay_requests SET status='cancelled',revision=?,decided_at=?,decision_note='Withdrawn by rental owner' WHERE id=?",revision,now,r.id))
  result={id:r.id,status:'cancelled',revision};propertyId=r.propertyId;kind='owner-stay'
 }else{need(false,'Unknown owner action',404)}
 queries.push(guard('EXISTS(SELECT 1 FROM cb_properties WHERE id=? AND owner_email=? COLLATE NOCASE)',propertyId,email),await ownerEvent(email,`owner.${name}`,now,{id:result.id,kind,propertyId,result:result.status}),query('UPDATE cb_meta SET version=version+1 WHERE id=1'))
 await ownerBatch(env.DB,queries);return result
}
