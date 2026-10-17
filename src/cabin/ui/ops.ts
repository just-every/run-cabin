import { h, propertyName, memberName, manager } from './shared'
import { between, wall, when, zoneAbbr, ZONES } from '../clock'
import { codeState } from '../codes'
import { lockLine } from '../locks'
import { homeSettings } from '../homes'
// Pieces the turnover, maintenance and readiness pages share.
export const chip = (label: string, tone: 'good' | 'bad' | 'wait' | '' = '') => `<span class="chip ${tone ? 'chip-' + tone : ''}"><span class="dot"></span>${h(label)}</span>`
export const TURNOVER: Record<string, [string, 'good' | 'bad' | 'wait' | '']> = { unassigned: ['No cleaner yet', 'bad'], approved: ['Cleaning scheduled', 'wait'], completed: ['Ready ✓', 'good'], cancelled: ['Cancelled', ''], draft: ['Draft for review', ''] }
export const turnoverChip = (t: any) => chip(...TURNOVER[t.status] ?? [t.status, ''])
const CODE: Record<string, [string, 'good' | 'bad' | 'wait' | '']> = { active: ['active', 'good'], scheduled: ['scheduled', 'wait'], expired: ['expired', ''], revoked: ['revoked', 'bad'] }
export function codeLine(s: any, code: any, label: string) {
  const [state, tone] = CODE[codeState(code)]
  return `<div class="door"><span class="door-label">${h(label)}</span><strong class="door-code">${h(code.code)}</strong>${chip(`${state}`, tone)}<span class="muted">${code.status === 'revoked' ? h(code.reason ?? '') : `Works ${h(between(code.validFrom, code.validUntil))}`}</span></div>`
}
/** Lock status for whoever is looking: setup advice is the manager's, a cleaner only learns whether to expect the code at the door. */
export const lockNote = (s: any, code: any) => code ? `<p class="muted lock-line">${h(manager(s) ? lockLine({ managed: s.managed, lockAccount: s.lockAccount }, code) : code.lock.state === 'set' ? 'The smart lock has this code.' : 'Your manager sets this code on the door’s keypad. If it does not open the door, contact your manager.')}</p>` : ''
export const windowText = (t: any) => t.windowStart ? between(t.windowStart, t.windowEnd) : `Due ${new Date(t.dueDate + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`
export const zoneName = (zone: string) => ZONES.find(([z]) => z === zone)?.[1] ?? zone
export const address = (s: any, propertyId: string) => { const a = homeSettings(s, propertyId).address; return a ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(a)}" rel="noreferrer" target="_blank">${h(a)}</a>` : '<span class="muted">No address entered yet</span>' }
export function photos(list: any[] = [], alt: string) {
  if (!list.length) return ''
  return `<div class="photos">${list.map((p, i) => `<a href="/api/cabin/photos/${h(p.id)}" target="_blank"><img src="/api/cabin/photos/${h(p.id)}" alt="${h(alt)} ${i + 1} of ${list.length}"></a>`).join('')}</div>`
}
/** The latest email about a record, to its current assignee when there is one. */
export function noticeLine(s: any, recordId: string, memberId?: string | null) {
  const n = [...s.notices].filter((r: any) => r.recordId === recordId && (!memberId || r.memberId === memberId)).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!n) return ''
  const at = (iso: string) => atHome(s, n.propertyId, iso)
  const who = memberName(s, n.memberId)
  const text = n.status === 'sent' ? `Emailed ${who} · ${at(n.sentAt)}` : n.status === 'suppressed' ? `Email to ${who} not sent: development mode sends no mail` : n.status === 'unavailable' ? `Email to ${who} not sent: no mail provider is set up` : n.status === 'failed' ? `Email to ${who} failed: ${n.detail ?? ''}` : `Emailing ${who}…`
  return `<p class="notice-line ${n.status === 'sent' ? 'ok' : n.status === 'failed' ? 'bad' : ''}">${h(text)}</p>`
}
export const homeName = propertyName
export const checkedOut = (s: any, t: any) => t.checkedOut ? `Checked out ${atHome(s, t.propertyId, t.checkedOut.at).split(', ').pop()} · ${t.checkedOut.source === 'cleaner' ? 'found by the cleaner' : 'recorded by staff'}` : ''
/** An instant shown at the home, e.g. "Sat Oct 24, 1:15 pm". */
/** Every timestamp Cabin shows is in the home's own time zone, labelled; one not tied to a home uses the first home's zone. */
export const atHome = (s: any, propertyId: string | null, at?: string | number | null) => { if (at === null || at === undefined || at === '') return ''; const zone = homeSettings(s, propertyId ?? s.properties?.[0]?.id ?? '').timeZone, ms = typeof at === 'number' ? at : Date.parse(at); return `${when(wall(ms, zone))} ${zoneAbbr(ms, zone)}` }
export const optionList = (choices: [string, string][], value: string | null | undefined, blank = '') => (blank ? `<option value="">${h(blank)}</option>` : '') + choices.map(([id, label]) => `<option value="${h(id)}"${id === value ? ' selected' : ''}>${h(label)}</option>`).join('')
export const choose = (name: string, label: string, choices: [string, string][], value?: string | null, blank = '', attrs = '') => `<label>${h(label)}<select name="${h(name)}" ${attrs}>${optionList(choices, value, blank)}</select></label>`
export const photoInput = (label: string, min: number, max: number) => `<label>${h(label)}<input name="photoFiles" type="file" accept="image/jpeg,image/png,image/*" multiple ${min ? `required data-min="${min}"` : ''} data-max="${max}"></label><p class="muted">${min ? `At least ${min}, up to ${max}` : `Up to ${max}`}. Phone photos are shrunk to fit before they upload; they stay private to this job.</p>`
