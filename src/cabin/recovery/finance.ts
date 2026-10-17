import { type Context, type Statement, integer, need, newId, property, text } from '../model'

/** Recovery callers enforce the owner's approval or automation policy before posting. */
export function postRecoveryBalance(c:Context,recovery:{id:string;propertyId:string;bookingId:string},creditCents:number,extraCleaningCents:number,why:string,reverse=false):string {
 const recoveryId=text(recovery.id,'recovery ID'),prop=property(c,recovery.propertyId),reason=text(why,'recovery balance reason',2000)
 integer(creditCents,'creditCents');integer(extraCleaningCents,'extraCleaningCents')
 need(Number.isSafeInteger(creditCents+extraCleaningCents),'Recovery balance total must be a safe whole number of cents')
 need(c.data.bookings.some(b=>b.id===recovery.bookingId&&b.propertyId===prop.id),'Recovery stay does not belong to this home',409)
 const postings=c.data.statements.filter(s=>s.source==='recovery'&&s.recoveryId===recoveryId)
 const originals=postings.filter(s=>!s.reversalOf),reversals=postings.filter(s=>s.reversalOf)
 need(originals.length<=1&&reversals.length<=1,'Recovery balance has conflicting postings; review its frozen statements',409)
 const original=originals[0]
 if(original){
  need(original.propertyId===prop.id&&original.status==='approved'&&original.approval?.revision===original.revision&&original.lines.length===2&&original.lines.every(l=>l.bookingId===recovery.bookingId&&Number.isSafeInteger(l.amountCents)&&l.amountCents<=0)&&original.netCents===original.lines.reduce((n,l)=>n+l.amountCents,0),'Recovery balance evidence does not match this case',409)
 }
 if(reverse){
  need(original,'Post the original recovery balance before reversing it',409)
  if(reversals[0]){need(reversals[0].reversalOf===original.id,'Recovery reversal references another balance',409);return reversals[0].id}
 }else if(original){
  need(original.lines[0].amountCents===-creditCents&&original.lines[1].amountCents===-extraCleaningCents,'This recovery already has a different frozen balance',409)
  return original.id
 }
 const lines=reverse?original!.lines.map(l=>({...l,description:`Recovery reversal ${recoveryId} · ${l.description} · ${reason}`,amountCents:-l.amountCents})):[
  {description:`Recovery ${recoveryId} · Guest credit · ${reason}`,amountCents:creditCents?-creditCents:0,bookingId:recovery.bookingId},
  {description:`Recovery ${recoveryId} · Extra cleaning · ${reason}`,amountCents:extraCleaningCents?-extraCleaningCents:0,bookingId:recovery.bookingId},
 ]
 const netCents=lines.reduce((n,l)=>n+l.amountCents,0),id=newId(),revision=newId()
 const approval={id:newId(),kind:'recovery-balance',recordId:id,revision,actorId:c.actor.id,actorName:c.actor.email,at:c.now}
 const row:Statement={id,revision,propertyId:prop.id,propertyRevision:prop.revision,propertyName:prop.name,ownerName:prop.ownerName,ownerEmail:prop.ownerEmail,month:c.now.slice(0,7),lines,source:'recovery',recoveryId,...(reverse?{reversalOf:original!.id}:{}),commissionBps:0,grossCents:netCents,managementFeeCents:0,netCents,status:'approved',preparedBy:c.actor.id,preparedAt:c.now,approval}
 c.data.statements.push(row);c.data.approvals.push(approval)
 c.data.deliveries.push({id:newId(),revision:newId(),propertyId:prop.id,statementId:id,email:prop.ownerEmail,status:'pending',at:c.now,detail:null})
 return id
}
