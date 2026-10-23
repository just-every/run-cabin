import { type Context,need,text } from '../../model'
import { cents,csvDate,csvRecords,sumCents } from '../csv'
import { sha } from '../../model'
import { base,retain } from './store'
import type { BankData,TrustAccount,BankStatement } from './types'
export async function importStatement(c:Context,data:BankData,account:TrustAccount,p:Record<string,unknown>){
 need(p.confirm==='yes','Confirm this is an actual bank statement, not a forecast or processor payout')
 const reference=text(p.reference,'bank statement reference',160),evidence=text(p.evidence,'source and custody evidence',1000)
 const from=csvDate(text(p.from,'period start'),'period start'),until=csvDate(text(p.until,'period end'),'period end')
 need(from<=until,'Statement period ends before it starts')
 const openingCents=cents(text(p.opening,'opening USD balance',40),'Opening balance'),closingCents=cents(text(p.closing,'closing USD balance',40),'Closing balance')
 const csv=text(p.csv,'bank CSV',2_000_000),[header,...rows]=csvRecords(csv)
 need(header.join(',')==='Transaction ID,Date,Amount,Reference','Use exactly Transaction ID,Date,Amount,Reference; do not upload account numbers or routing data')
 const transactions=rows.map(cells=>{
  need(cells.length===4,'Every bank CSV row needs four fields')
  const id=text(cells[0],'bank transaction ID',160),date=csvDate(cells[1],'bank transaction date'),amountCents=cents(cells[2],'Bank transaction amount')
  need(date>=from&&date<=until&&amountCents!==0,'Every bank transaction needs a nonzero amount within the statement period')
  return {id,date,amountCents,reference:text(cells[3],'bank transaction evidence',200)}
 })
 need(new Set(transactions.map(t=>t.id)).size===transactions.length,'Repeated bank transaction IDs in this statement')
 need(sumCents([openingCents,...transactions.map(t=>t.amountCents)])===closingCents,'Opening balance plus bank transactions does not equal closing balance',409)
 const sourceDigest=await sha(csv),previous=data.statements.filter(s=>s.accountId===account.id),existing=previous.find(s=>s.reference===reference)
 if(existing){need(existing.from===from&&existing.until===until&&existing.openingCents===openingCents&&existing.closingCents===closingCents&&existing.sourceDigest===sourceDigest&&existing.evidence===evidence,'This statement reference already has different immutable evidence; investigate the source correction',409);return existing}
 need(!previous.some(s=>s.transactions.some(t=>transactions.some(n=>n.id===t.id))),'A bank transaction already belongs to another statement',409)
 if(previous.length){const last=previous.at(-1)!,next=new Date(last.until+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);need(from===next.toISOString().slice(0,10)&&openingCents===last.closingCents,'Import consecutive statement periods with the previous closing balance as the next opening balance',409)}
 const statement:BankStatement={...base(c,account.propertyId),accountId:account.id,reference,evidence,from,until,openingCents,closingCents,sourceDigest,transactions}
 return retain(c,data,'statements',statement)
}
