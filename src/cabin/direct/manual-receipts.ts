import type { Bindings } from '../../auth.server'
import { need,text,integer,sha,manager,type Actor } from '../model'
import { mutate } from '../storage'
import { hasAction,permitsProperty } from '../permissions/policy'
import { contextJournals,post } from '../ledger/store'
import { debit,credit } from '../ledger/types'
import { paymentBalance } from '../reservations/balances'
import { day } from './rules'
export async function manualReceipt(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 if(name!=='direct.manual.receive')return undefined
 manager(actor);need(!actor.isAgent&&hasAction(actor,name),'A human with payment authority must record receipts',403)
 const method=text(input.method,'receipt method');need(method==='cash'||method==='check','Choose cash or a cleared check')
 need(input.confirm==='yes','Confirm actual cash receipt or verified trust-bank check clearance; a promised payment is not a receipt')
 const reference=text(input.reference,'receipt or cleared-check reference',200),note=text(input.note,'source evidence and custody record',1000),receivedAt=day(input.receivedAt),amount=integer(Number(input.amountCents),'received USD cents',1,99999999)
 need(Date.parse(receivedAt+'T00:00:00Z')<=Date.now(),'A future promised payment is not a receipt')
 return mutate(env.DB,actor,name,async c=>{
  const b=c.data.bookings.find(b=>b.id===input.bookingId)
  need(b&&permitsProperty(actor,b.propertyId),'Reservation not found',404)
  need(b.channel==='direct'&&b.source!=='feed'&&b.lifecycle?.price&&!b.guestErasedAt&&!b.restorePaused,'Choose a priced native direct reservation with retained receipt authority',409)
  const sourceKey='manual-receipt:'+b.propertyId+':'+await sha(method+':'+reference),sourceRevision=await sha(JSON.stringify({method,reference,note,receivedAt,amount,bookingId:b.id})),old=(await contextJournals(c)).find(j=>j.sourceKey===sourceKey)
  if(old){need(old.bookingId===b.id&&old.sourceRevision===sourceRevision,'This receipt reference already has different immutable evidence or amount',409);return old}
  need(b.revision===input.revision,'Reservation changed. Review the receipt against its current balance.',409)
  const balance=await paymentBalance(c,b);need(balance.balanceCents!==null&&amount<=balance.balanceCents,'Receipt exceeds the current outstanding reservation balance',409)
  const effectiveDate=await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(receivedAt.slice(0,7)).first()?c.now.slice(0,10):receivedAt
  const row=await post(c,{sourceKey,sourceType:'payment',sourceId:reference,sourceRevision,propertyId:b.propertyId,bookingId:b.id,effectiveDate,manualReceipt:{method,reference,note,receivedAt},lines:[debit('cash',amount),credit('receivable',amount)]})
  c.entityId=b.id;return row
 })
}
