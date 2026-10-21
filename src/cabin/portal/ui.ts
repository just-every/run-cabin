import { h, form, hidden, area, panel } from '../ui/shared'
import { homeSettings } from '../homes'
import { codeState } from '../codes'

/** Manager's view of the guest portal: each home's guide and the stay links that can still be replaced. */
export function portalPanel(s: any) {
 const homes = s.properties.filter((p: any) => s.homeSettings.some((r: any) => r.propertyId === p.id)).map((p: any) => {
  const guide = homeSettings(s, p.id).guide
  const links = s.codes.filter((c: any) => c.propertyId === p.id && c.holder === 'guest' && c.link && c.status === 'issued' && codeState(c) !== 'expired').map((c: any) => {
   const stay = s.bookings.find((b: any) => b.id === c.bookingId)
   return `<li>${h(stay?.guestName ?? 'Guest')} · ${h(c.validFrom.slice(0, 10))} to ${h(c.validUntil.slice(0, 10))} ${form('portal.link.rotate', 'turnovers', hidden('bookingId', c.bookingId), 'Replace guest link')}</li>`
  }).join('')
  const body = hidden('propertyId', p.id) + hidden('version', guide?.version ?? 0) + area('arrival', 'Arrival instructions (shown only while access is released)', guide?.arrival ?? '', 'maxlength="12000"')
   + `<label>Digital guidebook (optional)<textarea name="guidebook" rows="6" maxlength="12000">${h(guide?.guidebook ?? '')}</textarea></label>`
  return `<details class="home-settings"><summary><strong>${h(p.name)}</strong> · ${guide ? `guide version ${guide.version}` : 'no guide yet'}</summary>${form('portal.guide', 'turnovers', body, 'Save guide')}<p class="muted">House rules come from the property profile. Saving changed text raises the version guests see.</p>${links ? `<h3>Guest links</h3><ul>${links}</ul><p class="muted">Links stop working seven days after check-out. Replacing one ends the old link at once; send the guest the new one.</p>` : ''}</details>`
 }).join('')
 return panel('Guest portal by home', homes || '<p class="empty">Save a home’s turnover settings first; then write its guide here.</p>')
}
