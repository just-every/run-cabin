import { type Context, type Data, need, text, integer, newId, manager } from '../../model'
import { inboxSettings, stored } from '../settings'
import type { TeamSettings } from './types'
// Response windows count from the guest's unanswered message. Until a person saves team settings no thread is routed or escalated, so existing inboxes are not flooded with old threads.
export const DEFAULT_TEAM: TeamSettings = { since: '', templates: [], routes: [], shifts: [], normalMinutes: 240, urgentMinutes: 30, repeatMinutes: 30, escalationMemberId: null }
export const teamSettings = (data: Pick<Data, 'inbox'>): TeamSettings => ({ ...DEFAULT_TEAM, ...inboxSettings(data).team })
export const activeManager = (data: Pick<Data, 'members'>, id: unknown) => data.members.find(m => m.id === id && m.active && m.role === 'manager')
const wallTime = (v: unknown, label: string) => { const t = text(v, label, 5); need(/^([01]\d|2[0-3]):[0-5]\d$/.test(t), `${label} must be a time like 17:00`); return t }
const choose = (c: Context, v: unknown, label: string) => { const m = activeManager(c.data, v); need(m, `Choose an active manager for ${label}`); return m.id }
const homeOrAll = (c: Context, v: unknown) => { const id = String(v ?? '').trim(); if (!id) return null; need(c.data.properties.some(p => p.id === id), 'Property not found', 404); return id }
/** One command saves every team setting: section is template, route, shift or response; remove deletes the item named by id. */
export function teamSettingsCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'inbox.team.set') return undefined
 manager(c.actor); const row = stored(c, p.revision), team = { ...teamSettings(c.data) }
 team.since ||= c.now
 const section = String(p.section ?? ''), remove = p.remove === true || p.remove === 'on' || p.remove === 'yes', id = String(p.id ?? '')
 const list = { template: 'templates', route: 'routes', shift: 'shifts' } as const
 if (section in list) {
  const key = list[section as keyof typeof list], items = team[key] as { id: string }[]
  if (remove) { need(items.some(i => i.id === id), 'Not found', 404); (team[key] as unknown[]) = items.filter(i => i.id !== id) }
  else if (section === 'template') team.templates = [...team.templates, { id: newId(), title: text(p.title, 'template title', 80), text: text(p.text, 'template text', 2000) }]
  else if (section === 'route') team.routes = [...team.routes, { id: newId(), propertyId: homeOrAll(c, p.propertyId), urgency: p.urgency === 'urgent' ? 'urgent' : 'any', memberId: choose(c, p.memberId, 'the route') }]
  else {
   const days = Array.isArray(p.days) ? p.days.map(Number) : [0, 1, 2, 3, 4, 5, 6].filter(d => p[`day${d}`] === 'on' || p[`day${d}`] === true)
   need(days.length && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6), 'Choose the shift days')
   const from = wallTime(p.from, 'Shift start'), until = wallTime(p.until, 'Shift end'); need(from !== until, 'A shift needs different start and end times')
   team.shifts = [...team.shifts, { id: newId(), memberId: choose(c, p.memberId, 'the shift'), days: [...new Set(days)].sort(), from, until, propertyId: homeOrAll(c, p.propertyId) }]
  }
 } else if (section === 'response') {
  const normalMinutes = integer(Number(p.normalMinutes), 'Normal response minutes', 5, 10080), urgentMinutes = integer(Number(p.urgentMinutes), 'Urgent response minutes', 5, 1440)
  need(urgentMinutes <= normalMinutes, 'An urgent thread cannot wait longer than a normal one')
  Object.assign(team, { normalMinutes, urgentMinutes, repeatMinutes: integer(Number(p.repeatMinutes), 'Escalation repeat minutes', 5, 1440), escalationMemberId: choose(c, p.escalationMemberId, 'escalation') })
 } else need(false, 'Choose a team setting section')
 row.team = team; return team
}
