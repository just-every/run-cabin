import type { AccessCode, Turnover } from '../model'

export type RecoveryAction = 'cleaner:assign' | 'credit:post' | 'access:write' | 'guest:send' | 'owner:notify'
export type RecoveryProvider = 'cabin' | 'mail' | 'seam'
export interface RecoveryAuthority {
 id: string; revision: string; state: 'active' | 'paused' | 'revoked'; actions: RecoveryAction[]; providers: RecoveryProvider[]
 startsAt: string; endsAt: string; grantedBy: string; grantedAt: string
}
export interface RecoveryPolicy { id: string; revision: string; propertyId: string; cleanerIds: string[]; auto: boolean; creditLimitCents: number; cleaningLimitCents: number; savedBy: string; futureDiscountBps?: number; authority?: RecoveryAuthority }
export interface RecoveryEffect {
 id: string; kind: 'mail' | 'lock'; sourceId: string; sourceRevision: string; sourceHash: string; action: RecoveryAction; provider: RecoveryProvider
 state: 'queued' | 'started' | 'acknowledged' | 'uncertain' | 'not_applied' | 'blocked'
 attempts: { id: string; at: string; state: 'started' | 'acknowledged' | 'uncertain' | 'not_applied'; reference?: string; resolvedBy?: string; resolvedAt?: string }[]
 detail: string; providerId?: string
}
export interface RecoveryExecution {
 principal: 'cabin:stay-recovery'; authorityId: string; authorityRevision: string; at: string; proposalRevision: string
 grant: RecoveryAuthority; limits: { creditLimitCents: number; cleaningLimitCents: number; cleanerIds: string[] }
 bookingRevision: string; recipient: string | null; propertyRevision: number; settingsRevision: string | null; cleanerId: string; effects: RecoveryEffect[]; capturedAt?: string
}
export type Trigger = 'cleaner_cancelled' | 'not_ready' | 'late_checkout' | 'guest_problem'
export interface Proposal { cleanerId: string; creditCents: number; extraCleaningCents: number; why: string; baseline: string; guestText: string; arrivalTime?: string; futureRate?: { guestId: string; expiresAt: string; baseline: string } }
export interface Recovery {
 restorePaused?:boolean;
 id: string; revision: string; propertyId: string; bookingId: string; turnoverId: string; trigger: Trigger; reason: string
 status: 'open' | 'proposed' | 'active' | 'ready' | 'closed' | 'undone' | 'escalated'; createdAt: string; createdBy: string
 proposal?: Proposal; history: { at: string; by: string; action: string; why: string }[]
 codeId?: string; creditMessageId?: string; confirmationMessageId?: string; balanceCents?: number; statementId?: string; closedAt?: string; acceptedAt?: string; manualAckAt?: string
 offerId?: string; offerUrl?: string; guestAcceptedAt?: string; guestAcceptedRevision?: string;
 approvalId?: string; appliedBaseline?: string; previous?: { turnover: Turnover; code: AccessCode; arrivalTime?: string }; undoStatementId?: string
 execution?: RecoveryExecution
}
