export type Role = 'owner' | 'manager' | 'cleaner' | 'agent' | 'system'
export interface Actor { id: string; email: string; role: Role; isAgent: boolean; memberId?: string; operatorVersion: number; keyId?: string }
export interface Property { id: string; revision: number; name: string; ownerName: string; ownerEmail: string; commissionBps: number }
export interface Member { id: string; revision: number; name: string; email: string; role: 'manager' | 'cleaner'; active: boolean }
export type Channel = 'airbnb' | 'vrbo' | 'booking.com' | 'direct'
/** A stay holds a guest; a block closes nights without one (a channel's "Not available", an owner stay or maintenance). */
export interface CalendarEvent { uid: string; start: string; end: string; summary: string; cancelled: boolean; kind?: 'stay' | 'block'; guestName?: string }
/** source 'request' marks a hold Cabin itself granted (reservation.request); feeds never remove it, and a feed's matching stay adopts it. */
export interface Booking extends CalendarEvent { id: string; revision: string; propertyId: string; channel: Channel; status: 'confirmed' | 'cancelled'; approvedAt: string; source?: 'feed' | 'request'; arrivalTime?: string; collision?: string }
/** A channel's iCal export URL that Cabin polls (SYNC-009). */
export interface Connection { id: string; revision: string; propertyId: string; channel: Channel; url: string; intervalMinutes: number; status: 'pending' | 'ok' | 'stale'; error: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; lastChangeAt: string | null; nextPollAt: string; events: number; createdBy: string }
/** The listing's secret export token; replacing it revokes every old link. */
export interface ExportFeed { id: string; revision: string; propertyId: string; token: string; createdAt: string; createdBy: string }
export interface Request { id: string; revision: string; propertyId: string; channel: Channel; kind: 'stay' | 'block'; start: string; end: string; guestName: string; arrivalTime: string | null; note: string; status: 'accepted' | 'declined'; reason: string | null; overlaps: string | null; bookingId: string | null; requestedBy: string; requestedAt: string }
export interface Feed { id: string; propertyId: string; channel: Channel; importedAt: string; approvedAt: string; draftId: string }
export interface Clash { a: string; b: string; start: string; end: string }
export interface CalendarChange { kind: 'add' | 'change' | 'cancel' | 'remove'; uid: string; before?: Booking; after?: CalendarEvent }
export interface CalendarDraft { id: string; revision: string; propertyId: string; channel: Channel; importedAt: string; events: CalendarEvent[]; changes: CalendarChange[]; clashes: Clash[]; baseline: string; status: 'draft' | 'approved'; preparedBy: string; preparedAt: string; approval?: Approval }
export interface Approval { id: string; kind: string; recordId: string; revision: string; actorId: string; at: string }
export interface Completion { checks: string[]; photoId: string; caption: string; mimeType: string; sha256: string; completedBy: string; completedAt: string }
export interface Turnover { id: string; revision: string; bookingId: string; bookingRevision: string; propertyId: string; cleanerId: string; checklist: string[]; dueDate: string; status: 'draft' | 'approved' | 'completed'; preparedBy: string; preparedAt: string; approval?: Approval; completion?: Completion }
export interface StatementLine { description: string; amountCents: number }
export interface Statement { id: string; revision: string; propertyId: string; propertyRevision: number; propertyName: string; ownerName: string; ownerEmail: string; month: string; lines: StatementLine[]; commissionBps: number; grossCents: number; managementFeeCents: number; netCents: number; status: 'draft' | 'approved'; preparedBy: string; preparedAt: string; approval?: Approval }
export interface Event { id: string; actorId: string; actorRole: Role; action: string; entityId: string | null; at: string }
export const kinds = ['feeds', 'calendarDrafts', 'bookings', 'turnovers', 'statements', 'connections', 'exports', 'requests'] as const
export type RecordKind = typeof kinds[number]
export interface Data { version: number; properties: Property[]; members: Member[]; feeds: Feed[]; calendarDrafts: CalendarDraft[]; bookings: Booking[]; turnovers: Turnover[]; statements: Statement[]; connections: Connection[]; exports: ExportFeed[]; requests: Request[]; approvals: Approval[]; events: Event[] }
export interface State extends Data { actor: Actor; origin: string; managed: boolean; agentKeys: Record<string, unknown>[]; importJobs: Record<string, unknown>[] }
export interface Query { sql: string; params: any[] }
export interface Context { db: D1Database; actor: Actor; before: Data; data: Data; queries: Query[]; now: string; entityId: string | null }
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
 const approval = { id: newId(), kind, recordId: row.id, revision: row.revision, actorId: c.actor.id, at: c.now }
 row.status = 'approved'; row.approval = approval; c.data.approvals.push(approval); return approval
}
