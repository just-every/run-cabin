import { permitsProperty } from '../permissions/policy'
import type { Bindings } from '../../auth.server'
import { type Actor, need, text, newId, query, guard, exact, sha } from '../model'
import { authority, load, mutate, SYSTEM } from '../storage'
import { changeBlock, cancelBlock } from '../blocks'
import { settle } from '../settle'
import { overlaps } from '../inventory'
import { ownerRecords, sameEmail, optionalText, policyFor, stayDates } from './records'
import { ownerBatch, ownerEvent } from './activity'

export async function ownerAction(env:Bindings,email:string,name:string,input:Record<string,unknown>,nativeActor?:Actor){
 const [data,rows]=await Promise.all([load(env.DB),ownerRecords(env.DB)]),now=new Date().toISOString()
 const current=(id:string)=>{const p=data.properties.find(p=>p.id===id&&sameEmail(p.ownerEmail,email));need(p&&(!nativeActor||permitsProperty(nativeActor,p.id)),'Home not found',404);return p}
 const native=nativeActor?authority(nativeActor):null
 const queries=[...(native?[guard(native.sql,...native.params)]:[]),guard('(SELECT version FROM cb_meta WHERE id=1)=?',data.version)];let result:{id:string;status:string;revision:string};let propertyId:string;let kind:string
 if(name==='stay.edit'||name==='stay.cancel'){
  const r=rows.stayRequests.find(r=>r.id===text(input.id,'stay request ID')&&sameEmail(r.email,email));need(r,'Stay request not found',404);const home=current(r.propertyId);exact(r,input.revision)
  if(r.status==='approved'&&r.bookingId){
   const result=await mutate(env.DB,{...SYSTEM,id:'rental-owner:'+await sha(email.toLowerCase())},'owner.'+name,c=>{
    if(native)c.queries.push(guard(native.sql,...native.params));need(c.data.version===data.version,'Records changed. Reload your portal.',409);const b=c.data.bookings.find(b=>b.id===r.bookingId);need(b,'Block not found',404)
    if(name==='stay.edit'){stayDates(c.data,policyFor(rows.policies,home),{start:input.start,end:input.end});changeBlock(c,b,{...input,revision:b.revision})}else cancelBlock(c,b,{revision:b.revision})
    const revision=newId();c.queries.push(guard('EXISTS(SELECT 1 FROM cb_properties WHERE id=? AND owner_email=? COLLATE NOCASE)',home.id,email),query('UPDATE cb_owner_stay_requests SET start=?,end=?,note=?,status=?,revision=?,decided_at=? WHERE id=?',b.start,b.end,b.blockUse?.reason??r.note,name==='stay.cancel'?'cancelled':'approved',revision,c.now,r.id));return {id:r.id,status:name==='stay.cancel'?'cancelled':'approved',revision}
   });await settle(env);return result
  }
  need(r.status==='pending','This request is no longer editable',409)
  const dates=name==='stay.edit'?stayDates(data,policyFor(rows.policies,home),{start:input.start,end:input.end}):r
  need(name!=='stay.edit'||!data.bookings.some(b=>b.propertyId===home.id&&b.status==='confirmed'&&overlaps(b,dates)),'Those nights are unavailable.',409)
  const revision=newId(),status=name==='stay.cancel'?'cancelled':'pending';queries.push(query('UPDATE cb_owner_stay_requests SET start=?,end=?,note=?,status=?,revision=? WHERE id=?',dates.start,dates.end,name==='stay.edit'?text(input.note,'block reason',300):r.note,status,revision,r.id));result={id:r.id,status,revision};propertyId=r.propertyId;kind='owner-stay'
 }else if(name==='expense.decide'){
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
  const id=newId(),revision=newId(),note=text(input.note,'block reason',300),purpose=input.purpose==='maintenance'?'maintenance':'owner'
  queries.push(query("INSERT INTO cb_owner_stay_requests(id,property_id,email,revision,start,end,note,purpose,status,requested_at) VALUES(?,?,?,?,?,?,?,?,'pending',?)",id,p.id,email,revision,dates.start,dates.end,note,purpose,now))
  result={id,status:'pending',revision};propertyId=p.id;kind='owner-stay'
 }else{need(false,'Unknown owner action',404)}
 queries.push(guard('EXISTS(SELECT 1 FROM cb_properties WHERE id=? AND owner_email=? COLLATE NOCASE)',propertyId,email),await ownerEvent(email,`owner.${name}`,now,{id:result.id,kind,propertyId,result:result.status}),query('UPDATE cb_meta SET version=version+1 WHERE id=1'))
 if(native)queries.push(guard(native.sql,...native.params));await ownerBatch(env.DB,queries);return result
}
