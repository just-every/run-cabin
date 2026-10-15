import { Buffer } from 'node:buffer'
import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { SourceBundle, SourceRecord } from '../../modules/import-kit/src/types.ts'
import { ImportError, requiredText } from './errors'

export const namespace = 'cabin.properties.csv.v1'
const columns = ['external_id', 'name', 'owner_name', 'owner_email', 'commission_bps']

/** RFC 4180 quoting, including quoted line breaks. Row numbers are physical start lines. */
function parse(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = [], cell = '', state: 'plain' | 'quoted' | 'closed' = 'plain', line = 1, start = 1
  const push = () => { cells.push(cell); rows.push({ cells, line: start }); cells = []; cell = ''; state = 'plain' }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (state === 'quoted') {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else state = 'closed' }
      else { cell += ch; if (ch === '\n') line++ }
      continue
    }
    if (ch === '"') {
      if (state !== 'plain' || cell) throw new ImportError('invalid_csv', 422, `Unexpected quote at line ${line}`)
      state = 'quoted'; continue
    }
    if (ch === ',') { cells.push(cell); cell = ''; state = 'plain'; continue }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      push(); line++; start = line; continue
    }
    if (state === 'closed') throw new ImportError('invalid_csv', 422, `Unexpected text after a quote at line ${line}`)
    cell += ch
  }
  if (state === 'quoted') throw new ImportError('invalid_csv', 422, 'Unclosed CSV quote')
  if (cell || cells.length || state === 'closed') push()
  return rows
}

export function propertySource(value: unknown): SourceBundle {
  const csv = requiredText(value, 'csv'), bytes = Buffer.from(csv, 'utf8')
  if (bytes.length > 100_000) throw new ImportError('csv_too_large', 413, 'Property CSV is limited to 100,000 UTF-8 bytes')
  if (csv.includes('\0')) throw new ImportError('invalid_csv', 422)
  const rows = parse(csv.replace(/^\uFEFF/, ''))
  if (!rows.length || rows[0].cells.length !== columns.length || rows[0].cells.some((v, i) => v !== columns[i])) {
    throw new ImportError('invalid_csv_headers', 422, `Use these exact headers: ${columns.join(',')}`)
  }
  const body = rows.slice(1)
  if (!body.length || body.length > 100) throw new ImportError('invalid_property_count', 422, 'Import between 1 and 100 property rows')
  const ids = new Set<string>()
  const artifactHash = sha256(bytes)
  const records: SourceRecord[] = body.map(({ cells, line }) => {
    if (cells.length !== 5) throw new ImportError('invalid_csv_row', 422, `Line ${line} must have five cells`)
    const [id, name, owner_name, rawEmail, rawCommission] = cells.map(v => v.trim())
    const owner_email = rawEmail.toLowerCase(), commission_bps = Number(rawCommission)
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !name || name.length > 160 || !owner_name || owner_name.length > 160 || owner_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email) || !/^\d+$/.test(rawCommission) || !Number.isInteger(commission_bps) || commission_bps < 0 || commission_bps > 10000) {
      throw new ImportError('invalid_property_row', 422, `Invalid property fields at line ${line}`)
    }
    if (ids.has(id)) throw new ImportError('duplicate_property', 422, `Duplicate property ID at line ${line}`)
    ids.add(id)
    const payload = { id, name, owner_name, owner_email, commission_bps }
    return { namespace, kind: 'property', sourceId: id, payload, payloadHash: sha256(canonicalJson(payload)), artifactHash, location: { artifact: 'properties.csv', row: line } }
  })
  return { records, diagnostics: [], artifacts: [{ name: 'properties.csv', sha256: artifactHash, size: bytes.length, original: { status: 'available', base64: bytes.toString('base64') } }] }
}
