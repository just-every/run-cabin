import type { Booking, Data } from '../model'
import { homeSettings } from '../homes'
import { between, when } from '../clock'
// The facts a guest message is written from, filled in when it is sent so a
// moved stay or a new door code is always current. The door code is the
// guest's own code for this stay (codes.ts), never a cleaner's.
export type Facts = Record<'guest' | 'home' | 'checkin' | 'checkout' | 'address' | 'code' | 'stay_link', string>
/** With no origin the stay link is its path alone: what statement() compares. */
export function facts(data: Pick<Data, 'properties' | 'homeSettings' | 'codes'>, origin: string | null, b: Booking): Facts {
 const s = homeSettings({ data }, b.propertyId), code = data.codes.find(r => r.bookingId === b.id && r.holder === 'guest' && r.status === 'issued')
 const first = `${b.start.slice(0, 10)}T${b.arrivalTime ?? s.checkInTime}`, last = `${b.end.slice(0, 10)}T${s.checkOutTime}`
 return {
  guest: (b.guestName ?? '').split(/\s+/)[0] || 'there',
  home: data.properties.find(p => p.id === b.propertyId)?.name ?? 'the home',
  checkin: `${when(first)} (${s.timeZone.split('/').pop()!.replace(/_/g, ' ')} time)`,
  checkout: when(last),
  address: s.address || 'your host will send the address',
  code: code ? `${code.code} (works ${between(code.validFrom, code.validUntil)})` : 'your host will send it before you arrive',
  stay_link: code?.link ? (origin ? new URL(`/stay/${code.link}`, origin).href : `/stay/${code.link}`) : 'your host will send it',
 }
}
export const fill = (template: string, f: Facts) => template.replace(/\{(guest|home|checkin|checkout|address|code|stay_link)\}/g, (_, k: keyof Facts) => f[k])
/** What a scheduled message tells the guest, subject and body, so a change of stay or settings re-sends it only when this changes. */
export const statement = (data: Pick<Data, 'properties' | 'homeSettings' | 'codes'>, b: Booking, set: { subject: string; template: string }) => fill(`${set.subject}\n${set.template}`, facts(data, null, b))
