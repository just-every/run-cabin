// Team routing for the guest inbox (MESSAGE-002). One case per guest thread carries who owns the answer, its deadline and its private context.
export interface CaseNote { id: string; at: string; byName: string; text: string; promise: boolean; doneAt: string | null }
export interface Handover { id: string; at: string; fromName: string; toId: string; toName: string; summary: string; reservation: string | null; tasks: { id: string; title: string; blocking: boolean }[]; promises: { id: string; text: string }[] }
/** claim.sent is false while a person says they are replying and true for the minutes after they sent a reply. */
export interface Claim { byId: string; byName: string; until: string; sent: boolean }
export interface ThreadCase {
 id: string; revision: string; key: string; propertyId: string | null; bookingId: string | null; guest: string
 status: 'open' | 'accepted' | 'answered'; urgency: 'normal' | 'urgent'; labels: string[]
 assigneeId: string | null; route: string; acceptedByName: string | null; acceptedAt: string | null
 waitingSince: string | null; dueAt: string | null; claim: Claim | null
 notes: CaseNote[]; handovers: Handover[]; escalations: { at: string; toId: string; toName: string }[]
}
export interface TeamTemplate { id: string; title: string; text: string }
export interface TeamRoute { id: string; propertyId: string | null; urgency: 'any' | 'urgent'; memberId: string }
/** days are 0 (Sunday) to 6; from and until are wall times at the property. A shift whose until is not after its from runs past midnight into the next day. */
export interface TeamShift { id: string; memberId: string; days: number[]; from: string; until: string; propertyId: string | null }
export interface TeamSettings { since: string; templates: TeamTemplate[]; routes: TeamRoute[]; shifts: TeamShift[]; normalMinutes: number; urgentMinutes: number; repeatMinutes: number; escalationMemberId: string | null }
