import { cents, channel, date, emailValid, key, value } from './csv'
import { feedUrl } from '../../channels'
import type { Normalized, Provider, Row, SourceBalance, SourceHome, Table } from './types'

export interface Cutover {
  homes: Map<string, SourceHome>
  reservations: Map<string, Row>
  links: Row[]
  balances: SourceBalance[]
}
export const isCutover = (name: string) => /(?:^|\/)cabin-cutover(?:-[a-z0-9_-]+)?\.(csv|tsv)$/i.test(name)

export function readCutover(provider: Provider, tables: Table[], out: Normalized): Cutover {
  const result: Cutover = { homes: new Map(), reservations: new Map(), links: [], balances: [] }
  const duplicates = new Set<string>()
  const reservationDuplicates = new Set<string>()
  const refuse = (row: Row, kind: string, reason: string, externalId?: string) => out.refusals.push({ ...row.location, kind, reason, ...(externalId ? { externalId } : {}) })
  for (const table of tables) {
    out.mappings.push({ file: table.name, kind: 'Cabin supplemental cutover (operator supplied)', columns: table.columns })
    for (const row of table.rows) {
      const r = row.values, kind = key(value(r, 'Record type')), id = value(r, 'Listing ID')
      // Reconciliation sees all parseable USD balances even if business validation refuses them.
      const amount = cents(value(r, 'Opening balance'))
      if (kind === 'balance' && value(r, 'Currency').toUpperCase() === 'USD' && amount !== undefined) {
        if (!Number.isSafeInteger(out.sourceTotals.ownerBalanceCents + amount)) throw new Error('Combined opening balances exceed the supported exact money range')
        out.sourceTotals.ownerBalanceCents += amount
      }
      if (row.error) { refuse(row, kind || 'file', row.error, id); continue }
      if (key(value(r, 'Provider')) !== provider) { refuse(row, kind || 'file', `Provider must be ${provider}`, id); continue }
      if (kind === 'reservation') {
        const reservationId = value(r, 'Reservation ID')
        if (!reservationId || reservationId.length > 100) { refuse(row, kind, 'Reservation ID is required and must be at most 100 characters'); continue }
        if (result.reservations.has(reservationId) || reservationDuplicates.has(reservationId)) {
          const previous = result.reservations.get(reservationId)
          if (previous) refuse(previous, kind, 'Duplicate supplemental reservation', reservationId)
          result.reservations.delete(reservationId); reservationDuplicates.add(reservationId)
          refuse(row, kind, 'Duplicate supplemental reservation', reservationId); continue
        }
        result.reservations.set(reservationId, row); continue
      }
      if (!id || id.length > 100) { refuse(row, kind || 'file', 'Listing ID is required and must be at most 100 characters'); continue }
      if (kind === 'home') {
        if (result.homes.has(id) || duplicates.has(id)) {
          const previous = result.homes.get(id)
          if (previous?.location) out.refusals.push({ ...previous.location, kind, reason: 'Duplicate supplemental home terms', externalId: id })
          result.homes.delete(id); duplicates.add(id); refuse(row, kind, 'Duplicate supplemental home terms', id); continue
        }
        const name = value(r, 'Listing name'), ownerName = value(r, 'Owner name'), ownerEmail = value(r, 'Owner email'), commissionBps = cents(value(r, 'Commission percent'))
        if (!name || name.length > 160 || !ownerName || ownerName.length > 160 || ownerEmail.length > 254 || !emailValid(ownerEmail) || commissionBps === undefined || commissionBps < 0 || commissionBps > 10000) {
          refuse(row, kind, 'Home needs Listing name, Owner name, valid Owner email, and Commission percent from 0 to 100', id); continue
        }
        result.homes.set(id, { externalId: id, name, ownerName, ownerEmail, commissionBps, links: [], location: row.location })
      } else if (kind === 'balance') {
        if (value(r, 'Currency').toUpperCase() !== 'USD') { refuse(row, kind, 'Only USD opening balances are supported; no currency conversion is performed', id); continue }
        const asOf = date(value(r, 'As of')), ownerEmail = value(r, 'Owner email'), externalId = value(r, 'Balance ID')
        if (amount === undefined || !externalId || externalId.length > 100 || ownerEmail.length > 254 || !emailValid(ownerEmail) || asOf !== out.asOf) {
          refuse(row, kind, 'Balance needs unique Balance ID, valid Owner email, decimal Opening balance and As of equal to the cutover date', externalId || id); continue
        }
        result.balances.push({ externalId, listingId: id, ownerEmail, amountCents: amount, asOf, location: row.location })
      } else if (kind === 'link') {
        const source = channel(value(r, 'Channel')), url = value(r, 'iCal URL')
        let valid = false
        try { feedUrl(url); valid = true } catch { /* refusal below */ }
        if (!source || source === 'direct' || !valid) { refuse(row, kind, 'Link needs supported Channel and a public HTTPS iCal URL without credentials or private hosts', id); continue }
        result.links.push(row)
      } else refuse(row, kind || 'file', 'Record type must be home, reservation, balance or link', id)
    }
  }
  for (const row of result.links) {
    const home = result.homes.get(value(row.values, 'Listing ID'))
    const source = channel(value(row.values, 'Channel')) as 'airbnb' | 'vrbo' | 'booking.com'
    if (!home) { refuse(row, 'link', 'No valid supplemental home terms for Listing ID', value(row.values, 'Listing ID')); continue }
    if (home.links.some(link => link.channel === source)) { refuse(row, 'link', 'Duplicate retained iCal channel for home', home.externalId); continue }
    home.links.push({ channel: source, url: value(row.values, 'iCal URL') })
  }
  return result
}
