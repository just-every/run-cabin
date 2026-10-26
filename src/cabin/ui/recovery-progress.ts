import { choose } from './ops'
import { h, form, hidden, area, propertyName, money } from './shared'

const ref=(r:any)=>hidden('id',r.id)+hidden('revision',r.revision)
export function alternativeForm(s:any,r:any) {
 const a=r.proposal?.alternative
 return `<details><summary>Offer another home or different dates</summary>${choose('alternativePropertyId','Alternative home',[['','Keep current home'],...s.properties.map((p:any)=>[p.id,p.name])],a?.propertyId??'')}<div class="pair"><label>Alternative arrival date<input type="date" name="alternativeStart" value="${h(a?.start??'')}"></label><label>Alternative departure date<input type="date" name="alternativeEnd" value="${h(a?.end??'')}"></label></div><label>Alternative check-in time<input type="time" name="alternativeArrivalTime" value="${h(a?.arrivalTime??'')}"></label><p>The exact alternative needs manager approval and guest acceptance. Current inventory, source authority, cleaner capacity and both homes’ limits are checked again before any change.</p></details>`
}
export function alternativeSummary(s:any,r:any) {
 const a=r.proposal?.alternative
 if(!a)return ''
 return `<dl class="facts"><dt>Alternative home</dt><dd>${h(propertyName(s,a.propertyId))}</dd><dt>Alternative stay</dt><dd>${h(a.start)} → ${h(a.end)} · check-in ${h(a.arrivalTime)}</dd><dt>Preparation window</dt><dd>${h(a.preparation.windowStart)} → ${h(a.preparation.windowEnd)}</dd></dl>${a.blockedReason?`<p class="notice" role="alert">${h(a.blockedReason)}</p>`:''}`
}
export function recoveryProgress(s:any,r:any) {
 const b=s.bookings.find((b:any)=>b.id===r.bookingId),t=s.turnovers.find((t:any)=>t.id===r.turnoverId)
 const messages=s.messages.filter((m:any)=>m.bookingId===r.bookingId),statement=s.statements.find((row:any)=>row.id===r.statementId)
 const previous=r.previous&&s.codes.find((code:any)=>code.id===r.previous.code.id)
 const followup=r.status==='ready'&&r.guestConfirmedAt?form('recovery.recurrence','recovery',ref(r)+'<label>Follow-up evidence reference<input name="reference" maxlength="300" required></label>'+area('note','What the follow-up established','','maxlength="1000"')+'<label class="check"><input type="checkbox" name="confirm" value="yes" required> I checked current guest reports, field evidence, access and the frozen owner balance</label>','Record follow-up check'):''
 return `<details class="recovery-history"><summary>Stay evidence and remaining checks</summary><p><a href="/app/calendar?reservation=${h(r.bookingId)}">Current reservation and source history</a> · ${h(b?.channel??'')} · ${h(b?.revision??'')}</p>${r.alternativeOrigin?`<p>Original owner scope: ${h(propertyName(s,r.alternativeOrigin.propertyId))}. Operational home: ${h(propertyName(s,b?.propertyId))}. Existing owner postings remain with their original owner.</p>`:''}<ul><li>Accepted cleaner: ${r.acceptedAt?'confirmed':'waiting'}</li><li>Field checklist and photos: ${t?.status==='completed'?`${t.completion?.photos?.length??0} photos recorded`:'waiting'}</li><li>Previous access: ${h(previous?.lock.state??'no provider code')}</li><li>Guest thread: ${messages.length} recorded messages · <a href="/app/inbox">Open Inbox</a></li><li>Source revisions: ${b?.lifecycle?.sourceReview||b?.lifecycle?.sourceConflict?'needs reconciliation':'no unresolved source revision'}</li><li>Frozen owner adjustment: ${statement?h(money(statement.netCents)):'waiting'}</li><li>Guest recovery confirmation: ${r.guestConfirmedAt?'confirmed':'waiting for the guest'}</li><li>Follow-up check: ${r.recurrence?h(r.recurrence.reference):'waiting'}</li></ul>${r.status==='ready'&&!r.guestConfirmedAt?'<p>The readiness email is sent. The case stays open until the verified guest confirms the home and access on their private stay page, then a person checks for recurrence.</p>':''}${followup}</details>`
}
