import { h, form, hidden } from '../ui/shared'
import { inboxSettings } from './settings'
import { type Thread } from './threads'
import { homeSettings } from '../homes'

export function replySettings(s: any) {
 const set = inboxSettings(s)
 return `<details class="panel"><summary><strong>Reply authority and approved instructions</strong></summary><p>Drafts wait for a person by default. A narrow automatic rule sends only saved check-in, checkout or approved instruction text. Changes, money and safety always need a person. Uncertain replies and missed deadlines notify the responsible manager.</p>${s.properties.map((home: any) => {
  const p = set.replyPolicies?.find(p => p.propertyId === home.id), i = p?.instructions[0]
  return `<h3>${h(home.name)}</h3>${form('inbox.reply.policy', 'inbox', hidden('revision', set.revision) + hidden('propertyId', home.id) + `<label>Responsible manager email<input name="managerEmail" type="email" value="${h(p?.managerEmail ?? s.actor.email)}" required></label><label>Reply deadline (minutes)<input name="replyMinutes" type="number" min="5" max="1440" value="${p?.replyMinutes ?? 30}" required></label><label>Approved instruction title<input name="instructionTitle" maxlength="100" value="${h(i?.title ?? '')}"></label><label>Approved answer<textarea name="instructionAnswer" maxlength="2000" rows="3">${h(i?.answer ?? '')}</textarea></label><label class="check"><input type="checkbox" name="enabled"${p?.enabled ? ' checked' : ''}> Enable automatic replies for this home</label><fieldset><legend>Allowed topics</legend>${['checkin', 'checkout', 'instructions'].map(t => `<label class="check"><input type="checkbox" name="${t}"${p?.topics.includes(t) ? ' checked' : ''}> ${h(t === 'instructions' ? 'Approved instruction' : t === 'checkin' ? 'Check-in facts' : 'Checkout facts')}</label>`).join('')}</fieldset><div class="pair"><label>From (home time)<input name="from" type="time" value="${h(p?.from ?? '08:00')}" required></label><label>Until (home time)<input name="until" type="time" value="${h(p?.until ?? '20:00')}" required></label></div><label>Minimum model confidence (%)<input name="minConfidence" type="number" min="80" max="100" value="${p?.minConfidence ?? 95}" required></label><p>Automatic replies require your saved AI key and an unchanged source revision. Removing the check stops new automatic replies.</p>`, 'Save reply authority')}`
 }).join('')}</details>`
}
export function replyEvidence(m: any) {
 if (!m.control) return ''
 const c = m.control
 let sources: any = null; try { sources = JSON.parse(c.baseline) } catch { /* older source snapshot */ }
 return `<p class="note">Assigned to ${h(c.assignedEmail)} · reply due ${h(c.dueAt)}${c.escalatedAt ? ' · manager notified' : ''}. Confidence ${c.confidence}%. ${c.automatic ? 'Sent under property authority.' : 'Waiting for a person.'}</p><details><summary>Sources at drafting</summary><p><a href="/app/reservations">Reservation and arrival</a> · <a href="/app/readiness">Current readiness</a></p>${sources ? `<p>Check-in: ${h(sources.facts?.checkin)}. Readiness: ${h(sources.operations?.readiness)}.</p>${sources.instructions?.map((i: any) => `<p><strong>${h(i.title)}</strong> · ${h(i.answer)} <small>Source ${h(i.id)}</small></p>`).join('') ?? ''}` : ''}</details>`
}
export function earlyArrival(s: any, t: Thread) {
 const m = [...t.messages].reverse().find(m => m.direction === 'in'), b = m && t.stays.find(b => b.id === m.bookingId && b.status === 'confirmed')
 if (!m || !b) return ''
 const settings = homeSettings(s, b.propertyId)
 return `<details class="compose"><summary>Approve an early check-in</summary><p>Current arrival ${h(b.arrivalTime ?? settings.checkInTime)} (${h(settings.timeZone)}). The preceding turnover must be complete with its required photos and the home must have no blocking tasks. Approval updates the access window and emails this guest once. Set the new time on a manual keypad before confirming it to the guest.</p>${form('message.arrival.approve', `inbox?thread=${t.id}`, hidden('bookingId', b.id) + hidden('bookingRevision', b.revision) + hidden('messageId', m.id) + `<label>Approved check-in time<input name="arrivalTime" type="time" required></label><label class="check"><input type="checkbox" name="confirm" required> I confirm the home and keypad can be ready for this time.</label>`, 'Approve arrival and notify guest')}</details>`
}
