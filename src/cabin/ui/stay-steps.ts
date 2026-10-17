import { h } from './shared'
import { homeSettings } from '../homes'
import { wall, time12 } from '../clock'
import { icon } from './icons'
// The Stay recovery panel's timestamped checklist: what already happened, each
// at the home's local time (today as a time, earlier days as a date), then the
// one step still open.
export interface Step { at: string; title: string; note: string; tone: 'done' | 'muted' | 'bad' }
export const panelDay = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
function stamp(s: any, propertyId: string, iso: string, today: string) {
  const local = wall(Date.parse(iso), homeSettings(s, propertyId).timeZone)
  return local.slice(0, 10) === today ? time12(local.slice(11, 16)) : new Date(local.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
export function stepList(s: any, propertyId: string, today: string, done: Step[], open: { title: string; note: string }) {
  // At most six: the first (what started it) and the latest five.
  const all = done.filter(r => r.at).sort((a, b) => a.at.localeCompare(b.at)), kept = all.length > 6 ? [all[0], ...all.slice(-5)] : all
  const rows = kept.map(r => `<li class="${r.tone}"><span class="mark" aria-hidden="true">${r.tone === 'bad' ? icon('alert') : icon('check')}</span><time>${h(stamp(s, propertyId, r.at, today))}</time><div><strong>${h(r.title)}</strong>${r.note ? `<small>${h(r.note)}</small>` : ''}</div></li>`).join('')
  return `<ol class="steps">${rows}<li class="pending"><span class="mark" aria-hidden="true"></span><time>Now</time><div><strong>${h(open.title)}</strong>${open.note ? `<small>${h(open.note)}</small>` : ''}</div></li></ol>`
}
