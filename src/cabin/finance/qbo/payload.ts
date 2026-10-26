import { need, sha } from '../../model'
import type { Journal } from '../../ledger/types'
import type { Mapping, Payload } from './types'
export async function payload(j:Journal,m:Mapping):Promise<Payload> {
 return {DocNumber:'CB'+(await sha(j.id)).slice(0,19),TxnDate:j.effectiveDate,PrivateNote:`Cabin ledger ${j.id}; source ${j.sourceType} ${j.sourceId}; revision ${j.sourceRevision}`,CurrencyRef:{value:'USD'},Line:j.lines.map(l=>({Amount:(l.debitCents||l.creditCents)/100,Description:`Cabin ${j.sourceType}; ${l.account}; ${j.id}`,DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:l.debitCents?'Debit':'Credit',AccountRef:{value:m.accounts[l.account]},ClassRef:{value:m.classId},Entity:{Type:'Vendor',EntityRef:{value:m.vendorId}}}}))}
}
export function normalized(p:any):Payload {
 need(p&&Array.isArray(p.Line),'QuickBooks returned an invalid journal',502)
 return {DocNumber:p.DocNumber,TxnDate:p.TxnDate,PrivateNote:p.PrivateNote,CurrencyRef:{value:p.CurrencyRef?.value??'USD'},Line:p.Line.map((l:any)=>({Amount:l.Amount,Description:l.Description,DetailType:l.DetailType,JournalEntryLineDetail:{PostingType:l.JournalEntryLineDetail?.PostingType,AccountRef:{value:l.JournalEntryLineDetail?.AccountRef?.value},ClassRef:{value:l.JournalEntryLineDetail?.ClassRef?.value},Entity:{Type:l.JournalEntryLineDetail?.Entity?.Type,EntityRef:{value:l.JournalEntryLineDetail?.Entity?.EntityRef?.value}}}}))}
}
export const fingerprint=async(p:unknown)=>sha(JSON.stringify(normalized(p)))
export function totals(p:Payload) {let debitCents=0,creditCents=0;const accountTotals:Record<string,number>={};for(const l of p.Line){const cents=Math.round(l.Amount*100);need(Number.isSafeInteger(cents)&&cents>0,'Invalid QuickBooks amount');const debit=l.JournalEntryLineDetail.PostingType==='Debit';if(debit)debitCents+=cents;else creditCents+=cents;const id=l.JournalEntryLineDetail.AccountRef.value;accountTotals[id]=(accountTotals[id]??0)+(debit?cents:-cents)}need(Number.isSafeInteger(debitCents)&&debitCents===creditCents,'QuickBooks journal does not balance');return {debitCents,creditCents,accountTotals}}
