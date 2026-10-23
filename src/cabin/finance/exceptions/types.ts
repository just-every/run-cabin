import type { SourceLine } from '../sources'
export interface FinancialCase {
 agreement?:import('../../properties/terms').ManagementTerms;
 id:string; revision:string; propertyId:string; bookingId:string; createdAt:string; createdBy:string;
 reason:string; status:'investigating'|'awaiting_records'|'proposed'|'corrected'; restorePaused?:boolean;
 requests:{id:string; kind:'settlement'|'fee'|'refund'|'bank'; detail:string; requestedBy:string; at:string; resolvedBy?:string; evidenceId?:string}[];
 proposals:{id:string; status:'proposed'|'rejected'|'approved'; payoutId:string; originalJournalId:string; source:SourceLine; csv:string; evidence:string; sourceDigest:string; baseline:string; effectiveDate:string; why:string; proposedBy:string; at:string; decisionBy?:string; decisionAt?:string; decisionReason?:string; journalIds?:string[]}[];
 history:{at:string; by:string; action:string; reference?:string}[];
}
