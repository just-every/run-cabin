import type { RecoveryEffectTicket } from '../recovery/effects'

/** Persisted before the provider write. An interrupted started attempt is read-only. */
export interface LockJob {
 id:string
 fingerprint:string
 revision:string
 operation:'create'|'update'|'delete'
 deviceId:string|null
 name:string
 code:string
 starts_at:string
 ends_at:string
 stage:'prepared'|'started'|'observing'|'complete'
 claim:{token:string;until:string}|null
 startedAt?:string
 acceptedAt?:string
 providerId:string|null
 actionAttemptId?:string
 recovery?:RecoveryEffectTicket|null
}
export interface SeamCode {
 access_code_id:string
 device_id:string
 name?:string
 code?:string
 starts_at?:string
 ends_at?:string
 status?:string
 errors?:unknown[]
 pending_mutations?:unknown[]
 is_being_deleted?:boolean
}
export interface Observation {
 state:'pending'|'set'|'removed'|'failed'
 providerId:string|null
 error:string|null
 complete:boolean
 acknowledged:boolean
}
