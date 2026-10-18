/** All travel figures are entered by a manager, with the addresses they describe. */
export interface DriveTime { from: string; minutes: number; fromAddress: string; toAddress: string }
export interface PropertyDispatch {
 templateName: string; instructions: string; durationMinutes: number; rateCents: number
 startOffsetMinutes: number; finishBeforeMinutes: number; approvedCleanerIds: string[]
 offerCount: 1 | 3; responseMinutes: number; reminderMinutes: number; escalationMinutes: number
 driveTimes: DriveTime[]
}
export interface CleanerProfile {
 id: string; revision: string; homeBase: string; timeZone: string
 dailyJobs: number; dailyMinutes: number; availableFrom: string
}
export interface TurnoverOffer {
 id: string; generation: string; memberId: string; offeredAt: string; expiresAt: string
 status: 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn'
 respondedAt?: string; reason?: string; reminderAt?: string
}
export interface TurnoverDispatch {
 generation: string; baseline: string; templateName: string; instructions: string
 durationMinutes: number; rateCents: number; offers: TurnoverOffer[]
 acceptedBy?: string; acceptedAt?: string; scheduledStart?: string; scheduledEnd?: string
 excludedCleanerIds?: string[]
 reasons: string[]; escalatedAt?: string; completionReminderAt?: string
}
