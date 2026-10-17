import { h, heading, panel, form, select, area, hidden, approve, empty, propertyName, memberName, manager, day } from './shared'
import { turnoverChip, codeLine, lockNote, windowText, address, photos, noticeLine, choose, photoInput, zoneName, atHome, checkedOut } from './ops'
import { homeSettings } from '../homes'
import { ZONES, time12 } from '../clock'
import { stayLabel } from './calendar-grid'
import { checkoutInstant, checkoutTime } from '../turnover-window'
import { when } from '../clock'
import { turnoverLockSetup } from './turnover-lock-setup'
// Managers see every stay's turnover as Cabin dispatched it, with its window,
// cleaner, door codes and email; cleaners see their own jobs on their phone.
const jobs = (html: string) => html ? `<div class="jobs">${html}</div>` : ''
const order = (a: any, b: any) => (a.windowStart ?? a.dueDate).localeCompare(b.windowStart ?? b.dueDate)
const cleaners = (s: any) => s.members.filter((m: any) => m.role === 'cleaner' && m.active).map((m: any) => [m.id, m.name] as [string, string])
const codeOf = (s: any, t: any, holder: string) => {
  const codes = s.codes.filter((r: any) => (holder === 'guest' ? r.bookingId === t.bookingId && r.holder === 'guest' : r.turnoverId === t.id && r.holder === 'cleaner' && r.memberId === t.cleanerId))
  return codes.find((r: any) => r.status === 'issued') ?? codes.at(-1) ?? null
}
const stayOf = (s: any, id: string | null) => s.bookings.find((b: any) => b.id === id)
const checkoutWait = (s: any, t: any) => {
  const b = stayOf(s, t.bookingId), settings = homeSettings(s, t.propertyId)
  return b && Date.now() < checkoutInstant(settings, b) ? `<p class="muted">Guests have left and Mark ready open after check-out: ${h(when(checkoutTime(settings, b)))} (${h(zoneName(settings.timeZone))} time).</p>` : ''
}
function after(s: any, t: any) {
  const stay = stayOf(s, t.bookingId), next = stayOf(s, t.nextBookingId)
  return `${stay ? `After ${h(stayLabel(stay))} checks out` : 'After check-out'} · ${next ? `next arrival ${h(stayLabel(next))}${t.windowEnd ? ` at ${h(time12(t.windowEnd.slice(11, 16)))}` : ''}` : 'no next arrival booked'}`
}
function managerJob(s: any, t: any) {
  const guest = codeOf(s, t, 'guest'), mine = codeOf(s, t, 'cleaner'), open = t.status === 'unassigned' || t.status === 'approved', wait = checkoutWait(s, t)
  const assign = open && cleaners(s).length ? form('turnover.assign', 'turnovers', hidden('id', t.id) + hidden('revision', t.revision) + choose('cleanerId', t.cleanerId ? 'Reassign to' : 'Assign to', cleaners(s).filter(([id]: [string, string]) => id !== t.cleanerId), null, 'Choose a cleaner…', 'required'), t.cleanerId ? 'Reassign and email' : 'Assign and email', 'class="inline"') : ''
  const tasks = s.tasks.filter((k: any) => k.turnoverId === t.id).map((k: any) => `<li>${h(k.title)} · ${h(k.status === 'open' ? `open${k.blocking ? ', blocks arrival' : ''}` : 'closed')}</li>`).join('')
  return `<article class="record job" id="turnover-${h(t.id)}"><div class="record-title"><h3>${h(propertyName(s, t.propertyId))}</h3>${turnoverChip(t)}</div>
  <p class="when"><strong>${h(windowText(t))}</strong> <span class="muted">${h(zoneName(homeSettings(s, t.propertyId).timeZone))}</span></p><p class="muted">${after(s, t)}${t.source === 'manual' ? ' · prepared by hand' : ''}</p>
  ${t.status === 'cancelled' ? `<p class="muted">${h(t.cancelReason ?? '')}</p>` : `<p>${t.cleanerId ? `Cleaner: <strong>${h(memberName(s, t.cleanerId))}</strong>` : '<strong>No cleaner assigned.</strong> Assign one, or set a default cleaner for this home below.'}</p>${noticeLine(s, t.id, t.cleanerId)}`}
  ${open || t.status === 'completed' ? `<div class="doors">${guest ? codeLine(s, guest, 'Guest code') : ''}${mine ? codeLine(s, mine, 'Cleaner code') : ''}</div>${guest?.link && guest.status === 'issued' ? `<p class="muted">Guest stay page with the code: <a href="/stay/${h(guest.link)}">${h(s.origin)}/stay/${h(guest.link.slice(0, 8))}…</a></p>` : ''}${lockNote(s, guest)}` : ''}
  ${t.checkedOut ? `<p class="checked-out">${h(checkedOut(s, t))}</p>` : open ? wait || form('turnover.checkout', 'turnovers', hidden('id', t.id), 'Record check-out now', 'class="quiet"') : ''}
  ${assign}
  ${t.status === 'completed' ? `<p>Marked ready ${h(atHome(s, t.propertyId, t.completion?.completedAt))} · photos ${t.completion?.photos?.length ?? 1} / ${t.photosRequired ?? 1}${t.completion?.caption ? ` · “${h(t.completion.caption)}”` : ''}</p>${photos(t.completion?.photos ?? [{ id: t.completion?.photoId }], 'Turnover photo')}` : ''}
  ${t.status === 'draft' && manager(s) ? `<p>Assigned to ${h(memberName(s, t.cleanerId))} · ${h(t.checklist.length)} checklist items</p>` + approve('turnover.approve', 'turnovers', t, 'Approve and assign turnover') : ''}
  ${tasks ? `<p class="muted">Maintenance from this turnover:</p><ul>${tasks}</ul>` : ''}
  <details><summary>Checklist (${h(t.checklist.length)})</summary><ul>${t.checklist.map((item: string) => `<li>${h(item)}</li>`).join('')}</ul></details></article>`
}
function cleanerJob(s: any, t: any) {
  const code = codeOf(s, t, 'cleaner'), need = t.photosRequired ?? 1, wait = checkoutWait(s, t)
  const done = form('turnover.complete', 'turnovers', hidden('id', t.id) + hidden('revision', t.revision) + `<fieldset><legend>Checklist</legend>${t.checklist.map((item: string) => `<label class="check"><input type="checkbox" name="checks" value="${h(item)}" required> ${h(item)}</label>`).join('')}</fieldset>` + photoInput(`Photos of the ready home (${need} or more)`, need, 12) + '<label>Note for the owner<input name="caption" required maxlength="300" placeholder="All rooms ready"></label>', 'Mark ready', 'enctype="multipart/form-data" data-photos')
  const report = form('task.raise', 'turnovers', hidden('turnoverId', t.id) + '<label>What is wrong<input name="title" required maxlength="120" placeholder="Patio light out"></label><label>Details (optional)<textarea name="note" rows="3" maxlength="1000"></textarea></label><label class="check"><input type="checkbox" name="blocking" value="on"> The next guests cannot arrive until this is fixed</label>' + photoInput('Photos of the problem', 0, 6), 'Report it', 'enctype="multipart/form-data" data-photos')
  const reported = s.tasks.filter((k: any) => k.turnoverId === t.id).map((k: any) => `<li>${h(k.title)} · ${h(k.status === 'open' ? `reported ${atHome(s, k.propertyId, k.raisedAt)}${k.blocking ? ', blocks the next arrival' : ''}` : 'fixed')}</li>`).join('')
  return `<article class="record job mine" id="turnover-${h(t.id)}"><div class="record-title"><h3>${h(propertyName(s, t.propertyId))}</h3>${turnoverChip(t)}</div>
  <p class="when"><strong>${h(windowText(t))}</strong></p><p class="address">${address(s, t.propertyId)}</p>
  ${t.status === 'approved' && code ? `<div class="doors">${codeLine(s, code, 'Your door code')}</div><p class="muted">Your code lasts up to six hours after check-out, ending sooner if the next guests arrive. For later cleaning, arrange access with your manager.</p>${lockNote(s, code)}` : ''}
  ${t.checkedOut ? `<p class="checked-out">${h(checkedOut(s, t))}</p>` : t.status === 'approved' ? wait || form('turnover.checkout', 'turnovers', hidden('id', t.id), 'Guests have left', 'class="quiet"') : ''}
  ${t.status === 'approved' ? (!wait ? done : '') + `<details class="report"><summary>Report something broken</summary>${report}</details>` : ''}
  ${t.status === 'completed' ? `<p>Marked ready · ${h(t.completion?.photos?.length ?? 1)} photos</p>${photos(t.completion?.photos ?? [{ id: t.completion?.photoId }], 'Your photo')}<details class="report"><summary>Report something broken</summary>${report}</details>` : ''}
  ${reported ? `<div class="reported"><p><strong>You reported</strong> · saved; your manager sees these under Maintenance</p><ul>${reported}</ul></div>` : ''}
  ${t.status === 'cancelled' ? `<p class="muted">${h(t.cancelReason ?? 'Cancelled')}</p>` : ''}</article>`
}
function settingsForm(s: any, p: any) {
  const c = homeSettings(s, p.id), everyone = s.members.filter((m: any) => m.active).map((m: any) => [m.id, `${m.name} (${m.role})`] as [string, string])
  const body = hidden('propertyId', p.id) + hidden('revision', c.revision) + `<label>Address the cleaner drives to<input name="address" required maxlength="300" value="${h(c.address)}"></label>` + `<div class="pair">${choose('timeZone', 'Time zone', ZONES, c.timeZone)}<label>Photos to mark ready<input name="photosRequired" type="number" min="1" max="12" value="${h(c.photosRequired)}" required></label></div>` + `<div class="pair"><label>Check-out<input name="checkOutTime" type="time" value="${h(c.checkOutTime)}" required></label><label>Check-in<input name="checkInTime" type="time" value="${h(c.checkInTime)}" required></label></div>` + `<div class="pair">${choose('cleanerId', 'Default cleaner (sent every new turnover)', cleaners(s), c.cleanerId, 'Nobody: assign each one')}${choose('maintenanceId', 'Maintenance person', everyone, c.maintenanceId, 'Nobody yet')}</div>` + area('checklist', 'Checklist (one item per line)', c.checklist.join('\n')) + `<label>Smart-lock device ID (optional)<input name="lockDeviceId" maxlength="120" value="${h(c.lockDeviceId ?? '')}" placeholder="From the owner’s Seam account, once connected"></label>`

  return `<details class="home-settings"><summary><strong>${h(p.name)}</strong> · ${c.revision ? `${h(c.cleanerId ? memberName(s, c.cleanerId) : 'no default cleaner')} · out ${h(time12(c.checkOutTime))}, in ${h(time12(c.checkInTime))}` : 'not set up yet'}</summary>${form('home.settings', 'turnovers', body + turnoverLockSetup(s, c), 'Save turnover settings')}</details>`
}
export function turnovers(s: any) {
  if (!manager(s)) {
    const mine = s.turnovers.filter((t: any) => t.status === 'approved').sort(order), done = s.turnovers.filter((t: any) => t.status === 'completed').sort(order).reverse().slice(0, 10)
    return heading('Your turnovers', 'Jobs assigned to you', 'Each job shows the window, the address and your own door code. Tick every item, add your photos and mark the home ready.') + panel('To do', jobs(mine.map((t: any) => cleanerJob(s, t)).join('')) || empty('No turnovers assigned to you right now. New ones are emailed to you.')) + (done.length ? panel('Done', jobs(done.map((t: any) => cleanerJob(s, t)).join(''))) : '')
  }
  const open = s.turnovers.filter((t: any) => t.status === 'unassigned' || t.status === 'approved').sort(order), drafts = s.turnovers.filter((t: any) => t.status === 'draft')
  const done = s.turnovers.filter((t: any) => t.status === 'completed').sort(order).reverse().slice(0, 12), cancelled = s.turnovers.filter((t: any) => t.status === 'cancelled').sort(order).reverse().slice(0, 12)
  const manual = s.bookings.length && cleaners(s).length ? form('turnover.prepare', 'turnovers', select('bookingId', 'Departing booking', s.bookings.filter((b: any) => b.status === 'confirmed').map((b: any) => [b.id, `${propertyName(s, b.propertyId)} · ${b.summary} · checkout ${day(b.end)}`])) + select('cleanerId', 'Cleaner', cleaners(s)) + area('checklist', 'Checklist (one item per line)', 'Change linen\nClean kitchen\nCheck keys'), 'Prepare turnover') : empty('Add a stay and an active cleaner to prepare a turnover by hand.')
  return heading('Turnovers', 'Every stay turns itself over', 'Each reservation, from any channel or booked direct, makes its turnover between check-out and the next check-in, with a door code for the guest and one for the cleaner. The home’s cleaner is emailed the window, address and code; a moved or cancelled stay moves or cancels them.')
    + panel('Coming up', jobs(open.map((t: any) => managerJob(s, t)).join('')) || empty('No turnovers coming up. Each new stay adds one here.'))
    + (drafts.length ? panel('Waiting for your approval', jobs(drafts.map((t: any) => managerJob(s, t)).join(''))) : '')
    + panel('Turnover settings by home', s.properties.length ? `<p class="muted">Set each home’s address, times and default cleaner. Checklist and photo changes also reach every unfinished job; completed jobs keep their evidence.</p>${s.properties.map((p: any) => settingsForm(s, p)).join('')}` : empty('Add a home under Properties & people first.'))
    + panel('Ready', jobs(done.map((t: any) => managerJob(s, t)).join('')) || empty('Turnovers marked ready with their photos appear here.'))
    + (cancelled.length ? `<details class="panel"><summary><strong>Cancelled and replaced (${cancelled.length})</strong></summary>${jobs(cancelled.map((t: any) => managerJob(s, t)).join(''))}</details>` : '')
    + `<details class="panel"><summary><strong>Prepare a turnover by hand</strong></summary><p class="muted">For a stay Cabin did not dispatch, or an agent’s suggestion: a person approves it, and it replaces that stay’s open turnover.</p>${manual}</details>`
}
