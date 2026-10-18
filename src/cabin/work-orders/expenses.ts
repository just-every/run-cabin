import { costParts } from '../finance/allocation-calculation'
import { type Context, type Task, need, newId, sha } from '../model'
import { post } from '../ledger/store'
import { debit, credit } from '../ledger/types'
import { managementFor } from '../properties/terms'

export interface WorkExpense {
 id:string; revision:string; propertyId:string; taskId:string; bookingId:string; ownerEmail:string; ownerName:string;
 ownerAllocations?:ReturnType<typeof costParts>; agreementId:string; amountCents:number; invoiceReference:string; photoIds:string[]; period:string; approvedBy:string; approvedAt:string
}
/** Approval creates a vendor payable, never a bank payment. Exact invoice evidence posts once. */
export async function postWorkExpense(c:Context,task:Task):Promise<string> {
 const work=task.work!,invoice=work.invoice!;need(invoice,'Attach an invoice before approval')
 const existing=c.data.workExpenses.find(e=>e.taskId===task.id)
 if(existing){need(existing.invoiceReference===invoice.reference&&existing.amountCents===invoice.amountCents,'This work order already has a different approved invoice',409);return existing.id}
 const booking=c.data.bookings.find(b=>b.id===c.data.turnovers.find(t=>t.id===task.turnoverId)?.bookingId)
 const terms=work.ownerTerms??booking?.managementTerms??managementFor(c.data,task.propertyId,work.dueDate)
 need(c.data.ledgerSettings.some(s=>s.propertyId===task.propertyId),'Configure this home’s legal entity in Trust ledger before approving an invoice.',409)
 const row:WorkExpense={id:newId(),revision:newId(),propertyId:task.propertyId,taskId:task.id,bookingId:booking?.id??'',ownerEmail:terms.ownerEmail,ownerName:terms.ownerName,agreementId:terms.id,amountCents:invoice.amountCents,invoiceReference:invoice.reference,photoIds:invoice.photos.map(p=>p.id),period:c.now.slice(0,7),approvedBy:c.actor.id,approvedAt:c.now}
 row.ownerAllocations=costParts(terms,row.amountCents)
 for(const [i,part] of row.ownerAllocations.entries())if(part.expenseCents)await post(c,{sourceKey:'maintenance:'+task.id+(i?':'+i:''),propertyId:task.propertyId,bookingId:row.bookingId,effectiveDate:c.now.slice(0,10),ownerKey:await sha(part.ownerEmail),sourceType:'maintenance-expense',sourceId:task.id,sourceRevision:task.revision,lines:[debit('ownerLiability',part.expenseCents),credit('vendorPayable',part.expenseCents)]})
 c.data.workExpenses.push(row);return row.id
}
