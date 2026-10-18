import { promotionPayments } from '../promotions/settlement'
import type { Bindings } from '../../auth.server'
import { record, type AuditActor } from '../audit/write'
import { type Actor, type Booking, manager, need, text, newId } from '../model'
import { assertLive, mutate } from '../storage'
import { stays } from '../direct/store'
import { parsePayoutCsv, stripePayoutLines, type SourceLine } from './sources'
import type { Payout } from './types'
const sameRef=(uid:string,ref:string)=>{const u=uid.toLowerCase(),r=ref.toLowerCase();return u===r||(r.length>=6&&u.split(/[^a-z0-9]+/).includes(r))}
export function candidates(line:SourceLine,bookings:Booking[],propertyId?:string|null){
 return bookings.filter(b=>(!propertyId||b.propertyId===propertyId)&&b.channel===(line.source==='stripe'?'direct':line.source)&&(b.kind??'stay')==='stay'&&(
 sameRef(b.uid,line.reference)||!!(b.lifecycle?.sourceId&&sameRef(b.lifecycle.sourceId,line.reference))||!!(b.channelRef&&sameRef(b.channelRef,line.reference))||!!(line.start&&line.end&&b.start.slice(0,10)===line.start&&b.end.slice(0,10)===line.end)))
}
function matches(line:SourceLine,bookings:Booking[],direct:{paymentId?:string;bookingId:string;promotion?:boolean}[],propertyId?:string|null){
 const paid=line.source==='stripe'&&line.paymentId?direct.filter(s=>s.paymentId===line.paymentId):[]
 if(!paid.length)return candidates(line,bookings,propertyId)
 const linked=bookings.filter(b=>paid.some(s=>s.bookingId===b.id))
 need(linked.every(b=>(!propertyId||b.propertyId===propertyId)&&(b.channel==='direct'||paid.some(s=>s.bookingId===b.id&&s.promotion))&&(b.kind??'stay')==='stay'),'The Stripe payment intent belongs to a different home or is not linked to a direct stay',409)
 return linked
}
function unchanged(old:Payout,line:SourceLine){
 return old.grossCents===line.grossCents&&old.feeCents===line.feeCents&&old.netCents===line.netCents&&
  old.reference===line.reference&&old.payoutId===line.payoutId&&old.date===line.date&&
  old.start===line.start&&old.end===line.end&&old.currency===line.currency&&
  (old.paymentId??'')===(line.paymentId??'')&&old.guestName===line.guestName&&
  (!old.transactionId||!line.transactionId||old.transactionId===line.transactionId)&&
  (!old.evidenceReference||!line.evidenceReference||old.evidenceReference===line.evidenceReference)
}
export async function financeImport(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 manager(actor);await assertLive(env.DB,actor)
 if(name==='payout.match')return mutate(env.DB,actor,name,async c=>{
  const row=c.data.payouts.find(r=>r.id===text(input.id,'payout line'));need(row,'Payout line not found',404);need(!row.statementId,'A frozen statement already contains this line',409)
  const b=c.data.bookings.find(b=>b.id===text(input.bookingId,'stay'));need(b,'Stay not found',404)
  const allowed=matches(row,c.data.bookings,[...await stays(c.db),...await promotionPayments(c.db)],row.propertyId)
  need(allowed.some(candidate=>candidate.id===b.id),'The stay must have the same channel and reservation reference or exact dates, or the linked Stripe payment intent')
  need(row.bookingId===b.id||!await c.db.prepare('SELECT 1 FROM cb_ledger_journals WHERE source_key=?').bind('payout:'+row.id).first(),'This payout has a posted trust journal. Preserve its match; reverse the journal and import a separately identified provider correction.',409)
  row.bookingId=b.id;row.propertyId=b.propertyId;row.match='matched';row.revision=newId();c.entityId=row.id;return row
 })
 need(name==='payout.import'||name==='payout.stripe','Unknown payout command',404)
 let lines:SourceLine[],propertyId:string|null=null
 if(name==='payout.stripe'){
  const id=newId()
  await record(env.DB,actor,'payout.stripe.request',{kind:'payout-import',id,revision:id,result:'pending'})
  try { lines=await stripePayoutLines(env) } catch(error) {
   await record(env.DB,actor,'payout.stripe.result',{kind:'payout-import',id,revision:id,result:'failed-or-uncertain'});throw error
  }
 }
 else {
  need(input.source==='airbnb'||input.source==='vrbo'||input.source==='booking.com'||input.source==='stripe','Choose Airbnb, Vrbo, Booking.com or Stripe')
  propertyId=text(input.propertyId,'home')
  const evidence=input.source==='booking.com'||input.source==='stripe'?text(input.evidenceReference,'provider settlement evidence reference',500):undefined
  lines=parsePayoutCsv(input.source,text(input.csv,'payout CSV',2_000_000),evidence)
 }
 const direct=[...await stays(env.DB),...await promotionPayments(env.DB)]
 return mutate(env.DB,actor,name,c=>{
  if(propertyId)need(c.data.properties.some(p=>p.id===propertyId),'Home not found',404)
  const imported:Payout[]=[],duplicates:string[]=[]
  for(const line of lines){
   const old=c.data.payouts.find(r=>r.source===line.source&&r.externalId===line.externalId)
   if(old){need(unchanged(old,line),'A provider line changed after import; reconcile the source report before posting',409);need(!propertyId||old.propertyId===propertyId,'This provider line is already imported for another home',409);duplicates.push(old.id);continue}
   const eligible=matches(line,c.data.bookings,direct,propertyId)
   const b=eligible.length===1?eligible[0]:null
   const row:Payout={...line,id:newId(),revision:newId(),propertyId:b?.propertyId??propertyId,bookingId:b?.id??null,match:b?'matched':'unmatched',importedAt:c.now,importedBy:actor.id}
   c.data.payouts.push(row);imported.push(row)
  }
  c.entityId=imported[0]?.id??null;return {imported,duplicates,matched:imported.filter(r=>r.match==='matched').length}
 })
}
