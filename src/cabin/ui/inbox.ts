import { h, heading, panel, form, hidden, empty, propertyName } from './shared'
import { chip, atHome } from './ops'
import { channelName, span } from '../inventory'
import { threads, type Thread } from '../inbox/threads'
import { inboxSettings, RULES, RULE_NAMES, PLACEHOLDERS } from '../inbox/settings'
import { lateMinutes, dueFrom } from '../inbox/schedule'
import { SMS_LINE, SMS_MANAGED } from '../inbox/adapters/twilio'
import { CHANNEL_LINE } from '../inbox/adapters/booking'
import { AI_MANAGED, AI_MODEL } from '../inbox/ai'
// The guest inbox: one thread per guest on the left, the open thread on the
// right with its stays, every message by email, text or channel, the drafted
// reply waiting for a person and the stay's scheduled messages. At phone width
// the list and the open thread are separate screens.
const CHANNEL: Record<string, string> = { email: 'Email', sms: 'Text', airbnb: 'Airbnb', vrbo: 'Vrbo', 'booking.com': 'Booking.com' }
const at = (s: any, propertyId: string | null, iso?: string | null) => atHome(s, propertyId ?? s.properties[0]?.id ?? '', iso)
const page = (t: Thread | undefined) => t ? `inbox?thread=${t.id}` : 'inbox'
const stayLine = (s: any, b: any) => `<span class="stay-chip ${b.status === 'confirmed' ? '' : 'gone'}"><span class="ch ch-${b.channel === 'booking.com' ? 'booking' : h(b.channel)}">${h(channelName(b.channel))}</span> ${h(propertyName(s, b.propertyId))} · ${h(span(b))}${b.status === 'confirmed' ? '' : ' · cancelled'}</span>`
function row(s: any, t: Thread, current: boolean) {
  const last = [...t.messages].reverse().find(m => m.status !== 'draft' && m.status !== 'drafting'), stay = t.stays[t.stays.length - 1]
  return `<a class="thread-row${current ? ' current' : ''}" href="/app/inbox?thread=${h(t.id)}"${current ? ' aria-current="true"' : ''}><span class="who"><strong>${h(t.name)}</strong>${t.drafts ? `<span class="draft-dot">Draft waiting</span>` : ''}</span><span class="muted">${stay ? `${h(propertyName(s, stay.propertyId))} · ${h(span(stay))}` : h(t.email ?? t.phone ?? 'No stay matched yet')}</span>${last ? `<span class="excerpt">${last.direction === 'in' ? '' : last.status === 'sent' ? 'You: ' : 'Not sent: '}${h(last.text.replace(/\s+/g, ' ').slice(0, 90))}</span>` : ''}</a>`
}
function status(s: any, m: any, t: Thread) {
  const when = at(s, m.propertyId, m.sentAt ?? m.createdAt)
  if (m.direction === 'in') return `<p class="meta">${h(CHANNEL[m.channel])} · ${h(when)}</p>`
  const sched = m.scheduledId ? s.scheduled.find((r: any) => r.id === m.scheduledId) : null, late = sched ? lateMinutes(sched) : null
  const who = m.source === 'scheduled' ? `Scheduled · ${RULE_NAMES[sched?.rule as keyof typeof RULE_NAMES] ?? 'message'}` : m.approvalId ? `${m.source === 'ai' ? 'AI draft' : 'Drafted reply'}, sent by you` : 'You'
  const state = m.status === 'sent' ? `Sent ${when}${sched ? (late !== null && late <= 5 ? ' · on time' : ` · ${late} min late`) : ''}` : m.status === 'suppressed' ? 'Not sent: development mode sends no email' : m.status === 'unavailable' ? `Not sent: ${(m.detail ?? '').split(/(?<=\.) /)[0]}` : m.status === 'failed' ? `Could not send: ${m.detail ?? ''}` : 'Sending…'
  const retry = m.status === 'failed' ? form('message.retry', page(t), hidden('id', m.id), 'Send again', 'class="quiet inline"') : ''
  return `<p class="meta">${h(CHANNEL[m.channel])} · ${h(who)}</p><p class="state ${m.status === 'sent' ? 'ok' : m.status === 'failed' || m.status === 'unavailable' ? 'bad' : ''}">${h(state)}</p>${retry}`
}
function draft(s: any, t: Thread, m: any) {
  if (m.status === 'drafting') return `<article class="msg out draft"><p class="meta">Drafting a reply with your AI key…</p><p class="muted">Reload in a moment. Nothing is sent until you send it.</p></article>`
  const body = hidden('id', m.id) + hidden('revision', m.revision) + `<label>Reply to ${h(t.name)} by ${h(CHANNEL[m.channel].toLowerCase())}<textarea name="text" rows="8" maxlength="4000" required>${h(m.text)}</textarea></label>`
  return `<article class="msg out draft" id="draft"><div class="record-title"><p class="meta">${m.source === 'ai' ? 'AI draft' : 'Drafted reply'} · waiting for your nod</p>${chip('Not sent', 'wait')}</div>${m.grounds?.length ? `<p class="muted">Uses: ${h(m.grounds.join(', '))}</p>` : ''}${m.detail ? `<p class="note">${h(m.detail)}</p>` : ''}${form('message.send', page(t), body, 'Send to guest')}${form('message.discard', page(t), hidden('id', m.id) + hidden('revision', m.revision), 'Discard draft', 'class="quiet"')}</article>`
}
function schedule(s: any, t: Thread) {
  const rows = [...t.scheduled].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map(r => {
    const b = t.stays.find(x => x.id === r.bookingId), late = lateMinutes(r)
    const state = r.status === 'scheduled' ? chip(`Due ${at(s, r.propertyId, dueFrom(r))}`, 'wait') : r.status === 'sent' ? chip(late !== null && late <= 5 ? 'Sent on time' : `Sent ${late} min late`, 'good') : r.status === 'sending' ? chip('Sending…', 'wait') : chip(r.status === 'cancelled' ? 'Cancelled' : r.status === 'skipped' ? 'Skipped' : r.status === 'suppressed' ? 'Not sent (development)' : 'Not sent', r.status === 'cancelled' || r.status === 'skipped' ? '' : 'bad')
    return `<li><span><strong>${h(RULE_NAMES[r.rule as keyof typeof RULE_NAMES])}</strong> · ${b ? h(span(b)) : ''}</span>${state}${r.reason && ['cancelled', 'skipped', 'failed', 'scheduled'].includes(r.status) ? `<span class="muted">${h(r.reason)}</span>` : ''}</li>`
  }).join('')
  return rows ? `<section class="scheduled"><h3>Scheduled for ${t.stays.length > 1 ? 'these stays' : 'this stay'}</h3><ul>${rows}</ul></section>` : ''
}
function contact(s: any, t: Thread) {
  const b = [...t.stays].reverse().find(x => x.status === 'confirmed')
  if (!b || b.guestEmail) return ''
  const body = hidden('id', b.id) + hidden('guestName', b.guestName ?? '') + hidden('arrivalTime', b.arrivalTime ?? '') + hidden('guestPhone', b.guestPhone ?? '') + `<label>Guest email<input name="guestEmail" type="email" maxlength="254" required placeholder="name@example.com"></label>`
  return `<div class="notice"><p><strong>No email for ${b.guestName ? h(b.guestName) : 'this guest'} yet.</strong> ${h(b.channel === 'direct' ? 'Add it and Cabin emails their scheduled messages.' : CHANNEL_LINE)}</p>${form('booking.details', page(t), body, 'Add email to this stay', 'class="inline"')}</div>`
}
function conversation(s: any, t: Thread) {
  const shown = t.messages.filter(m => m.status !== 'draft' && m.status !== 'drafting'), drafts = t.messages.filter(m => m.status === 'draft' || m.status === 'drafting')
  const bubbles = shown.map(m => `<article class="msg ${m.direction}">${m.subject && m.channel === 'email' ? `<p class="subject">${h(m.subject)}</p>` : ''}<div class="text">${h(m.text)}</div>${status(s, m, t)}</article>`).join('')
  const reach = t.email ?? t.phone
  const compose = form('message.compose', page(t), hidden('thread', t.id) + `<label>Write to ${h(t.name)}<textarea name="text" rows="4" maxlength="4000" required></textarea></label>`, 'Send')
  return `<p class="back"><a href="/app/inbox">← All guests</a></p><div class="thread-head"><h2>${h(t.name)}</h2><p class="muted">${h([t.email, t.phone].filter(Boolean).join(' · ') || 'No email or phone yet')}</p><p class="stays">${t.stays.map(b => stayLine(s, b)).join('') || '<span class="muted">Not matched to a stay: the sender’s address is on no stay yet.</span>'}</p></div>
  ${contact(s, t)}<div class="messages">${bubbles || empty('No messages yet. Scheduled messages and guest replies appear here.')}</div>${drafts.map(m => draft(s, t, m)).join('')}${reach || t.stays.length ? `<details class="compose"><summary>Write a message yourself</summary>${compose}</details>` : ''}${schedule(s, t)}`
}
function settings(s: any) {
  const set = inboxSettings(s), local = s.origin.startsWith('http://127.0.0.1') || s.origin.startsWith('http://localhost')
  const address = form('inbox.address', 'inbox', hidden('revision', set.revision) + `<label>Guest email address<input name="address" type="email" maxlength="254" value="${h(set.address ?? '')}" placeholder="guests@example.com"></label>`, 'Save address')
  const tryIt = local && set.address ? `<details class="try"><summary>Try a guest email here</summary>${form('inbox.try', 'inbox', `<label>Paste a saved email’s source (.eml), addressed to ${h(set.address)}<textarea name="source" rows="8" maxlength="1000000" required></textarea></label>`, 'Receive it')}</details>` : ''
  const where = s.managed ? 'RER Managed hosting has no domain of yours yet, so guest email cannot reach Cabin there. Scheduled messages still go out by email.' : local ? 'On this computer no mail server can reach Cabin; a hosted install receives guest email. Here, paste a saved email below to see it land in its guest’s thread. Development mode sends no email.' : 'In Cloudflare, open your domain’s Email → Email Routing, add a custom address and send it to this Cabin’s Worker. Enter that address here: guest email to it lands in the guest’s thread, and every message Cabin sends asks guests to reply to it.'
  const rules = RULES.map(r => { const v = set.schedule[r]; return `<fieldset class="rule"><legend>${h(RULE_NAMES[r])}</legend><div class="pair"><label class="check"><input type="checkbox" name="${r}Enabled" value="on"${v.enabled ? ' checked' : ''}> Send for every stay</label><label>${r === 'review' ? 'Hours after check-out' : `Hours before ${r === 'checkin' ? 'check-in' : 'check-out'}`}<input name="${r}Hours" type="number" min="0" max="720" value="${v.hours}" required></label></div><label>Subject<input name="${r}Subject" maxlength="200" value="${h(v.subject)}" required></label><label>Message<textarea name="${r}Template" rows="6" maxlength="4000" required>${h(v.template)}</textarea></label></fieldset>` }).join('')
  const ai = s.managed ? `<p>${h(AI_MANAGED)}</p>` : `${set.ai ? `<p>Key ${h(set.ai.keyHint)} · model ${h(set.ai.model)} · saved by ${h(set.ai.savedBy)}</p><div class="actions">${form('inbox.ai.test', 'inbox', '', 'Test the key', 'class="quiet"')}${form('inbox.ai.remove', 'inbox', hidden('revision', set.revision), 'Remove key', 'class="quiet"')}</div>` : '<p class="muted">No AI key yet: replies are drafted from templates that use the stay’s times, address, door code and stay page.</p>'}${form('inbox.ai.save', 'inbox', hidden('revision', set.revision) + `<label>Anthropic API key<input name="key" type="password" autocomplete="off" maxlength="400" ${set.ai ? 'placeholder="Leave empty to keep the saved key"' : 'required'}></label><div class="pair"><label>Model<input name="model" maxlength="120" value="${h(set.ai?.model ?? AI_MODEL)}"></label><label>Workspace ID (optional)<input name="workspace" maxlength="120" value="${h(set.ai?.workspace ?? '')}"></label></div>`, set.ai ? 'Save AI settings' : 'Save key')}`
  const booking = s.messaging.booking ? form('inbox.channels', 'inbox', hidden('revision', set.revision) + s.properties.map((p: any) => `<label>${h(p.name)} · Booking.com property ID<input name="booking_${h(p.id)}" inputmode="numeric" maxlength="20" value="${h(set.channelIds?.[p.id] ?? '')}"></label>`).join(''), 'Save Booking.com properties') : ''
  return `<div class="columns">${panel('Guest email', `<p class="muted">${h(where)}</p>${address}${tryIt}`)}${panel('Drafted replies', `<p class="muted">Every guest message gets a drafted reply in its thread. It waits for you: nothing is sent until you press Send.</p>${ai}`)}</div>`
    + panel('Texts and channel messages', `<p>${h(s.messaging.sms ? 'Texts are connected through Twilio: guests with only a phone number get texts, and their replies join their thread.' : s.managed ? SMS_MANAGED : SMS_LINE)}</p><p>${h(s.messaging.booking ? 'Booking.com messages are connected: enter each home’s Booking.com property ID and the reservation number on each Booking.com stay.' : CHANNEL_LINE)}</p>${booking}`)
    + `<details class="panel"><summary><strong>Scheduled messages</strong> · ${RULES.filter(r => set.schedule[r].enabled).map(r => RULE_NAMES[r].toLowerCase()).join(', ') || 'all off'}</summary><p class="muted">Each stay gets these, timed from its dates and the home’s check-in and check-out times in the home’s time zone. A moved stay moves them; a cancelled one cancels them. Use ${h(PLACEHOLDERS.join(' '))} in a message.</p>${form('inbox.schedule', 'inbox', hidden('revision', set.revision) + rules, 'Save scheduled messages')}</details>`
}
export function inbox(s: any, thread?: string | null) {
  const all = threads(s), open = all.find(t => t.id === thread) ?? (thread ? undefined : all[0])
  const list = all.length ? all.map(t => row(s, t, t === open)).join('') : empty('No guests yet. Each stay’s guest gets a thread here with its scheduled messages; guest email lands in it.')
  return heading('Guest inbox', 'One thread per guest', 'Email, text and every stay from Airbnb, Vrbo, Booking.com or booked direct join one thread per guest. Check-in details, checkout reminders and review requests go out on time; each guest message gets a drafted reply that waits for your nod.')
    + `<div class="inbox${thread && open ? ' has-thread' : ''}"><aside class="threads" aria-label="Guests">${list}</aside><section class="conversation" aria-label="Conversation">${open ? conversation(s, open) : empty(thread ? 'That conversation is not here any more.' : 'Choose a guest.')}</section></div>`
    + settings(s)
}
