import type { Booking, Data, AccessCode, Turnover, Task } from '../model'
export interface ReadinessPlan { id: string; revision: string; propertyId: string; supplies: string[]; inspectorId: string }
export interface Attestation { item: string; status: 'passed' | 'failed' | 'excepted'; note: string; guestImpact: string; by: string; name: string; at: string }
export interface ReadinessRecord { id: string; revision: string; propertyId: string; bookingId: string; baseline: string; attestations: Attestation[]; history?: { baseline: string; attestations: Attestation[] }[]; chases: { by: string; name: string; at: string; note: string }[] }
export type ReadinessData = Pick<Data, 'readinessPlans' | 'readinessRecords'>
export const DEFAULT_SUPPLIES = ['Linens', 'Toiletries', 'Coffee', 'Paper goods']
export const readinessPlan = (s: ReadinessData, propertyId: string): ReadinessPlan => s.readinessPlans.find(p => p.propertyId === propertyId) ?? { id: '', revision: '', propertyId, supplies: DEFAULT_SUPPLIES, inspectorId: 'owner' }
export function arrivalChecks(s: ReadinessData, arrival: Booking, turnover: Turnover | null, blockers: Task[], code: AccessCode | null) {
 const plan = readinessPlan(s, arrival.propertyId)
 const baseline = JSON.stringify([arrival.id, arrival.start, arrival.end, arrival.arrivalTime, plan, turnover?.revision, turnover?.completion, blockers.map(t => [t.id,t.revision]), code && [code.id,code.revision,code.validFrom,code.validUntil,code.lock.state]])
 const saved = s.readinessRecords.find(r => r.bookingId === arrival.id), current = saved?.baseline === baseline
 const items = [
  ...plan.supplies.map(item => ({ id: 'supply:' + item, label: item })),
  { id: 'access', label: 'Entry and access checked in person' },
  ...blockers.map(t => ({ id: 'maintenance:' + t.id, label: 'Maintenance: ' + t.title })),
  { id: 'inspection', label: 'Inspector acceptance' },
 ].map(item => ({ ...item, attestation: current ? saved.attestations.find(a => a.item === item.id) : undefined }))
 return { baseline, saved, current, plan, items }
}
