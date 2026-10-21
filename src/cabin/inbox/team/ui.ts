import { h, form, hidden, memberName, propertyName } from '../../ui/shared'
import { chip, atHome, choose } from '../../ui/ops'
import type { Thread } from '../threads'
import { inboxSettings } from '../settings'
import { teamSettings } from './settings'
import type { ThreadCase } from './types'
// Who owns each guest thread, what is private to the team and when the next person must act.
const page = (t: Thread) => `inbox?thread=${t.id}`
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const caseOf = (s: any, t: Thread): ThreadCase | undefined => (s.threadCases ?? []).find((r: ThreadCase) => r.id === t.id)
const people = (s: any): [string, string][] => s.members.filter((m: any) => m.role === 'manager' && m.active).map((m: any) => [m.id, m.name])
const live = (row: ThreadCase) => row.claim && Date.parse(row.claim.until) > Date.now() ? row.claim : null
export function teamChips(s: any, t: Thread) {
 const row = caseOf(s, t); if (!row || row.status === 'answered') return ''
 const late = row.status === 'open' && row.dueAt && Date.parse(row.dueAt) <= Date.now()
 return `<span class="team-chips">${row.urgency === 'urgent' ? chip('Urgent', 'bad') : ''}${late ? chip('Overdue', 'bad') : row.status === 'accepted' ? chip('Accepted', 'good') : chip('Needs an owner', 'wait')}${row.assigneeId ? `<span class="muted">${h(memberName(s, row.assigneeId))}</span>` : ''}</span>`
}
function status(s: any, row: ThreadCase | undefined) {
 if (!row) return '<p class="muted">No one is handling this thread yet. Saving team settings routes guest messages that arrive afterwards; any action below opens it.</p>'
 const team = teamSettings(s), claim = live(row)
 const head = row.status === 'answered' ? 'Answered' : row.status === 'accepted' ? `Accepted by ${row.acceptedByName} · ${atHome(s, row.propertyId, row.acceptedAt)}` : `Waiting for an accountable person${row.dueAt ? ` · respond by ${atHome(s, row.propertyId, row.dueAt)}` : ''}`
 return `<p><strong>${h(head)}</strong>${row.urgency === 'urgent' ? ' ' + chip('Urgent', 'bad') : ''}</p><p class="muted">Assigned to ${h(row.assigneeId ? memberName(s, row.assigneeId) : 'nobody')} · ${h(row.route)}${row.labels.length ? ` · labels: ${h(row.labels.join(', '))}` : ''}</p>`
  + (claim ? `<p class="notice" role="status">${h(claim.byName)} ${claim.sent ? 'just replied' : 'is replying'} until ${h(atHome(s, row.propertyId, claim.until))}. Wait before answering this guest.</p>` : '')
  + (row.status === 'open' && !team.escalationMemberId ? '<p class="note">No escalation manager is set, so nobody is notified when this deadline passes.</p>' : '')
  + (row.escalations.length ? `<p class="note">Escalated ${row.escalations.length} time${row.escalations.length === 1 ? '' : 's'}; last to ${h(row.escalations[row.escalations.length - 1].toName)} at ${h(atHome(s, row.propertyId, row.escalations[row.escalations.length - 1].at))}. It repeats until someone accepts.</p>` : '')
}
export function teamPanel(s: any, t: Thread) {
 const row = caseOf(s, t), id = hidden('thread', t.id), choices = people(s), team = teamSettings(s)
 const notes = row?.notes.length ? `<ul class="team-notes">${row.notes.map(n => `<li><p>${n.promise ? chip(n.doneAt ? 'Promise kept' : 'Promise open', n.doneAt ? 'good' : 'wait') + ' ' : ''}${h(n.text)}</p><p class="muted">${h(n.byName)} · ${h(atHome(s, row.propertyId, n.at))}</p>${n.promise && !n.doneAt ? form('thread.promise.done', page(t), id + hidden('id', n.id), 'Mark kept', 'class="quiet inline"') : ''}</li>`).join('')}</ul>` : ''
 const handovers = row?.handovers.length ? `<h4>Handovers</h4><ul>${row.handovers.map(v => `<li><p>${h(v.fromName)} to ${h(v.toName)} · ${h(atHome(s, row.propertyId, v.at))}: ${h(v.summary)}</p><p class="muted">${h(v.reservation ?? 'No stay matched')} · ${v.tasks.length} open task${v.tasks.length === 1 ? '' : 's'}${v.tasks.length ? ` (${h(v.tasks.map(x => x.title).join('; '))})` : ''} · ${v.promises.length} open promise${v.promises.length === 1 ? '' : 's'}${v.promises.length ? ` (${h(v.promises.map(x => x.text).join('; '))})` : ''}</p></li>`).join('')}</ul>` : ''
 return `<section class="panel team" aria-label="Team handling"><h3>Team handling</h3>${status(s, row)}
 <div class="team-actions">${row && row.status === 'open' ? form('thread.accept', page(t), id, 'Accept this thread', 'class="inline"') : ''}${form('thread.claim', page(t), id, 'I’m replying', 'class="quiet inline"')}</div>
 ${form('thread.assign', page(t), id + choose('memberId', 'Assign to', choices, row?.assigneeId, 'Choose…', 'required'), 'Assign', 'class="inline"')}
 ${form('thread.triage', page(t), id + `<label>Labels (comma separated)<input name="labels" maxlength="200" value="${h(row?.labels.join(', ') ?? '')}"></label>` + choose('urgency', 'Urgency', [['normal', 'Normal'], ['urgent', 'Urgent']], row?.urgency ?? 'normal'), 'Save labels', 'class="inline"')}
 ${team.templates.length ? form('thread.template', page(t), id + choose('templateId', 'Reply template', team.templates.map(x => [x.id, x.title] as [string, string]), null, 'Choose…', 'required'), 'Draft from template', 'class="inline"') : ''}
 <h4>Private notes</h4><p class="muted">Only your team sees these. They are never sent to the guest.</p>${notes}
 ${form('thread.note', page(t), id + `<label>Private note<textarea name="text" rows="3" maxlength="2000" required></textarea></label><label class="check"><input type="checkbox" name="promise"> This is a promise to the guest</label>`, 'Save private note')}
 <h4>Hand over</h4>${form('thread.handover', page(t), id + choose('memberId', 'Next person', choices, null, 'Choose…', 'required') + `<label>What the next person needs to know<textarea name="summary" rows="3" maxlength="2000" required></textarea></label>`, 'Hand over with context')}${handovers}</section>`
}
const list = (items: string[], none: string) => items.length ? `<ul>${items.join('')}</ul>` : `<p class="muted">${h(none)}</p>`
export function teamSettingsCard(s: any) {
 const set = inboxSettings(s), team = teamSettings(s), people_ = people(s), rev = hidden('revision', set.revision)
 const remove = (section: string, id: string) => form('inbox.team.set', 'inbox', rev + hidden('section', section) + hidden('id', id) + hidden('remove', 'yes'), 'Remove', 'class="quiet inline"')
 const homes: [string, string][] = s.properties.map((p: any) => [p.id, p.name])
 return `<details class="panel" id="team"><summary><strong>Team routing, shifts and response deadlines</strong></summary><p>New guest messages go to the most specific matching route (a home beats all homes, urgent beats any). Someone with shifts who is off shift is replaced by whoever is on shift at the home’s local time; with nobody on shift the escalation manager takes it. A message unanswered past its deadline notifies the escalation manager with the full thread context and repeats until a person accepts it. Settings apply to messages that arrive after they are first saved.</p>
 <h3>Deadlines and escalation</h3>${form('inbox.team.set', 'inbox', rev + hidden('section', 'response') + `<label>Normal response minutes<input name="normalMinutes" type="number" min="5" max="10080" value="${team.normalMinutes}" required></label><label>Urgent response minutes<input name="urgentMinutes" type="number" min="5" max="1440" value="${team.urgentMinutes}" required></label><label>Repeat escalation every (minutes)<input name="repeatMinutes" type="number" min="5" max="1440" value="${team.repeatMinutes}" required></label>` + choose('escalationMemberId', 'Escalation manager', people_, team.escalationMemberId, 'Choose…', 'required'), 'Save deadlines')}
 <h3>Reply templates</h3>${list(team.templates.map(x => `<li><strong>${h(x.title)}</strong> ${remove('template', x.id)}</li>`), 'No templates yet. Use {guest}, {home}, {checkin}, {checkout}, {address} and {stay_link}.')}${form('inbox.team.set', 'inbox', rev + hidden('section', 'template') + `<label>Title<input name="title" maxlength="80" required></label><label>Text<textarea name="text" rows="4" maxlength="2000" required></textarea></label>`, 'Add template')}
 <h3>Routes</h3>${list(team.routes.map(r => `<li>${h(r.propertyId ? propertyName(s, r.propertyId) : 'All homes')} · ${r.urgency === 'urgent' ? 'urgent threads' : 'any thread'} → ${h(memberName(s, r.memberId))} ${remove('route', r.id)}</li>`), 'No routes yet.')}${form('inbox.team.set', 'inbox', rev + hidden('section', 'route') + choose('propertyId', 'Home', homes, null, 'All homes') + choose('urgency', 'Urgency', [['any', 'Any'], ['urgent', 'Urgent only']], 'any') + choose('memberId', 'Route to', people_, null, 'Choose…', 'required'), 'Add route')}
 <h3>Shifts</h3>${list(team.shifts.map(x => `<li>${h(memberName(s, x.memberId))} · ${x.days.map(d => DAYS[d]).join(', ')} ${h(x.from)}–${h(x.until)} ${h(x.propertyId ? propertyName(s, x.propertyId) : 'all homes')} (home time) ${remove('shift', x.id)}</li>`), 'No shifts yet. A shift whose end is before its start runs past midnight.')}${form('inbox.team.set', 'inbox', rev + hidden('section', 'shift') + choose('memberId', 'Person', people_, null, 'Choose…', 'required') + choose('propertyId', 'Home', homes, null, 'All homes') + `<fieldset><legend>Days</legend>${DAYS.map((d, i) => `<label class="check"><input type="checkbox" name="day${i}"> ${d}</label>`).join('')}</fieldset><label>Starts<input name="from" type="time" required></label><label>Ends<input name="until" type="time" required></label>`, 'Add shift')}</details>`
}
