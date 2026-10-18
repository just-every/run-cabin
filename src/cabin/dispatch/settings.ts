import { type Context, type HomeSettings, need, integer, text, newId, manager, exact } from '../model'
import { ZONES } from '../clock'
import type { CleanerProfile, PropertyDispatch } from './types'

const number = (v: unknown, label: string, min: number, max: number) => integer(Number(v), label, min, max)
export function propertyDispatch(c: Context, p: Record<string, unknown>, previous?: PropertyDispatch): PropertyDispatch | undefined {
 if (p.dispatch === undefined) return previous
 need(p.dispatch && typeof p.dispatch === 'object' && !Array.isArray(p.dispatch), 'Enter turnover dispatch settings')
 const d = p.dispatch as Record<string, unknown>
 need(Array.isArray(d.approvedCleanerIds) && d.approvedCleanerIds.length > 0, 'Approve at least one cleaner or team')
 const approvedCleanerIds = [...new Set(d.approvedCleanerIds.map(id => text(id, 'approved cleaner ID')))]
 need(approvedCleanerIds.every(id => c.data.members.some(m => m.id === id && m.active && m.role === 'cleaner')), 'Only active cleaners or cleaner teams can be approved')
 const offerCount = number(d.offerCount, 'Simultaneous offers', 1, 3)
 need(offerCount === 1 || offerCount === 3, 'Offer to one cleaner or three eligible cleaners')
 const responseMinutes = number(d.responseMinutes, 'Response minutes', 5, 10080), reminderMinutes = number(d.reminderMinutes, 'Reminder minutes before response deadline', 1, 10080)
 need(reminderMinutes < responseMinutes, 'Send the reminder before the response deadline')
 return { templateName: text(d.templateName, 'template name', 100), instructions: typeof d.instructions === 'string' ? d.instructions.trim().slice(0, 2000) : '', durationMinutes: number(d.durationMinutes, 'Work minutes', 15, 1440), rateCents: number(d.rateCents, 'Rate in USD cents', 0, 10000000), startOffsetMinutes: number(d.startOffsetMinutes, 'Minutes after checkout', 0, 1440), finishBeforeMinutes: number(d.finishBeforeMinutes, 'Minutes before arrival', 0, 1440), approvedCleanerIds, offerCount, responseMinutes, reminderMinutes, escalationMinutes: number(d.escalationMinutes, 'Escalation minutes before arrival', 5, 1440), driveTimes: previous?.driveTimes ?? [] }
}
export function capacityCommand(c: Context, name: string, p: Record<string, unknown>) {
 if (name !== 'cleaner.capacity') return undefined
 manager(c.actor)
 const id = text(p.memberId, 'cleaner ID'), member = c.data.members.find(m => m.id === id && m.active && m.role === 'cleaner')
 need(member, 'Choose an active cleaner or team', 404)
 const old = c.data.cleanerProfiles.find(r => r.id === id)
 if (old) exact(old, p.revision)
 const timeZone = text(p.timeZone, 'home-base time zone', 40), availableFrom = text(p.availableFrom, 'daily start time', 5)
 need(ZONES.some(([z]) => z === timeZone), 'Choose a US time zone')
 need(/^([01]\d|2[0-3]):[0-5]\d$/.test(availableFrom), 'Enter a daily start time as HH:MM')
 const row: CleanerProfile = { id, revision: newId(), homeBase: text(p.homeBase, 'home-base address', 300), timeZone, availableFrom, dailyJobs: number(p.dailyJobs, 'Daily jobs', 1, 50), dailyMinutes: number(p.dailyMinutes, 'Daily work minutes', 15, 1440) }
 if (old) Object.assign(old, row); else c.data.cleanerProfiles.push(row)
 c.entityId = id; return row
}
export function driveCommand(c: Context, name: string, p: Record<string, unknown>, settings: HomeSettings) {
 if (name !== 'home.drive') return undefined
 manager(c.actor); exact(settings, p.revision)
 need(settings.dispatch, 'Configure this home’s dispatch template first', 409)
 const from = text(p.from, 'starting home or home base'), memberId = from.startsWith('base:') ? from.slice(5) : null
 const fromAddress = memberId ? c.data.cleanerProfiles.find(r => r.id === memberId)?.homeBase : c.data.homeSettings.find(r => r.propertyId === from)?.address
 need(fromAddress, 'Save the starting address or cleaner’s home base first')
 need(from !== settings.propertyId, 'Choose a different starting home')
 const minutes = number(p.minutes, 'One-way drive minutes', 0, 1440)
 const route = { from, minutes, fromAddress, toAddress: settings.address }
 settings.dispatch.driveTimes = [...settings.dispatch.driveTimes.filter(r => r.from !== from), route]
 settings.revision = newId(); c.entityId = settings.propertyId; return route
}
