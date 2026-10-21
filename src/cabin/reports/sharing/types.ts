import type { Actor } from '../../model'
import type { ReportFilters } from '../read'
export interface SavedReport {
 id:string; revision:string; name:string; filters:ReportFilters; propertyIds:string[];
 creator:Actor; createdAt:string
}
export type Recipient = {kind:'owner';email:string}|{kind:'member';memberId:string;email:string;actor:Actor}
export interface ReportSchedule {
 id:string; revision:string; name:string; savedReportId:string; savedReportRevision:string;
 filters:ReportFilters; propertyIds:string[]; creator:Actor; recipient:Recipient;
 period:'saved-window'|'previous-month'|'previous-week'; cadence:'once'|'weekly'|'monthly';
 format:'csv'|'json'; nextRunAt:string; enabled:boolean; consentedAt:string; consentedBy:string;
 createdAt:string; lastRunId?:string; pausedAt?:string; recipientPropertyIds?:string[]
}
export interface ReportScope { propertyIds:string[]; ownerKey:string|null; creator:Actor; recipient:Recipient }
export interface ReportRun {
 id:string; scheduleId:string; name:string; dueAt:string; startedAt:string; finishedAt?:string;
 period:ReportSchedule['period']; format:ReportSchedule['format']; filters:ReportFilters;
 scope:ReportScope|null; creator:Actor; recipient:Recipient;
 status:'generating'|'sending'|'sent'|'suppressed'|'refused'|'generation_failed'|'delivery_failed';
 cutoff?:string; dataVersion?:number; artifact?:{sha256:string;filename:string;contentType:string};
 detail:string; providerReference?:string; history:{at:string;status:string;detail:string}[]
}
export interface ReportFollowup {
 id:string; revision:string; runId:string; scheduleId:string; reason:string;
 assignedTo:string; assignedEmail:string; assignedName:string; createdAt:string;
 resolvedAt?:string; resolvedBy?:string; resolution?:string
}
