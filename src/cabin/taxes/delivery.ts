import type { Bindings } from '../../auth.server'
import { operatorMail } from '../connections/mail'
import { mutate, SYSTEM } from '../storage'
import { h } from '../ui/shared'
import { taxData, saveDelivery } from './store'
import type { TaxReport, Obligation } from './types'
/** A packet is an instruction to the accountant/partner, never a statutory filing receipt. */
export function packet(report:TaxReport,o:Obligation){const sourceIds=new Set(o.lines.map(l=>l.sourceId)),ruleIds=new Set(o.lines.map(l=>l.ruleId));return {format:'cabin-reviewed-lodging-tax-v1',reportId:report.id,revision:report.revision,propertyId:report.propertyId,month:report.month,approvedAt:report.approvedAt,approvedBy:report.approvedBy,priorReportIds:report.priorReportIds,obligation:o,sources:report.sources.filter(s=>sourceIds.has(s.id)),rules:report.rules.filter(r=>ruleIds.has(r.id)),instruction:'Review and file/remit through the authorized jurisdiction process. Return filing acknowledgement and payment evidence. Email delivery is not government acceptance or payment.'}}
export async function deliverTaxes(env:Bindings){
 for(const pending of (await taxData(env.DB)).deliveries.filter(d=>d.status==='pending').slice(0,12)){
  const claim=await mutate(env.DB,SYSTEM,'tax.delivery.claim',async c=>{
   const data=await taxData(c.db),row=data.deliveries.find(d=>d.id===pending.id);if(!row||row.status!=='pending')return null
   const report=data.reports.find(r=>r.id===row.reportId&&r.status==='approved'),obligation=report?.obligations.find(o=>o.jurisdiction.id===row.jurisdictionId);if(!report||!obligation)return null
   row.status='sending';row.detail='Mail acceptance is uncertain until the provider returns a result. Check the provider before requesting another send.';saveDelivery(c,row,true);return {row,report,obligation}
  }).catch(()=>null)
  if(!claim)continue
  const {row,report,obligation}=claim,sender=operatorMail(env)
  let status:'sent'|'suppressed'|'failed'|'unavailable'='unavailable',detail:string|null='Configure a mail provider to deliver this reviewed tax packet.'
  if(sender&&env.MAIL_FROM)try{
   const body=`Reviewed ${report.month} lodging-tax obligation: ${obligation.jurisdiction.name}\nPartner: ${row.partner}\nPacket SHA-256: ${row.digest}\n\n${JSON.stringify(packet(report,obligation),null,2)}`
   const result=await sender.send({deliveryId:row.id,headers:{'Auto-Submitted':'auto-generated'},from:env.MAIL_FROM,to:[row.email],subject:`Cabin tax review · ${report.month} · ${obligation.jurisdiction.name}`,text:body,html:`<div style="white-space:pre-wrap;font:14px/1.6 monospace">${h(body)}</div>`})
   status=result?.status==='accepted'?'sent':result?.status==='development'?'suppressed':'failed';detail=status==='sent'?'Mail provider accepted this packet. Filing acceptance and payment still require external evidence.':status==='suppressed'?'Development/demo mode suppressed this email. No filing partner received it.':'Provider acceptance was not confirmed. Check delivery before requesting another attempt.'
  }catch{status='failed';detail='Mail acceptance is uncertain. Check the provider using this delivery ID before requesting another attempt.'}
  await mutate(env.DB,SYSTEM,'tax.delivery.result',async c=>{const saved=(await taxData(c.db)).deliveries.find(d=>d.id===row.id);if(saved?.status==='sending'){Object.assign(saved,{status,detail,sentAt:c.now});saveDelivery(c,saved,true)}})
 }
}
