import { record } from '../audit/write'
import type { Bindings } from '../../auth.server'
import { operatorMail } from '../connections/mail'
import { load, mutate, SYSTEM } from '../storage'
import { manager, need, text, newId, type Actor } from '../model'
import { h } from '../ui/shared'
import { statementMonth } from './presentation'
export async function resendStatement(env:Bindings,actor:Actor,input:Record<string,unknown>){
 manager(actor);return mutate(env.DB,actor,'statement.deliver',c=>{
  const s=c.data.statements.find(r=>r.id===text(input.id,'statement'));need(s?.status==='approved','Approved statement not found',404)
  need(!c.data.deliveries.some(d=>d.statementId===s.id&&['sending','pending'].includes(d.status)),'A delivery is already pending',409)
  const row={id:newId(),revision:newId(),propertyId:s.propertyId,statementId:s.id,email:s.ownerEmail,status:'pending' as const,at:c.now,detail:null};c.data.deliveries.push(row);return row
 })
}
export async function deliverStatements(env:Bindings){
 for(const pending of (await load(env.DB)).deliveries.filter(d=>d.status==='pending').slice(0,20)){
  const claimed=await mutate(env.DB,SYSTEM,'statement.delivery.claim',c=>{const d=c.data.deliveries.find(r=>r.id===pending.id);if(!d||d.status!=='pending')return null;d.status='sending';return {delivery:{...d},statement:c.data.statements.find(s=>s.id===d.statementId)}}).catch(()=>null)
  if(!claimed?.statement)continue
  const {delivery:d,statement:s}=claimed,sender=operatorMail(env)
  let status:'sent'|'suppressed'|'failed'|'unavailable'='unavailable',detail:string|null='Configure a mail provider to deliver this statement.'
  if(sender&&env.MAIL_FROM){try{
   const link=new URL(`/owners?statement=${s.id}`,env.AUTH_ORIGIN).href
   const month=statementMonth(s.month)
   const text=s.source==='recovery'?`${s.ownerName}, an approved recovery adjustment for ${s.propertyName} is ready.\n\n${s.lines.map(l=>`${l.description}: $${(l.amountCents/100).toFixed(2)}`).join('\n')}\nOwner balance adjustment: $${(s.netCents/100).toFixed(2)}\n\nView the frozen statement: ${link}\n\nCabin records the adjustment; it does not transfer funds.`:`${s.ownerName}, your approved ${month} statement for ${s.propertyName} is ready.\n\nGross: $${(s.grossCents/100).toFixed(2)}\nChannel fees: $${((s.channelFeeCents??0)/100).toFixed(2)}\nPaid owner expenses: $${((s.expenseCents??0)/100).toFixed(2)}\nManagement fee: $${(s.managementFeeCents/100).toFixed(2)}\nOwner payout: $${(s.netCents/100).toFixed(2)}\n\nView your statement and stays: ${link}\n\nSign in with this email address. This statement records your owner payable; Cabin does not transfer funds.`
   const result=await sender.send({deliveryId:d.id,headers:{'Auto-Submitted':'auto-generated'},from:env.MAIL_FROM,to:[d.email],subject:`${s.propertyName} · ${month} owner statement`,text,html:`<div style="white-space:pre-wrap;font:16px/1.6 system-ui">${h(text)}</div>`})
   status=result?.status==='accepted'?'sent':result?.status==='development'?'suppressed':'failed';detail=status==='sent'?null:status==='suppressed'?'Development mode does not send email.':'The provider did not confirm acceptance. Check delivery before requesting another send.'
  }catch{status='failed';detail='Mail acceptance is uncertain. Check the provider before requesting another send.'}}
  const bookingIds=[...new Set(s.lines.map(l=>l.bookingId).filter(Boolean))];for(const bookingId of bookingIds.length?bookingIds:[null])await record(env.DB,SYSTEM,'statement.provider.result',{kind:'deliveries',id:d.id,propertyId:d.propertyId,bookingId,revision:d.revision,result:status==='failed'?'failed-or-uncertain':status})
  await mutate(env.DB,SYSTEM,'statement.delivery.result',c=>{const row=c.data.deliveries.find(r=>r.id===d.id);if(row)Object.assign(row,{status,detail,sentAt:c.now})})
 }
}
