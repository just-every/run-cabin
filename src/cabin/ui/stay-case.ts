import { h, money, memberName, approve, form, hidden, owner } from './shared'
import { homeSettings } from '../homes'
import { channelName } from '../inventory'
import { when, between } from '../clock'
import { withinLimits } from '../recovery/limits'
import { statementMonth } from '../finance/presentation'
import { guestOf, town, homeThumb } from './calendar-grid'
import { type Step, panelDay, stepList } from './stay-steps'
import { icon } from './icons'
// The Stay recovery panel when a stay has a recovery case (src/cabin/recovery):
// the case's own history as the checklist, the proposal with its guest credit
// against the home's saved limit, Approve and Reject posting the case's own
// commands, and what the case does to the owner's balance.
export const TRIGGER: Record<string, string> = { cleaner_cancelled: 'Cleaner cancelled', not_ready: 'Home not ready', late_checkout: 'Late checkout', guest_problem: 'Guest problem' }
const RANK: Record<string, number> = { proposed: 0, escalated: 1, open: 2, active: 3, ready: 4 }
/** Cases still in progress for the homes shown, whose stay has not ended: proposals first. */
export function liveCases(s: any, homes: any[], today: string) {
  const ids = new Set(homes.map((p: any) => p.id))
  return (s.recoveries ?? []).filter((r: any) => r.status in RANK && ids.has(r.propertyId) && (s.bookings.find((b: any) => b.id === r.bookingId)?.end.slice(0, 10) ?? '') >= today)
    .sort((a: any, b: any) => RANK[a.status] - RANK[b.status] || (s.bookings.find((x: any) => x.id === a.bookingId)?.start ?? '').localeCompare(s.bookings.find((x: any) => x.id === b.bookingId)?.start ?? ''))
}
const person = (s: any, by: string) => s.members.find((m: any) => m.id === by || m.email === by)?.name ?? (by === s.actor.email || by === s.actor.id ? 'you' : by)
const first = (name: string) => name.split(' ')[0]
function steps(s: any, r: any, t: any, guest: string): Step[] {
  const p = r.proposal, cleaner = p ? memberName(s, p.cleanerId) : '', list: Step[] = [], was = r.previous?.turnover.cleanerId ?? t?.cleanerId
  const lastProposed = r.history.map((e: any) => e.action).lastIndexOf('Action proposed')
  r.history.forEach((e: any, i: number) => {
    const who = person(s, e.by)
    const title = e.action === 'Case opened' ? (r.trigger === 'cleaner_cancelled' && s.members.some((m: any) => (m.id === e.by || m.email === e.by) && m.role === 'cleaner') ? `${first(who)} cancelled` : `${TRIGGER[r.trigger] ?? 'Problem'} reported by ${who}`)
      : e.action === 'Action proposed' ? (i === lastProposed && p ? `${cleaner} proposed to replace ${was ? first(memberName(s, was)) : 'the cleaner'}` : 'Earlier plan proposed')
      : e.action === 'Action rejected' ? 'Proposal rejected'
      : e.action === 'Action approved and applied' ? `${cleaner} assigned · approved by ${who}`
      : e.action === 'Applied within owner limits' ? `${cleaner} assigned within your limits`
      : e.action === 'Replacement cleaner accepted' ? `${first(cleaner)} accepted`
      : e.action
    const note = e.action === 'Action rejected' ? 'Nothing was applied' : e.action === 'Action proposed' ? (i === lastProposed && p ? `${p.creditCents ? `${money(p.creditCents)} guest credit` : 'No guest credit'}${p.extraCleaningCents ? ` · ${money(p.extraCleaningCents)} extra cleaning` : ''}` : '') : e.action === 'Action approved and applied' || e.action === 'Applied within owner limits' ? 'Cleaner emailed the window, address and door code' : e.why
    list.push({ at: e.at, title, note, tone: e.action === 'Owner needed' ? 'bad' : e.action === 'Action rejected' || e.action === 'Action compensated' ? 'muted' : 'done' })
  })
  const code = r.codeId && s.codes.find((c: any) => c.id === r.codeId)
  if (code) list.push({ at: code.createdAt, title: `New door code ${code.code} generated`, note: `${guest} · works ${between(code.validFrom, code.validUntil)}`, tone: 'done' })
  const m = r.creditMessageId && s.messages.find((x: any) => x.id === r.creditMessageId)
  if (m) list.push({ at: m.sentAt ?? m.createdAt, title: m.status === 'sent' ? `${guest} notified` : m.status === 'pending' ? 'Guest update queued' : m.status === 'suppressed' ? 'Guest update written' : 'Guest update not sent', note: m.status === 'sent' ? `Email sent: ${m.subject}` : m.status === 'suppressed' ? 'Email not sent: development mode sends no mail' : m.status === 'pending' ? 'Email queued to send' : m.status === 'discarded' ? 'Email withdrawn' : m.detail ?? m.status, tone: m.status === 'sent' ? 'done' : m.status === 'failed' ? 'bad' : 'muted' })
  return list
}
function now(s: any, r: any, t: any) {
  if (r.status === 'proposed') return { title: 'Waiting for your approval', note: 'Nothing changes for the cleaner, the guest or the owner until you approve.' }
  if (r.status === 'open') return { title: 'Needs a plan', note: 'Find a free backup cleaner from this home’s list and draft the guest message.' }
  if (r.status === 'escalated') return { title: 'Owner needed', note: r.history.at(-1)?.why ?? '' }
  if (r.status === 'ready') return { title: 'Waiting for the guest’s readiness email', note: 'The case closes once the confirmation is accepted.' }
  const code = s.codes.find((c: any) => c.id === r.codeId), m = s.messages.find((x: any) => x.id === r.creditMessageId)
  const left = [!r.acceptedAt && `${first(memberName(s, r.proposal.cleanerId))} has not accepted yet`, t?.status !== 'completed' && 'turnover not marked ready with photos', code && code.lock.state !== 'set' && !r.manualAckAt && 'door code not confirmed on the lock', m && !['sent', 'suppressed'].includes(m.status) && 'guest update not delivered yet'].filter(Boolean)
  return { title: 'Verifying readiness', note: left.length ? `${left.join(' · ')}.` : 'Every check is done. Close the case on Stay recovery.' }
}
function proposal(s: any, r: any, guest: string) {
  const p = r.proposal, policy = s.recoveryPolicies.find((x: any) => x.propertyId === r.propertyId)
  const within = withinLimits({ data: s } as any, r, p)
  const limit = policy ? `${within ? 'Within' : 'Above'} your ${money(policy.creditLimitCents)} limit` : 'No saved limit for this home'
  const extra = p.extraCleaningCents ? ` · ${money(p.extraCleaningCents)} extra cleaning` : ''
  const ref = hidden('id', r.id) + hidden('revision', r.revision)
  const approveButton = within || owner(s) ? approve('recovery.approve', 'calendar', r, 'Approve') : ''
  return `<section class="credit"><h3>Propose guest credit</h3><p class="muted">${h(p.creditCents ? `Suggesting a ${money(p.creditCents)} credit for the cleaner change.` : 'A replacement cleaner, with no guest credit.')}</p>
  <div class="credit-line${within ? '' : ' bad'}"><span class="credit-mark" aria-hidden="true">$</span><div><strong>${h(p.creditCents ? `${money(p.creditCents)} credit` : 'No credit')}${h(extra)}</strong><small>${h(`${limit} · ${guest}’s stay`)}</small></div></div>
  ${within ? '' : '<p class="muted">Above the saved limits: only the owner can approve.</p>'}<div class="actions case-actions">${approveButton}${form('recovery.reject', 'calendar', ref, 'Reject', 'class="quiet"')}<a class="button quiet" href="/app/recovery#recovery-${h(r.id)}">Edit</a></div></section>`
}
// The owner's balance for the latest statement period, as the statements state it
// (the month's statement plus any approved recovery adjustments that month), with
// this case's guest credit beside it: its own signed change, never the balance.
function balance(s: any, r: any, today: string) {
  const p = r.proposal, posted = r.statementId && s.statements.find((x: any) => x.id === r.statementId)
  const home = s.properties.find((x: any) => x.id === r.propertyId), mine = s.statements.filter((x: any) => x.propertyId === r.propertyId)
  const latest = mine.filter((x: any) => x.source !== 'recovery').sort((a: any, b: any) => b.month.localeCompare(a.month))[0]
  const owed = latest && latest.netCents + mine.filter((x: any) => x.source === 'recovery' && x.status === 'approved' && x.month === latest.month).reduce((n: number, x: any) => n + x.netCents, 0)
  const cents = posted ? posted.netCents : p && r.status === 'proposed' ? -(p.creditCents + p.extraCleaningCents) : 0
  const month = posted ? posted.month : today.slice(0, 7), what = (posted ? posted.lines[1]?.amountCents : p?.extraCleaningCents) ? 'Guest credit and extra cleaning' : 'Guest credit'
  const effect = cents === 0 ? ['chip-good', 'Unchanged'] : ['chip-wait', `${money(cents).replace('-', '−')}${latest && latest.month === month ? '' : ` in ${statementMonth(month).slice(0, 3)}`}`]
  const note = cents === 0 ? (posted ? 'No impact from this change.' : 'Nothing is posted until a plan with a credit is approved.') : posted ? `${what} ${money(cents).replace('-', '−')} · posted as its own ${statementMonth(posted.month)} recovery adjustment, approved and frozen · <a href="/app/statements#statement-${h(posted.id)}">Adjustment</a>` : `${what} ${money(cents).replace('-', '−')} · if approved, posted as its own frozen ${statementMonth(month)} adjustment.`
  const figure = latest ? `<strong class="money">${h(money(owed))}</strong>` : '<strong class="money none">No statement yet</strong>'
  const source = latest ? `${statementMonth(latest.month)} statement, ${latest.status === 'approved' ? 'approved' : 'in review'} · <a href="/app/statements#statement-${h(latest.id)}">Statement</a>` : 'Cabin shows a balance once this home has an owner statement.'
  return `<section class="balance"><h3>Owner balance${latest ? ` · ${h(statementMonth(latest.month))}` : ''}</h3><div class="money-line">${figure}<span class="chip ${effect[0]}"><span class="dot"></span>${h(effect[1])}</span></div><p class="muted">${h(home?.ownerName ?? '')} · ${source}</p><p class="muted">${note}</p></section>`
}
export function casePanel(s: any, cases: any[], today: string, readyCount: string, after: string) {
  const r = cases[0], b = s.bookings.find((x: any) => x.id === r.bookingId), t = s.turnovers.find((x: any) => x.id === r.turnoverId)
  const p = s.properties.find((x: any) => x.id === r.propertyId), place = town(s, r.propertyId), guest = b ? guestOf(b) : 'The guest'
  const subject = t ? `${panelDay(t.windowStart ?? t.dueDate)} turnover` : 'Stay'
  const plan = ['open', 'escalated'].includes(r.status) ? `<div class="actions case-actions stack">${approve('recovery.plan', 'calendar', r, 'Find replacement and draft plan')}<a class="button quiet" href="/app/recovery#recovery-${h(r.id)}">Open case</a></div>` : r.status === 'proposed' ? '' : `<p class="more"><a href="/app/recovery#recovery-${h(r.id)}">Open this case</a></p>`
  return `<aside class="panel stay-panel" aria-label="Stay recovery"><header>${icon('spark')}<h2>Stay recovery</h2>${readyCount}</header>
  <div class="stay-home">${homeThumb(s, p)}<div><h3>${h(p.name)}</h3>${place ? `<p>${h(place)}</p>` : ''}</div></div>
  ${b ? `<p class="next">Next arrival <strong>${h(guest)}</strong> · ${h(channelName(b.channel))} · ${h(when(`${b.start.slice(0, 10)}T${b.arrivalTime ?? homeSettings(s, r.propertyId).checkInTime}`))}</p>` : ''}
  <section><h3>${h(subject)} – ${h(TRIGGER[r.trigger] ?? 'Recovery')}</h3>${stepList(s, r.propertyId, today, steps(s, r, t, guest), now(s, r, t))}${plan}</section>
  ${r.status === 'proposed' && r.proposal ? proposal(s, r, guest) : ''}
  ${balance(s, r, today)}
  ${cases.length > 1 ? `<p class="more"><a href="/app/recovery">${cases.length - 1} more recovery case${cases.length === 2 ? '' : 's'} in progress</a></p>` : ''}
  ${after}</aside>`
}
