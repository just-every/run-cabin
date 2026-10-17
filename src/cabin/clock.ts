// Property-local wall times. Stays, turnover windows and door codes are kept as
// 'YYYY-MM-DDTHH:MM' at the home, with the home's IANA time zone beside them.
export const ZONES: [string, string][] = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']]
const formats = new Map<string, Intl.DateTimeFormat>()
function parts(ms: number, zone: string) {
 let f = formats.get(zone)
 if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); formats.set(zone, f) }
 const v = Object.fromEntries(f.formatToParts(new Date(ms)).map(p => [p.type, p.value]))
 return { y: +v.year, m: +v.month, d: +v.day, h: +v.hour % 24, min: +v.minute, s: +v.second }
}
const offset = (ms: number, zone: string) => { const p = parts(ms, zone); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000 }
/** The UTC instant of a property-local wall time. */
export function instant(local: string, zone: string) { const guess = Date.parse(local + ':00Z'); let t = guess - offset(guess, zone); t = guess - offset(t, zone); return t }
/** The property-local wall time of an instant. */
export function wall(ms: number, zone: string) { const p = parts(ms, zone), two = (n: number) => String(n).padStart(2, '0'); return `${p.y}-${two(p.m)}-${two(p.d)}T${two(p.h)}:${two(p.min)}` }
/** The zone's short name at that instant, such as EDT or HST. */
export const zoneAbbr = (ms: number, zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName')?.value ?? zone
export const localDay = (ms: number, zone: string) => wall(ms, zone).slice(0, 10)
export const time12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}` }
const day = (date: string, weekday = true) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { ...(weekday ? { weekday: 'short' } : {}), month: 'short', day: 'numeric', timeZone: 'UTC' } as Intl.DateTimeFormatOptions)
/** "Sat Oct 24, 10 am" */
export const when = (local: string) => `${day(local.slice(0, 10))}, ${time12(local.slice(11, 16))}`
/** "Sat Oct 24, 10 am → 4 pm" or across days "Fri Oct 23, 10 am → Sat Oct 24, 4 pm" */
export const between = (from: string, until: string) => from.slice(0, 10) === until.slice(0, 10) ? `${when(from)} → ${time12(until.slice(11, 16))}` : `${when(from)} → ${when(until)}`
export const dayName = (date: string, today: string) => date === today ? 'today' : Date.parse(date) - Date.parse(today) === 86_400_000 ? 'tomorrow' : Date.parse(date) - Date.parse(today) < 7 * 86_400_000 && date > today ? new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : day(date, false)
