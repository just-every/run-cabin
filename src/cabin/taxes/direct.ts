import type { Quote } from '../direct/types'
import { stay } from '../direct/store'
import { need, sha, text, type Context } from '../model'
import { assess } from './calculate'
import { sourceCommand } from './sources'
import { taxData } from './store'
import type { TaxData, Config } from './types'
/** Imports the actual frozen paid quote; never recalculates a historical receipt with today's rate. */
export async function directSource(c:Context,data:TaxData,p:Record<string,unknown>){
 const receipt=await stay(c.db,text(p.stayId,'paid direct stay'))
 need(receipt.paymentId&&receipt.phase==='confirmed','Only a provider-confirmed paid direct reservation can supply tax evidence',409)
 const quote=receipt.quote as Quote&{taxConfiguration?:Config[];taxConfigurationDigest?:string},frozen=quote.taxConfiguration,config=frozen?.length?frozen:data.config.filter(r=>r.propertyId===receipt.propertyId)
 if(frozen?.length)need(quote.taxConfigurationDigest===await sha(JSON.stringify(config)),'The paid receipt rule snapshot does not match its digest',409)
 const assessed=assess(config,receipt.propertyId,receipt.start,receipt.end,receipt.quote.rentCents+receipt.quote.cleaningCents+receipt.quote.extraGuestCents,0)
 const totals=new Map<string,number>();for(const r of assessed.filter(r=>r.rule.bps>0)){const key=r.jurisdiction.level+':'+r.rule.bps;totals.set(key,(totals.get(key)??0)+r.taxCents)}
 const charged=new Map<string,number>();for(const t of receipt.quote.taxes){const key=t.jurisdiction+':'+t.bps;charged.set(key,(charged.get(key)??0)+t.amountCents)}
 need(totals.size===charged.size&&[...totals].every(([key,amount])=>charged.get(key)===amount),'The paid quote has an unmapped jurisdiction, rate or amount. Keep it as a work item and review its receipt; do not re-tax it.',409)
 const fields={bookingId:receipt.bookingId,baseCents:receipt.quote.rentCents+receipt.quote.cleaningCents+receipt.quote.extraGuestCents,exemptCents:0,reference:`stripe:${receipt.paymentId}`,document:`Frozen paid direct quote ${receipt.id}; Stripe payment ${receipt.paymentId}; mode ${receipt.paymentMode??'recorded by provider'}; checkout ${receipt.checkoutId??''}; signed quote ${receipt.signature.sha256}; ${frozen?.length?`rule snapshot ${quote.taxConfigurationDigest}`:'legacy receipt matched to effective rules by jurisdiction level, rate and exact tax amount'}; charged levies ${JSON.stringify(receipt.quote.taxes)}.`,collections:assessed.map(r=>({ruleId:r.rule.id,month:r.month,channelCents:0})),confirm:p.confirm}
 const preview=await sourceCommand(c,{...data,config},'tax.source.preview',fields)
 need(preview&&'previewDigest' in preview,'Calculate this paid receipt first',409)
 return sourceCommand(c,{...data,config},'tax.source.record',{...fields,previewDigest:preview.previewDigest})
}
