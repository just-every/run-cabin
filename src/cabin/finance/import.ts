import type { Bindings } from '../../auth.server'
import { type Actor, type Booking, manager, need, text, newId } from '../model'
import { assertLive, mutate } from '../storage'
import { stays } from '../direct/store'
import { parsePayoutCsv, stripePayoutLines, type SourceLine } from './sources'
import type { Payout } from './types'
const sameRef=(uid:string,ref:string)=>{const u=uid.toLowerCase(),r=ref.toLowerCase();return u===r||(r.length>=6&&u.split(/[^a-z0-9]+/).includes(r))}
export function candidates(line:SourceLine,bookings:Booking[],propertyId?:string|null){
 return bookings.filter(b=>(!propertyId||b.propertyId===propertyId)&&b.channel===(line.source==='stripe'?'direct':line.source)&&(b.kind??'stay')==='stay'&&(
 sameRef(b.uid,line.reference)||!!(line.start&&line.end&&b.start.slice(0,10)===line.start&&b.end.slice(0,10)===line.end)))
}
export async function financeImport(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 manager(actor);await assertLive(env.DB,actor)
 if(name==='payout.match')return mutate(env.DB,actor,name,async c=>{
  const row=c.data.payouts.find(r=>r.id===text(input.id,'payout line'));need(row,'Payout line not found',404);need(!row.statementId,'A frozen statement already contains this line',409)
  const b=c.data.bookings.find(b=>b.id===text(input.bookingId,'stay'));need(b,'Stay not found',404)
  need(candidates(row,[b],row.propertyId).length===1,'The stay must have the same channel and reservation reference or exact dates')
  need(row.bookingId===b.id||!await c.db.prepare('SELECT 1 FROM cb_ledger_journals WHERE source_key=?').bind('payout:'+row.id).first(),'This payout has a posted trust journal. Preserve its match; reverse the journal and import a separately identified provider correction.',409)
  row.bookingId=b.id;row.propertyId=b.propertyId;row.match='matched';row.revision=newId();c.entityId=row.id;return row
 })
 need(name==='payout.import'||name==='payout.stripe','Unknown payout command',404)
 let lines:SourceLine[],propertyId:string|null=null
 if(name==='payout.stripe')lines=await stripePayoutLines(env)
 else {need(input.source==='airbnb'||input.source==='vrbo','Choose Airbnb or Vrbo');propertyId=text(input.propertyId,'home');lines=parsePayoutCsv(input.source,text(input.csv,'payout CSV',2_000_000))}
 const direct=await stays(env.DB)
 return mutate(env.DB,actor,name,c=>{
  if(propertyId)need(c.data.properties.some(p=>p.id===propertyId),'Home not found',404)
  const imported:Payout[]=[],duplicates:string[]=[]
  for(const line of lines){
   const old=c.data.payouts.find(r=>r.source===line.source&&r.externalId===line.externalId)
   if(old){need(old.grossCents===line.grossCents&&old.feeCents===line.feeCents&&old.netCents===line.netCents&&old.reference===line.reference,'A provider line changed after import; reconcile the source report before posting',409);need(!propertyId||old.propertyId===propertyId,'This provider line is already imported for another home',409);duplicates.push(old.id);continue}
   const paid=line.paymentId?direct.filter(s=>s.paymentId===line.paymentId):[]
   const matches=paid.length?c.data.bookings.filter(b=>paid.some(s=>s.bookingId===b.id)):candidates(line,c.data.bookings,propertyId)
   const b=matches.length===1?matches[0]:null
   const row:Payout={...line,id:newId(),revision:newId(),propertyId:b?.propertyId??propertyId,bookingId:b?.id??null,match:b?'matched':'unmatched',importedAt:c.now,importedBy:actor.id}
   c.data.payouts.push(row);imported.push(row)
  }
  c.entityId=imported[0]?.id??null;return {imported,duplicates,matched:imported.filter(r=>r.match==='matched').length}
 })
}
