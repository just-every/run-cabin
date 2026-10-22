import type { Booking, Context } from '../model'
import type { Journal } from '../ledger/types'
import { charge } from './finance'

/** Read each selected reservation's receipts once; contractual charges are not payments. */
export async function paymentBalances(db:D1Database,bookings:Booking[]) {
 const ids=JSON.stringify(bookings.map(b=>b.id)),inside="IN (SELECT value FROM json_each(?))"
 const result=await db.batch<{data:string}>([
  db.prepare(`SELECT data FROM cb_direct_stays WHERE json_extract(data,'$.bookingId') ${inside} ORDER BY rowid`).bind(ids),
  db.prepare(`SELECT data FROM cb_ledger_journals WHERE booking_id ${inside} ORDER BY posted_at,id`).bind(ids),
  db.prepare(`SELECT data FROM cb_records WHERE kind='collectionPlans' AND json_extract(data,'$.bookingId') ${inside}`).bind(ids),
  db.prepare(`SELECT data FROM cb_records WHERE kind='promotionOffers' AND json_extract(data,'$.bookingId') ${inside}`).bind(ids),
 ])
 const group=(rows:{data:string}[])=>{const map=new Map<string,any[]>();for(const row of rows){const value=JSON.parse(row.data),list=map.get(value.bookingId)??[];list.push(value);map.set(value.bookingId,list)}return map}
 const direct=group(result[0].results),journals=group(result[1].results),collections=group(result[2].results),offers=group(result[3].results)
 return new Map(bookings.map(b=>{
  const d=direct.get(b.id)?.[0],rows=(journals.get(b.id)??[]) as Journal[],index=new Map(rows.map(j=>[j.id,j]))
  const family=(j:Journal):string=>{const original=j.reversalOf?index.get(j.reversalOf):undefined;return original?family(original):j.sourceType}
  const received=rows.filter(j=>family(j)==='payment').reduce((n,j)=>n+j.lines.filter(l=>l.account==='receivable').reduce((a,l)=>a+l.creditCents-l.debitCents,0),0)
  const refunded=rows.filter(j=>family(j)==='refund').reduce((n,j)=>n+j.lines.filter(l=>l.account==='cash').reduce((a,l)=>a+l.creditCents-l.debitCents,0),0)
  const directRefunded=d?.refunds?.filter((r:any)=>r.status==='succeeded'&&r.kind!=='deposit').reduce((n:number,r:any)=>n+r.amounts.totalCents,0)??0
  const promotion=(offers.get(b.id)??[]).reduce((n,o)=>n+(o.paymentId?o.amountCents:0)-(o.refund?.status==='succeeded'?o.refund.amountCents:0),0)
  const collected=(collections.get(b.id)??[]).flatMap(p=>p.jobs).filter(j=>j.status==='succeeded').reduce((n,j)=>n+j.amountCents,0),postedCollections=rows.filter(j=>j.sourceKey.startsWith('collection:')).reduce((n,j)=>n+j.lines.filter(l=>l.account==='receivable').reduce((a,l)=>a+l.creditCents-l.debitCents,0),0),collectionReceipts=Math.max(0,collected-postedCollections)
  const paidCents=collectionReceipts+promotion+received+(d?.paymentId?d.quote.totalCents:0)-refunded-directRefunded,totalCents=b.lifecycle?.price?charge(b):d?.quote?.totalCents
  return [b.id,{paidCents,totalCents:totalCents??null,balanceCents:totalCents===undefined?null:totalCents-paidCents}]
 }))
}
export async function paymentBalance(c:Pick<Context,'db'|'data'>,b:Booking){return (await paymentBalances(c.db,[b])).get(b.id)!}
