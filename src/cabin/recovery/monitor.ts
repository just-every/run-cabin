import { type Context, type Data, need, text } from '../model'
import { overlaps, channelName } from '../inventory'
import { liveTurnover } from '../dispatch'
import { openCase, note } from './cases'
import type { Recovery } from './types'

/** Conflicts are actual held inventory, including blocks; a declined request is never a booking. */
export function recoveryConflicts(data: Data, bookingId: string) {
 const b = data.bookings.find(b => b.id === bookingId)
 return b?.status === 'confirmed' ? data.bookings.filter(other => other.id !== b.id && other.propertyId === b.propertyId && other.status === 'confirmed' && overlaps(other, b)) : []
}
export function synchronizeRecoveryCollisions(c: Context) {
 for (const b of c.data.bookings) {
  if (b.restorePaused || b.guestErasedAt || b.status !== 'confirmed' || (b.kind ?? 'stay') !== 'stay' || b.end.slice(0,10) < c.now.slice(0,10)) continue
  const collisions = recoveryConflicts(c.data, b.id)
  if (!collisions.length) continue
  const t = c.data.turnovers.find(t => t.nextBookingId === b.id && !['cancelled','draft'].includes(t.status)) ?? liveTurnover(c, b.id)
  if (!t) continue
  const signature = JSON.stringify(collisions.map(o => [o.id,o.revision]).sort())
  const current = c.data.recoveries.find(r => r.bookingId === b.id && !r.issue && !['closed','undone'].includes(r.status))
  if (current?.collisionRevision === signature) continue
  const row = current ?? openCase(c,b,t,'reservation_conflict',`Confirmed inventory conflicts with ${collisions.map(o => channelName(o.channel)+' '+o.start.slice(0,10)+' to '+o.end.slice(0,10)).join(', ')}. Review both sources before promising readiness.`)
  row.collisionRevision = signature
  if (current) note(c,row,'Inventory conflict detected','A confirmed stay or block now overlaps this reservation. Reconcile the sources or approve available alternative inventory.')
 }
}
export function recoveryUnresolved(data: Data, row: Recovery) {
 const b = data.bookings.find(b => b.id === row.bookingId)
 const reasons: string[] = []
 if (!b || b.status !== 'confirmed') return ['The reservation is no longer confirmed']
 if (recoveryConflicts(data,b.id).length) reasons.push('Confirmed inventory still overlaps this stay')
 if (b.lifecycle?.sourceReview || b.lifecycle?.sourceConflict) reasons.push('The channel source revision still needs reconciliation')
 const previous = row.previous?.code
 if (previous) {
  const old = data.codes.find(code => code.id === previous.id)
  if (old?.lock.providerId && old.lock.state !== 'removed') reasons.push('The previous lock code has not been confirmed removed')
 }
 if (data.recoveries.some(other => other.id !== row.id && other.bookingId === row.bookingId && other.issue && !['closed','undone'].includes(other.status))) reasons.push('A guest service problem still needs field and guest confirmation')
 return reasons
}
/** A later observation binds the same field evidence, guest response, access and frozen balance. */
export function recoveryCheckBaseline(data: Data, row: Recovery) {
 const b=data.bookings.find(b=>b.id===row.bookingId),t=data.turnovers.find(t=>t.id===row.turnoverId),code=data.codes.find(code=>code.id===row.codeId),statement=data.statements.find(s=>s.id===row.statementId)
 return JSON.stringify([b?.id,b?.revision,b?.propertyId,t?.revision,t?.completion,row.acceptedAt,code&&[code.id,code.revision,code.lock.state],data.readinessRecords.find(r=>r.bookingId===b?.id),statement&&[statement.id,statement.revision,statement.netCents],row.guestConfirmedAt,recoveryUnresolved(data,row)])
}
export function confirmRecurrence(c: Context, row: Recovery, input: Record<string,unknown>) {
 need(row.status==='ready' && row.guestConfirmedAt,'Obtain the guest’s confirmation after verified readiness before the follow-up check',409)
 const reasons=recoveryUnresolved(c.data,row)
 need(!reasons.length,reasons.join('; '),409)
 need(input.confirm==='yes','Confirm you checked the guest thread, current access, field evidence and owner balance')
 row.recurrence={at:c.now,by:c.actor.id,reference:text(input.reference,'follow-up evidence reference',300),note:text(input.note,'what the follow-up established',1000),baseline:recoveryCheckBaseline(c.data,row)}
 note(c,row,'Follow-up verified',row.recurrence.note)
 return row
}
