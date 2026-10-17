import { key, value } from './csv'
import type { NativeHome, NativeStay, Provider, Table } from './types'

export function nativeRows(provider: Provider, table: Table): { homes: NativeHome[]; stays: NativeStay[]; kind: string } {
  const columns = new Set(table.columns.map(key))
  const has = (...names: string[]) => names.every(name => columns.has(key(name)))
  if (provider === 'guesty' && has('Listing ID') && !has('Confirmation code')) {
    if (!['Nickname', "Listing's nickname", 'Title', "Listing's title"].some(name => columns.has(key(name)))) throw new Error('Guesty properties report needs Listing ID and Nickname or Title')
    return { kind: 'Guesty properties report', stays: [], homes: table.rows.map(({ values: r, location }) => ({ id: value(r, 'Listing ID'), name: value(r, 'Nickname', "Listing's nickname", 'Title', "Listing's title"), location })) }
  }
  const signature = provider === 'guesty' ? ['Confirmation code', 'Listing ID']
    : provider === 'hostaway' ? ['Reservation ID', 'Listing name', 'Arrival date', 'Departure date']
      : ['Booking #', 'Property', 'Arrival', 'Departure']
  if (!has(...signature)) throw new Error(`Unrecognized ${provider} report. Required columns: ${signature.join(', ')}`)
  return { homes: [], kind: provider === 'hostaway' ? 'Hostaway Rental Activity reservations report' : provider === 'ownerrez' ? 'OwnerRez Date Range stay report' : 'Guesty reservations report', stays: table.rows.map(({ values: r, location, error }) => {
    if (provider === 'guesty') return {
      id: value(r, 'Reservation ID', 'Confirmation code'), listingId: value(r, 'Listing ID'), listingName: value(r, "Listing's nickname", "Listing's title"), guestId: '',
      guestName: value(r, "Guest's name"), email: value(r, "Guest's email"), phone: value(r, "Guest's phone"),
      start: value(r, 'Check-in', 'Check-in date'), end: value(r, 'Check-out', 'Check-out date'), channel: value(r, 'Source', 'Channel', 'Integration'), status: value(r, 'Status'), channelRef: value(r, 'Confirmation code'), location, error,
    }
    if (provider === 'hostaway') return {
      id: value(r, 'Reservation ID'), listingId: '', listingName: value(r, 'Listing name'), guestId: '', guestName: value(r, 'Guest name'), email: '', phone: '',
      start: value(r, 'Arrival date'), end: value(r, 'Departure date'), channel: value(r, 'Channel name'), status: value(r, 'Reservation status'), channelRef: '', location, error,
    }
    return {
      id: value(r, 'Booking #'), listingId: '', listingName: value(r, 'Property'), guestId: '', guestName: value(r, 'Guest'), email: value(r, 'Email'), phone: value(r, 'Phone'),
      start: value(r, 'Arrival'), end: value(r, 'Departure'), channel: '', status: '', channelRef: '', location, error,
    }
  }) }
}
