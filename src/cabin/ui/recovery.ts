import { issuePanels } from '../issues/ui'
import { h, heading, panel, form, hidden, select, area, approve, empty, propertyName, memberName, manager, owner, money, dateRange, day } from './shared'
import { atHome, chip, choose, codeLine, lockNote } from './ops'
import { guestOf } from './calendar-grid'
import { RECOVERY_ACTIONS, RECOVERY_PROVIDERS } from '../recovery/authority'

const triggers: [string, string][] = [['cleaner_cancelled', 'Cleaner cancelled'], ['not_ready', 'Home not ready'], ['late_checkout', 'Late checkout'], ['guest_problem', 'Guest problem']]
const policyOf = (s: any, propertyId: string) => s.recoveryPolicies.find((p: any) => p.propertyId === propertyId)
const reference = (r: any) => hidden('id', r.id) + hidden('revision', r.revision)
const dollars = (cents: number) => (cents / 100).toFixed(2)
const amount = (name: string, label: string, cents: number) => `<label>${h(label)}<input name="${h(name)}" type="number" inputmode="decimal" min="0" step="0.01" value="${h(dollars(cents))}" required></label>`
const tone = (status: string) => ['ready', 'closed'].includes(status) ? 'good' : ['escalated', 'open'].includes(status) ? 'bad' : ['proposed', 'active'].includes(status) ? 'wait' : ''

function openForm(s: any) {
  const staff = manager(s)
  const jobs = s.turnovers.filter((t: any) => t.cleanerId === s.actor.memberId && ['approved', 'completed'].includes(t.status))
  const bookings = s.bookings.filter((b: any) => b.status === 'confirmed' && b.kind !== 'block')
  if (staff ? !bookings.length : !jobs.length) return empty(staff ? 'Add a confirmed stay before opening a recovery case.' : 'Your assigned turnovers appear here when you have a problem to report.')
  const choices: [string, string][] = staff
    ? bookings.map((b: any) => [b.id, `${propertyName(s, b.propertyId)} · ${guestOf(b)} · ${day(b.start)} → ${day(b.end)}`])
    : jobs.map((t: any) => [t.id, `${propertyName(s, t.propertyId)} · ${day(t.windowStart ?? t.dueDate)}`])
  return form('recovery.open', 'recovery', select(staff ? 'bookingId' : 'turnoverId', staff ? 'Stay' : 'Your turnover', choices) + select('trigger', 'What happened?', triggers) + area('reason', 'What needs to be put right?', '', 'maxlength="2000"'), staff ? 'Open recovery case' : 'Report stay problem')
}

function proposalForm(s: any, r: any) {
  const policy = policyOf(s, r.propertyId)
  const cleaners: [string, string][] = s.members.filter((m: any) => m.role === 'cleaner' && m.active && policy?.cleanerIds.includes(m.id)).map((m: any) => [m.id, m.name])
  if (!cleaners.length) return `<p class="muted">The owner needs to choose an available recovery cleaner in this home's settings before a plan can be proposed.</p>`
  return `<details class="recovery-propose"${r.status === 'open' ? ' open' : ''}><summary>${r.proposal ? 'Revise the proposal' : 'Prepare an action proposal'}</summary>${form('recovery.propose', 'recovery', reference(r) + choose('cleanerId', 'Replacement cleaner', cleaners, r.proposal?.cleanerId, 'Choose a recovery cleaner…', 'required') + `<div class="pair">${amount('creditDollars', 'Guest credit (USD)', r.proposal?.creditCents ?? 0)}${amount('extraCleaningDollars', 'Extra cleaning (USD)', r.proposal?.extraCleaningCents ?? 0)}</div>` + settlementForm(s, r) + area('why', 'Explanation', r.proposal?.why ?? r.reason, 'maxlength="2000"') + '<p class="muted">Review the saved proposal and its exact guest wording before approving. Automatic recovery follows the owner’s policy.</p>', 'Prepare proposal')}</details>`
}

