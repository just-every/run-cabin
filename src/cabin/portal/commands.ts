import { type Context, integer, manager, need, newId, property, text } from '../model'
import { homeSettings } from '../homes'
import type { GuestGuide } from './types'
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
const optional = (value: unknown, label: string) => value === undefined || value === null || value === '' ? '' : text(value, label, 12000)
export async function portalCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'portal.guide') {
  manager(c.actor); const prop = property(c, p.propertyId), settings = c.data.homeSettings.find(s => s.propertyId === prop.id)
  need(settings, 'Save this home’s turnover settings first', 409)
  const current = settings.guide, version = integer(Number(p.version ?? 0), 'guide version', 0)
  need(version === (current?.version ?? 0), 'This guide changed. Reload before saving.', 409)
  const arrival = text(p.arrival, 'arrival instructions', 12000), guidebook = optional(p.guidebook, 'guidebook')
  c.entityId = prop.id
  if (current && current.arrival === arrival && current.guidebook === guidebook) return current
  const guide: GuestGuide = { version: (current?.version ?? 0) + 1, arrival, guidebook, updatedAt: c.now, updatedBy: c.actor.id }
  settings.guide = guide; return guide
 }
 if (name === 'portal.link.rotate') {
  manager(c.actor); const booking = c.data.bookings.find(b => b.id === text(p.bookingId, 'reservation ID'))
  need(booking, 'Reservation not found', 404)
  const code = c.data.codes.find(r => r.bookingId === booking.id && r.holder === 'guest' && r.status === 'issued' && r.link)
  need(code, 'This reservation has no active guest link', 409)
  homeSettings(c, booking.propertyId); code.link = token(); code.revision = newId(); c.entityId = booking.id
  return { bookingId: booking.id, replaced: true }
 }
 return undefined
}
