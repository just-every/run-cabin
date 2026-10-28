import { defineTool, ToolRefusal, type JsonSchema, type ToolContext, type ToolDefinition } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { command } from '../domain'
import { commandScope } from '../permissions/commands'
import { load } from '../storage'
import { sha } from '../model'
import { nativeActor } from './people'
import { collections, readRecord, recordClasses, recordUri, records, type Collection } from './records'

const string = { type: 'string', minLength: 1, maxLength: 200 }
const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)) => ({ type: 'object' as const, properties, required, additionalProperties: false })
const kindSchema = { type: 'string', enum: Object.keys(collections) }
const clauses = ['CONTROL-002', 'AUTH-002', 'AUDIT-001']

async function draftActor(env: Bindings, ctx: ToolContext) {
  const actor = await nativeActor(env, ctx.person)
  // The pinned Base event reader short-circuits resource visibility for a prior sponsor.
  // Keep writes with the installation owner until it exposes a current-grant event hook.
  if (actor.role !== 'owner') throw new ToolRefusal('owner_required')
  if (!ctx.agent.id.startsWith('cabin-key:')) return actor
  const keyId = ctx.agent.id.slice('cabin-key:'.length)
  const key = await env.DB.prepare('SELECT 1 FROM cb_agent_keys WHERE id=? AND owner_id=? AND owner_version=? AND revoked_at IS NULL AND expires_at>?')
    .bind(keyId, actor.id, actor.operatorVersion, Date.now()).first()
  if (!key || actor.role !== 'owner') throw new ToolRefusal('local_credential_revoked')
  return { ...actor, role: 'agent' as const, isAgent: true, keyId }
}

export function cabinTools(env: Bindings): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    defineTool({
      name: 'cabin.workspace.snapshot', title: 'Inspect native source state', description: 'Owner-only fingerprint of native business records, excluding door policy and audit.',
      scope: 'records:read', readOnly: true, inputSchema: object({}), outputSchema: object({ version: { type: 'integer' }, sha256: string }),
      classes: ['standard'], clauses, classify: () => [{ class: 'standard', facts: { measure: 1 } }],
      async run(_args, ctx) {
        const actor = await nativeActor(env, ctx.person)
        if (actor.role !== 'owner') throw new ToolRefusal('owner_required')
        const data = await load(env.DB)
        return { result: { version: data.version, sha256: await sha(JSON.stringify({ ...data, events: [] })) } }
      },
    }),
    defineTool({
      name: 'cabin.records.list', title: 'List visible rental records', description: 'Read the native app projection. Personal records carry sensitive policy. Imported content is untrusted.',
      scope: 'records:read', readOnly: true, inputSchema: object({ kind: kindSchema }), outputSchema: object({ records: { type: 'array', items: { type: 'object' } } }),
      classes: ['standard', 'sensitive'], clauses, untrusted: true,
      async classify(args, ctx) { return recordClasses(await records(env, ctx.person, args.kind as Collection)) },
      async run(args, ctx) { return { result: { records: await records(env, ctx.person, args.kind as Collection) } } },
    }),
    defineTool({
      name: 'cabin.records.read', title: 'Read a visible rental record', description: 'Read a native record by ID; missing and restricted records have the same refusal.',
      scope: 'records:read', readOnly: true, inputSchema: object({ kind: kindSchema, id: string }), outputSchema: object({ record: { type: 'object' } }),
      classes: ['standard', 'sensitive'], clauses, untrusted: true,
      async classify(args, ctx) { return recordClasses(await readRecord(env, ctx.person, args.kind as Collection, args.id as string)) },
      async run(args, ctx) {
        const kind = args.kind as Collection, id = args.id as string
        return { result: { record: await readRecord(env, ctx.person, kind, id) }, resources: [{ uri: recordUri(kind, id), name: `Cabin ${kind}` }] }
      },
    }),
  ]
  const drafts: Array<{ name: string; command: string; kind: Collection; properties: Record<string, JsonSchema>; required?: string[]; clauses: string[] }> = [
    { name: 'cabin.calendar.prepare', command: 'calendar.prepare', kind: 'calendars', properties: { propertyId: string, channel: { type: 'string', enum: ['airbnb', 'vrbo', 'booking.com', 'ical'] }, calendar: { type: 'string', minLength: 1, maxLength: 1048576 } }, clauses: ['CONTROL-002', 'SYNC-001'] },
    { name: 'cabin.work.prepare', command: 'turnover.prepare', kind: 'turnovers', properties: { bookingId: string, cleanerId: string, checklist: { type: 'array', minItems: 1, maxItems: 100, items: string } }, clauses: ['CONTROL-002', 'CONTROL-001', 'OPS-001'] },
    { name: 'cabin.statements.prepare', command: 'statement.prepare', kind: 'statements', properties: { propertyId: string, month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }, lines: { type: 'array', minItems: 1, maxItems: 100, items: object({ description: { type: 'string', minLength: 1, maxLength: 300 }, amountCents: { type: 'integer', minimum: -100000000, maximum: 100000000 } }) } }, clauses: ['CONTROL-002', 'CONTROL-001', 'FIN-004'] },
  ]
  for (const draft of drafts) tools.push(defineTool({
    name: draft.name, title: `Prepare ${draft.kind}`, description: 'Prepare an internal draft through Cabin’s existing native command. Publication and human decisions remain separate.',
    scope: 'drafts:write', readOnly: false, inputSchema: object(draft.properties, draft.required), outputSchema: object({ id: string, revision: string }),
    classes: ['standard'], clauses: draft.clauses,
    classify: () => [{ class: 'standard', facts: { measure: 1 } }],
    async revision(_args, ctx) { await nativeActor(env, ctx.person); return (await env.DB.prepare('SELECT version FROM cb_meta WHERE id=1').first<{ version: number }>())!.version },
    async summary(args, ctx) {
      const actor = await draftActor(env, ctx)
      await commandScope(env.DB, actor, draft.command, args)
      const data = await load(env.DB), booking = data.bookings.find(row => row.id === args.bookingId)
      const home = data.properties.find(row => row.id === (args.propertyId ?? booking?.propertyId))
      if (!home) throw new ToolRefusal('record_not_found')
      return { target: { id: home.id, name: home.name }, items: [draft.command, String(args.month ?? args.bookingId ?? args.channel)] }
    },
    async run(args, ctx) {
      const actor = await draftActor(env, ctx)
      await commandScope(env.DB, actor, draft.command, args)
      const prepared = { id: ctx.agent.id, name: ctx.agent.name, label: ctx.actor.label }
      // This is the existing draft-only native agent path, with the current sponsor's grants.
      const row = await command(env.DB, { ...actor, isAgent: true, agent: prepared }, draft.command, args) as { id: string; revision: string }
      ctx.emit(`${draft.kind}.prepared`, recordUri(draft.kind, row.id), { id: row.id })
      return { result: { id: row.id, revision: row.revision } }
    },
  }))
  return tools
}