function settlementForm(s: any, r: any) {
 const booking = s.bookings.find((b: any) => b.id === r.bookingId), settings = s.homeSettings.find((h: any) => h.propertyId === r.propertyId)
 const current = booking?.arrivalTime ?? settings?.checkInTime
 const arrival = current && settings?.checkInTime && current < settings.checkInTime ? `<label>Withdraw early check-in (optional)<input type="time" name="arrivalTime" min="${h(current)}" max="${h(settings.checkInTime)}" value="${h(r.proposal?.arrivalTime ?? '')}"></label><p class="muted">Current promise ${h(current)}; normal check-in ${h(settings.checkInTime)}. Guest acceptance is required before this case can close.</p>` : ''
 const offer = (policyOf(s, r.propertyId)?.futureDiscountBps ?? 0) >= 1000 ? `<label class="check"><input type="checkbox" name="futureDiscount" value="on"${r.proposal?.futureRate ? ' checked' : ''}> Offer 10% off rent on one future stay</label><label>Future-stay offer expiry<input type="date" name="offerExpiresAt" value="${h(r.proposal?.futureRate?.expiresAt?.slice(0,10) ?? '')}"></label><p class="muted">Requires the home’s returning-offer permission, verified guest contact and explicit consent recorded under Guests. The guest accepts on their stay page; a future booking still passes availability and stay rules.</p>` : ''
 return arrival || offer ? `<fieldset><legend>Revised guest arrangements</legend>${arrival}${offer}</fieldset>` : ''
}

function proposal(s: any, r: any) {
  const p = r.proposal
  if (!p) return '<p class="muted">No action proposed yet.</p>'
  if (!manager(s)) return `<p>Replacement cleaner: <strong>${h(memberName(s, p.cleanerId))}</strong></p><p class="recovery-text">${h(p.why)}</p>`
  return `<section class="recovery-proposal" aria-label="Action proposal"><h4>Action proposal${r.status === 'proposed' ? ' · awaiting approval' : ''}</h4><dl class="facts"><dt>Replacement cleaner</dt><dd>${h(memberName(s, p.cleanerId))}</dd><dt>Guest credit</dt><dd>${h(money(p.creditCents))}</dd><dt>Extra cleaning</dt><dd>${h(money(p.extraCleaningCents))}</dd><dt>Total spend</dt><dd><strong>${h(money(p.creditCents + p.extraCleaningCents))}</strong></dd></dl><h4>Explanation</h4><p class="recovery-text">${h(p.why)}</p><h4>Exact guest message</h4><div class="recovery-text recovery-guest">${h(p.guestText)}</div></section>`
}

function history(s: any, r: any) {
  const approvals = s.approvals.filter((a: any) => a.recordId === r.id)
  const approved = approvals.length ? `<h4>Recorded approvals</h4><ul>${approvals.map((a: any) => `<li>${h(a.actorName ?? memberName(s, a.actorId))} · ${h(atHome(s, r.propertyId, a.at))}<br><span class="muted">${h(a.kind)} · revision ${h(a.revision)}</span></li>`).join('')}</ul>` : manager(s) ? '<p class="muted">No approval recorded yet.</p>' : ''
  return `<details class="recovery-history"><summary>Progress and approvals</summary>${approved}${r.history.length ? `<ol>${r.history.map((e: any) => `<li><strong>${h(e.action)}</strong> · ${h(atHome(s, r.propertyId, e.at))}<br><span class="muted">${h(memberName(s, e.by))}</span>${e.why ? `<p class="recovery-text">${h(e.why)}</p>` : ''}</li>`).join('')}</ol>` : '<p class="muted">No progress recorded yet.</p>'}</details>`
}

function access(s: any, r: any) {
  const code = s.codes.find((c: any) => c.id === r.codeId)
  if (!code || !['active', 'ready'].includes(r.status)) return ''
  return `<div class="recovery-access"><h4>Recovery door access</h4>${codeLine(s, code, 'New guest code')}${lockNote(s, code)}${manager(s) && code.lock.state === 'manual' && !r.manualAckAt ? form('recovery.access', 'recovery', reference(r) + '<p class="muted">Enter this guest code on the physical keypad for its displayed access window, then confirm it is set.</p>', 'I set the new code on the keypad') : r.manualAckAt ? `<p class="muted">Keypad code confirmed ${h(atHome(s, r.propertyId, r.manualAckAt))}.</p>` : ''}</div>`
}

