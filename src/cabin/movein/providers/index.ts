import { channel, date, emailValid, nights, parseCsv, status, value } from './csv'
import { isCutover, readCutover } from './cutover'
import { nativeRows } from './native'
import type { NativeHome, NativeStay, Normalized, Provider, Table, Upload } from './types'
export type { Location, Normalized, Provider, Refusal, SourceBalance, SourceGuest, SourceHome, SourceStay, Upload } from './types'

export function normalizeProvider(provider: unknown, files: unknown, asOf: unknown): Normalized {
  if (provider !== 'guesty' && provider !== 'hostaway' && provider !== 'ownerrez') throw new Error('Choose Guesty, Hostaway or OwnerRez')
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !date(asOf)) throw new Error('Cutover date must be a valid YYYY-MM-DD date')
  if (!Array.isArray(files) || !files.length || files.length > 20) throw new Error('Upload 1 to 20 CSV files')
  const uploads: Upload[] = files.map(file => {
    if (!file || typeof file !== 'object' || typeof file.name !== 'string' || typeof file.text !== 'string' || !file.name || file.name.length > 200) throw new Error('Each file needs a name and text')
    return { name: file.name, text: file.text }
  })
  if (new Set(uploads.map(file => file.name)).size !== uploads.length) throw new Error('File names must be unique')
  if (uploads.reduce((sum, file) => sum + new TextEncoder().encode(file.text).length, 0) > 2 * 1024 * 1024) throw new Error('Move-in uploads must total at most 2 MB')
  const out: Normalized = { provider, homes: [], guests: [], stays: [], balances: [], refusals: [], warnings: ['This profile imports listing identities, reservation dates and guest contacts, owner terms, opening USD balances and retained iCal links only. Prices, payments, threads, attachments, rules, tasks and historical statements need separate exports or later adapters.'], mappings: [], sourceTotals: { reservations: 0, futureNights: 0, ownerBalanceCents: 0 }, asOf }
  const tables: Table[] = []
  for (const file of uploads) {
    try {
      if (!/\.(csv|tsv)$/i.test(file.name)) throw new Error('Upload CSV/TSV exports; API JSON is supported only by the offline recorded-fixture adapter')
      tables.push(parseCsv(file))
    } catch (error) { out.refusals.push({ file: file.name, row: 1, kind: 'file', reason: error instanceof Error ? error.message : 'Unreadable CSV' }) }
  }
  if (tables.reduce((sum, table) => sum + table.rows.length, 0) > 500) throw new Error('Initial move-in supports at most 500 source rows across all files')
  const supplemental = readCutover(provider, tables.filter(table => isCutover(table.name)), out)
  const nativeHomes: NativeHome[] = [], nativeStays: NativeStay[] = []
  for (const table of tables.filter(table => !isCutover(table.name))) {
    try {
      const native = nativeRows(provider, table)
      nativeHomes.push(...native.homes); nativeStays.push(...native.stays)
      out.mappings.push({ file: table.name, kind: native.kind, columns: table.columns })
    } catch (error) { out.refusals.push({ file: table.name, row: 1, kind: 'file', reason: error instanceof Error ? error.message : 'Unrecognized report' }) }
  }
  if (supplemental.homes.size > 100) throw new Error('Initial move-in supports at most 100 homes')
  const named = new Map<string, string[]>()
  for (const home of supplemental.homes.values()) named.set(home.name, [...(named.get(home.name) || []), home.externalId])
  const sourceHomes = new Map<string, NativeHome>()
  const refuse = (item: NativeStay | NativeHome, kind: string, reason: string) => out.refusals.push({ ...item.location, kind, reason, ...(item.id ? { externalId: item.id } : {}) })
  for (const home of nativeHomes) {
    if (!home.id || home.id.length > 100 || !home.name || home.name.length > 160) { refuse(home, 'home', 'Native listing needs its ID (at most 100 characters) and name (at most 160 characters)'); continue }
    sourceHomes.set(home.id, home)
  }
  for (const stay of nativeStays) {
    if (!stay.listingId) {
      const matches = named.get(stay.listingName) || []
      if (matches.length === 1) stay.listingId = matches[0]
    }
    if (stay.listingId && !sourceHomes.has(stay.listingId)) sourceHomes.set(stay.listingId, { id: stay.listingId, name: stay.listingName, location: stay.location })
  }
  // Vacant properties can be supplied explicitly in the cutover inventory.
  for (const home of supplemental.homes.values()) {
    const native = sourceHomes.get(home.externalId)
    out.homes.push({ ...home, ...(native?.name ? { name: native.name, location: native.location } : {}) })
  }
  for (const home of sourceHomes.values()) if (!supplemental.homes.has(home.id)) refuse(home, 'home', 'Missing owner terms: supply a home row in cabin-cutover CSV')
  if (out.homes.length > 100 || sourceHomes.size > 100) throw new Error('Initial move-in supports at most 100 homes')
  out.balances = supplemental.balances
  const usedSupplements = new Set<string>()
  for (const stay of nativeStays) {
    out.sourceTotals.reservations++
    const extra = supplemental.reservations.get(stay.id)
    if (extra) usedSupplements.add(stay.id)
    const r = extra?.values || {}
    const sourceStatus = stay.status || value(r, 'Status'), sourceChannel = stay.channel || value(r, 'Channel')
    const normalizedStatus = status(sourceStatus), normalizedChannel = channel(sourceChannel)
    const start = date(stay.start), end = date(stay.end)
    if (normalizedStatus === 'confirmed' && start && end && end > start) out.sourceTotals.futureNights += nights(start, end, asOf)
    if (stay.error) { refuse(stay, 'reservation', stay.error); continue }
    if (!stay.id || stay.id.length > 100 || stay.listingId.length > 100) { refuse(stay, 'reservation', 'Reservation and listing IDs must be nonempty and at most 100 characters'); continue }
    if (!start || !end || end <= start) { refuse(stay, 'reservation', 'Stay dates must be valid YYYY-MM-DD or US MM/DD/YYYY dates, with departure after arrival'); continue }
    if (!normalizedStatus) { refuse(stay, 'reservation', 'Missing or unsupported reservation status; pending holds, owner stays, and blocks need separate handling'); continue }
    if (!normalizedChannel) { refuse(stay, 'reservation', 'Missing or unsupported channel; provide an explicit supported Channel in a cutover reservation row when absent from the report'); continue }
    if (extra && ((value(r, 'Status') && status(value(r, 'Status')) !== normalizedStatus) || (value(r, 'Channel') && channel(value(r, 'Channel')) !== normalizedChannel))) {
      refuse(stay, 'reservation', 'Supplemental channel/status conflicts with native reservation'); continue
    }
    if (!stay.listingId) { refuse(stay, 'reservation', 'Listing name must match exactly one cutover home or export its native Listing ID'); continue }
    if (!stay.guestName || stay.guestName.length > 160 || stay.guestName === 'Blocked-Off Time') { refuse(stay, 'reservation', 'Guest name is missing, longer than 160 characters, or this row is blocked-off time'); continue }
    if (stay.email.length > 254 || (stay.email && !emailValid(stay.email)) || stay.phone.length > 80) { refuse(stay, 'guest', 'Guest email is invalid/too long or phone exceeds 80 characters'); continue }
    // Report exports do not guarantee native guest IDs. Preserve one contact per
    // source reservation instead of claiming that matching names identify a person.
    const guestId = stay.guestId || `reservation:${stay.id}:guest`
    out.guests.push({ externalId: guestId, name: stay.guestName, email: stay.email, phone: stay.phone, location: stay.location })
    const channelRef = stay.channelRef || value(r, 'Channel reference'), icalUid = value(r, 'iCal UID')
    out.stays.push({ externalId: stay.id, listingId: stay.listingId, guestId, start, end, channel: normalizedChannel, status: normalizedStatus,
      ...(channelRef ? { channelRef } : {}), ...(icalUid ? { icalUid } : {}), location: stay.location })
  }
  for (const [id, row] of supplemental.reservations) if (!usedSupplements.has(id)) out.refusals.push({ ...row.location, kind: 'reservation', externalId: id, reason: 'Supplemental Reservation ID has no matching native report row' })
  if (!nativeStays.length) out.warnings.push('No native reservation rows were found. Export the full future date range, including cancellations, and check the source reservation count.')
  if (!out.balances.length) out.warnings.push('No opening owner balances were supplied. Add explicit USD balance rows, including zero balances, reconciled to owner statements at cutover.')
  if (out.homes.some(home => !home.links.length)) out.warnings.push('Some homes have no retained channel iCal links. Provide each existing channel export URL in the Cabin cutover file.')
  if (provider === 'hostaway') out.warnings.push('Rental Activity does not include guest email/phone or native listing IDs. Homes match exact listing names; guest contact details remain empty where absent.')
  if (provider === 'ownerrez') out.warnings.push('Date Range Stay report lacks channel/status. Each reservation needs verified Channel and Status in the Cabin cutover file; blocks and pending holds are not imported as confirmed stays.')
  if (provider === 'guesty') out.warnings.push('Guesty reservations reports exclude owner stays. Export properties separately to include vacant homes; owner stays require separate handling.')
  return out
}
