import type { ReadinessPlan, ReadinessRecord } from './readiness/records'
import type { RentalAgreement, RentalTemplate } from './agreements/types'
import type { GuestData } from './guests/types'
import type { CleanerProfile, PropertyDispatch, TurnoverDispatch } from './dispatch/types'
import type { LedgerSetting } from './ledger/types'
import type { Recovery, RecoveryPolicy } from './recovery/types'
import type { Payout, Delivery, Posting } from './finance/types'
export type Role = 'owner' | 'manager' | 'cleaner' | 'agent' | 'system'
export interface Actor { id: string; email: string; role: Role; isAgent: boolean; memberId?: string; operatorVersion: number; keyId?: string }
export interface Property { id: string; revision: number; name: string; ownerName: string; ownerEmail: string; commissionBps: number }
export interface Member { id: string; revision: number; name: string; email: string; role: 'manager' | 'cleaner'; active: boolean }
export type Channel = 'airbnb' | 'vrbo' | 'booking.com' | 'direct' | 'ical'
/** A stay holds a guest; a block closes nights without one (a channel's "Not available", an owner stay or maintenance). */
export interface CalendarEvent { uid: string; start: string; end: string; summary: string; cancelled: boolean; kind?: 'stay' | 'block'; guestName?: string }
/** source 'request' marks a hold Cabin itself granted (reservation.request); feeds never remove it, and a feed's matching stay adopts it. */
export interface Booking extends CalendarEvent { id: string; revision: string; propertyId: string; channel: Channel; status: 'confirmed' | 'cancelled'; approvedAt: string; source?: 'feed' | 'request' | 'migration'; arrivalTime?: string; guestErasedAt?: string; collision?: string; guestEmail?: string; guestPhone?: string; channelRef?: string; connectionId?: string }
/** A channel's iCal export URL that Cabin polls (SYNC-009). */
export interface Connection { id: string; revision: string; propertyId: string; channel: Channel; url: string; intervalMinutes: number; status: 'pending' | 'ok' | 'stale'; error: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; lastChangeAt: string | null; nextPollAt: string; events: number; createdBy: string; name?: string; exception?: { id: string; assignedTo: string; assignedName: string; openedAt: string; resolvedAt: string | null } }
/** The listing's secret export token; replacing it revokes every old link. */
export interface ExportFeed { id: string; revision: string; propertyId: string; token: string; createdAt: string; createdBy: string }
export interface Request { id: string; revision: string; propertyId: string; channel: Channel; kind: 'stay' | 'block'; start: string; end: string; guestName: string; arrivalTime: string | null; note: string; status: 'accepted' | 'declined'; reason: string | null; overlaps: string | null; bookingId: string | null; requestedBy: string; requestedAt: string }
export interface Feed { id: string; propertyId: string; channel: Channel; importedAt: string; approvedAt: string; draftId: string }
export interface Clash { a: string; b: string; start: string; end: string }
export interface CalendarChange { kind: 'add' | 'change' | 'cancel' | 'remove'; uid: string; before?: Booking; after?: CalendarEvent }
export interface CalendarDraft { id: string; revision: string; propertyId: string; channel: Channel; importedAt: string; events: CalendarEvent[]; changes: CalendarChange[]; clashes: Clash[]; baseline: string; status: 'draft' | 'approved'; preparedBy: string; preparedAt: string; approval?: Approval }
export interface Approval { id: string; kind: string; recordId: string; revision: string; actorId: string; actorName?: string; at: string }
export interface StoredPhoto { id: string; mimeType: string; sha256: string }
/** photoId, mimeType and sha256 name the first (cover) photo; photos lists every one. */
export interface Completion { checks: string[]; photoId: string; caption: string; mimeType: string; sha256: string; photos?: StoredPhoto[]; completedBy: string; completedAt: string }
/** What the cleaner was last emailed; a difference from the current assignment sends the next notice. */
export interface Notified { cleanerId: string; windowStart: string; windowEnd: string; code: string }
/** source 'auto' marks the one turnover Cabin dispatches for each stay; windows are property-local wall times (YYYY-MM-DDTHH:MM). */
export interface Turnover { id: string; revision: string; bookingId: string; bookingRevision: string; propertyId: string; cleanerId: string | null; checklist: string[]; dueDate: string; status: 'draft' | 'unassigned' | 'approved' | 'completed' | 'cancelled'; preparedBy: string; preparedAt: string; approval?: Approval; completion?: Completion; source?: 'auto' | 'manual'; photosRequired?: number; windowStart?: string; windowEnd?: string; nextBookingId?: string | null; cancelReason?: string; checkedOut?: { at: string; by: string; source: 'cleaner' | 'staff' }; notified?: Notified | null; dispatch?: TurnoverDispatch; history?: { at: string; by: string; action: string; cleanerId: string | null }[] }
/** Per-home operations: where the cleaner goes, when stays turn over, who cleans and who fixes things. id is the property id. */
export interface HomeSettings { id: string; revision: string; propertyId: string; address: string; timeZone: string; checkInTime: string; checkOutTime: string; cleanerId: string | null; maintenanceId: string | null; checklist: string[]; photosRequired: number; lockDeviceId: string | null; dispatch?: PropertyDispatch }
export interface LockState { state: 'manual' | 'pending' | 'set' | 'removed' | 'failed'; providerId: string | null; error: string | null; at: string | null }
/** A door code bound to a stay (guest) or its turnover (cleaner), valid between property-local wall times. link is the guest's secret stay-page token. */
export interface AccessCode { id: string; revision: string; propertyId: string; bookingId: string; turnoverId: string | null; holder: 'guest' | 'cleaner'; memberId: string | null; code: string; validFrom: string; validUntil: string; timeZone: string; status: 'issued' | 'revoked'; reason: string | null; link: string | null; lock: LockState; createdAt: string }
export interface Notice { id: string; revision: string; propertyId: string; memberId: string; email: string; kind: 'assigned' | 'changed' | 'removed' | 'cancelled' | 'task' | 'inbox'; recordId: string; subject: string; text: string; status: 'pending' | 'sending' | 'sent' | 'suppressed' | 'unavailable' | 'failed'; detail: string | null; createdAt: string; sentAt: string | null }
export interface Task { id: string; revision: string; propertyId: string; turnoverId: string | null; title: string; note: string; blocking: boolean; assigneeId: string | null; status: 'open' | 'closed'; photos: StoredPhoto[]; raisedBy: string; raisedByName: string; raisedAt: string; closedBy: string | null; closedAt: string | null; closeNote: string; closePhotos: StoredPhoto[]; notified: string | null }
/** One message in a guest's thread (inbox/threads.ts); ref is a channel's reservation number when no stay matched it. Inbound messages are 'received'; a draft waits for a person; an approved or written reply is 'pending' until it is sent. */
export type MessageChannel = 'email' | 'sms' | 'airbnb' | 'vrbo' | 'booking.com'
export interface ReplyControl { confidence: number; topic: 'checkin' | 'checkout' | 'instructions' | 'other'; needsHost: boolean; instructionId: string | null; baseline: string; dueAt: string; assignedEmail: string; escalatedAt?: string; automatic?: boolean }
export interface ReplyPolicy { propertyId: string; revision: string; instructions: { id: string; title: string; answer: string }[]; enabled: boolean; topics: string[]; minConfidence: number; from: string; until: string; replyMinutes: number; managerEmail: string; approvedBy: string; approvedAt: string }
export interface GuestMessage { control?: ReplyControl; id: string; revision: string; propertyId: string | null; bookingId: string | null; email: string | null; phone: string | null; ref: string | null; channel: MessageChannel; direction: 'in' | 'out'; source: 'guest' | 'host' | 'scheduled' | 'template' | 'ai'; status: 'received' | 'drafting' | 'draft' | 'pending' | 'sending' | 'sent' | 'suppressed' | 'unavailable' | 'failed' | 'discarded'; subject: string; text: string; detail: string | null; replyTo: string | null; headerId: string | null; sentBy: string | null; approvalId: string | null; scheduledId: string | null; providerId: string | null; grounds: string[]; createdAt: string; sentAt: string | null }
export type ScheduleRule = 'checkin' | 'checkout' | 'review'
/** A lifecycle message due for a stay; dueAt is the UTC instant from the stay's dates and the home's times, anchor the stay's check-in or check-out it is timed from, code the guest door code and hours a check-in message states, updated set when it re-sends corrected details. */
export interface Scheduled { id: string; revision: string; propertyId: string; bookingId: string; rule: ScheduleRule; dueAt: string; deadline: string; anchor?: string; code?: string; content?: string; updated?: boolean; status: 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'skipped' | 'unavailable' | 'suppressed' | 'failed'; reason: string | null; messageId: string | null; createdAt: string; sentAt: string | null }
export interface ScheduleSetting { enabled: boolean; hours: number; subject: string; template: string }
/** The install's inbox: the routed guest address, the lifecycle schedule and its own AI key (sealed). id is always 'inbox'. */
export interface InboxSettings { replyPolicies?: ReplyPolicy[]; id: string; revision: string; address: string | null; schedule: Record<ScheduleRule, ScheduleSetting>; ai: { model: string; workspace: string; keySealed: string; keyHint: string; savedBy: string; savedAt: string } | null; channelIds: Record<string, string> }
export interface StatementLine { description: string; amountCents: number; payoutId?:string; bookingId?:string; category?:'gross'|'channelFee'|'expense' }
export interface Statement { id: string; revision: string; propertyId: string; propertyRevision: number; propertyName: string; ownerName: string; ownerEmail: string; month: string; lines: StatementLine[]; source?:'imported'|'manual'|'recovery'; recoveryId?:string; reversalOf?:string; payoutIds?:string[]; channelFeeCents?:number; settlementCents?:number; expenseCents?:number; sourceBaseline?:string; commissionBps: number; grossCents: number; managementFeeCents: number; netCents: number; status: 'draft' | 'approved'; preparedBy: string; preparedAt: string; approval?: Approval }
export interface Event { id: string; actorId: string; actorRole: Role; action: string; entityId: string | null; at: string }
export const kinds = ['readinessPlans', 'readinessRecords', 'rentalTemplates', 'rentalAgreements', 'guests', 'guestMerges', 'guestPolicies', 'guestOffers', 'cleanerProfiles', 'ledgerSettings', 'feeds', 'calendarDrafts', 'bookings', 'turnovers', 'statements', 'connections', 'exports', 'requests', 'homeSettings', 'codes', 'notices', 'tasks', 'payouts', 'deliveries', 'postings', 'messages', 'scheduled', 'inbox', 'recoveries', 'recoveryPolicies'] as const
export type RecordKind = typeof kinds[number]
export interface Data extends GuestData { readinessPlans: ReadinessPlan[]; readinessRecords: ReadinessRecord[]; rentalTemplates: RentalTemplate[]; rentalAgreements: RentalAgreement[]; cleanerProfiles: CleanerProfile[]; ledgerSettings: LedgerSetting[]; recoveries: Recovery[]; recoveryPolicies: RecoveryPolicy[]; version: number; properties: Property[]; members: Member[]; feeds: Feed[]; calendarDrafts: CalendarDraft[]; bookings: Booking[]; turnovers: Turnover[]; statements: Statement[]; connections: Connection[]; exports: ExportFeed[]; requests: Request[]; homeSettings: HomeSettings[]; codes: AccessCode[]; notices: Notice[]; tasks: Task[]; messages: GuestMessage[]; scheduled: Scheduled[]; inbox: InboxSettings[]; payouts:Payout[]; deliveries:Delivery[]; postings:Posting[]; approvals: Approval[]; events: Event[] }
export interface State extends Data { actor: Actor; origin: string; local: boolean; workerName: string | null; managed: boolean; lockAccount: boolean; messaging: { sms: boolean; booking: boolean }; agentKeys: Record<string, unknown>[]; importJobs: Record<string, unknown>[] }
export interface Query { sql: string; params: any[] }
export interface Context { audit?:import('./audit/write').Scope[]; db: D1Database; actor: Actor; before: Data; data: Data; queries: Query[]; now: string; entityId: string | null }
export const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }) }
export function need(condition: unknown, message: string, status = 400): asserts condition { if (!condition) fail(message, status) }
export function text(value: unknown, label: string, max = 200): string { need(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `Enter ${label} (up to ${max} characters)`); return value.trim() }
export function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number { need(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, `${label} must be an integer from ${min} to ${max}`); return value }
export const newId = () => crypto.randomUUID()
export function manager(actor: Actor) { need(actor.role === 'owner' || actor.role === 'manager', 'Manager access required', 403) }
export function preparer(actor: Actor) { need(['owner', 'manager', 'agent'].includes(actor.role), 'Manager access required', 403) }
export function owner(actor: Actor) { need(actor.role === 'owner', 'Owner access required', 403) }
export const query = (sql: string, ...params: any[]): Query => ({ sql, params })
export const guard = (sql: string, ...params: any[]) => query(`INSERT INTO cb_guard(ok) SELECT CASE WHEN (${sql}) THEN 1 ELSE 0 END`, ...params)
export const sha = async (value: string | Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value))), b => b.toString(16).padStart(2, '0')).join('')
export function property(c: Context, id: unknown) { const p = c.data.properties.find(p => p.id === text(id, 'property ID')); need(p, 'Property not found', 404); return p }
export function exact(row: { revision: string }, value: unknown) { need(typeof value === 'string' && row.revision === value, 'The revision changed. Review this exact draft again.', 409) }
export function approve(c: Context, kind: string, row: { id: string; revision: string; status: string; approval?: Approval }, revision: unknown) {
 manager(c.actor); exact(row, revision); need(row.status === 'draft', 'This draft has already been approved', 409)
 const approval: Approval = { id: newId(), kind, recordId: row.id, revision: row.revision, actorId: c.actor.id, at: c.now }
 row.status = 'approved'; row.approval = approval; c.data.approvals.push(approval); return approval
}
