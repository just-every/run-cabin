import type { Context, Data, GuestMessage } from '../../model'
import { homeSettings } from '../../homes'
import { wall } from '../../clock'
import { teamSettings, activeManager } from './settings'
import type { ThreadCase, TeamShift } from './types'
// Urgency comes from the guest's words and a person can change it. Access trouble and safety words make a thread urgent.
const ACCESS = /\b(locked out|lockout|stuck outside|(?:can'?t|cannot|unable to|won'?t|doesn'?t|isn'?t|not)\s+(?:\w+\s+){0,3}(?:get in|enter|open|unlock|work)\w*)\b/i
const SAFETY = /\b(emergency|no (?:hot )?water|no power|power (?:is )?out|gas|smoke|flood\w*|fire|unsafe)\b/i
export function triage(message: string) {
 const access = ACCESS.test(message) && /\b(door|lock|code|key|keypad|gate|get in|inside)\b/i.test(message), safety = SAFETY.test(message)
 return { urgency: access || safety ? 'urgent' as const : 'normal' as const, labels: [...(access ? ['access'] : []), ...(safety ? ['safety'] : [])] }
}
/** A shift covers a property-local instant; a shift ending at or before its start runs into the next day. */
export function covers(shift: TeamShift, propertyId: string | null, zone: string, ms: number) {
 if (shift.propertyId && shift.propertyId !== propertyId) return false
 const local = wall(ms, zone), hm = local.slice(11), dow = new Date(local.slice(0, 10) + 'T00:00:00Z').getUTCDay()
 if (shift.from < shift.until) return shift.days.includes(dow) && hm >= shift.from && hm < shift.until
 return (shift.days.includes(dow) && hm >= shift.from) || (shift.days.includes((dow + 6) % 7) && hm < shift.until)
}
export const zoneOf = (data: Pick<Data, 'homeSettings' | 'properties'>, propertyId: string | null) => homeSettings(data, propertyId ?? data.properties[0]?.id ?? '').timeZone
/** Precedence: the most specific matching route (property beats any, urgent beats any), moved to whoever is on shift when that person has shifts and is off; with nobody on shift, the escalation manager. */
export function assignee(c: Pick<Context, 'data'>, row: Pick<ThreadCase, 'propertyId' | 'urgency'>, ms: number) {
 const team = teamSettings(c.data), zone = zoneOf(c.data, row.propertyId)
 const on = (id: string) => team.shifts.some(s => s.memberId === id && covers(s, row.propertyId, zone, ms)), shifted = (id: string) => team.shifts.some(s => s.memberId === id)
 const routed = team.routes.filter(r => (!r.propertyId || r.propertyId === row.propertyId) && (r.urgency === 'any' || r.urgency === row.urgency) && activeManager(c.data, r.memberId))
  .sort((a, b) => (+!!b.propertyId * 2 + +(b.urgency === 'urgent')) - (+!!a.propertyId * 2 + +(a.urgency === 'urgent')))[0]
 if (routed && (!shifted(routed.memberId) || on(routed.memberId))) return { memberId: routed.memberId, route: 'Route for this home and urgency' }
 const cover = c.data.members.filter(m => m.active && m.role === 'manager' && on(m.id)).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0]
 if (cover) return { memberId: cover.id, route: routed ? `On shift now; ${activeManager(c.data, routed.memberId)?.name} is off shift` : 'On shift now' }
 const fallback = activeManager(c.data, team.escalationMemberId)
 return { memberId: fallback?.id ?? null, route: fallback ? 'Nobody on shift; escalation manager' : 'Nobody on shift and no escalation manager set' }
}
/** The guest's newest message when nobody has answered it. Scheduled lifecycle mail, drafts and failed or unavailable sends do not answer a guest. */
export function awaiting(messages: GuestMessage[]) {
 const real = messages.filter(m => m.status !== 'draft' && m.status !== 'drafting' && (m.direction === 'in' || m.source !== 'scheduled'))
 const last = real[real.length - 1]
 if (!last) return null
 return last.direction === 'in' ? last : ['pending', 'sending', 'sent', 'suppressed'].includes(last.status) ? null : [...real].reverse().find(m => m.direction === 'in') ?? null
}
