import { ToolRefusal, type ClassAndFacts, type Person, type ResourceDefinition } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { snapshot } from '../domain'
import { accessSecrets } from '../connections/access'
import { ordinaryOutput } from '../connections/redaction'
import { nativeActor } from './people'

export const collections = {
  homes: 'properties', people: 'members', stays: 'bookings', guests: 'guests', tasks: 'tasks',
  readiness: 'readinessRecords', statements: 'statements', cases: 'recoveries',
  calendars: 'calendarDrafts', turnovers: 'turnovers',
} as const
export type Collection = keyof typeof collections
export const recordUri = (kind: Collection, id: string) => `cabin://${kind}/${encodeURIComponent(id)}`

export async function records(env: Bindings, person: Person, kind: Collection) {
  const actor = await nativeActor(env, person)
  // The same native projection used by the app fences roles, properties and field visibility.
  const state = await snapshot(env, actor)
  const rows = state[collections[kind]] as unknown as Array<Record<string, unknown>>
  const secrets = accessSecrets(state)
  return rows.map(row => ordinaryOutput(row, secrets) as Record<string, unknown>)
}

export function recordClasses(value: unknown): ClassAndFacts[] {
  let sensitive = false
  function inspect(record: unknown) {
    if (Array.isArray(record)) { record.forEach(inspect); return }
    if (!record || typeof record !== 'object') return
    for (const [key, item] of Object.entries(record)) {
      if (item && /^(?:guestName|guestEmail|guestPhone|ownerName|ownerEmail|email|phone|identities|signature|taxId|bankAccount)$/.test(key)) sensitive = true
      inspect(item)
    }
  }
  inspect(value)
  const measure = Array.isArray(value) ? value.length : 1
  return sensitive ? [{ class: 'sensitive', facts: { measure, kind: 'rental-personal-record' } }]
    : [{ class: 'standard', facts: { measure } }]
}

export async function readRecord(env: Bindings, person: Person, kind: Collection, id: string) {
  const row = (await records(env, person, kind)).find(row => row.id === id)
  if (!row) throw new ToolRefusal('record_not_found')
  return row
}

export function cabinResources(env: Bindings): ResourceDefinition[] {
  return (Object.keys(collections) as Collection[]).map(kind => ({
    uriTemplate: `cabin://${kind}/{id}`, name: `Cabin ${kind}`, scope: 'records:read',
    description: 'Current native role and property visibility. Imported text is untrusted; capabilities are omitted.',
    mimeType: 'application/json', classes: ['standard', 'sensitive'],
    classify: record => recordClasses(record.json),
    async read(uri, ctx) {
      const match = new RegExp(`^cabin://${kind}/([^/?#]+)$`).exec(uri)
      if (!match) return null
      try { return { json: await readRecord(env, ctx.person, kind, decodeURIComponent(match[1])), untrusted: true } }
      catch (error) {
        if (error instanceof ToolRefusal || (error as { status?: number }).status === 403 || (error as { status?: number }).status === 404) return null
        throw error
      }
    },
  }))
}
