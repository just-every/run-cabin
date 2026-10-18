import { type Context, type Booking, type Property, type BlockUse, need, text, exact, newId, sha, query } from './model'
import { held, overlaps, describe } from './inventory'
import { day } from './direct/rules'
import { ownerRecords, policyFor } from './owners/records'
import { post } from './ledger/store'
import { debit, credit } from './ledger/types'

/** Explicit Cabin blocks create cleaning work; opaque channel closures never do. */
export const occupancy = (b: Booking) => (b.kind ?? 'stay') === 'stay' || !!b.blockUse
export async function blockUse(c:Context,p:Property,input:Record<string,unknown>,reason:string):Promise<BlockUse> {
 const purpose=input.purpose==='owner'?'owner':'maintenance'
 const policy=policyFor((await ownerRecords(c.db)).policies,p)
 const cleaningCents=purpose==='owner'?policy.cleaningCents:0
 need(!cleaningCents||c.data.ledgerSettings.some(s=>s.propertyId===p.id),'Configure this home’s Trust ledger before accepting billable owner use.',409)
 return {purpose,reason:text(reason,'block reason',300),cleaningCents,policyRevision:policy.revision,ownerEmail:p.ownerEmail,ownerName:p.ownerName}
}
export function changeBlock(c:Context,b:Booking,p:Record<string,unknown>){
 need(b.kind==='block'&&b.source==='request'&&b.status==='confirmed'&&b.blockUse,'Choose an active owner or maintenance block',409);exact(b,p.revision)
 need(!c.data.tasks.some(t=>t.work?.blockId===b.id),'This block belongs to a work order. Complete and inspect its work before reopening.',409)
 need(!c.data.turnovers.some(t=>t.bookingId===b.id&&t.status==='completed'),'Completed cleaning is retained. Create a new block for later work.',409)
 const start=day(p.start),end=day(p.end);need(start<end&&Date.parse(end)-Date.parse(start)<=365*86400000,'Choose between 1 and 365 blocked nights')
 const hit=held(c,b.propertyId).find(o=>o.id!==b.id&&overlaps(o,{start,end}));need(!hit,`Those nights overlap ${hit?describe(hit):''}`,409)
 c.queries.push(query('UPDATE cb_owner_stay_requests SET start=?,end=?,note=?,revision=? WHERE booking_id=?',start,end,text(p.note,'block reason',300),newId(),b.id));
 b.start=start;b.end=end;b.blockUse.reason=text(p.note,'block reason',300);b.summary=b.blockUse.reason;b.revision=newId();b.approvedAt=c.now;c.entityId=b.id
 return b
}
export function cancelBlock(c:Context,b:Booking,p:Record<string,unknown>){
 exact(b,p.revision);c.queries.push(query("UPDATE cb_owner_stay_requests SET status='cancelled',revision=?,decided_at=? WHERE booking_id=?",newId(),c.now,b.id));Object.assign(b,{status:'cancelled',cancelled:true,revision:newId(),approvedAt:c.now});c.entityId=b.id;return b
}
/** A completed cleaning creates its agreed payable once. A reservation/block itself creates no revenue or cash. */
export async function allocateBlockCleaning(c:Context){
 for(const t of c.data.turnovers.filter(t=>t.status==='completed')){
  const b=c.data.bookings.find(b=>b.id===t.bookingId),use=b?.blockUse
  if(!b||!use?.cleaningCents||c.before.turnovers.some(old=>old.id===t.id&&old.status==='completed'))continue
  await post(c,{sourceKey:'owner-use-cleaning:'+t.id,propertyId:b.propertyId,bookingId:b.id,effectiveDate:c.now.slice(0,10),ownerKey:await sha(use.ownerEmail.toLowerCase()),sourceType:'owner-use-cleaning',sourceId:t.id,sourceRevision:t.revision,lines:[debit('ownerLiability',use.cleaningCents),credit('vendorPayable',use.cleaningCents)]})
 }
}
