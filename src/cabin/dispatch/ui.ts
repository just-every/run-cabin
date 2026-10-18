import { h, form, hidden, memberName, propertyName } from '../ui/shared'
import { windowText, choose, atHome } from '../ui/ops'
import { directions } from './planner'
import { ZONES } from '../clock'

const number = (name: string, label: string, value: number, min = 0, max = 1440) => `<label>${h(label)}<input type="number" name="${h(name)}" value="${h(value)}" min="${min}" max="${max}" required></label>`
export function dispatchSettings(s: any, settings: any) {
 const d = settings.dispatch, ids = d?.approvedCleanerIds ?? (settings.cleanerId ? [settings.cleanerId] : [])
 const cleaners = s.members.filter((m: any) => m.active && m.role === 'cleaner')
 return `<fieldset><legend>Acceptance, backups and capacity</legend>${d ? hidden('dispatchEnabled', 'on') + '<p>Every new or changed job requires acceptance. Capacity and saved drive times are checked before an offer and again when it is accepted.</p>' : '<label class="check"><input type="checkbox" name="dispatchEnabled" value="on"> Require acceptance and route eligible backups</label><p class="muted">Enable after saving cleaner capacities, home bases and one-way drive times. Existing automatic assignments continue until enabled.</p>'}
 <label>Template name<input name="dispatchTemplateName" maxlength="100" value="${h(d?.templateName ?? 'Standard turnover')}"></label>
 <label>Work and inspection instructions<textarea name="dispatchInstructions" rows="3" maxlength="2000">${h(d?.instructions ?? '')}</textarea></label>
 <div class="pair">${number('dispatchDurationMinutes', 'Work minutes', d?.durationMinutes ?? 120, 15)}<label>Rate per completed turnover (USD)<input type="number" name="dispatchRateDollars" min="0" max="100000" step="0.01" value="${((d?.rateCents ?? 0) / 100).toFixed(2)}"></label></div>
 <div class="pair">${number('dispatchStartOffsetMinutes', 'Start minutes after checkout', d?.startOffsetMinutes ?? 0)}${number('dispatchFinishBeforeMinutes', 'Finish minutes before arrival', d?.finishBeforeMinutes ?? 0)}</div>
 <fieldset><legend>Approved cleaners and teams</legend>${cleaners.map((m: any) => `<label class="check"><input type="checkbox" name="approvedCleanerIds" value="${h(m.id)}"${ids.includes(m.id) ? ' checked' : ''}> ${h(m.name)}</label>`).join('') || '<p>Add cleaners under Properties & people.</p>'}</fieldset>
 ${choose('dispatchOfferCount', 'Send offers to', [['1', 'Default, then eligible backups'], ['3', 'Three nearby eligible cleaners; first acceptance wins']], String(d?.offerCount ?? 3))}
 <p class="muted">Nearby means the manager-entered drive minutes from each saved home base. No distance or travel time is guessed. Only approved people receive offers.</p>
 <div class="pair">${number('dispatchResponseMinutes', 'Response deadline (minutes after offer)', d?.responseMinutes ?? 120, 5, 10080)}${number('dispatchReminderMinutes', 'Remind minutes before response deadline', d?.reminderMinutes ?? 30, 1, 10080)}</div>
 ${number('dispatchEscalationMinutes', 'Escalate minutes before arrival', d?.escalationMinutes ?? 60, 5)}
 <p class="muted">An offer expires early enough to finish the work before the pre-arrival deadline. Rates are saved on the job; an offer creates no payable expense.</p></fieldset>`
}
export function driveSettings(s: any, settings: any) {
 if (!settings.dispatch) return ''
 const starts: [string, string][] = [...(s.cleanerProfiles ?? []).map((p: any) => [`base:${p.id}`, `${memberName(s, p.id)} home base · ${p.homeBase}`]), ...s.homeSettings.filter((p: any) => p.propertyId !== settings.propertyId && p.address).map((p: any) => [p.propertyId, `${propertyName(s, p.propertyId)} · ${p.address}`])]
 const rows = settings.dispatch.driveTimes.map((r: any) => `<li>${h(r.fromAddress)} → ${h(r.toAddress)}: ${h(r.minutes)} min · <a href="${h(directions(r.fromAddress, r.toAddress))}" target="_blank" rel="noreferrer">Check directions</a>${((r.from.startsWith('base:') ? s.cleanerProfiles?.find((p: any) => p.id === r.from.slice(5))?.homeBase : s.homeSettings.find((p: any) => p.propertyId === r.from)?.address) !== r.fromAddress || settings.address !== r.toAddress) ? ' · address changed; re-enter drive time' : ''}</li>`).join('')
 return `<details><summary>Saved drives to ${h(propertyName(s, settings.propertyId))}</summary><p>Enter actual one-way drive minutes after checking directions. Save each direction separately. Address changes invalidate the saved journey.</p>${rows ? `<ul>${rows}</ul>` : '<p>No drive times saved yet. Offers wait until the route is known.</p>'}${starts.length ? form('home.drive', 'turnovers', hidden('propertyId', settings.propertyId) + hidden('revision', settings.revision) + choose('from', 'Start from', starts, starts[0][0]) + number('minutes', 'One-way drive minutes', 30), 'Save drive time') : '<p>Save cleaner home bases under Properties & people first.</p>'}</details>`
}
export function capacityForm(s: any, member: any) {
 if (member.role !== 'cleaner' || !member.active) return ''
 const p = s.cleanerProfiles?.find((p: any) => p.id === member.id)
 return `<details><summary>Daily capacity and home base${p ? ` · ${h(p.dailyJobs)} jobs / ${h(p.dailyMinutes / 60)} hours` : ' · not configured'}</summary>${form('cleaner.capacity', 'people', hidden('memberId', member.id) + hidden('revision', p?.revision ?? '') + `<label>Home-base address<input name="homeBase" required maxlength="300" value="${h(p?.homeBase ?? '')}"></label>` + choose('timeZone', 'Home-base time zone', ZONES, p?.timeZone ?? 'America/New_York') + `<label>Available each day from<input name="availableFrom" type="time" required value="${h(p?.availableFrom ?? '08:00')}"></label><div class="pair">${number('dailyJobs', 'Maximum jobs per day', p?.dailyJobs ?? 3, 1, 50)}${number('dailyMinutes', 'Daily work and drive minutes', p?.dailyMinutes ?? 480, 15)}</div><p class="muted">For a team, save its shared capacity under its team account. Travel and work both count toward hours.</p>`, 'Save cleaner capacity')}</details>`
}
export function dispatchStatus(s: any, t: any) {
 const d = t.dispatch
 if (!d) return '<p class="muted">Acceptance and capacity routing are not configured for this job.</p>'
 const offers = d.offers.map((o: any) => `<li>${h(memberName(s, o.memberId))}: ${h(o.status)} · ${h(atHome(s, t.propertyId, o.respondedAt ?? o.offeredAt))}${o.reason ? ` · ${h(o.reason)}` : ''}${o.status === 'pending' ? ` · respond by ${h(atHome(s, t.propertyId, o.expiresAt))}` : ''}</li>`).join('')
 return `<p><strong>${d.acceptedBy ? `Accepted by ${h(memberName(s, d.acceptedBy))}` : 'Awaiting cleaner acceptance'}</strong> · ${h(d.templateName)} · ${h(d.durationMinutes)} work minutes · USD ${(d.rateCents / 100).toFixed(2)}</p>${d.scheduledStart ? `<p>Planned: ${h(atHome(s, t.propertyId, d.scheduledStart))} → ${h(atHome(s, t.propertyId, d.scheduledEnd))}</p>` : ''}${d.instructions ? `<p>${h(d.instructions)}</p>` : ''}${d.reasons.length ? `<div class="notice"><strong>Manager action required</strong><ul>${d.reasons.map((r: string) => `<li>${h(r)}</li>`).join('')}</ul></div>` : ''}${d.escalatedAt ? `<p>Escalated ${h(atHome(s, t.propertyId, d.escalatedAt))}; see linked maintenance task.</p>` : ''}${offers ? `<details><summary>Offer and replacement history</summary><ul>${offers}</ul></details>` : ''}${t.status === 'unassigned' ? form('turnover.offers', 'turnovers', hidden('id', t.id) + hidden('revision', t.revision), 'Ask approved cleaners again', 'class="quiet"') : ''}`
}
export function cleanerOffer(s: any, t: any) {
 const d = t.dispatch, offer = d?.offers.find((o: any) => o.memberId === s.actor.memberId && o.status === 'pending' && o.generation === d.generation)
 if (!offer) return ''
 const home = s.homeSettings.find((p: any) => p.propertyId === t.propertyId), base = s.cleanerProfiles?.find((p: any) => p.id === s.actor.memberId)?.homeBase
 const inputs = hidden('id', t.id) + hidden('revision', t.revision) + hidden('offerId', offer.id)
 return `<article class="record job"><h3>${h(propertyName(s, t.propertyId))}</h3><p><strong>Offer · ${h(windowText(t))}</strong></p><p>${h(home?.address)}${base && home?.address ? ` · <a href="${h(directions(base, home.address))}" target="_blank" rel="noreferrer">Directions from your home base</a>` : ''}</p><p>${h(d.templateName)} · ${h(d.durationMinutes)} work minutes · USD ${(d.rateCents / 100).toFixed(2)}</p><p>${h(d.instructions)}</p><ul>${t.checklist.map((i: string) => `<li>${h(i)}</li>`).join('')}</ul><p>Respond before ${h(atHome(s, t.propertyId, offer.expiresAt))}. The first eligible cleaner to accept gets this job. Acceptance checks your current route and capacity.</p>${form('turnover.accept', 'turnovers', inputs, 'Accept turnover')}${form('turnover.decline', 'turnovers', inputs + '<label>Reason for declining<input name="reason" required maxlength="500"></label>', 'Decline', 'class="quiet"')}</article>`
}
export function cleanerCancellation(s: any, t: any) {
 const offer = t.dispatch?.offers.find((o: any) => o.memberId === s.actor.memberId && o.status === 'accepted')
 return t.status === 'approved' && offer ? `<details><summary>I can no longer do this job</summary><p>Your manager is alerted and Cabin asks eligible approved backups. Your access is removed.</p>${form('turnover.decline', 'turnovers', hidden('id', t.id) + hidden('revision', t.revision) + hidden('offerId', offer.id) + '<label>Why you need to cancel<input name="reason" required maxlength="500"></label>', 'Cancel my acceptance', 'class="quiet"')}</details>` : ''
}
