import { kinds, type Actor, type Data } from '../model'
import { assertLive } from '../storage'
import { permitsProperty } from '../permissions/policy'

/** A page owns a read model, never a mutation context or a replacement archive. */
export async function pageBase(db: D1Database, actor: Actor): Promise<Data> {
 await assertLive(db, actor)
 const result = await db.batch<any>([
  db.prepare('SELECT version FROM cb_meta WHERE id=1'),
  db.prepare('SELECT id,version AS revision,name,owner_name AS ownerName,owner_email AS ownerEmail,commission_bps AS commissionBps FROM cb_properties ORDER BY name,id'),
  db.prepare('SELECT m.id,m.version AS revision,m.name,m.email,m.role,m.active,s.pms_role,s.property_ids,s.actions,s.revision AS scope_revision FROM cb_members m LEFT JOIN cb_member_scopes s ON s.member_id=m.id ORDER BY m.name,m.id'),
 ])
 const collections=Object.fromEntries(kinds.map(kind => [kind, []])) as Pick<Data,typeof kinds[number]>
 return { ...collections, verifications: [], approvals: [], events: [], version: result[0].results[0].version,
  properties: result[1].results.filter((p: any) => permitsProperty(actor, p.id)),
  members: result[2].results.map((m: any) => ({ id:m.id,revision:m.revision,name:m.name,email:m.email,role:m.role,active:!!m.active,...(m.pms_role?{scope:{pmsRole:m.pms_role,propertyIds:JSON.parse(m.property_ids),actions:JSON.parse(m.actions),revision:m.scope_revision}}:{}) })),
 }
}
export async function records(db: D1Database, data: Data, selected: readonly string[], where = '1=1', params: unknown[] = []) {
 const result = await db.prepare(`SELECT kind,data FROM cb_records WHERE kind IN (${selected.map(() => '?').join(',')}) AND (${where}) ORDER BY rowid`).bind(...selected, ...params).all<{kind: keyof Data; data: string}>()
 for (const row of result.results) (data[row.kind] as unknown[]).push(JSON.parse(row.data))
}
export const inIds = (expression: string) => `${expression} IN (SELECT value FROM json_each(?))`
export const scoped = (data: Data) => JSON.stringify(data.properties.map(p => p.id))
export function pageNumber(value: string | null, label: string) {
 if (!value) return 1
 if (!/^[1-9]\d{0,7}$/.test(value)) throw Object.assign(new Error(`Choose a valid ${label} page`), { status: 400 })
 return Number(value)
}
