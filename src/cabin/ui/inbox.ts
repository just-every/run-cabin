import { h, heading, form, hidden, empty, propertyName } from './shared'
import { chip, atHome } from './ops'
import { channelName, span } from '../inventory'
import { threads, type Thread } from '../inbox/threads'
import { RULE_NAMES } from '../inbox/settings'
import { inboxSetup } from '../inbox/setup-ui'
import { lateMinutes, dueFrom } from '../inbox/schedule'
import { CHANNEL_LINE } from '../inbox/adapters/booking'
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
  const who = m.source === 'scheduled' ? (sched ? `Scheduled · ${RULE_NAMES[sched.rule as keyof typeof RULE_NAMES]}` : 'Direct booking · sent automatically') : m.approvalId ? `${m.source === 'ai' ? 'AI draft' : 'Drafted reply'}, sent by you` : 'You'
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
  const lastIn = [...t.messages].reverse().find((m: any) => m.direction === 'in')
  const compose = form('message.compose', page(t), hidden('thread', t.id) + `${lastIn && lastIn.channel !== 'email' ? '' : `<label>Subject<input name="subject" maxlength="200" value="${h(lastIn?.subject ? (/^re:/i.test(lastIn.subject) ? lastIn.subject : `Re: ${lastIn.subject}`) : '')}" placeholder="About your stay"></label>`}<label>Write to ${h(t.name)}<textarea name="text" rows="4" maxlength="4000" required></textarea></label>`, 'Send')
  return `<p class="back"><a href="/app/inbox">← All guests</a></p><div class="thread-head"><h2>${h(t.name)}</h2><p class="muted">${h([t.email, t.phone].filter(Boolean).join(' · ') || 'No email or phone yet')}</p><p class="stays">${t.stays.map(b => stayLine(s, b)).join('') || '<span class="muted">Not matched to a stay: the sender’s address is on no stay yet.</span>'}</p></div>
  ${contact(s, t)}<div class="messages">${bubbles || empty('No messages yet. Scheduled messages and guest replies appear here.')}</div>${drafts.map(m => draft(s, t, m)).join('')}${reach || t.stays.length ? `<details class="compose"><summary>Write a message yourself</summary>${compose}</details>` : ''}${schedule(s, t)}`
}
export function inbox(s: any, thread?: string | null) {
  const all = threads(s), open = all.find(t => t.id === thread) ?? (thread ? undefined : all[0])
  const list = all.length ? all.map(t => row(s, t, t === open)).join('') : empty('No guests yet. Each stay’s guest gets a thread here with its scheduled messages; guest email lands in it.')
  return heading('Guest inbox', 'One thread per guest', 'Email, text and every stay from Airbnb, Vrbo, Booking.com or booked direct join one thread per guest. Check-in details, checkout reminders and review requests go out on time; each guest message gets a drafted reply that waits for your nod.')
    + `<div class="inbox${thread && open ? ' has-thread' : ''}"><aside class="threads" aria-label="Guests">${list}</aside><section class="conversation" aria-label="Conversation">${open ? conversation(s, open) : empty(thread ? 'That conversation is not here any more.' : 'Choose a guest.')}</section></div>`
    + inboxSetup(s)
}
