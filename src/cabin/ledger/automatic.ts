import { type Context, sha } from '../model'
import { post, contextJournals } from './store'
import { debit as dr, credit as cr } from './types'
import { stays } from '../direct/store'
import { paymentLedger } from '../direct/settlement-ledger'
/** Recovery is a payable credit, never invented cash movement. Undo reverses the exact original scope. */
export async function postRecovery(c:Context,statement:{id:string;revision:string;propertyId:string;preparedAt:string;ownerEmail:string;reversalOf?:string;lines:{bookingId?:string;amountCents:number}[]}) {
 if(!c.data.ledgerSettings.some(s=>s.propertyId===statement.propertyId))return
 const amount=-statement.lines.reduce((n,l)=>n+l.amountCents,0),credit=-statement.lines[0].amountCents,cleaning=-statement.lines[1].amountCents
 if(!amount)return
 const original=statement.reversalOf?(await contextJournals(c)).find(j=>j.sourceKey==='recovery:'+statement.reversalOf):undefined
 if(statement.reversalOf&&!original)return
 const build=[...(credit?[dr('ownerLiability',Math.abs(credit)),cr('guestCredits',Math.abs(credit))]:[]),...(cleaning?[dr('ownerLiability',Math.abs(cleaning)),cr('vendorPayable',Math.abs(cleaning))]:[])]
 await post(c,{sourceKey:'recovery:'+statement.id,propertyId:statement.propertyId,bookingId:statement.lines[0].bookingId!,effectiveDate:c.now.slice(0,10),sourceType:original?'recovery-reversal':'recovery',sourceId:statement.id,sourceRevision:statement.revision,...(original?{ownerKey:original.ownerKey,legalEntity:original.legalEntity,reversalOf:original.id}:{ownerKey:await sha(statement.ownerEmail.trim().toLowerCase())}),lines:amount<0?build.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents})):build})
}
/** Reconcile provider-confirmed records only. Nothing manufactures a bank receipt. */
export async function syncLedger(c:Context) {
 const configured=new Set(c.data.ledgerSettings.map(s=>s.propertyId))
 const direct=await stays(c.db)
 for(const s of direct)await paymentLedger(c,s)
 for(const s of c.data.statements.filter(s=>s.source==='recovery'&&s.status==='approved'))await postRecovery(c,s)
 for(const p of c.data.payouts.filter(p=>p.match==='matched'&&p.bookingId&&p.propertyId&&configured.has(p.propertyId)&&(!c.before.payouts.some(old=>old.id===p.id&&old.match===p.match&&old.bookingId===p.bookingId)))){
  if(!p.grossCents)continue
  const signed=(account:Parameters<typeof dr>[0],n:number,side:'dr'|'cr')=>n===0?[]:[(n>0===(side==='dr')?dr:cr)(account,Math.abs(n))]
  const processor=p.source==='stripe'&&direct.some(s=>s.bookingId===p.bookingId&&s.paymentId===p.paymentId)
  const lines=[...signed('cash',p.netCents,'dr'),...signed('channelFees',p.feeCents,'dr'),...signed(processor?'processorFunds':'ownerLiability',p.grossCents,'cr'),...signed('ownerLiability',p.feeCents,'dr'),...signed('channelFees',p.feeCents,'cr')]
  await post(c,{sourceKey:'payout:'+p.id,propertyId:p.propertyId!,bookingId:p.bookingId!,effectiveDate:await openDate(c,p.date),sourceType:'payout',sourceId:p.id,sourceRevision:p.revision,lines})
 }
}
/** Late provider evidence posts now if its original period has closed, retaining the original source date in the provider record. */
async function openDate(c:Context,date:string){return await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(date.slice(0,7)).first()?c.now.slice(0,10):date}
