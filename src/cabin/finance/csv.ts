import { need } from '../model'

/** Strict RFC 4180 reader: quoted commas, escaped quotes, embedded newlines, BOM and CRLF. */
export function csvRecords(input: string): string[][] {
 need(typeof input === 'string' && input.trim().length > 0, 'Upload a nonempty payout CSV.')
 const records: string[][] = [], row: string[] = []
 let cell = '', quoted = false, closed = false
 const pushCell = () => { row.push(cell); cell = ''; closed = false }
 const pushRow = () => { pushCell(); if (row.some(value => value.trim())) records.push([...row]); row.length = 0 }
 const csv = input.replace(/^\uFEFF/, '')
 for (let i = 0; i < csv.length; i++) {
  const char = csv[i]
  if (quoted) {
   if (char === '"') { if (csv[i + 1] === '"') { cell += '"'; i++ } else { quoted = false; closed = true } }
   else cell += char
  } else if (char === ',') pushCell()
  else if (char === '\r' || char === '\n') { if (char === '\r' && csv[i + 1] === '\n') i++; pushRow() }
  else if (char === '"') { need(!cell && !closed, 'Malformed payout CSV: a quote must start a cell.'); quoted = true }
  else { need(!closed, 'Malformed payout CSV: unexpected text after a closing quote.'); cell += char }
 }
 need(!quoted, 'Malformed payout CSV: an unclosed quoted cell.')
 if (cell || row.length || closed) pushRow()
 need(records.length > 1, 'The payout CSV needs a header and at least one transaction row.')
 return records
}

const normalized = (value: string) => value.trim().toLowerCase().replace(/[ _-]+/g, ' ')
export class PayoutRow {
 constructor(readonly headers: Map<string, number>, readonly cells: string[], readonly number: number) {}
 has(...names: string[]) { return names.some(name => this.headers.has(normalized(name))) }
 entries(names: string[]): Array<[string, string]> {
  return names.flatMap(name => {
   const index = this.headers.get(normalized(name)), value = index === undefined ? '' : this.cells[index].trim()
   return value ? [[name, value] as [string, string]] : []
  })
 }
 error(message: string): never { throw Object.assign(new Error(`Payout CSV row ${this.number}: ${message}`), { status: 400 }) }
 text(names: string[], required = false): string {
  const values = this.entries(names).map(([, value]) => value)
  if (new Set(values).size > 1) this.error(`conflicting ${names.join(' / ')} values; use one unambiguous column.`)
  if (required && !values.length) this.error(`missing ${names.join(' / ')}.`)
  return values[0] || ''
 }
 money(names: string[], required = false): number | null {
  const values = this.entries(names).map(([name, value]) => cents(value, `${name} on row ${this.number}`))
  if (new Set(values).size > 1) this.error(`conflicting ${names.join(' / ')} amounts; export transaction-level amounts.`)
  if (required && !values.length) this.error(`missing ${names.join(' / ')}.`)
  return values[0] ?? null
 }
 date(names: string[], required = false): string | null {
  const values = this.entries(names).map(([name, value]) => csvDate(value, `${name} on row ${this.number}`))
  if (new Set(values).size > 1) this.error(`conflicting ${names.join(' / ')} dates.`)
  if (required && !values.length) this.error(`missing ${names.join(' / ')}.`)
  return values[0] ?? null
 }
}

export function payoutRows(csv: string): PayoutRow[] {
 const [header, ...records] = csvRecords(csv), headers = new Map<string, number>()
 header.forEach((name, index) => {
  const key = normalized(name)
  need(key.length > 0 && !headers.has(key), 'Payout CSV has blank or duplicate headers; export a report with unique column names.')
  headers.set(key, index)
 })
 return records.map((cells, index) => {
  need(cells.length === header.length, `Payout CSV row ${index + 2} has ${cells.length} columns; expected ${header.length}. Quote values containing commas.`)
  return new PayoutRow(headers, cells, index + 2)
 })
}

/** USD decimal amounts only; do not round fractional cents or parse locale-dependent numbers. */
export function cents(raw: string, label: string): number {
 let value = raw.trim(), negative = false
 if (value.startsWith('(') && value.endsWith(')')) { negative = true; value = value.slice(1, -1).trim() }
 value = value.replace(/^USD\s*/i, '').replace(/\s*USD$/i, '').trim()
 const match = /^([+-]?)[\$]?((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{1,2}))?$/.exec(value)
 need(match && !(negative && match[1]), `${label} must be a USD decimal amount with at most two decimal places; fractional cents and other currencies are unsupported.`)
 const total = BigInt(match[2].replace(/,/g, '')) * 100n + BigInt((match[3] || '').padEnd(2, '0'))
 need(total <= BigInt(Number.MAX_SAFE_INTEGER), `${label} is too large to store accurately.`)
 return Number(total) * (negative || match[1] === '-' ? -1 : 1)
}

/** Provider English/US exports: ISO YYYY-MM-DD or US M/D/YYYY, never locale guessing. */
export function csvDate(value: string, label: string): string {
 const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value), us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
 need(iso || us, `${label} must use YYYY-MM-DD or US M/D/YYYY; export English/US dates.`)
 const year = Number(iso ? iso[1] : us![3]), month = Number(iso ? iso[2] : us![1]), day = Number(iso ? iso[3] : us![2])
 const result = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
 need(year >= 1900 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) === result, `${label} is not a valid calendar date.`)
 return result
}

export function sumCents(values: number[]): number {
 const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
 need(total >= BigInt(Number.MIN_SAFE_INTEGER) && total <= BigInt(Number.MAX_SAFE_INTEGER), 'Payout amount exceeds the supported integer-cent range.')
 return Number(total)
}
