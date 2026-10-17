import type { AccessCode, Turnover } from '../model'

export interface RecoveryPolicy { id: string; revision: string; propertyId: string; cleanerIds: string[]; auto: boolean; creditLimitCents: number; cleaningLimitCents: number; savedBy: string }
export type Trigger = 'cleaner_cancelled' | 'not_ready' | 'late_checkout' | 'guest_problem'
export interface Proposal { cleanerId: string; creditCents: number; extraCleaningCents: number; why: string; baseline: string; guestText: string }
export interface Recovery {
 id: string; revision: string; propertyId: string; bookingId: string; turnoverId: string; trigger: Trigger; reason: string
 status: 'open' | 'proposed' | 'active' | 'ready' | 'closed' | 'undone' | 'escalated'; createdAt: string; createdBy: string
 proposal?: Proposal; history: { at: string; by: string; action: string; why: string }[]
 codeId?: string; creditMessageId?: string; confirmationMessageId?: string; balanceCents?: number; statementId?: string; closedAt?: string; acceptedAt?: string; manualAckAt?: string
 approvalId?: string; appliedBaseline?: string; previous?: { turnover: Turnover; code: AccessCode }; undoStatementId?: string
}
