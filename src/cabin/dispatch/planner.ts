import type { Context, Turnover } from '../model'
import { homeSettings } from '../homes'
import { instant, localDay } from '../clock'

export const directions = (from: string, to: string) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`
export function driveMinutes(c: Context, memberId: string, propertyId: string, from?: string): number | null {
 const settings = homeSettings(c, propertyId), profile = c.data.cleanerProfiles.find(r => r.id === memberId)
 const key = from ?? `base:${memberId}`
 if (key === propertyId) return 0
 const address = from ? homeSettings(c, from).address : profile?.homeBase
 if (!address || !settings.address) return null
 const route = settings.dispatch?.driveTimes.find(r => r.from === key && r.fromAddress === address && r.toAddress === settings.address)
 return route?.minutes ?? null
}
export interface Plan { ok: boolean; reason: string; start?: string; end?: string; baseMinutes?: number }
/** Re-evaluated at offer creation and acceptance; offers never reserve capacity. */
export function planAssignment(c: Context, memberId: string, candidate: Turnover, accepting = true): Plan {
 const bad = (reason: string): Plan => ({ ok: false, reason })
 const member = c.data.members.find(m => m.id === memberId && m.active && m.role === 'cleaner')
 if (!member) return bad('Cleaner or team is inactive')
 const settings = homeSettings(c, candidate.propertyId), config = settings.dispatch
 if (!config?.approvedCleanerIds.includes(memberId)) return bad('Cleaner or team is not approved for this property')
 const profile = c.data.cleanerProfiles.find(r => r.id === memberId)
 if (!profile) return bad('Daily capacity and home-base address have not been saved')
 if (!candidate.windowStart || !candidate.windowEnd) return bad('Turnover window has not been set')
 const day = localDay(instant(candidate.windowStart, settings.timeZone), profile.timeZone)
 const jobs = c.data.turnovers.filter(t => t.id !== candidate.id && t.cleanerId === memberId && (t.status === 'approved' || t.status === 'completed') && t.windowStart && localDay(instant(t.windowStart, homeSettings(c, t.propertyId).timeZone), profile.timeZone) === day)
 jobs.push(candidate)
 if (jobs.length > profile.dailyJobs) return bad(`Daily capacity exceeded: ${jobs.length} jobs; limit ${profile.dailyJobs}`)
 jobs.sort((a, b) => instant(a.windowStart!, homeSettings(c, a.propertyId).timeZone) - instant(b.windowStart!, homeSettings(c, b.propertyId).timeZone) || a.id.localeCompare(b.id))
 let finish = instant(`${day}T${profile.availableFrom}`, profile.timeZone), prior: Turnover | undefined, total = 0, start = 0, end = 0
 for (const job of jobs) {
  const home = homeSettings(c, job.propertyId), duration = job.dispatch?.durationMinutes ?? home.dispatch?.durationMinutes
  if (!duration) return bad('Another assigned turnover has no saved work duration; a manager must review capacity')
  const drive = driveMinutes(c, memberId, job.propertyId, prior?.propertyId)
  if (drive === null) return bad(`Drive time missing or addresses changed: ${prior ? c.data.properties.find(p => p.id === prior!.propertyId)?.name ?? 'previous home' : 'home base'} → ${c.data.properties.find(p => p.id === job.propertyId)?.name ?? 'home'}`)
  total += duration + drive
  if (total > profile.dailyMinutes) return bad(`Daily hours exceeded: ${total} work and drive minutes; limit ${profile.dailyMinutes}`)
  const begin = Math.max(instant(job.windowStart!, home.timeZone), finish + drive * 60000, accepting && job.id === candidate.id ? Date.parse(c.now) : 0)
  finish = begin + duration * 60000
  if (finish > instant(job.windowEnd!, home.timeZone)) return bad(`Cannot reach and finish ${c.data.properties.find(p => p.id === job.propertyId)?.name ?? 'the next home'} within its window (${drive} drive minutes, ${duration} work minutes)`)
  if (job.id === candidate.id) { start = begin; end = finish }
  prior = job
 }
 return { ok: true, reason: '', start: new Date(start).toISOString(), end: new Date(end).toISOString(), baseMinutes: driveMinutes(c, memberId, candidate.propertyId) ?? undefined }
}
