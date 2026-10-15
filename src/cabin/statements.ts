import { type Context, type Statement, type StatementLine, type Actor, need, text, integer, newId, preparer, manager, property, approve } from './model'
import { assertLive, load } from './storage'
export async function statementCommand(c:Context,name:string,p:Record<string,unknown>){
 if(name==='statement.prepare'){
  preparer(c.actor);const prop=property(c,p.propertyId),month=text(p.month,'statement month',7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Use a YYYY-MM month')
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
  approve(c,'statement',row,p.revision);c.entityId=row.id;return row
 }
 return undefined
}
/** Prevent spreadsheet formulas even when prefixed by whitespace or controls. */
export function csvCell(value:unknown){const s=String(value??'');return '"'+(typeof value==='number'?s:/^[\s\u0000-\u001f]*[=+@-]/.test(s)?"'"+s:s).replaceAll('"','""')+'"'}
export async function statementCsv(db:D1Database,actor:Actor,id:string){
 manager(actor);await assertLive(db,actor);const s=(await load(db)).statements.find(s=>s.id===id);need(s&&s.status==='approved','Approved statement not found',404)
 const rows:unknown[][]=[['Cabin owner statement'],['Property',s.propertyName],['Owner',s.ownerName,s.ownerEmail],['Month',s.month],['Revision',s.revision],['Description','Amount (cents)'],...s.lines.map(l=>[l.description,l.amountCents]),['Gross (cents)',s.grossCents],['Commission (basis points)',s.commissionBps],['Management fee (cents)',s.managementFeeCents],['Owner net (cents)',s.netCents],['Approved by',s.approval!.actorId,s.approval!.at],['Operational statement only. No payment processing or trust accounting.']]
 await assertLive(db,actor);return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
