// Resolve today in the home's zone before adding calendar days. Adding elapsed
// 24-hour periods to the current instant can cross the wrong date around DST.
export function homeDay(offset, timeZone, now = Date.now()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]))
 const today = `${parts.year}-${parts.month}-${parts.day}`
 return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}
