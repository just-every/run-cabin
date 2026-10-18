import { type Context, type StoredPhoto, exact, integer, manager, need, newId, property, query, text } from '../model'
import { homeCommand, homeSettings } from '../homes'
import { photoList, storePhotos } from '../photos'

export type PropertyProfile = {
 id: string; revision: string; propertyId: string; buildingName: string; unitName: string
 occupancyLimit: number; amenities: string[]; houseRules: string; emergencyName: string; emergencyPhone: string
 listingIds: { airbnb: string; vrbo: string; 'booking.com': string }; photos: StoredPhoto[]
}

function optional(value: unknown, label: string, max: number) {
 if (value === undefined || value === null || value === '') return ''
 need(typeof value === 'string', `Enter ${label} as text`)
 return value.trim() ? text(value, label, max) : ''
}
function amenities(value: unknown) {
 const lines = typeof value === 'string' ? value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : value
 need(Array.isArray(lines) && lines.length <= 50, 'Enter up to 50 amenities, one per line')
 const result = lines.map(v => text(v, 'amenity', 120))
 need(new Set(result.map(v => v.toLowerCase())).size === result.length, 'List each amenity once')
 return result
}
function removals(value: unknown, previous: StoredPhoto[]) {
 if (value === undefined || value === null || value === '') return []
 const ids = (Array.isArray(value) ? value : [value]).map(v => text(v, 'photo ID', 100))
 need(new Set(ids).size === ids.length && ids.every(id => previous.some(photo => photo.id === id)), 'Choose photos belonging to this property')
 return ids
}

export async function propertyProfileCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'property.profile') return undefined
 manager(c.actor)
 const prop = property(c, p.propertyId), old = c.data.propertyProfiles.find(r => r.propertyId === prop.id)
 if (old) exact(old, p.revision)
 const settings = homeSettings(c, prop.id)
 const listing = p.listingIds
 need(listing === undefined || (listing !== null && typeof listing === 'object' && !Array.isArray(listing)), 'Enter listing IDs as an object')
 const ids = listing as Record<string, unknown> | undefined
 const listingId = (channel: keyof PropertyProfile['listingIds'], field: string) => optional(ids?.[channel] ?? p[field] ?? old?.listingIds[channel], `${channel} listing ID`, 120)
 const emergencyName = optional(p.emergencyName ?? old?.emergencyName, 'emergency contact name', 160)
 const emergencyPhone = optional(p.emergencyPhone ?? old?.emergencyPhone, 'emergency contact phone', 40)
 need(Boolean(emergencyName) === Boolean(emergencyPhone), 'Enter both the emergency contact name and phone, or leave both blank')
 need(!emergencyPhone || (/^[+\d\s().-]+$/.test(emergencyPhone) && emergencyPhone.replace(/\D/g, '').length >= 7 && emergencyPhone.replace(/\D/g, '').length <= 15), 'Enter an emergency phone with 7 to 15 digits')
 const previousPhotos = old?.photos ?? [], removeIds = removals(p.removePhotoIds, previousPhotos)
 const retained = previousPhotos.filter(photo => !removeIds.includes(photo.id)), uploads = photoList(p, 0, 12)
 need(retained.length + uploads.length <= 12, 'Keep at most 12 property photos; remove an existing photo before adding more')
 const row: PropertyProfile = {
  id: old?.id ?? newId(), revision: newId(), propertyId: prop.id,
  buildingName: optional(p.buildingName ?? old?.buildingName, 'building name', 160),
  unitName: optional(p.unitName ?? old?.unitName, 'unit name', 160),
  occupancyLimit: integer(Number(p.occupancyLimit ?? old?.occupancyLimit), 'Occupancy limit', 1, 100),
  amenities: amenities(p.amenities ?? old?.amenities ?? []),
  houseRules: optional(p.houseRules ?? old?.houseRules, 'house rules', 5000),
  emergencyName, emergencyPhone,
  listingIds: { airbnb: listingId('airbnb', 'airbnbListingId'), vrbo: listingId('vrbo', 'vrboListingId'), 'booking.com': listingId('booking.com', 'bookingListingId') },
  photos: retained,
 }
 // The operations command remains the authority for time, address and checklist rules.
 // Its revision is independent of the profile revision and every unrelated setting stays intact.
 await homeCommand(c, 'home.settings', {
  ...settings, propertyId: prop.id, revision: p.homeRevision,
  address: p.address ?? settings.address, timeZone: p.timeZone ?? settings.timeZone,
  checkInTime: p.checkInTime ?? settings.checkInTime, checkOutTime: p.checkOutTime ?? settings.checkOutTime,
 })
 row.photos.push(...await storePhotos(c, row.id, uploads, `Property: ${prop.name}`, previousPhotos.map(photo => photo.id)))
 for (const id of removeIds) c.queries.push(query('DELETE FROM cb_photos WHERE id=? AND turnover_id=?', id, row.id))
 if (old) Object.assign(old, row); else c.data.propertyProfiles.push(row)
 c.entityId = row.id
 return row
}
