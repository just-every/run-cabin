export type IssueCategory = 'access' | 'maintenance' | 'cleaning' | 'emergency' | 'other'
export interface IssuePolicy {
 revision:string; responsibleId:string; responsibleName:string; responsibleEmail:string
 vendorIds:string[]; inspectorId:string; spendLimitCents:number; recurrenceMinutes:number
 instructions:{id:string;category:IssueCategory;title:string;answer:string}[]; approvedBy:string; approvedAt:string
}
export interface ServiceIssue {
 category:IssueCategory; source:'portal'|'inbox'|'staff'; messageId?:string; assignedId:string; assignedName:string; assignedEmail:string
 policyRevision:string; emergencyInstructions?:string
 troubleshooting?:{instructionId:string;title:string;answer:string;baseline:string;sources:string[];sentMessageId?:string}
 dispatch?:{vendorId:string;inspectorId:string;estimateCents:number;baseline:string;approvedBy?:string;approvedAt?:string}
 taskId?:string; previousTaskIds?:string[]; declines:{vendorId:string|null;at:string;reason:string}[]
 workRevision?:string; inspectedAt?:string; confirmationMessageId?:string
 guestConfirmedAt?:string; guestConfirmation?:string; recurrenceDueAt?:string; recurrenceRequestedAt?:string
 recurrenceConfirmedAt?:string; recurrenceEvidence?:string; humanAcceptedAt?:string
}
