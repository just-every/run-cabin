import type { Data } from './model'
import { teamSettings } from './inbox/team/settings'
import { inboxSettings } from './inbox/settings'

/**
 * "Is anything due?" for the five-minute Cron, answered by narrow indexed reads.
 *
 * Cabin stores most records as JSON documents in cb_records and every full load()
 * reads all of them. A quiet tick must not pay that, so each Cron step asks its own
 * question here first. Every question is a superset of what the step then acts on
 * (the step's own filter stays authoritative), and costs the same however much
 * history is stored: it reads a status index, a partial index over open work
 * (migration 0070) or a small configuration kind (one row per home).
 */
const some = async (db: D1Database, from: string, ...params: unknown[]) => !!(await db.prepare(`SELECT 1 FROM ${from} LIMIT 1`).bind(...params).first())
const status = "json_extract(data,'$.status')"
const iso = (ms = Date.now()) => new Date(ms).toISOString()
/** A small configuration kind (one row per home, never per booking or message). */
export async function configRows<T>(db: D1Database, kind: string): Promise<T[]> {
 return (await db.prepare('SELECT data FROM cb_records WHERE kind=? ORDER BY rowid').bind(kind).all<{ data: string }>()).results.map(r => JSON.parse(r.data))
}
const inboxData = async (db: D1Database) => ({ inbox: await configRows(db, 'inbox') }) as Pick<Data, 'inbox'>

/** Email notices waiting to send, or sends whose claim must be reconciled (notify.ts). */
export const noticesDue = (db: D1Database) => some(db, `cb_records WHERE kind='notices' AND ${status} IN ('pending','sending')`)
/** Outgoing guest mail waiting to send, a send to reconcile, or a scheduled message that has fallen due (inbox/deliver.ts). */
export const guestMessagesDue = async (db: D1Database) => {
 const now = iso()
 return await some(db, `cb_records WHERE kind='messages' AND ${status} IN ('pending','sending')`)
  || await some(db, `cb_records WHERE kind='scheduled' AND ${status}='sending'`)
  || await some(db, `cb_records WHERE kind='scheduled' AND ${status}='scheduled' AND json_extract(data,'$.dueAt')<=? AND (json_extract(data,'$.nextEligibleAt') IS NULL OR json_extract(data,'$.nextEligibleAt')<=?)`, now, now)
}
/** AI drafts waiting to be written (inbox/drafts.ts). */
export const draftsDue = (db: D1Database) => some(db, `cb_records WHERE kind='messages' AND ${status}='drafting'`)
/** Drafts the host has not answered that the saved policy would now escalate (inbox/reply-policy.ts). */
export async function replyEscalationDue(db: D1Database) {
 // Confidence below the highest saved minimum (default 80) is the widest the step can act on.
 const policies = inboxSettings(await inboxData(db)).replyPolicies ?? [], floor = Math.max(80, ...policies.map(p => Number(p.minConfidence) || 0))
 return some(db, `cb_records WHERE kind='messages' AND ${status}='draft' AND json_extract(data,'$.control') IS NOT NULL AND json_extract(data,'$.control.escalatedAt') IS NULL AND (json_extract(data,'$.control.needsHost') OR json_extract(data,'$.control.confidence')<? OR json_extract(data,'$.control.dueAt')<=?)`, floor, iso())
}
/** An inquiry deadline that reached a later stage, or an open team thread past its due time (inbox/team/advance.ts). */
export async function casesDue(db: D1Database) {
 const urgent = teamSettings(await inboxData(db)).urgentMinutes, now = Date.now()
 return await some(db, `cb_records WHERE kind='inquiries' AND ${status}='inquiry' AND COALESCE(json_extract(data,'$.restorePaused'),0)=0 AND ((json_extract(data,'$.deadlineStage')<>'elapsed' AND julianday(json_extract(data,'$.deadline'))<=julianday(?)) OR (json_extract(data,'$.deadlineStage')='pending' AND julianday(json_extract(data,'$.deadline'))<=julianday(?)))`, iso(now), iso(now + urgent * 60_000))
  || await some(db, `cb_records WHERE kind='threadCases' AND ${status}='open' AND json_extract(data,'$.dueAt') IS NOT NULL AND julianday(json_extract(data,'$.dueAt'))<=julianday(?)`, iso(now))
}
/** An issued staff quote past its expiry (reservations/quotes.ts). */
export const quotesDue = (db: D1Database) => some(db, `cb_records WHERE kind='staffQuotes' AND ${status}='issued' AND julianday(json_extract(data,'$.versions[#-1].expiresAt'))<=julianday(?)`, iso())
/** An open guest issue whose repair is inspected and still needs its confirmation or recurrence check (issues/due.ts). */
export const issueChecksDue = (db: D1Database) => some(db, `cb_records r INDEXED BY cb_records_open_issue WHERE kind='recoveries' AND ${OPEN_ISSUE_R}
 AND EXISTS(SELECT 1 FROM cb_records t WHERE t.kind='tasks' AND t.id=json_extract(r.data,'$.issue.taskId') AND json_extract(t.data,'$.status')='closed' AND (json_extract(t.data,'$.work') IS NULL OR (json_extract(t.data,'$.work.accepted') IS NOT NULL AND json_extract(t.data,'$.work.inspected') IS NOT NULL)))
 AND (COALESCE(json_extract(r.data,'$.issue.workRevision'),'')='' OR COALESCE(json_extract(r.data,'$.issue.confirmationMessageId'),'')='' OR (json_extract(r.data,'$.issue.recurrenceDueAt') IS NOT NULL AND json_extract(r.data,'$.issue.recurrenceRequestedAt') IS NULL AND julianday(json_extract(r.data,'$.issue.recurrenceDueAt'))<=julianday(?)))`, iso())
