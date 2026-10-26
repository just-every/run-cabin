import type { Booking } from './model'
import type { PropertyProfile } from './properties/profile'
/** Unit IDs name physical rooms, never a transitive listing group. */
export type Capacity = { propertyProfiles?: Pick<PropertyProfile, 'propertyId' | 'inventoryUnits' | 'revision'>[] }
export const units = (data: Capacity, propertyId: string): string[] => data.propertyProfiles?.find(p => p.propertyId === propertyId)?.inventoryUnits ?? [propertyId]
export function sharesCapacity(data: Capacity, a: string, b: string) {
 return a === b || units(data, a).some(id => units(data, b).includes(id))
}
export function capacityBookings(data: Capacity & { bookings: Booking[] }, propertyId: string) {
 return data.bookings.filter(b => b.status === 'confirmed' && sharesCapacity(data, b.propertyId, propertyId))
}
