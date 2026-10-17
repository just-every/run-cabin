import { type Context, type Statement, type StatementLine, type Actor, need, text, integer, newId, preparer, manager, property, approve } from './model'
import { sha } from './model'
import { assertLive, load } from './storage'
import { statementMonth, usd } from './finance/presentation'
export async function statementCommand(c:Context,name:string,p:Record<string,unknown>){
 if(name==='statement.prepare'){
  preparer(c.actor);const prop=property(c,p.propertyId),month=text(p.month,'statement month',7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Use a YYYY-MM month')
  if(p.lines===undefined){
   const payouts=c.data.payouts.filter(r=>r.propertyId===prop.id&&r.date.startsWith(month)&&!r.statementId)
   need(payouts.length>0,'Import payouts for this home and month first')
   need(payouts.every(r=>r.match==='matched'&&r.bookingId),'Match every imported payout in this home and month before preparing a statement',409)
   const lines:StatementLine[]=payouts.flatMap(r=>[{description:`${r.source} ${r.reference} · gross`,amountCents:r.grossCents,payoutId:r.id,bookingId:r.bookingId!,category:'gross' as const},...(r.feeCents?[{description:`${r.source} ${r.reference} · imported channel fee`,amountCents:-r.feeCents,payoutId:r.id,bookingId:r.bookingId!,category:'channelFee' as const}]:[])])
   const grossCents=payouts.reduce((n,r)=>n+r.grossCents,0),channelFeeCents=payouts.reduce((n,r)=>n+r.feeCents,0),settlementCents=payouts.reduce((n,r)=>n+r.netCents,0)
   need(grossCents>=0&&grossCents-channelFeeCents===settlementCents,'Imported payouts do not reconcile to gross less channel fees',409)
   const managementFeeCents=Number((BigInt(grossCents)*BigInt(prop.commissionBps)+5000n)/10000n)
   const row:Statement={id:newId(),revision:newId(),propertyId:prop.id,propertyRevision:prop.revision,propertyName:prop.name,ownerName:prop.ownerName,ownerEmail:prop.ownerEmail,month,lines,source:'imported',payoutIds:payouts.map(r=>r.id),sourceBaseline:await sha(JSON.stringify(payouts)),channelFeeCents,settlementCents,commissionBps:prop.commissionBps,grossCents,managementFeeCents,netCents:settlementCents-managementFeeCents,status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
   c.data.statements.push(row);c.entityId=row.id;return row
  }
  need(Array.isArray(p.lines)&&p.lines.length>0&&p.lines.length<=100,'Provide 1 to 100 statement lines')
  const lines:StatementLine[]=p.lines.map((v:any)=>({description:text(v?.description,'line description',300),amountCents:integer(v?.amountCents,'amountCents',-100_000_000,100_000_000)}))
  const grossCents=lines.reduce((sum,line)=>sum+line.amountCents,0);need(Number.isSafeInteger(grossCents)&&grossCents>=0,'Statement total must be a non-negative whole number of cents')
  const calculated=Number((BigInt(grossCents)*BigInt(prop.commissionBps)+5000n)/10000n)
  const managementFeeCents=p.managementFeeCents===undefined?calculated:integer(p.managementFeeCents,'managementFeeCents',0,grossCents)
  const row:Statement={id:newId(),revision:newId(),propertyId:prop.id,propertyRevision:prop.revision,propertyName:prop.name,ownerName:prop.ownerName,ownerEmail:prop.ownerEmail,month,lines,commissionBps:prop.commissionBps,grossCents,managementFeeCents,netCents:grossCents-managementFeeCents,status:'draft',preparedBy:c.actor.id,preparedAt:c.now}
  c.data.statements.push(row);c.entityId=row.id;return row
 }
 if(name==='statement.approve'){
  manager(c.actor);const row=c.data.statements.find(s=>s.id===text(p.id,'statement ID'));need(row,'Statement not found',404)
  need(property(c,row.propertyId).revision===row.propertyRevision,'Property or fee terms changed. Prepare the statement again.',409)
  need(!c.data.statements.some(s=>s.id!==row.id&&s.propertyId===row.propertyId&&s.month===row.month&&s.status==='approved'),'This property month already has an approved statement',409)
  if(row.source==='imported'){
   const payouts=c.data.payouts.filter(r=>r.propertyId===row.propertyId&&r.date.startsWith(row.month)&&!r.statementId)
   need(await sha(JSON.stringify(payouts))===row.sourceBaseline,'Imported payouts changed. Prepare and review a new statement.',409)
   need(payouts.every(r=>r.match==='matched'),'Match every imported payout before approval',409)
   for(const payout of payouts)payout.statementId=row.id
  }
  const member=c.data.members.find(m=>m.id===c.actor.memberId&&m.email.toLowerCase()===c.actor.email.toLowerCase())
  const operator=member?null:await c.db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(c.actor.id).first<{display_name:string}>()
  const actorName=member?.name||operator?.display_name
  need(actorName,'Approving operator name not found',409)
  const approval=approve(c,'statement',row,p.revision)
  approval.actorName=actorName
  c.data.deliveries.push({id:newId(),revision:newId(),propertyId:row.propertyId,statementId:row.id,email:row.ownerEmail,status:'pending',at:c.now,detail:null})
  c.entityId=row.id;return row
 }
 return undefined
}
/** Prevent spreadsheet formulas even when prefixed by whitespace or controls. */
export function csvCell(value:unknown){const s=String(value??'');return '"'+(typeof value==='number'?s:/^[\s\u0000-\u001f]*[=+@-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"'}
export function approvedStatementCsv(s:Statement){
 const rows:unknown[][]=[['Cabin owner statement'],['Property',s.propertyName],['Owner',s.ownerName,s.ownerEmail],['Month',statementMonth(s.month)],['Revision',s.revision],['Description','Amount (USD)'],...s.lines.map(l=>[l.description,usd(l.amountCents)]),['Gross (USD)',usd(s.grossCents)],['Imported channel fees (USD)',usd(s.channelFeeCents??0)],['Management commission',`${(s.commissionBps/100).toFixed(2)}%`],['Management fee (USD)',usd(s.managementFeeCents)],['Owner payout (USD)',usd(s.netCents)],['Approved by',s.approval!.actorName??'Name not recorded on this earlier approval',s.approval!.at],['Operational statement only. No payment processing or trust accounting.']]
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
export async function statementCsv(db:D1Database,actor:Actor,id:string){
 manager(actor);await assertLive(db,actor);const s=(await load(db)).statements.find(s=>s.id===id);need(s&&s.status==='approved','Approved statement not found',404)
 await assertLive(db,actor);return approvedStatementCsv(s)
}
