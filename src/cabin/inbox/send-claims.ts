import { newId } from '../model'

export type SendState = 'started' | 'accepted' | 'rejected' | 'uncertain' | 'suppressed' | 'unavailable' | 'discarded'
/** reference correlates an application delivery; it is not provider idempotency. */
export interface SendClaim {
 attemptId: string; attempt: number; reference: string; dueAt: string; startedAt: string; expiresAt: string
 state: SendState; providerId: string | null; assignedEmail: string; finishedAt?: string
 lateResult?: { state: SendState; providerId: string | null; at: string }
}
type SendRecord = { id: string; revision: string; status: string; send?: SendClaim }
export const UNCERTAIN_SEND = 'Submission outcome is uncertain after interruption. Check the provider before any resend.'
export function startSend(row: SendRecord, now: string, dueAt: string, assignedEmail: string) {
 row.send = { attemptId: newId(), attempt: (row.send?.attempt ?? 0) + 1, reference: row.id, dueAt, startedAt: now, expiresAt: new Date(Date.parse(now) + 5 * 60_000).toISOString(), state: 'started', providerId: null, assignedEmail }
 row.status = 'sending'; row.revision = newId()
}
/** Legacy in-flight rows have no provable live claim and must also be reviewed. */
export function sendExpired(row: SendRecord, now: string) {
 return row.status === 'sending' && (!row.send || row.send.state !== 'started' || !Number.isFinite(Date.parse(row.send.expiresAt)) || Date.parse(row.send.expiresAt) <= Date.parse(now))
}
export function ownsSend<T extends SendRecord>(row: T | undefined, claimed: SendRecord): row is T {
 return !!row && row.status === 'sending' && row.revision === claimed.revision && row.send?.state === 'started' && row.send.attemptId === claimed.send?.attemptId
}
export function finishSend(row: SendRecord, state: SendState, providerId: string | null, now: string) {
 if (row.send) Object.assign(row.send, { state, providerId, finishedAt: now })
}
export function resultState(status: string): SendState {
 return status === 'sent' ? 'accepted' : status === 'suppressed' ? 'suppressed' : status === 'unavailable' ? 'unavailable' : status === 'discarded' ? 'discarded' : 'rejected'
}
/** Keep a late receipt without undoing a newer revision or a person's resolution. */
export function retainLateResult(row: SendRecord | undefined, claimed: SendRecord, state: SendState, providerId: string | null, now: string) {
 if (!row?.send || row.send.attemptId !== claimed.send?.attemptId || row.send.state !== 'uncertain') return
 row.send.lateResult = { state, providerId, at: now }; row.revision = newId()
}
