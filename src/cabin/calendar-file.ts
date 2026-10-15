import { type CalendarEvent, type Booking, need, fail } from './model'
function day(value: string) {
 need(/^\d{8}$/.test(value), 'Calendar dates must use YYYYMMDD')
 const iso = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`
 need(Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10) === iso, 'Calendar contains an invalid date')
 return iso
}
function instant(value: string, dateOnly: boolean) {
 if (dateOnly) return day(value)
 need(/^\d{8}T\d{6}Z$/.test(value), 'Use all-day dates or UTC calendar times. Floating times and time zones are unsupported.')
 const result = `${day(value.slice(0,8))}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}Z`
 need(Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0,19) + 'Z' === result, 'Calendar contains an invalid UTC time')
 return result
}
const unescape = (value: string) => value.replace(/\\([nN,;\\])/g, (_, char: string) => char === 'n' || char === 'N' ? '\n' : char)
/** RFC 5545 unfolds continuation lines; all-day DTEND stays end-exclusive. */
export function parseCalendar(value: unknown, existing: Booking[] = []): CalendarEvent[] {
 need(typeof value === 'string' && new TextEncoder().encode(value).length <= 200_000, 'Calendar file must be at most 200 KB')
 const lines = value.replace(/^\uFEFF/, '').replace(/\r\n[ \t]|\n[ \t]/g, '').split(/\r?\n/)
 need(lines[0]?.trim() === 'BEGIN:VCALENDAR' && lines.some(line => line.trim() === 'END:VCALENDAR'), 'Upload a VCALENDAR .ics file')
 const events = new Map<string, CalendarEvent>(); let fields: Map<string, { params: string; value: string }> | null = null
 for (const raw of lines) {
  const line = raw.trimEnd()
  if (line === 'BEGIN:VEVENT') { need(!fields, 'Nested calendar events are invalid'); fields = new Map(); continue }
  if (line === 'END:VEVENT') {
   need(fields, 'Invalid calendar event')
   const uid = unescape(fields.get('UID')?.value ?? '').trim(), cancelled = fields.get('STATUS')?.value.toUpperCase() === 'CANCELLED'
   need(uid.length > 0 && uid.length <= 500, 'Every calendar event requires a UID')
   const prior = existing.find(e => e.uid === uid), from = fields.get('DTSTART'), to = fields.get('DTEND')
   need(cancelled || (from && to), 'Every booking requires DTSTART and DTEND')
   need((from && to) || (cancelled && prior), 'Cancelled events without dates must identify an existing booking')
   const allDay = from ? from.params.includes('VALUE=DATE') || /^\d{8}$/.test(from.value) : false
   if (from && to) need(allDay === (to.params.includes('VALUE=DATE') || /^\d{8}$/.test(to.value)), 'Calendar start and end must use matching date types')
   const start = from ? instant(from.value, allDay) : prior!.start, end = to ? instant(to.value, allDay) : prior!.end
   need(start < end && Date.parse(start) < Date.parse(end), 'Calendar end must follow its start')
   const event: CalendarEvent = { uid,start,end,summary: unescape(fields.get('SUMMARY')?.value ?? prior?.summary ?? 'Reserved').slice(0,300),cancelled }
   const duplicate = events.get(uid)
   need(!duplicate || JSON.stringify(duplicate) === JSON.stringify(event), 'Duplicate UID has conflicting event details')
   events.set(uid,event); fields = null; need(events.size <= 300, 'Import at most 300 calendar events at a time'); continue
  }
  if (!fields || !line) continue
  const colon = line.indexOf(':'); need(colon > 0, 'Invalid calendar field')
  const keyAndParams = line.slice(0,colon), [rawKey] = keyAndParams.split(';'), key = rawKey.toUpperCase()
  if (['RRULE','RDATE','EXDATE','RECURRENCE-ID'].includes(key)) fail('Expand recurring events before importing this calendar')
  if (['UID','DTSTART','DTEND','SUMMARY','STATUS'].includes(key)) { need(!fields.has(key), `Duplicate ${key} in calendar event`); fields.set(key,{params:keyAndParams.toUpperCase(),value:line.slice(colon+1)}) }
 }
 need(!fields, 'Unclosed calendar event'); return [...events.values()].sort((a,b) => a.uid.localeCompare(b.uid))
}
