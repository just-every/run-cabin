import type { Table, Upload } from './types'

export const key = (value: string) => value.trim().replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, ' ')
export const value = (row: Record<string, string>, ...names: string[]) => {
  for (const name of names) if (row[key(name)] !== undefined) return row[key(name)]
  return ''
}

/** RFC 4180 quotes, doubled quotes, embedded newlines; reports also support ; and TSV. */
export function parseCsv(upload: Upload): Table {
  const text = upload.text.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delimiter = ['\t', ';', ','].map(char => ({ char, count: firstLine.split(char).length - 1 })).sort((a, b) => b.count - a.count)[0].char
  const records: { cells: string[]; line: number; error?: string }[] = []
  let cells: string[] = [], cell = '', quoted = false, closed = false, line = 1, rowLine = 1, error = ''
  const flush = () => {
    cells.push(cell.trim())
    if (cells.some(item => item !== '')) records.push({ cells, line: rowLine, ...(error ? { error } : {}) })
    cells = []; cell = ''; closed = false; error = ''; rowLine = line + 1
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else { cell += char; if (char === '\n') line++ }
    } else if (char === '"') {
      if (cell || closed) error = 'Unexpected quote in CSV field'
      else quoted = true
    } else if (char === delimiter) { cells.push(cell.trim()); cell = ''; closed = false }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      flush(); line++
    } else {
      if (closed && char.trim()) error = 'Text after closing CSV quote'
      cell += char
    }
  }
  if (quoted) error = 'Unclosed CSV quote'
  if (cell || cells.length || error) flush()
  const header = records.shift()
  if (!header) throw new Error('CSV is empty')
  if (header.error) throw new Error(header.error)
  const columns = header.cells
  const keys = columns.map(key)
  if (keys.some(item => !item) || new Set(keys).size !== keys.length) throw new Error('CSV column names must be nonempty and unique')
  return { name: upload.name, columns, rows: records.map(record => ({
    values: Object.fromEntries(keys.map((column, i) => [column, record.cells[i] || ''])),
    location: { file: upload.name, row: record.line },
    error: record.error || (record.cells.length !== keys.length ? `Expected ${keys.length} CSV fields; found ${record.cells.length}` : undefined),
  })) }
}

export function date(value: string): string {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const result = us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return ''
  const instant = new Date(`${result}T00:00:00Z`)
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === result ? result : ''
}

/** Decimal dollars -> integer cents, without binary floating-point rounding. */
export function cents(value: string): number | undefined {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return undefined
  const amount = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'))
  const signed = match[1] ? -amount : amount
  return signed <= BigInt(Number.MAX_SAFE_INTEGER) && signed >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(signed) : undefined
}

export const emailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export const nights = (start: string, end: string, asOf: string) => Math.max(0, (Date.parse(end) - Date.parse(start > asOf ? start : asOf)) / 86_400_000)

export function channel(input: string): 'airbnb' | 'vrbo' | 'booking.com' | 'direct' | undefined {
  const normalized = key(input)
  if (['airbnb', 'airbnbofficial', 'airbnb2'].includes(normalized)) return 'airbnb'
  if (['vrbo', 'homeaway', 'homeawayapi', 'vrboical', 'homeawayical'].includes(normalized)) return 'vrbo'
  if (['booking.com', 'bookingcom'].includes(normalized)) return 'booking.com'
  if (['direct', 'manual', 'bookingengine', 'wordpress', 'website'].includes(normalized)) return 'direct'
  return undefined
}

export function status(input: string): 'confirmed' | 'cancelled' | undefined {
  if (['confirmed', 'new', 'modified', 'active'].includes(key(input))) return 'confirmed'
  if (['cancelled', 'canceled'].includes(key(input))) return 'cancelled'
  return undefined
}
