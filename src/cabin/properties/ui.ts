import { h, form, hidden, manager } from '../ui/shared'
import { choose, photos } from '../ui/ops'
import { homeSettings } from '../homes'
import { ZONES } from '../clock'

const input = (name: string, label: string, value: unknown, attrs = '') => `<label>${h(label)}<input name="${h(name)}" value="${h(value)}" ${attrs}></label>`
const area = (name: string, label: string, value: unknown, max: number) => `<label>${h(label)}<textarea name="${h(name)}" rows="3" maxlength="${max}">${h(value)}</textarea></label>`

export function propertyEditor(s: any, p: any): string {
 if (!manager(s)) return ''
 const profile = s.propertyProfiles.find((r: any) => r.propertyId === p.id), home = homeSettings(s, p.id)
 const currentPhotos = profile?.photos ?? [], listingIds = profile?.listingIds
 const body = hidden('propertyId', p.id) + hidden('revision', profile?.revision ?? '') + hidden('homeRevision', home.revision)
  + '<p class="muted">Each listing has its own calendar. Assign the physical rooms it consumes; a whole home consumes every room selected. Leave empty for an independent unit. Interchangeable rooms require an explicit assignment before booking.</p>'
  + '<fieldset><legend>Physical rooms used by this listing</legend>' + s.properties.map((unit: any) => `<label class="check"><input type="checkbox" name="inventoryUnits" value="${h(unit.id)}" ${(profile?.inventoryUnits ?? []).includes(unit.id) ? 'checked' : ''}> ${h(unit.name)}</label>`).join('') + hidden('inventoryUnits', '') + '</fieldset>'
  + input('buildingName', 'Building name (optional)', profile?.buildingName ?? '', 'maxlength="160"')
  + input('unitName', 'Unit name or number (optional)', profile?.unitName ?? '', 'maxlength="160"')
  + input('address', 'Property address', home.address, 'required maxlength="300" autocomplete="street-address"')
  + choose('timeZone', 'Property time zone', ZONES, home.timeZone, '', 'required')
  + input('checkInTime', 'Check-in time', home.checkInTime, 'type="time" required')
  + input('checkOutTime', 'Check-out time', home.checkOutTime, 'type="time" required')
  + input('occupancyLimit', 'Maximum guests', profile?.occupancyLimit ?? '', 'type="number" required min="1" max="100" step="1"')
  + area('amenities', 'Amenities (optional, one per line)', profile?.amenities.join('\n') ?? '', 6050)
  + area('houseRules', 'House rules (optional)', profile?.houseRules ?? '', 5000)
  + input('emergencyName', 'Emergency contact name (optional)', profile?.emergencyName ?? '', 'maxlength="160" autocomplete="name"')
  + input('emergencyPhone', 'Emergency contact phone (optional)', profile?.emergencyPhone ?? '', 'type="tel" maxlength="40" autocomplete="tel"')
  + input('airbnbListingId', 'Airbnb listing ID (optional)', listingIds?.airbnb ?? '', 'maxlength="120"')
  + input('vrboListingId', 'Vrbo listing ID (optional)', listingIds?.vrbo ?? '', 'maxlength="120"')
  + input('bookingListingId', 'Booking.com listing ID (optional)', listingIds?.['booking.com'] ?? '', 'maxlength="120"')
  + '<p class="muted">Enter listing identifiers only. Calendar connections are managed under Channels.</p>'
  + photos(currentPhotos, `${p.name} property photo`)
  + currentPhotos.map((photo: any, i: number) => `<label class="check"><input type="checkbox" name="removePhotoIds" value="${h(photo.id)}"> Remove property photo ${i + 1}</label>`).join('')
  + '<label>Property photos (optional)<input name="photoFiles" type="file" accept="image/jpeg,image/png,image/*" multiple data-max="12"></label><p class="muted">Keep up to 12 photos in total. Phone photos are shrunk before upload and stay private to your property team.</p>'
 return `<details><summary>Property details</summary>${form('property.profile', 'people', body, 'Save property details', 'enctype="multipart/form-data" data-photos data-photo-form')}</details>`
}