function actions(s: any, r: any) {
  if (!manager(s)) {
    const mine = r.proposal?.cleanerId === s.actor.memberId
    return `${mine && r.status === 'active' && !r.acceptedAt ? approve('recovery.accept', 'recovery', r, 'Accept replacement cleaning') : ''}${r.acceptedAt ? `<p class="muted">Replacement accepted ${h(atHome(s, r.propertyId, r.acceptedAt))}.</p>` : ''}<p><a href="/app/turnovers${mine ? '#turnover-' + encodeURIComponent(r.turnoverId) : ''}">Open Turnovers for the checklist, photos and Mark ready</a></p>`
  }
  const policy = policyOf(s, r.propertyId)
  const aboveLimit = r.proposal && (!policy || r.proposal.creditCents > policy.creditLimitCents || r.proposal.extraCleaningCents > policy.cleaningLimitCents)
  const review = r.status === 'proposed' ? `${aboveLimit ? '<p class="muted">This proposal exceeds the home’s limits and needs owner approval.</p>' : ''}<div class="actions">${!aboveLimit || owner(s) ? approve('recovery.approve', 'recovery', r, 'Approve this proposal') : ''}${form('recovery.reject', 'recovery', reference(r), 'Reject proposal', 'class="quiet"')}${!s.managed && s.inbox?.[0]?.ai ? form('recovery.wording', 'recovery', reference(r), 'Draft AI opening', 'class="quiet"') : ''}</div>` : ''
  const undo = owner(s) && ['active', 'ready', 'closed'].includes(r.status) ? `<details class="report"><summary>Undo this recovery</summary>${form('recovery.undo', 'recovery', reference(r) + area('reason', 'Reason for undo', '', 'maxlength="2000"'), 'Undo recovery', 'class="danger"')}</details>` : ''
  const close = r.status === 'active' ? `<p class="muted">Closing checks the cleaner’s acceptance, completed turnover photos and replacement door access.</p>${approve('recovery.close', 'recovery', r, 'Check readiness and close')}` : ''
  return `${['open', 'escalated'].includes(r.status) ? approve('recovery.plan', 'recovery', r, 'Find replacement and draft plan') : ''}${['open', 'proposed', 'escalated'].includes(r.status) ? proposalForm(s, r) : ''}${review}${close}${r.guestAcceptedAt ? `<p class="notice">Guest accepted revised arrangements ${h(atHome(s,r.propertyId,r.guestAcceptedAt))}.</p>` : r.proposal?.arrivalTime || r.offerId ? '<p class="muted">Waiting for the guest’s acceptance on their private stay page. Follow up in the Inbox.</p>' : ''}${undo}`
}

function card(s: any, r: any) {
  const booking = s.bookings.find((b: any) => b.id === r.bookingId)
  return `<article class="record recovery-case" id="recovery-${h(r.id)}"><div class="record-title"><h3>${h(propertyName(s, r.propertyId))}${booking ? ` · ${h(guestOf(booking))}` : ''}</h3>${chip(r.status, tone(r.status))}</div><p class="muted">${booking ? dateRange(booking) + ' · ' : ''}Opened ${h(atHome(s, r.propertyId, r.createdAt))}</p><p><strong>${h(triggers.find(([key]) => key === r.trigger)?.[1] ?? r.trigger)}</strong></p><p class="recovery-text">${h(r.reason)}</p>${proposal(s, r)}${access(s, r)}${actions(s, r)}${manager(s) && r.creditMessageId ? `<p>Guest credit update: ${h(s.messages.find((m:any)=>m.id===r.creditMessageId)?.status ?? 'pending')} · <a href="/app/inbox">Open guest Inbox</a></p><p><a href="/app/statements#statement-${h(r.statementId)}">Open frozen owner adjustment</a></p>` : ''}${r.balanceCents !== undefined && manager(s) ? `<p>Recorded balance: ${h(money(r.balanceCents))}</p>` : ''}${r.confirmationMessageId ? `<p>Guest confirmation: ${h(s.messages.find((m:any)=>m.id===r.confirmationMessageId)?.status ?? 'pending')}</p>` : ''}${r.closedAt ? `<p class="muted">Closed ${h(atHome(s, r.propertyId, r.closedAt))}.</p>` : ''}${execution(s,r)}${history(s, r)}</article>`
}

