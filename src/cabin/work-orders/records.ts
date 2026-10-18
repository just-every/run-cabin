import type { Data, Task } from '../model'
import { managementFor } from '../properties/terms'
import type { WorkOrder } from './types'
/** Upgrade pre-work-order reports into the same evidence workflow as new reports. */
export function initialWork(data:Data,task:Pick<Task,'title'|'propertyId'|'turnoverId'|'raisedAt'>):WorkOrder {
 const date=task.raisedAt.slice(0,10),turnover=data.turnovers.find(t=>t.id===task.turnoverId),booking=data.bookings.find(b=>b.id===turnover?.bookingId)
 return {asset:task.title,priority:'normal',dueDate:date,checklist:['Verify repair'],requiresInspection:false,inspectorId:null,recurrenceDays:0,spendLimitCents:0,ownerTerms:structuredClone(booking?.managementTerms??managementFor(data,task.propertyId,date))}
}
