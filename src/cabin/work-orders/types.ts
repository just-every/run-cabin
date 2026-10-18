import type { StoredPhoto } from '../model'
import type { ManagementTerms } from '../properties/terms'

export interface WorkApproval { id: string; by: string; at: string; revision: string; overLimit?: boolean }
export interface WorkOrder {
 asset: string
 priority: 'normal' | 'urgent'
 dueDate: string
 checklist: string[]
 requiresInspection: boolean
 inspectorId: string | null
 recurrenceDays: number
 spendLimitCents: number
 ownerTerms?: ManagementTerms
 accepted?: { by: string; at: string }
 declined?: { by: string; at: string; note: string }
 quote?: { id: string; description: string; amountCents: number; photos: StoredPhoto[]; approved?: WorkApproval }
 invoice?: { id: string; reference: string; amountCents: number; photos: StoredPhoto[]; approved?: WorkApproval }
 completed?: { by: string; at: string; checks: string[]; note: string; photos: StoredPhoto[] }
 inspectionHistory?: {by:string;at:string;note:string;accepted:boolean}[]
 inspected?: { by: string; at: string; note: string }
 blockId?: string
 recurrenceOf?: string
 nextTaskId?: string
 expenseId?: string
}
