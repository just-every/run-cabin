import { type Context, need, text, exact, newId, property } from '../model'
import { homeSettings } from '../homes'
import { homeReadiness } from '../readiness'
import { instant, time12 } from '../clock'
/** Exact human authority changes access and its guest reply in one serialized commit. */
export function arrivalCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'message.arrival.approve') return undefined
 const b = c.data.bookings.find(b => b.id === text(p.bookingId, 'reservation'))
 need(b && b.status === 'confirmed' && (b.kind ?? 'stay') === 'stay' && !b.guestErasedAt, 'Confirmed stay not found', 404)
 exact(b, p.bookingRevision)
 const home = property(c, b.propertyId), settings = homeSettings(c, b.propertyId)
 const m = c.data.messages.find(m => m.id === text(p.messageId, 'guest message') && m.bookingId === b.id && m.direction === 'in')
 need(m, 'Choose the guest message for this stay', 404)
 const time = text(p.arrivalTime, 'approved arrival time', 5)
 need(/^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time < (b.arrivalTime ?? settings.checkInTime), 'Choose an earlier check-in time')
 const start = `${b.start.slice(0, 10)}T${time}`
 need(instant(start, settings.timeZone) > Date.parse(c.now), 'The new check-in must still be ahead', 409)
 const readiness = homeReadiness(c.data, home, b.start.slice(0, 10))
 need(readiness.arrival?.id === b.id && readiness.state === 'ready', `Early check-in needs verified readiness: ${readiness.reasons.join('; ') || 'another arrival comes first'}`, 409)
 need(!readiness.turnover?.completion || Date.parse(readiness.turnover.completion.completedAt) <= instant(start, settings.timeZone), 'Cleaning finishes after this arrival', 409)
 need(p.confirm === true || p.confirm === 'on', 'Confirm the home and keypad can be ready for the new time')
 const approval = { id: newId(), kind: 'early-arrival', recordId: b.id, revision: b.revision, actorId: c.actor.id, at: c.now }
 c.data.approvals.push(approval)
 b.arrivalTime = time; b.revision = newId()
 for (const d of c.data.messages) if (d.replyTo === m.id && ['draft', 'drafting'].includes(d.status)) { d.status = 'discarded'; d.revision = newId() }
 const reply = { ...m, id: newId(), revision: newId(), direction: 'out' as const, source: 'host' as const, status: 'pending' as const, text: `Your early check-in at ${time12(time)} is approved. Your door code starts at ${time12(time)} (${settings.timeZone} time).`, subject: `Early check-in approved at ${home.name}`, replyTo: m.id, headerId: null, sentBy: c.actor.id, approvalId: approval.id, scheduledId: null, providerId: null, grounds: ['approved arrival time', 'verified readiness'], createdAt: c.now, sentAt: null, detail: null, control: undefined }
 c.data.messages.push(reply); c.entityId = b.id
 return { bookingId: b.id, arrivalTime: time, messageId: reply.id }
}
