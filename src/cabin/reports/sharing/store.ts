import { query, type Context } from '../../model'
import type { SavedReport, ReportSchedule, ReportRun, ReportFollowup } from './types'
export type Table='cb_saved_reports'|'cb_report_schedules'|'cb_report_runs'|'cb_report_followups'
export async function rows<T>(db:D1Database,table:Table):Promise<T[]> {
 return (await db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all<{data:string}>()).results.map(r=>JSON.parse(r.data))
}
export async function row<T>(db:D1Database,table:Table,id:string):Promise<T|null>{
 const found=await db.prepare(`SELECT data FROM ${table} WHERE id=?`).bind(id).first<{data:string}>();return found?JSON.parse(found.data):null
}
export function saveDefinition(c:Context,r:SavedReport){c.queries.push(query('INSERT INTO cb_saved_reports(id,revision,creator_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data',r.id,r.revision,r.creator.id,JSON.stringify(r)))}
export function saveSchedule(c:Context,r:ReportSchedule){c.queries.push(query('INSERT INTO cb_report_schedules(id,revision,creator_id,enabled,next_run_at,data) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,next_run_at=excluded.next_run_at,data=excluded.data',r.id,r.revision,r.creator.id,r.enabled?1:0,r.nextRunAt,JSON.stringify(r)))}
export function insertRun(c:Context,r:ReportRun){c.queries.push(query('INSERT INTO cb_report_runs(id,schedule_id,due_at,data) VALUES(?,?,?,?)',r.id,r.scheduleId,r.dueAt,JSON.stringify(r)))}
export function saveRun(c:Context,r:ReportRun){c.queries.push(query('UPDATE cb_report_runs SET data=? WHERE id=?',JSON.stringify(r),r.id))}
export function saveFollowup(c:Context,r:ReportFollowup){c.queries.push(query('INSERT INTO cb_report_followups(id,run_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',r.id,r.runId,JSON.stringify(r)))}
