import type { SourceLine } from './sources'
export interface Payout extends SourceLine { id:string; revision:string; propertyId:string|null; bookingId:string|null; importedAt:string; importedBy:string; match:'matched'|'unmatched'; statementId?:string }
export interface Delivery { id:string; revision:string; propertyId:string; statementId:string; email:string; status:'pending'|'sending'|'sent'|'suppressed'|'failed'|'unavailable'; at:string; detail:string|null; sentAt?:string }
export type { BookPosting as Posting } from './books'
