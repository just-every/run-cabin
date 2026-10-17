/** Offline schema adapter only. The application upload path accepts CSV, never
 * credentials or a live API. Synthetic response fixtures exercise these shapes. */
import { channel, date, status } from './csv'
import type { Provider, SourceGuest, SourceStay } from './types'

type ObjectValue = Record<string, unknown>
export interface RecordedResponses { listings: unknown; reservations: unknown; guests?: unknown; ownerStatements?: unknown; importedCalendars?: unknown }
export interface RecordedResult {
  listings: { externalId: string; name: string }[]
  guests: SourceGuest[]
  stays: SourceStay[]
  statementEvidence: { externalId: string; ownerId: string; currency: string; endingBalance?: string; dueToOwner?: string; listingIds: string[] }[]
  calendars: { listingId: string; name: string; url: string }[]
  refusals: { externalId: string; reason: string }[]
  warnings: string[]
}
const object = (input: unknown): ObjectValue => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a recorded API object')
  return input as ObjectValue
}
const string = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : ''
const objects = (input: unknown): ObjectValue[] => {
  if (!Array.isArray(input)) throw new Error('Expected a recorded API array')
  return input.map(object)
}
const ownerItems = (input: unknown) => objects(object(input).items || [])
const hostItems = (input: unknown) => {
  const data = object(input)
  if (data.status !== 'success') throw new Error('Recorded Hostaway response must have status success')
  return objects(data.result)
}
const guestyItems = (input: unknown) => Array.isArray(input) ? objects(input) : objects(object(input).results)
const contact = (items: unknown, field: string) => {
  const records = items === undefined ? [] : objects(items)
  return string((records.find(row => row.is_default === true) || records[0] || {})[field])
}

export function adaptRecordedApi(provider: Provider, input: RecordedResponses): RecordedResult {
  const out: RecordedResult = { listings: [], guests: [], stays: [], statementEvidence: [], calendars: [], refusals: [], warnings: ['Offline recorded-response fixture validation only; no API account was contacted. Owner agreements, opening balances and retained channel links still require a reconciled Cabin cutover file.'] }
  if (!['guesty', 'hostaway', 'ownerrez'].includes(provider)) throw new Error('Unsupported provider')
  const listingRows = provider === 'ownerrez' ? ownerItems(input.listings) : provider === 'hostaway' ? hostItems(input.listings) : guestyItems(input.listings)
  for (const row of listingRows) {
    const id = string(provider === 'guesty' ? row._id : row.id)
    const name = string(provider === 'guesty' ? row.nickname || row.title : row.name)
    if (!id || !name) throw new Error('Recorded listing needs documented id/name fields')
    out.listings.push({ externalId: id, name })
  }
  const guestRows = input.guests === undefined ? [] : provider === 'ownerrez' ? ownerItems(input.guests) : provider === 'guesty' ? (Array.isArray(input.guests) ? objects(input.guests) : [object(input.guests)]) : []
  for (const row of guestRows) {
    const id = string(provider === 'guesty' ? row._id : row.id)
    const name = provider === 'guesty' ? string(row.fullName) || [string(row.firstName), string(row.lastName)].filter(Boolean).join(' ') : [string(row.first_name), string(row.last_name)].filter(Boolean).join(' ')
    if (!id || !name) throw new Error('Recorded guest needs its native ID and name')
    out.guests.push({ externalId: id, name, email: provider === 'guesty' ? string(row.email) : contact(row.email_addresses, 'address'), phone: provider === 'guesty' ? string(row.phone) : contact(row.phones, 'number') })
  }
  const stays = provider === 'ownerrez' ? ownerItems(input.reservations) : provider === 'hostaway' ? hostItems(input.reservations) : guestyItems(input.reservations)
  for (const row of stays) {
    const id = string(provider === 'guesty' ? row.reservationId : row.id)
    let listingId = '', guestId = '', start = '', end = '', source = '', channelRef = ''
    const normalizedStatus = status(string(row.status))
    if (provider === 'ownerrez') {
      if (row.type !== 'booking') { out.refusals.push({ externalId: id, reason: 'Owner stays, blocks, linked availability and quote holds need separate handling' }); continue }
      listingId = string(row.property_id); guestId = string(row.guest_id); start = string(row.arrival); end = string(row.departure); source = string(row.listing_site); channelRef = string(row.platform_reservation_number)
    } else if (provider === 'hostaway') {
      listingId = string(row.listingMapId); start = string(row.arrivalDate); end = string(row.departureDate); source = string(row.channelName); channelRef = string(row.channelReservationId)
      guestId = `reservation:${id}:guest`
      if (string(row.guestName)) out.guests.push({ externalId: guestId, name: string(row.guestName), email: string(row.guestEmail), phone: string(row.phone) })
    } else {
      const segments = objects(row.stay)
      if (segments.length !== 1) { out.refusals.push({ externalId: id, reason: 'Multi-segment Guesty stays cannot be flattened to a single home' }); continue }
      listingId = string(segments[0].listingId); guestId = string(row.guestId); start = string(row.checkInDateLocalized); end = string(row.checkOutDateLocalized); source = string(row.source)
      if (row.channelMetadata) channelRef = string(object(row.channelMetadata).externalReservationId)
      if (!channelRef) channelRef = string(row.confirmationCode)
    }
    const normalizedChannel = channel(source)
    if (!id || !listingId || !guestId || !date(start) || !date(end) || end <= start || !normalizedChannel || !normalizedStatus) {
      out.refusals.push({ externalId: id, reason: 'Missing identity, invalid dates, or unsupported channel/status in recorded response' }); continue
    }
    if (!out.guests.some(guest => guest.externalId === guestId)) { out.refusals.push({ externalId: id, reason: 'No recorded guest detail for guest ID' }); continue }
    out.stays.push({ externalId: id, listingId, guestId, start, end, channel: normalizedChannel, status: normalizedStatus, ...(channelRef ? { channelRef } : {}) })
  }
  if (provider === 'guesty' && input.ownerStatements !== undefined) for (const row of guestyItems(input.ownerStatements)) {
    out.statementEvidence.push({ externalId: string(row.id), ownerId: string(row.ownerId), currency: string(row.currency), endingBalance: String(row.endingBalance), dueToOwner: String(row.dueToOwner), listingIds: objects(row.listings).map(listing => string(listing.id)) })
    out.warnings.push('Guesty endingBalance, dueToOwner and minimumAccountBalance have different meanings; owner-level statements are not automatically allocated to listing opening balances.')
  }
  if (provider === 'hostaway' && input.ownerStatements !== undefined) {
    object(object(input.ownerStatements).result)
    out.warnings.push('Hostaway owner statement summaryDataJson contains account-defined formula totals, not a portable owner opening balance.')
  }
  if (provider === 'ownerrez') out.warnings.push('OwnerRez public v2 schema exposes owners but no owner-statement/balance or retained iCal URL endpoint. Use reconciled statement exports and existing calendar URLs.')
  if (provider === 'guesty' && input.importedCalendars !== undefined) for (const row of objects(input.importedCalendars)) {
    // Names are user-defined. Preserve as evidence; do not infer channel from name.
    out.calendars.push({ listingId: string(row.listingId), name: string(row.name), url: string(row.url) })
  }
  for (const data of [input.listings, input.reservations, input.guests]) if (data && !Array.isArray(data)) {
    const page = object(data)
    if (page.next_page_url || (page.pagination && object(page.pagination).hasMore === true)) out.warnings.push('Recorded fixture is one page of a paginated source; it does not prove a complete account export.')
  }
  return out
}
