import type { AgentChannel } from './types'
export type ReadKind = 'read-reservations' | 'read-messages' | 'read-payouts'
export interface ReadAction {
 id:string; accountId?:string; accountGeneration?:string; profileId:string; propertyId:string; channel:AgentChannel; kind:ReadKind;
 readUrl:string; profileGeneration:string; createdAt:string;
}
export interface ReadPayload { observedAt:string; records:Record<string,string>[] }
/** Source values are copied from visible cells; optional means absent, never inferred. */
export interface ReservationRead extends Record<string,string> {
 reservationId:string; guestName:string; start:string; end:string; status:string;
}
export interface MessageRead extends Record<string,string> {
 reservationId:string; messageId:string; text:string; sentAt:string;
}
export interface PayoutRead extends Record<string,string> {
 transactionId:string; payoutId:string; reservationId:string; date:string; currency:string;
 gross:string; fee:string; net:string; type:string; status:string;
}
export const READ_SOURCE='channelAgentReadSources', READ_OBSERVATION='channelAgentReadObservations'
export interface ReadSource {
 id:string; accountId?:string; propertyId:string; profileId:string; generation:string; channel:AgentChannel;
 kind:ReadKind; observedAt:string; fingerprint:string; bookingId?:string; bookingRevision?:string;
 messageId?:string; status?:string;
}