const actionNames: Record<string,string> = { 'cleaner:assign': 'Assign approved replacement cleaners', 'credit:post': 'Post bounded guest credits to the owner ledger', 'access:write': 'Rotate access for the approved stay and turnover', 'guest:send': 'Send exact approved guest arrangements', 'owner:notify': 'Notify the owner of the frozen adjustment' }
function authoritySettings(s:any, property:any) {
 const policy=policyOf(s,property.id), grant=policy?.authority
 if(!owner(s)||!policy)return ''
 const ref=hidden('propertyId',property.id)+hidden('revision',policy.revision)
 const actions=RECOVERY_ACTIONS.map(action=>`<label class="check"><input type="checkbox" name="actions" value="${h(action)}"${grant?.actions.includes(action)?' checked':''}> ${h(actionNames[action])}</label>`).join('')
 const providers=RECOVERY_PROVIDERS.map(provider=>`<label class="check"><input type="checkbox" name="providers" value="${h(provider)}"${grant?.providers.includes(provider)?' checked':''}> ${h(provider==='cabin'?'Cabin records and ledger':provider==='mail'?'Configured mail provider':'Configured Seam lock provider')}</label>`).join('')
 const controls=grant&&grant.state!=='revoked'?`<div class="actions">${form(grant.state==='paused'?'recovery.authority.resume':'recovery.authority.pause','recovery',ref,grant.state==='paused'?'Resume this execution grant':'Pause execution','class="quiet"')}${form('recovery.authority.revoke','recovery',ref,'Revoke execution grant','class="danger"')}</div>`:''
 return `<details class="home-settings"><summary><strong>${h(property.name)}</strong> · separate agent execution ${h(grant?.state??'not granted')}</summary><p>This grants the native Cabin recovery agent access to this home only, under its saved per-stay credit and cleaning limits. Bearer keys remain draft-only. A person still verifies readiness, signs agreements and approves payouts.</p>${grant?`<p>Granted ${h(atHome(s,property.id,grant.grantedAt))}; window ${h(grant.startsAt)} → ${h(grant.endsAt)}. Pausing stops new provider requests. Started requests remain unresolved until acknowledged or reconciled.</p>`:''}${controls}${form('recovery.authority.save','recovery',ref+`<fieldset><legend>Allowed actions</legend>${actions}</fieldset><fieldset><legend>Approved providers</legend>${providers}</fieldset><label>Execution starts (ISO time with zone)<input name="startsAt" value="${h(grant?.startsAt??new Date().toISOString())}" required></label><label>Execution ends (ISO time with zone)<input name="endsAt" value="${h(grant?.endsAt??new Date(Date.now()+7*86400000).toISOString())}" required></label><p>A replacement grant requires exact review of any pending case before it continues. Provider account permissions still apply separately.</p>`,'Grant these actions and providers')}</details>`
}
function execution(s:any,r:any) {
 const e=r.execution;if(!manager(s)||!e)return ''
 const grant=policyOf(s,r.propertyId)?.authority
 const pending=e.effects.some((effect:any)=>['started','uncertain'].includes(effect.state))
 const rows=e.effects.map((effect:any)=>`<li><strong>${h(effect.action)} · ${h(effect.provider)} · ${h(effect.state)}</strong><p>${h(effect.detail)}</p><p class="muted">Record ${h(effect.sourceId)}${effect.providerId?` · provider reference ${h(effect.providerId)}`:''}</p>${effect.attempts.length?`<ol>${effect.attempts.map((attempt:any)=>`<li>${h(attempt.at)} · ${h(attempt.state)}${attempt.reference?` · ${h(attempt.reference)}`:''}${attempt.resolvedAt?` · reconciled ${h(attempt.resolvedAt)}`:''}</li>`).join('')}</ol>`:''}${owner(s)&&['started','uncertain'].includes(effect.state)?form('recovery.effect.resolve','recovery',reference(r)+hidden('effectId',effect.id)+select('outcome','Provider evidence establishes',[['accepted','Provider accepted the request'],['not_applied','Provider confirms no effect occurred']])+`<label>Provider request / evidence reference<input name="reference" maxlength="300" required></label>`+area('reason','Evidence and reconciliation','', 'maxlength="1000"')+`<label class="check"><input type="checkbox" name="confirm" value="yes" required> I checked provider request history. A timeout alone does not prove failure.</label>`,'Record reconciled outcome'):''}</li>`).join('')
 const review=owner(s)&&grant?.state==='active'&&!pending&&e.effects.some((effect:any)=>effect.state==='blocked')?form('recovery.execution.review','recovery',reference(r)+area('reason','Reason to continue this unchanged action','', 'maxlength="1000"')+'<label class="check"><input type="checkbox" name="confirm" value="yes" required> I reviewed the exact case, recipients and pending provider actions under the current grant.</label>','Approve exact continuation'):''
 return `<details class="recovery-history"><summary>Agent authority and provider outcomes${pending?' · unresolved provider response':''}</summary><p>Cabin recovery agent · plan revision ${h(e.proposalRevision)} · owner grant ${h(e.authorityId)}. Credit limit ${h(money(e.limits.creditLimitCents))}; extra cleaning limit ${h(money(e.limits.cleaningLimitCents))}. No payout is authorized here.</p><p>${h(e.recipient??'No guest email')} · ${h(e.grant.startsAt)} → ${h(e.grant.endsAt)}</p>${rows?`<ul>${rows}</ul>`:'<p>Native work is recorded. No external provider request is queued.</p>'}${review}</details>`
}

