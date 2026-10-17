import { h, heading, panel, form, hidden, empty, propertyName, memberName, manager } from './shared'
import { chip, photos, noticeLine, choose, photoInput, address, atHome } from './ops'
import { homeSettings } from '../homes'
// Broken things become tasks with photos, assigned to a person and closed with
// what was done. Open blocking tasks keep a home off the ready list.
const people = (s: any) => s.members.filter((m: any) => m.active).map((m: any) => [m.id, `${m.name} (${m.role})`] as [string, string])
function card(s: any, t: any) {
  const mine = s.actor.memberId && t.assigneeId === s.actor.memberId, open = t.status === 'open'
  const assign = open && manager(s) ? form('task.assign', 'maintenance', hidden('id', t.id) + hidden('revision', t.revision) + choose('assigneeId', t.assigneeId ? 'Reassign to' : 'Assign to', people(s), t.assigneeId, 'Choose…', 'required') + `<label class="check"><input type="checkbox" name="blocking" value="on"${t.blocking ? ' checked' : ''}> Blocks the next arrival</label>`, t.assigneeId ? 'Save and email' : 'Assign and email', 'class="inline"') : ''
  const close = open && (manager(s) || mine) ? `<details class="report"><summary>Close this task</summary>${form('task.close', 'maintenance', hidden('id', t.id) + hidden('revision', t.revision) + '<label>What was done (optional)<input name="note" maxlength="1000" placeholder="Replaced the bulb"></label>' + photoInput('Photos of the fix (optional)', 0, 6), 'Close task', 'enctype="multipart/form-data" data-photos')}</details>` : ''
  return `<article class="record task"><div class="record-title"><h3>${h(t.title)}</h3>${open ? chip(t.blocking ? 'Open · blocks arrival' : 'Open', t.blocking ? 'bad' : 'wait') : chip('Closed', 'good')}</div>
  <p><strong>${h(propertyName(s, t.propertyId))}</strong> · ${address(s, t.propertyId)}</p>
  <p class="muted">Reported by ${h(t.raisedByName)} · ${h(atHome(s, t.propertyId, t.raisedAt))}${t.turnoverId ? ' · from a turnover' : ''}</p>
  ${t.note ? `<p>${h(t.note)}</p>` : ''}${photos(t.photos, `Photo of ${t.title}`)}
  ${open ? `<p>${t.assigneeId ? `Assigned to <strong>${h(mine ? 'you' : memberName(s, t.assigneeId))}</strong>` : '<strong>Nobody assigned yet.</strong>'}</p>${manager(s) ? noticeLine(s, t.id, t.assigneeId) : ''}` : `<p>Closed ${h(atHome(s, t.propertyId, t.closedAt))}${t.closeNote ? ` · ${h(t.closeNote)}` : ''}</p>${photos(t.closePhotos, `Photo of the fix for ${t.title}`)}`}
  ${assign}${close}</article>`
}
export function maintenance(s: any) {
  const open = s.tasks.filter((t: any) => t.status === 'open').sort((a: any, b: any) => Number(b.blocking) - Number(a.blocking) || a.raisedAt.localeCompare(b.raisedAt))
  const closed = s.tasks.filter((t: any) => t.status === 'closed').sort((a: any, b: any) => b.closedAt.localeCompare(a.closedAt)).slice(0, 20)
  if (!manager(s)) return heading('Maintenance', 'Things to fix', 'Tasks assigned to you and the problems you reported. Close a task with what you did and a photo.') + panel('Open', open.map((t: any) => card(s, t)).join('') || empty('Nothing to fix right now.')) + (closed.length ? panel('Closed', closed.map((t: any) => card(s, t)).join('')) : '')
  const homes = s.properties.map((p: any) => [p.id, `${p.name}${homeSettings(s, p.id).maintenanceId ? ` · ${memberName(s, homeSettings(s, p.id).maintenanceId!)}` : ''}`] as [string, string])
  const add = s.properties.length ? form('task.raise', 'maintenance', choose('propertyId', 'Home', homes, null, 'Choose a home…', 'required') + '<label>What is wrong<input name="title" required maxlength="120" placeholder="Hot tub heater not working"></label><label>Details (optional)<textarea name="note" rows="3" maxlength="1000"></textarea></label>' + choose('assigneeId', 'Assign to', people(s), null, 'The home’s maintenance person') + '<label class="check"><input type="checkbox" name="blocking" value="on" checked> The next guests cannot arrive until this is fixed</label>' + photoInput('Photos (optional)', 0, 6), 'Add task and email', 'enctype="multipart/form-data" data-photos') : empty('Add a home first.')
  return heading('Maintenance', 'Broken things become tasks with photos', 'Cleaners report problems from their turnover; you can add one by hand. Each goes to the home’s maintenance person by email, and an open blocking task shows the home as not ready.')
    + `<div class="columns"><div>${panel('Open tasks', open.map((t: any) => card(s, t)).join('') || empty('No open maintenance tasks.'))}</div><div>${panel('Add a task', add)}</div></div>`
    + (closed.length ? panel('Recently closed', closed.map((t: any) => card(s, t)).join('')) : '')
}
