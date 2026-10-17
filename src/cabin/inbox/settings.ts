import { type Context, type InboxSettings, type ScheduleRule, type ScheduleSetting, need, text, integer, newId, manager } from '../model'
// The inbox's settings: the address the owner routed to this install (guest
// email lands there and guests' replies come back to it), the three lifecycle
// messages each stay gets, and the install's own AI key for drafted replies.
export const RULES: ScheduleRule[] = ['checkin', 'checkout', 'review']
export const RULE_NAMES: Record<ScheduleRule, string> = { checkin: 'Check-in instructions', checkout: 'Checkout reminder', review: 'Review request' }
/** checkin and checkout are sent `hours` before the home's check-in or check-out time; review `hours` after check-out. */
export const DEFAULT_SCHEDULE: Record<ScheduleRule, ScheduleSetting> = {
 checkin: { enabled: true, hours: 24, subject: 'Check-in details for {home}', template: 'Hi {guest},\n\nWelcome to {home}. Check-in is {checkin}.\n\nAddress: {address}\nDoor code: {code}\n\nYour stay page has the code and directions: {stay_link}\n\nReply to this email with any questions.' },
 checkout: { enabled: true, hours: 14, subject: 'Checkout tomorrow at {home}', template: 'Hi {guest},\n\nA reminder that check-out from {home} is {checkout}. Please lock the door behind you; the code stops working then.\n\nThank you for staying with us.' },
 review: { enabled: true, hours: 4, subject: 'Thank you for staying at {home}', template: 'Hi {guest},\n\nThank you for staying at {home}. If you enjoyed it, a review on the site you booked through would mean a lot to us.\n\nIf anything could have been better, reply to this email and tell us.' },
}
export const PLACEHOLDERS = ['{guest}', '{home}', '{checkin}', '{checkout}', '{address}', '{code}', '{stay_link}']
export const inboxSettings = (from: { data: { inbox: InboxSettings[] } } | { inbox: InboxSettings[] }): InboxSettings => ('data' in from ? from.data : from).inbox.find(r => r.id === 'inbox') ?? { id: 'inbox', revision: '', address: null, schedule: DEFAULT_SCHEDULE, ai: null, channelIds: {} }
/** The settings row to change, after checking the revision the person saw. */
export function stored(c: Context, revision: unknown) {
 const old = c.data.inbox.find(r => r.id === 'inbox')
 if (old) need(revision === old.revision, 'Inbox settings changed. Reload before saving.', 409)
 const row = old ?? { ...inboxSettings(c), schedule: structuredClone(DEFAULT_SCHEDULE) }
 if (!old) c.data.inbox.push(row)
 row.revision = newId(); c.entityId = 'inbox'; return row
}
/** A mailbox address; Cabin accepts guest mail sent to exactly this address and refuses the rest unread. */
export function mailbox(value: unknown) {
 const v = String(value ?? '').trim().toLowerCase()
 return /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(v) ? v : null
}
export function settingsCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name === 'inbox.address') {
  manager(c.actor)
  const value = String(p.address ?? '').trim(), address = value ? mailbox(value) : null
  need(!value || address, 'Enter the address you routed to Cabin, like guests@example.com')
  const row = stored(c, p.revision); row.address = address; return { address }
 }
 if (name === 'inbox.channels') {
  manager(c.actor); const row = stored(c, p.revision), ids: Record<string, string> = {}
  for (const prop of c.data.properties) { const v = String(p[`booking_${prop.id}`] ?? '').trim(); if (v) { need(/^\d{1,20}$/.test(v), 'A Booking.com property ID is a number'); ids[prop.id] = v } }
  row.channelIds = ids; return ids
 }
 if (name === 'inbox.schedule') {
  manager(c.actor); const row = stored(c, p.revision)
  for (const rule of RULES) {
   const on = p[`${rule}Enabled`], hours = Number(p[`${rule}Hours`] ?? row.schedule[rule].hours)
   row.schedule[rule] = { enabled: on === true || on === 'on' || on === 'true', hours: integer(hours, `${RULE_NAMES[rule]} hours`, 0, 720), subject: text(p[`${rule}Subject`] ?? row.schedule[rule].subject, `${RULE_NAMES[rule]} subject`, 200), template: text(p[`${rule}Template`] ?? row.schedule[rule].template, `${RULE_NAMES[rule]} message`, 4000) }
  }
  return row.schedule
 }
 return undefined
}
