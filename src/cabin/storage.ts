import { expireQuotes } from './reservations/quotes'
import { queueChannelClosures } from './channel-agent/queue'
import { synchronizePromotions } from './promotions/inventory'
import { synchronizeIssues } from './issues/records'
import { recordReservations } from './reservations/history'
import { syncReservationFinance } from './reservations/finance'
import { loadVerifications, synchronizeVerification } from './verification/records'
import { allocateBlockCleaning } from './blocks'
import { initialWork } from './work-orders/records'
import { captureManagement } from './properties/terms'
import { synchronizeAgreements } from './agreements/records'
import { syncGuests } from './guests/sync'
import { type Actor, type Context, type Data, type Query, kinds, query, guard, need, fail, newId } from './model'
import { finishRecoveries } from './recovery/commands'
import { changes } from './audit/write'
import { retainGuestErasure } from './audit/privacy'
import { syncLedger } from './ledger/automatic'
import { dispatch } from './dispatch'
import { synchronizeMessages } from './inbox/schedule'
import { syncTeam } from './inbox/team/cases'
/** The scheduled iCal sync acts as Cabin itself; principal() never issues this role. */
export const SYSTEM: Actor = { id: 'cabin:ical-sync', email: '', role: 'system', isAgent: false, operatorVersion: 0 }
export function authority(a: Actor): Query {
 if (a.role === 'system') return query('1=1')
 const operator = "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=? AND role=?)"
 const params: any[] = [a.id, a.operatorVersion, ['owner', 'agent'].includes(a.role) ? 'owner' : 'member']
 let sql = operator
 if (a.role === 'agent') { sql += ' AND EXISTS(SELECT 1 FROM cb_agent_keys WHERE id=? AND owner_id=? AND owner_version=? AND revoked_at IS NULL AND expires_at>?)'; params.push(a.keyId, a.id, a.operatorVersion, Date.now()) }
 if (a.role === 'manager' || a.role === 'cleaner') { sql += ' AND EXISTS(SELECT 1 FROM cb_members WHERE id=? AND email=? COLLATE NOCASE AND role=? AND active=1)'; params.push(a.memberId, a.email, a.role) }
 return query(sql, ...params)
}
export async function assertLive(db: D1Database, actor: Actor) { const a = authority(actor); need(await db.prepare(`SELECT 1 WHERE ${a.sql}`).bind(...a.params).first(), 'Access expired or revoked', 403) }
export async function load(db: D1Database): Promise<Data> {
 const results = await db.batch<any>([
  db.prepare('SELECT version FROM cb_meta WHERE id=1'), db.prepare('SELECT id,version AS revision,name,owner_name AS ownerName,owner_email AS ownerEmail,commission_bps AS commissionBps FROM cb_properties ORDER BY name,id'),
  db.prepare('SELECT id,version AS revision,name,email,role,active FROM cb_members ORDER BY name,id'), db.prepare(`SELECT kind,data FROM cb_records WHERE kind IN (${kinds.map(()=>'?').join(',')}) ORDER BY rowid`).bind(...kinds),
  db.prepare('SELECT a.id,a.kind,a.record_id AS recordId,a.revision,a.actor_id AS actorId,o.display_name AS actorName,a.at FROM cb_approvals a LEFT JOIN oa_operators o ON o.id=a.actor_id ORDER BY a.at,a.id'),
  db.prepare('SELECT e.id,COALESCE(a.anonymous_id,e.actor_id) AS actorId,e.actor_role AS actorRole,e.action,COALESCE(x.anonymous_id,e.entity_id) AS entityId,e.at FROM cb_events e LEFT JOIN cb_audit_redactions a ON a.subject_id=e.actor_id LEFT JOIN cb_audit_redactions x ON x.subject_id=e.entity_id ORDER BY e.rowid DESC LIMIT 100'),
 ])
 const data: Data = { threadCases:[], staffQuotes:[], statementSchedules:[], financialAllocations:[], sharedCosts:[], verifications:await loadVerifications(db), workExpenses:[], propertyProfiles: [], managementTerms: [], readinessPlans: [], readinessRecords: [], rentalTemplates: [], rentalAgreements: [], guests: [], guestMerges: [], guestPolicies: [], guestOffers: [], cleanerProfiles: [], ledgerSettings: [], recoveries: [], recoveryPolicies: [], version: results[0].results[0].version, properties: results[1].results, members: results[2].results.map((m: any) => ({ ...m, active: !!m.active })), feeds: [], calendarDrafts: [], bookings: [], turnovers: [], statements: [], connections: [], exports: [], requests: [], homeSettings: [], codes: [], notices: [], tasks: [], messages: [], scheduled: [], inbox: [], payouts: [], deliveries: [], postings: [], approvals: results[4].results, events: results[5].results }
 for (const row of results[3].results) if ((kinds as readonly string[]).includes(row.kind)) (data[row.kind as typeof kinds[number]] as unknown[]).push(JSON.parse(row.data))
 for(const task of data.tasks)if(!task.work)task.work=initialWork(data,task)
 return data
}
/** `audit` false suppresses an empty poll event; actual business/provider changes remain attributable. */
export function transaction(c: Context, name: string, audit = true): Query[] {
 const a = authority(c.actor), q = [guard(a.sql, ...a.params), guard('(SELECT version FROM cb_meta WHERE id=1)=?', c.before.version)]
 for (const kind of kinds) {
  const old = new Map(c.before[kind].map(row => [row.id, JSON.stringify(row)]))
  for (const row of c.data[kind]) if (old.get(row.id) !== JSON.stringify(row)) q.push(query('INSERT INTO cb_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data', kind, row.id, 'revision' in row ? row.revision : row.id, JSON.stringify(row)))
 }
 const existing = new Set(c.before.approvals.map(a => a.id))
 for (const a of c.data.approvals) if (!existing.has(a.id)) q.push(query('INSERT INTO cb_approvals(id,kind,record_id,revision,actor_id,at) VALUES(?,?,?,?,?,?)', a.id,a.kind,a.recordId,a.revision,a.actorId,a.at))
 q.push(...c.queries, ...changes(c,name,audit),query('UPDATE cb_meta SET version=version+1 WHERE id=1'),guard(a.sql,...a.params),query('DELETE FROM cb_guard'))
 return q
}
/** Every commit first brings turnovers, door codes, notices and scheduled guest messages in line with the stays (dispatch.ts, inbox/schedule.ts). */
export async function commit(c: Context, name: string, audit = true) {
 expireQuotes(c); await synchronizePromotions(c,name); captureManagement(c); retainGuestErasure(c); syncGuests(c); await synchronizeAgreements(c); await synchronizeVerification(c); await recordReservations(c,name); await syncReservationFinance(c); dispatch(c); await synchronizeMessages(c); retainGuestErasure(c); syncTeam(c); await finishRecoveries(c); synchronizeIssues(c); await syncLedger(c); await allocateBlockCleaning(c); await queueChannelClosures(c)
 try { await c.db.batch(transaction(c, name, audit).map(q => c.db.prepare(q.sql).bind(...q.params))) }
 catch (error) { if (/constraint|CHECK|UNIQUE/i.test(String(error))) fail('Records or access changed. Reload and review before trying again.',409); throw error }
}
/** Load, change and commit as one actor; the version guard refuses a concurrent commit with 409. */
export async function mutate<T>(db: D1Database, actor: Actor, name: string, change: (c: Context) => T | Promise<T>, audit: (result: T) => boolean = () => true): Promise<T> {
 await assertLive(db, actor); const before = await load(db), c: Context = { db, actor, before, data: structuredClone(before), queries: [], now: new Date().toISOString(), entityId: null }
 expireQuotes(c); const result = await change(c); await commit(c, name, audit(result)); return result
}
