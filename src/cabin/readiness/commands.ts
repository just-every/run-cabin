import { type Context, manager, text, need, newId, property } from '../model'
import { homeReadiness } from '../readiness'
import { arrivalChecks, readinessPlan, type ReadinessRecord } from './records'
const actorName = (c: Context) => c.data.members.find(m => m.id === c.actor.memberId)?.name ?? c.actor.email
export function readinessCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (!name.startsWith('readiness.')) return undefined
 manager(c.actor)
 if (name === 'readiness.plan') {
  const home = property(c,p.propertyId), old = readinessPlan(c.data,home.id)
  need(p.revision === old.revision,'Readiness requirements changed. Reload before saving.',409)
  const raw = typeof p.supplies === 'string' ? p.supplies.split(/\r?\n/).filter(s => s.trim()) : p.supplies
  need(Array.isArray(raw) && raw.length > 0 && raw.length <= 30,'Enter 1 to 30 supply items')
  const supplies = raw.map(item => text(item,'supply item',100)); need(new Set(supplies).size === supplies.length,'Supply items must be unique')
  const inspectorId = text(p.inspectorId,'inspector')
  need(inspectorId === 'owner' || c.data.members.some(m => m.id === inspectorId && m.role === 'manager' && m.active),'Choose the owner or an active manager as inspector')
  const row = { id: old.id || newId(), revision: newId(), propertyId: home.id, supplies, inspectorId }
  if (old.id) Object.assign(old,row); else c.data.readinessPlans.push(row)
  c.entityId = row.id; return row
 }
 const booking = c.data.bookings.find(b => b.id === text(p.bookingId,'arrival') && b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay')
 need(booking,'Arrival not found',404)
 const home = property(c,booking.propertyId), r = homeReadiness(c.data,home,booking.start.slice(0,10),Date.parse(c.now))
 need(r.arrival?.id === booking.id,'Another arrival comes first. Open that arrival before attesting.',409)
 const info = arrivalChecks(c.data,booking,r.turnover,r.blockers,r.guestCode)
 need(p.baseline === info.baseline && p.revision === (info.saved?.revision ?? ''),'Arrival evidence changed. Reload and review before continuing.',409)
 let row = info.saved
 if (!row) { row = { id:newId(), revision:newId(), propertyId:home.id, bookingId:booking.id, baseline:info.baseline, attestations:[], chases:[] }; c.data.readinessRecords.push(row) }
 if (row.attestations.length) row.history = [...row.history ?? [], { baseline:row.baseline, attestations:structuredClone(row.attestations) }]
 if (!info.current) { row.baseline = info.baseline; row.attestations = [] }
 if (name === 'readiness.chase') {
  need(r.state !== 'ready','This arrival is already ready',409)
  row.chases.push({ by:c.actor.id, name:actorName(c), at:c.now, note:text(p.note,'follow-up and responsible person',1000) })
 } else {
  need(name === 'readiness.attest','Unknown readiness command',404)
  const item = text(p.item,'readiness item'); need(info.items.some(i => i.id === item),'Readiness item changed',409)
  const status = text(p.status,'outcome'); need(['passed','failed','excepted'].includes(status),'Choose a readiness outcome')
  if (item === 'inspection' && status === 'passed') {
   need(info.plan.inspectorId === 'owner' ? c.actor.role === 'owner' : c.actor.memberId === info.plan.inspectorId,'Only the named inspector may accept this arrival',403)
   need(!r.reasons.some(reason => !reason.startsWith('Inspector acceptance')),'Resolve cleaning, maintenance, supplies and access before inspection',409)
  }
  need(!item.startsWith('maintenance:') || status !== 'passed','Close the maintenance task with its evidence, or record an explicit exception')
  if (status === 'passed') need(r.turnover?.status === 'completed','Complete the cleaning before attesting physical readiness',409)
  const attestation = { item, status:status as 'passed'|'failed'|'excepted', note:text(p.note,'physical evidence or exception reason',1000), guestImpact:status === 'excepted' ? text(p.guestImpact,'guest impact and agreed mitigation',1000) : '', by:c.actor.id, name:actorName(c), at:c.now }
  row.attestations = row.attestations.filter(a => a.item !== item && (item === 'inspection' || a.item !== 'inspection'))
  row.attestations.push(attestation)
 }
 row.revision = newId(); c.entityId = row.id; return row as ReadinessRecord
}
