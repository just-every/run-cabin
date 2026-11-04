import { newId, query, type Context, type Query } from '../model'

const preparations = {
  'calendar.prepare': { collection: 'calendarDrafts', kind: 'calendars' },
  'turnover.prepare': { collection: 'turnovers', kind: 'turnovers' },
  'statement.prepare': { collection: 'statements', kind: 'statements' },
} as const

/** Retain only preparation metadata, in the same guarded batch as the native record.
 * Current record adapters enforce visibility when the built-in event tool delivers it.
 */
export function preparationEvents(c: Context, command: string): Query[] {
  const preparation = preparations[command as keyof typeof preparations]
  if (!preparation) return []
  const { collection, kind } = preparation
  const previous = new Set(c.before[collection].map(row => row.id))
  return c.data[collection].filter(row => !previous.has(row.id) && row.preparedBy === c.actor.id).map(row => {
    const id = newId(), uri = `cabin://${kind}/${encodeURIComponent(row.id)}`
    const event = JSON.stringify({ id, type: `${kind}.prepared`, uri, at: c.now })
    // Resolve the native person's name at commit; legacy draft keys remain agents too.
    const actor = c.actor.isAgent
      ? `json_object('kind','agent','agent',json_object('id',?,'name',COALESCE(?,k.label)),
          'for',json_object('id',o.id,'name',o.display_name),
          'label',COALESCE(?,k.label) || ' for ' || o.display_name)`
      : `json_object('kind','person','person',json_object('id',o.id,'name',o.display_name))`
    const attribution = c.actor.isAgent
      ? [c.actor.agent?.id ?? `cabin-key:${c.actor.keyId}`, c.actor.agent?.name ?? null, c.actor.agent?.name ?? null]
      : []
    return query(`INSERT INTO agent_door_events(id,uri,event)
      SELECT ?,?,json_set(?,'$.actor',json(${actor})) FROM oa_operators o
      LEFT JOIN cb_agent_keys k ON k.id=? WHERE o.id=?`,
    id, uri, event, ...attribution, c.actor.keyId ?? null, c.actor.id)
  })
}
