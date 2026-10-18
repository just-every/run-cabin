import { type Context, type Data, type Property, type Booking, need, text, integer, newId, manager } from '../model'
import { day } from '../direct/rules'

export interface ManagementTerms {
 id: string; revision: string; propertyId: string; effectiveFrom: string;
 ownerName: string; ownerEmail: string; commissionBps: number; terms: string; recordedAt: string; recordedBy: string
}
const initial = (p: Property): ManagementTerms => ({ id: p.id + ':initial', revision: String(p.revision), propertyId: p.id, effectiveFrom: '0001-01-01', ownerName: p.ownerName, ownerEmail: p.ownerEmail, commissionBps: p.commissionBps, terms: 'Commission on gross rent. Other costs require separate approval.', recordedAt: '', recordedBy: 'legacy' })
export function managementFor(data: Pick<Data, 'properties' | 'managementTerms'>, propertyId: string, date: string): ManagementTerms {
 const p = data.properties.find(p => p.id === propertyId); need(p, 'Property not found', 404)
 return [...data.managementTerms.filter(t => t.propertyId === propertyId && t.effectiveFrom <= date)].reverse().sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.recordedAt.localeCompare(a.recordedAt))[0] ?? initial(p)
}
/** Freeze once. Later owner, date or commission edits never rewrite a stay's allocation. */
export function captureManagement(c: Context, existingPropertyId?:string) {
 if(existingPropertyId)for (const p of c.before.properties) if (p.id===existingPropertyId&&!c.data.managementTerms.some(t => t.propertyId === p.id)) c.data.managementTerms.push(initial(p))
 for (const b of c.data.bookings) if (!b.managementTerms) {
  const previous = c.before.bookings.find(old => old.id === b.id)
  if(previous&&b.propertyId!==existingPropertyId)continue
  b.managementTerms = structuredClone(previous ? previous.managementTerms ?? managementFor(c.before, b.propertyId, b.start.slice(0,10)) : managementFor(c.data, b.propertyId, b.start.slice(0,10)))
 }
}
export function saveManagement(c: Context, p: Property, input: Record<string, unknown>) {
 const effectiveFrom = day(input.effectiveFrom ?? c.now.slice(0,10))
 const email = text(input.ownerEmail, 'owner email', 254).toLowerCase(); need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid owner email')
 const row: ManagementTerms = { id:newId(),revision:newId(),propertyId:p.id,effectiveFrom,ownerName:text(input.ownerName,'owner name',160),ownerEmail:email,commissionBps:integer(input.commissionBps,'commissionBps',0,10000),terms:text(input.terms ?? 'Commission on gross rent. Other costs require separate approval.','management agreement',10000),recordedAt:c.now,recordedBy:c.actor.id }
 c.data.managementTerms.push(row); return row
}
export function managementCommand(c: Context, name: string, p: Record<string,unknown>) {
 if (name !== 'property.terms') return undefined
 manager(c.actor); const prop=c.data.properties.find(v=>v.id===p.propertyId); need(prop,'Property not found',404)
 need(Number(p.propertyRevision)===prop.revision,'Property changed. Reload before saving terms.',409)
 captureManagement(c,prop.id); c.entityId=prop.id; return saveManagement(c,prop,p)
}
export const allocationTerms = (data: Data, b: Booking) => b.managementTerms ?? managementFor(data,b.propertyId,b.start.slice(0,10))
