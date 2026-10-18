import { type Context, type InboxSettings, type MessageChannel, type ScheduleRule, type ScheduleSetting, need, text, newId, property } from '../model'
import { DEFAULT_SCHEDULE, RULES, RULE_NAMES, stored, inboxSettings } from './settings'
export interface LifecycleHome {
 propertyId: string; revision: string; schedule: Record<ScheduleRule, ScheduleSetting>;
 quietFrom: string; quietUntil: string; channels: MessageChannel[]; managerEmail: string
}
export interface LifecycleSettings { homes: LifecycleHome[]; optouts: { bookingId: string; disabled: boolean; at: string; by: string; reason: string }[] }
export const lifecycleSettings = (inbox: InboxSettings): LifecycleSettings => inbox.lifecycle ?? { homes: [], optouts: [] }
export function lifecycleHome(data: { inbox: InboxSettings[] }, propertyId: string): LifecycleHome {
 const inbox = inboxSettings(data), home = inbox.lifecycle?.homes.find(h => h.propertyId === propertyId)
 return home ?? { propertyId, revision: '', schedule: inbox.schedule, quietFrom: '', quietUntil: '', channels: ['email', 'sms', 'booking.com'], managerEmail: '' }
}
export function lifecycleCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'inbox.lifecycle') {
  const home = property(c, p.propertyId), row = stored(c, p.revision), old = lifecycleHome(c.data, home.id)
  const quietFrom = String(p.quietFrom ?? ''), quietUntil = String(p.quietUntil ?? '')
  need((!quietFrom && !quietUntil) || [quietFrom, quietUntil].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) && quietFrom !== quietUntil, 'Choose both quiet-hour times, or leave both empty')
  const managerEmail = text(p.managerEmail, 'responsible manager email', 254).toLowerCase()
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail), 'Enter the responsible manager email')
  const channels = (['email', 'sms', 'booking.com'] as MessageChannel[]).filter(channel => p[channel] === true || p[channel] === 'on')
  need(channels.length, 'Allow at least one connected delivery channel')
  const schedule = Object.fromEntries(RULES.map(rule => {
   const value = old.schedule[rule] ?? DEFAULT_SCHEDULE[rule], hours = Number(p[`${rule}Hours`] ?? value.hours)
   need(Number.isInteger(hours) && hours >= 0 && hours <= 2160, 'Schedule hours must be between 0 and 2160')
   return [rule, { enabled: p[`${rule}Enabled`] === true || p[`${rule}Enabled`] === 'on', hours, subject: text(p[`${rule}Subject`] ?? value.subject, `${RULE_NAMES[rule]} subject`, 200), template: text(p[`${rule}Template`] ?? value.template, `${RULE_NAMES[rule]} message`, 4000) }]
  })) as Record<ScheduleRule, ScheduleSetting>
  row.lifecycle ??= { homes: [], optouts: [] }
  const saved = { propertyId: home.id, revision: newId(), schedule, quietFrom, quietUntil, channels, managerEmail }
  row.lifecycle.homes = [...row.lifecycle.homes.filter(h => h.propertyId !== home.id), saved]
  return saved
 }
 if (name === 'inbox.optout') {
  const b = c.data.bookings.find(b => b.id === p.bookingId); need(b, 'Stay not found', 404)
  const row = stored(c, p.revision); row.lifecycle ??= { homes: [], optouts: [] }
  const decision = { bookingId: b.id, disabled: p.disabled === true || p.disabled === 'on', at: c.now, by: c.actor.id, reason: text(p.reason, 'guest preference source', 500) }
  row.lifecycle.optouts = [...row.lifecycle.optouts.filter(o => o.bookingId !== b.id), decision]
  return decision
 }
 return undefined
}
