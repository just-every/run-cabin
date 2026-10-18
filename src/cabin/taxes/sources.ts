import { need, text, integer, query, newId, sha, type Context } from '../model'
import { post, contextJournals } from '../ledger/store'
import { debit, credit } from '../ledger/types'
import { assess, date, month } from './calculate'
import { scope } from './store'
import type { TaxData, TaxSource, TaxLine } from './types'
const cents=(v:unknown,label:string,max=100_000_000)=>integer(Number(v),label,0,max)
function facts(c:Context,p:Record<string,unknown>){
 const booking=c.data.bookings.find(b=>b.id===text(p.bookingId,'reservation'));need(booking&&booking.kind!=='block','Choose a guest reservation',404)
 const baseCents=cents(p.baseCents,'rent and taxable fees cents'),exemptCents=cents(p.exemptCents??0,'exempt cents',baseCents)
 const exemptionEvidence=exemptCents?text(p.exemptionEvidence,'exemption certificate/reference and reason',2000):''
 return {booking,baseCents,exemptCents,exemptionEvidence}
}
async function ledger(c:Context,line:TaxLine,original?:TaxLine) {
 if(!line.hostCents)return null
 const originalJournal=original?.ledgerId?(await contextJournals(c)).find(j=>j.id===original.ledgerId):undefined
 need(!original||originalJournal,'Original host tax posting is missing',409)
 const amount=Math.abs(line.hostCents),lines=line.hostCents>0?[debit('receivable',amount),credit('taxes',amount)]:[debit('taxes',amount),credit('receivable',amount)]
 const j=await post(c,{sourceKey:'tax-line:'+line.id,propertyId:line.propertyId,bookingId:line.bookingId,effectiveDate:line.effectiveDate,sourceType:original?'lodging-tax-adjustment':'lodging-tax',sourceId:line.id,sourceRevision:line.id,...(originalJournal?{ownerKey:originalJournal.ownerKey,legalEntity:originalJournal.legalEntity,correctionOf:originalJournal.id}:{}),lines})
 return j.id
}
function saveLine(c:Context,line:TaxLine){c.queries.push(query('INSERT INTO cb_tax_lines(id,property_id,booking_id,month,jurisdiction_id,source_id,data) VALUES(?,?,?,?,?,?,?)',line.id,line.propertyId,line.bookingId,line.month,line.jurisdictionId,line.sourceId,JSON.stringify(line)));scope(c,line)}
export async function sourceCommand(c:Context,data:TaxData,name:string,p:Record<string,unknown>){
 if(name==='tax.source.preview'||name==='tax.source.record'){
  const f=facts(c,p),assessed=assess(data.config,f.booking.propertyId,f.booking.start,f.booking.end,f.baseCents,f.exemptCents)
  const previewDigest=await sha(JSON.stringify({booking:f.booking,baseCents:f.baseCents,exemptCents:f.exemptCents,exemptionEvidence:f.exemptionEvidence,assessed}))
  if(name.endsWith('preview')){const superseded=new Set(data.sources.map(s=>s.supersedesSourceId));return {kind:'tax-source-preview',...f,assessed,previewDigest,supersedesSourceId:data.sources.find(s=>s.bookingId===f.booking.id&&!superseded.has(s.id))?.id??''}}
  need(p.previewDigest===previewDigest,'The reservation or effective tax rules changed. Calculate and review the source again.',409)
  need(p.confirm==='yes','Confirm that you reviewed the source, exemption and each levy’s collection responsibility')
  const reference=text(p.reference,'source document reference',200),sourceKey=f.booking.propertyId+':'+f.booking.channel+':'+reference
  const existing=data.sources.find(s=>s.sourceKey===sourceKey)
  need(!existing,'This source is already recorded; use its saved lines or add an adjustment',409)
  const superseded=new Set(data.sources.map(s=>s.supersedesSourceId)),previous=data.sources.find(s=>s.bookingId===f.booking.id&&!superseded.has(s.id))
  if(previous){need(p.supersedesSourceId===previous.id,'This reservation already has a tax source; fully reverse it before recording corrected evidence',409);for(const line of data.lines.filter(l=>l.sourceId===previous.id&&!l.originalLineId)){const reductions=data.lines.filter(l=>l.originalLineId===line.id);need(line.taxCents+reductions.reduce((n,l)=>n+l.taxCents,0)===0&&line.channelCents+reductions.reduce((n,l)=>n+l.channelCents,0)===0&&line.baseCents+reductions.reduce((n,l)=>n+l.baseCents,0)===0,'Fully reverse the original tax and base before replacing a source',409)}}
  const source:TaxSource={id:newId(),propertyId:f.booking.propertyId,bookingId:f.booking.id,bookingRevision:f.booking.revision,channel:f.booking.channel,start:f.booking.start,end:f.booking.end,sourceKey,reference,document:text(p.document,'source statement/receipt evidence',12000),at:c.now,by:c.actor.id,baseCents:f.baseCents,exemptCents:f.exemptCents,exemptionEvidence:f.exemptionEvidence,rules:[...new Map(assessed.map(r=>[r.rule.id,r.rule])).values()],...(previous?{supersedesSourceId:previous.id}:{})}
  const collections=Array.isArray(p.collections)?p.collections as {ruleId:string;month:string;channelCents:number}[]:assessed.map(r=>({ruleId:r.rule.id,month:r.month,channelCents:p[`channel:${r.rule.id}:${r.month}`] as number}))
  need(collections.length===assessed.length,'Record channel collection separately for every assessed levy and month')
  const lines:TaxLine[]=[]
  for(const row of assessed){const recorded=collections.filter(r=>r.ruleId===row.rule.id&&r.month===row.month);need(recorded.length===1,'Record collection responsibility once for each levy and month')
   const channelCents=cents(recorded[0].channelCents,'source-recorded channel-collected tax cents',row.taxCents);need(f.booking.channel!=='direct'||channelCents===0,'Direct stays are host-collected')
   const line:TaxLine={id:newId(),propertyId:source.propertyId,bookingId:source.bookingId,sourceId:source.id,sourceReference:reference,month:row.month,jurisdictionId:row.jurisdiction.id,jurisdiction:row.jurisdiction.name,level:row.jurisdiction.level,ruleId:row.rule.id,ruleRevision:row.rule.revision,taxType:row.rule.taxType,bps:row.rule.bps,baseCents:row.baseCents,exemptCents:row.exemptCents,taxCents:row.taxCents,channelCents,hostCents:row.taxCents-channelCents,effectiveDate:row.month+'-01',ledgerId:null}
   if(await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(line.month).first())line.effectiveDate=c.now.slice(0,10)
   line.ledgerId=await ledger(c,line);saveLine(c,line);lines.push(line)
  }
  c.queries.push(query('INSERT INTO cb_tax_sources(id,property_id,booking_id,source_key,data) VALUES(?,?,?,?,?)',source.id,source.propertyId,source.bookingId,source.sourceKey,JSON.stringify(source)));scope(c,source);return {source,lines}
 }
 if(name==='tax.adjust'){
  const original=data.lines.find(l=>l.id===text(p.lineId,'original tax line'));need(original&&!original.originalLineId,'Choose an original assessed tax line',404)
  const adjusted=data.lines.filter(l=>l.originalLineId===original.id),remainingTax=original.taxCents+adjusted.reduce((n,l)=>n+l.taxCents,0),remainingChannel=original.channelCents+adjusted.reduce((n,l)=>n+l.channelCents,0)
  const tax=cents(p.taxCents,'tax reduction cents',remainingTax),channel=cents(p.channelCents,'channel-refunded tax cents',Math.min(tax,remainingChannel)),remainingHost=remainingTax-remainingChannel
  need(tax-channel<=remainingHost,'The adjustment exceeds the remaining host tax; review who refunded each levy')
  const base=cents(p.baseCents??0,'refunded taxable base cents',original.baseCents+adjusted.reduce((n,l)=>n+l.baseCents,0)),exempt=cents(p.exemptCents??0,'refunded exempt base cents',Math.min(base,original.exemptCents+adjusted.reduce((n,l)=>n+l.exemptCents,0)))
  const reference=text(p.reference,'refund/cancellation document reference',200);need(!adjusted.some(l=>l.sourceReference===reference),'This adjustment reference is already recorded',409)
  const effectiveDate=date(p.effectiveDate,'refund accounting date'),reason=text(p.reason,'refund/cancellation reason and source evidence',4000)
  need(p.confirm==='yes','Confirm the source refund/cancellation evidence and allocation between host and channel')
  const line:TaxLine={...original,id:newId(),sourceReference:reference,month:month(effectiveDate.slice(0,7)),baseCents:-base,exemptCents:-exempt,taxCents:-tax,channelCents:-channel,hostCents:-(tax-channel),originalLineId:original.id,effectiveDate,reason,ledgerId:null}
  line.ledgerId=await ledger(c,line,original);saveLine(c,line);return line
 }
 return undefined
}
