import { newId, query, type Context, type Query } from '../model'

// Keep this inventory independent of public resource capability adoption.
const records = {
  homes: 'properties', people: 'members', stays: 'bookings', guests: 'guests', tasks: 'tasks',
  readiness: 'readinessRecords', statements: 'statements', cases: 'recoveries',
  calendars: 'calendarDrafts', turnovers: 'turnovers',
} as const
const preparations = { 'calendar.prepare': 'calendars', 'turnover.prepare': 'turnovers', 'statement.prepare': 'statements' }

/** Retain metadata in the guarded native transaction; delivery reapplies native visibility. */
export function recordEvents(c: Context, command: string): Query[] {
  const events: Query[] = []
  for (const [kind, collection] of Object.entries(records)) {
    const before = new Map((c.before[collection as typeof records[keyof typeof records]] as Array<{ id: string }>).map(row => [row.id, JSON.stringify(row)]))
    const after = new Map((c.data[collection as typeof records[keyof typeof records]] as Array<{ id: string }>).map(row => [row.id, JSON.stringify(row)]))
    // Team grants are written directly rather than copied into the native snapshot.
    if (kind === 'people') for (const q of c.queries) if (q.sql.startsWith('INSERT INTO cb_members')) {
      after.set(String(q.params[0]), JSON.stringify(q.params))
    }
    for (const [recordId, value] of after) {
      if (value === before.get(recordId)) continue
      const prepared = !before.has(recordId) && preparations[command as keyof typeof preparations] === kind
      events.push(retain(c, kind, recordId, prepared ? 'prepared' : before.has(recordId) ? 'updated' : 'created'))
    }
    // A removed record is retained for history; current visibility withholds its URI.
    for (const recordId of before.keys()) if (!after.has(recordId)) events.push(retain(c, kind, recordId, 'removed'))
  }
  return events
}

function retain(c: Context, kind: string, recordId: string, change: string): Query {
  const id = newId(), uri = `cabin://${kind}/${encodeURIComponent(recordId)}`
  const event = JSON.stringify({ id, type: `${kind}.${change}`, uri, at: c.now })
  const agent = c.actor.isAgent || c.actor.role === 'system'
  const actor = agent
    ? `json_object('kind','agent','agent',json_object('id',?,'name',COALESCE(?,k.label)),
        'for',json_object('id',o.id,'name',o.display_name),
        'label',COALESCE(?,k.label) || ' for ' || o.display_name)`
    : `json_object('kind','person','person',json_object('id',o.id,'name',o.display_name))`
  const name = c.actor.role === 'system' ? 'Cabin automation' : c.actor.agent?.name ?? null
  const attribution = agent ? [c.actor.agent?.id ?? (c.actor.role === 'system' ? c.actor.id : `cabin-key:${c.actor.keyId}`), name, name] : []
  return query(`INSERT INTO agent_door_events(id,uri,event)
    SELECT ?,?,json_set(?,'$.actor',json(${actor})) FROM oa_operators o
    LEFT JOIN cb_agent_keys k ON k.id=? WHERE ${c.actor.role === 'system' ? "o.role='owner' AND o.status='active' ORDER BY o.id LIMIT 1" : 'o.id=?'}`,
  id, uri, event, ...attribution, c.actor.keyId ?? null, ...(c.actor.role === 'system' ? [] : [c.actor.id]))
}

/** Erased native actors must not reappear through retained event metadata. */
export function retireRecordEvents(operatorId: string): Query {
  return query(`UPDATE agent_door_events SET uri='',event=json_object(
    'id',id,'at',json_extract(event,'$.at'),'tombstone',json_object('reason','native_person_erased'))
    WHERE uri LIKE 'cabin://%' AND (json_extract(event,'$.actor.person.id')=? OR json_extract(event,'$.actor.for.id')=?)`,
  operatorId, operatorId)
}