function settings(s: any, property: any) {
  const p = policyOf(s, property.id)
  if (!owner(s)) return `<article class="record"><h3>${h(property.name)}</h3>${p ? `<dl class="facts"><dt>Recovery cleaners</dt><dd>${h(p.cleanerIds.map((id: string) => memberName(s, id)).join(', ') || 'None selected')}</dd><dt>Automatic recovery</dt><dd>${p.auto ? 'Enabled within these limits' : 'Manager approval required'}</dd><dt>Guest credit limit</dt><dd>${h(money(p.creditLimitCents))}</dd><dt>Extra cleaning limit</dt><dd>${h(money(p.cleaningLimitCents))}</dd></dl>` : '<p class="muted">No recovery policy yet. The owner can set cleaners and spending limits here.</p>'}</article>`
  const cleaners = s.members.filter((m: any) => m.active && m.role === 'cleaner')
  const checks = cleaners.map((m: any) => `<label class="check"><input name="cleanerIds" type="checkbox" value="${h(m.id)}"${p?.cleanerIds.includes(m.id) ? ' checked' : ''}> ${h(m.name)}</label>`).join('')
  return `<details class="home-settings"><summary><strong>${h(property.name)}</strong> · ${p ? p.auto ? 'automatic within limits' : 'manager approval required' : 'not configured'}</summary>${form('recovery.settings', 'recovery', hidden('propertyId', property.id) + hidden('revision', p?.revision ?? '') + hidden('cleanerIds', '') + `<fieldset><legend>Allowed recovery cleaners</legend>${checks || empty('Add an active cleaner under Properties & people first.')}</fieldset>` + `<label class="check"><input name="futureDiscountAllowed" type="checkbox" value="on"${p?.futureDiscountBps === 1000 ? ' checked' : ''}> Allow a one-use 10% future-stay rent offer with guest consent</label><label class="check"><input name="auto" type="checkbox" value="on"${p?.auto ? ' checked' : ''}> Allow automatic recovery within these limits</label><div class="pair">${amount('creditLimitDollars', 'Guest credit limit (USD)', p?.creditLimitCents ?? 0)}${amount('cleaningLimitDollars', 'Extra cleaning limit (USD)', p?.cleaningLimitCents ?? 0)}</div><p class="muted">Only the owner can change recovery cleaners, automatic approval and spending limits.</p>`, 'Save recovery settings')}</details>`
}

export function recovery(s: any) {
  const ongoing = s.recoveries.filter((r: any) => !r.issue && !['closed', 'undone'].includes(r.status))
  const finished = s.recoveries.filter((r: any) => !r.issue && ['closed', 'undone'].includes(r.status))
  return `<div class="recovery">${heading('Stay recovery', 'Put a disrupted stay right', manager(s) ? 'Record the problem, review the replacement cleaner, guest credit and exact guest message, then follow recovery through readiness.' : 'Report a problem with your turnover and follow its recovery. Complete the cleaning checklist and photos in Turnovers.')}${panel(manager(s) ? 'Open a recovery case' : 'Report a stay problem', openForm(s))}${issuePanels(s)}${panel('In progress', ongoing.map((r: any) => card(s, r)).join('') || empty('No recovery cases in progress.'))}${finished.length ? `<details class="panel"><summary><strong>Closed and undone (${finished.length})</strong></summary>${finished.map((r: any) => card(s, r)).join('')}</details>` : ''}${manager(s) ? panel('Recovery settings by home', s.properties.map((p: any) => settings(s, p)+authoritySettings(s,p)).join('') || empty('Add a home under Properties & people first.')) + panel('Optional AI wording', '<p>Recovery works without an AI key. Cabin can prepare the recovery plan and guest message using its deterministic rules.</p>' + (s.managed ? '<p>AI wording is not available yet on RER Managed.</p>' : owner(s) ? '<p><a href="/app/recovery/setup">Set up or manage AI wording</a> using the existing guest inbox AI connection.</p>' : '<p class="muted">The owner can configure optional AI wording for this Cabin.</p>')) : ''}</div>`
}