// Must match the partial index in migration 0070 exactly, or SQLite scans every recovery.
const OPEN_ISSUE_R = "json_extract(r.data,'$.issue') IS NOT NULL AND json_extract(r.data,'$.status') NOT IN ('closed','undone')"
/** Turnovers whose offers, reminders or pre-arrival deadlines the five-minute sweep advances (dispatch/offers.ts). */
export async function turnoverDeadlinesDue(db: D1Database) {
 if (!await some(db, `cb_records WHERE kind='homeSettings' AND json_extract(data,'$.dispatch') IS NOT NULL`)) return false
 // Unassigned jobs keep looking for a cleaner; accepted ones only matter within days of their window. Finished jobs are never read.
 return await some(db, `cb_records WHERE kind='turnovers' AND ${status}='unassigned' AND json_extract(data,'$.dispatch') IS NOT NULL`)
  || await some(db, `cb_records WHERE kind='turnovers' AND ${status}='approved' AND json_extract(data,'$.dispatch') IS NOT NULL AND json_extract(data,'$.windowEnd')<=?`, iso(Date.now() + 4 * 86_400_000).slice(0, 16))
}
/** A scheduled report that is due, or a run stuck generating or sending (reports/sharing/run.ts). */
export const reportsDue = async (db: D1Database, now = Date.now()) => await some(db, 'cb_report_schedules WHERE enabled=1 AND next_run_at<=?', iso(now))
 || await some(db, `cb_report_runs WHERE ${REPORT_ACTIVE}`)
const REPORT_ACTIVE = "json_extract(data,'$.status') IN ('generating','sending')"
/** Tax packets waiting to send (taxes/delivery.ts). */
export const taxDeliveriesDue = (db: D1Database) => some(db, "cb_tax_deliveries WHERE status='pending'")
/** Approved owner statements waiting to send (finance/delivery.ts). */
export const statementDeliveriesDue = (db: D1Database) => some(db, `cb_records WHERE kind='deliveries' AND ${status}='pending'`)
/** Door codes that still need pushing to, or removing from, the lock (locks.ts). */
export const lockCodesDue = (db: D1Database) => some(db, `cb_records INDEXED BY cb_records_lock_open WHERE kind='codes' AND ${LOCK_OPEN}`)
const LOCK_OPEN = "(json_extract(data,'$.lock.state')='pending' OR (json_extract(data,'$.status')='revoked' AND json_extract(data,'$.lock.providerId') IS NOT NULL AND json_extract(data,'$.lock.state')<>'removed') OR (json_extract(data,'$.lock.job.stage') IS NOT NULL AND json_extract(data,'$.lock.job.stage')<>'complete'))"
/** A promotion offer past its expiry that is still open for guests (promotions/payments.ts). */
export const promotionExpiryDue = (db: D1Database) => some(db, `cb_records WHERE kind='promotionOffers' AND ${status} IN ('draft','sent') AND julianday(json_extract(data,'$.expiresAt'))<=julianday(?)`, iso())
