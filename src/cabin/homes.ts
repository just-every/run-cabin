import { type Context, type HomeSettings, need, text, integer, newId, manager, property } from './model'
import { ZONES } from './clock'
// What each home's turnovers need: the address the cleaner drives to, check-in
// and check-out times in the home's own time zone, the default cleaner and
// maintenance person, the checklist, how many photos make it ready, and the
// smart-lock device its door codes go to once a lock account is connected.
export const DEFAULT_CHECKLIST = ['Strip and make every bed', 'Clean kitchen and bathrooms', 'Restock coffee, paper goods and toiletries', 'Check doors and windows are locked']
/** From a command's context or a page's state. */
export const homeSettings = (from: { data: { homeSettings: HomeSettings[] } } | { homeSettings: HomeSettings[] }, propertyId: string): HomeSettings => ('data' in from ? from.data : from).homeSettings.find(s => s.propertyId === propertyId) ?? { id: propertyId, revision: '', propertyId, address: '', timeZone: 'America/New_York', checkInTime: '16:00', checkOutTime: '10:00', cleanerId: null, maintenanceId: null, checklist: DEFAULT_CHECKLIST, photosRequired: 1, lockDeviceId: null }
const clock = (value: unknown, label: string) => { const v = text(value, label, 5); need(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), `Enter the ${label} as HH:MM`); return v }
export function checklist(value: unknown) { need(Array.isArray(value) && value.length > 0 && value.length <= 50, 'Use a checklist of 1 to 50 items'); const items = value.map(v => text(v, 'checklist item', 250)); need(new Set(items).size === items.length, 'Checklist items must be unique'); return items }
const optionalId = (value: unknown) => value === undefined || value === null || value === '' ? null : text(value, 'member ID')
export async function homeCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'home.settings') return undefined
 manager(c.actor); const prop = property(c, p.propertyId), old = c.data.homeSettings.find(s => s.propertyId === prop.id)
 if (old) need(p.revision === old.revision, 'These settings changed. Reload before saving.', 409)
 const timeZone = text(p.timeZone ?? 'America/New_York', 'time zone', 40); need(ZONES.some(([z]) => z === timeZone), 'Choose a US time zone')
 const cleanerId = optionalId(p.cleanerId), maintenanceId = optionalId(p.maintenanceId)
 need(!cleanerId || c.data.members.some(m => m.id === cleanerId && m.active && m.role === 'cleaner'), 'Choose an active cleaner')
 need(!maintenanceId || c.data.members.some(m => m.id === maintenanceId && m.active), 'Choose an active person for maintenance')
 const lock = p.lockDeviceId === undefined || p.lockDeviceId === null || String(p.lockDeviceId).trim() === '' ? null : text(p.lockDeviceId, 'lock device ID', 120)
 const row: HomeSettings = { id: prop.id, revision: newId(), propertyId: prop.id, address: text(p.address, 'home address', 300), timeZone, checkInTime: clock(p.checkInTime ?? '16:00', 'check-in time'), checkOutTime: clock(p.checkOutTime ?? '10:00', 'check-out time'), cleanerId, maintenanceId, checklist: checklist(p.checklist), photosRequired: integer(Number(p.photosRequired ?? 1), 'Photos required', 1, 12), lockDeviceId: lock }
 need(row.checkOutTime <= row.checkInTime, 'Check-out must be no later than check-in so a same-day turnover fits')
 if (old) Object.assign(old, row); else c.data.homeSettings.push(row)
 for (const job of c.data.turnovers) {
  if (job.propertyId !== prop.id || job.status === 'completed' || job.status === 'cancelled') continue
  if (JSON.stringify(job.checklist) === JSON.stringify(row.checklist) && job.photosRequired === row.photosRequired) continue
  Object.assign(job, { checklist: [...row.checklist], photosRequired: row.photosRequired, revision: newId() })
  job.history = [...job.history ?? [], { at: c.now, by: c.actor.id, action: 'home checklist and photo requirements updated', cleanerId: job.cleanerId }]
  // Retain the prior assignee/window so their notice is a replacement email.
  if (job.notified) job.notified = { ...job.notified, code: '' }
 }
 c.entityId = prop.id; return row
}
