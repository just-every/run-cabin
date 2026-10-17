import { h, heading, panel, form, field, area, hidden, empty, badge, manager, money, propertyName } from './shared'

const cents = (name: string, label: string, value: unknown, min = 0, attrs = '') => field(name, `${label} (cents)`, 'number', String(value ?? ''), `min="${min}" step="1" ${attrs}`)
const integer = (name: string, label: string, value: unknown, min = 0) => field(name, label, 'number', String(value ?? ''), `min="${min}" step="1"`)
const check = (name: string, label: string, checked: boolean) => `<label class="check"><input name="${h(name)}" type="checkbox" value="true"${checked ? ' checked' : ''}>${h(label)}</label>`
const optional = (name: string, label: string, value: unknown) => `<label>${h(label)}<input name="${h(name)}" value="${h(value)}" maxlength="120"></label>`
const rate = (bps: number) => `${(bps / 100).toFixed(2)}%`
const line = (label: string, value: string) => `<li>${h(label)}: ${h(value)}</li>`

function savedRules(home: any) {
  return `<details><summary>Saved pricing and booking rules</summary><ul>${[
    line('Nightly rate', money(home.nightlyCents)),
    line('Cleaning per stay', money(home.cleaningCents)),
    line('Extra guest per night', `${money(home.extraGuestCents)} after ${home.includedGuests} included guests`),
    line('Guest limit', String(home.maxGuests)),
    line('Stay length', `${home.minNights}–${home.maxNights} nights`),
    line('Minimum gap', `${home.minGapNights} nights`),
    line('State tax', `${home.taxLabel || 'No label'} · ${rate(home.taxBps)}`),
    line('County tax', `${home.countyTaxLabel || 'No label'} · ${rate(home.countyTaxBps)}`),
    line('Damage deposit authorization', `${money(home.depositCents)} · release ${home.releaseHours} hours after checkout`),
    line('Identity check', home.requireIdentity ? 'Required' : 'Not required'),
  ].join('')}</ul><p class="muted">New bookings use these saved rules. Existing stays retain their quoted amounts and signed agreement.</p></details>`
}

function homeSettings(state: any, property: any) {
  const saved = state.direct.homes.find((home: any) => home.propertyId === property.id)
  const home = saved ?? {
    enabled: false, slug: '', description: '', nightlyCents: '', cleaningCents: 0,
    extraGuestCents: 0, includedGuests: 2, maxGuests: 4, minNights: 2, maxNights: 30,
    minGapNights: 0, depositCents: 0, releaseHours: 24, taxLabel: '', taxBps: 0,
    countyTaxLabel: '', countyTaxBps: 0, agreement: '', requireIdentity: false,
  }
  const publicUrl = saved?.slug ? state.origin + '/book/' + saved.slug : ''
  const fields = hidden('propertyId', property.id) + hidden('revision', saved?.revision ?? '')
    + check('enabled', 'Publish this home for direct bookings', home.enabled)
    + field('slug', 'Public booking slug', 'text', home.slug, 'pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" placeholder="your-home"')
    + '<p class="muted">Use lowercase letters, numbers and hyphens. The address “stay” is reserved.</p>'
    + area('description', 'Home description', home.description, 'maxlength="3000"')
    + '<h3>Rates and guests</h3><p class="muted">Enter whole cents: 12500 means $125.00. Extra guest fees apply per extra guest, per night.</p>'
    + `<div class="pair">${cents('nightlyCents', 'Nightly rate', home.nightlyCents, 1)}${cents('cleaningCents', 'Cleaning fee per stay', home.cleaningCents)}</div>`
    + `<div class="pair">${cents('extraGuestCents', 'Extra guest fee per night', home.extraGuestCents)}${integer('includedGuests', 'Guests included in the nightly rate', home.includedGuests, 1)}</div>`
    + integer('maxGuests', 'Maximum guests', home.maxGuests, 1)
    + `<div class="pair">${integer('minNights', 'Minimum nights', home.minNights, 1)}${integer('maxNights', 'Maximum nights', home.maxNights, 1)}</div>`
    + integer('minGapNights', 'Minimum gap between stays (nights)', home.minGapNights)
    + '<h3>Damage deposit</h3>'
    + `<div class="pair">${cents('depositCents', 'Deposit authorization', home.depositCents)}${integer('releaseHours', 'Release after checkout (hours)', home.releaseHours)}</div>`
    + '<h3>Lodging taxes</h3><p class="muted">Enter tax rates in basis points: 900 means 9%. Recording a filing below stores your evidence; it does not file or remit taxes.</p>'
    + `<div class="pair">${optional('taxLabel', 'State tax label (for example, Maine lodging tax)', home.taxLabel)}${integer('taxBps', 'State tax rate (basis points)', home.taxBps)}</div>`
    + `<div class="pair">${optional('countyTaxLabel', 'County tax label', home.countyTaxLabel)}${integer('countyTaxBps', 'County tax rate (basis points)', home.countyTaxBps)}</div>`
    + '<h3>Guest agreement and identity</h3>' + area('agreement', 'Agreement guests must sign', home.agreement, 'maxlength="20000"')
    + check('requireIdentity', 'Require a Stripe identity check before confirmation', home.requireIdentity)
  return `<article class="record"><div class="record-title"><h3>${h(property.name)}</h3>${badge(saved?.enabled ? 'Published' : 'Unpublished')}</div>${publicUrl ? `<p>Public booking URL: <a href="${h(publicUrl)}">${h(publicUrl)}</a>${saved.enabled ? '' : ' · currently unpublished'}</p>` : '<p class="muted">Save a slug to create this home’s public booking URL.</p>'}${saved ? savedRules(saved) : ''}<details${saved ? '' : ' open'}><summary>${saved ? 'Edit booking settings' : 'Set up direct bookings'}</summary>${form('direct.configure', 'direct', fields, 'Save booking settings')}</details></article>`
}

function quote(stay: any) {
  const q = stay.quote
  return `<details><summary>Quoted total ${h(money(q.totalCents))} · ${h(q.nights)} nights</summary><ul>${[
    line('Rent', `${q.nights} nights × ${money(q.nightlyCents)} = ${money(q.rentCents)}`),
    line('Cleaning', money(q.cleaningCents)),
    line('Extra guests', money(q.extraGuestCents)),
    ...q.taxes.map((tax: any) => line(`${tax.label} (${rate(tax.bps)})`, money(tax.amountCents))),
    line('Booking total', money(q.totalCents)),
    line('Separate damage deposit authorization', money(q.depositCents)),
  ].join('')}</ul></details>`
}

function depositActions(stay: any, managed: boolean) {
  const deposit = stay.deposit
  if (!deposit) return '<p>Damage deposit: no authorization recorded.</p>'
  const authorization = `<p>Damage deposit: ${badge(deposit.status)} · ${h(money(deposit.amountCents))}${deposit.expiresAt ? ` · authorization expires ${h(deposit.expiresAt)}` : ''}${deposit.claimCents && !deposit.capturedCents ? ` · claim requested ${h(money(deposit.claimCents))}` : ''}${deposit.capturedCents ? ` · captured ${h(money(deposit.capturedCents))}` : ''}${deposit.reason ? ` · ${h(deposit.reason)}` : ''}${deposit.evidence ? ` · Evidence: ${h(deposit.evidence)}` : ''}</p>`
  if (managed || deposit.status !== 'requires_capture') return authorization
  if (Date.now() < Date.parse(stay.checkedOutAt ?? stay.end + 'T23:59:59.999Z')) return authorization + '<p class="muted">Release or capture is available after checkout. Review the authorization expiry before arrival.</p>'
  const release = Date.now() >= Date.parse(stay.checkedOutAt ?? stay.end + 'T23:59:59.999Z')
    ? form('direct.deposit.release', 'direct', hidden('id', stay.id), 'Release deposit')
    : '<p class="muted">Manual release is available after checkout. Stripe may expire an authorization earlier; review its expiry above.</p>'
  return authorization + release
    + `<details><summary>Capture damage from this deposit</summary><p>Capture only the documented damage amount, up to the authorized deposit. This charges the guest.</p>${form('direct.deposit.capture', 'direct', hidden('id', stay.id) + cents('amountCents', 'Amount to capture', '', 1, `max="${h(deposit.amountCents)}"`) + area('reason', 'Damage reason') + field('evidence', 'Damage evidence reference'), 'Capture damage amount')}</details>`
}

function taxForms(stay: any) {
  const evidence = stay.taxFilings?.length ? `<h4>Recorded tax filing evidence</h4><ul>${stay.taxFilings.map((filing: any) => `<li>${h(filing.jurisdiction)} · ${h(filing.reference)} · recorded ${h(filing.at)} by ${h(filing.actorId)}</li>`).join('')}</ul>` : ''
  if (!['paid', 'confirmed'].includes(stay.phase)) return evidence
  return evidence + `<details><summary>Record manual tax filing</summary><p>File and remit through the relevant tax authority first, then record its confirmation reference here. Cabin does not submit a filing or payment.</p>${(['state', 'county'] as const).map(jurisdiction => form('direct.tax.filed', 'direct', hidden('id', stay.id) + hidden('jurisdiction', jurisdiction) + field('reference', `${jurisdiction === 'state' ? 'State' : 'County'} filing confirmation reference`), `Record ${jurisdiction} filing`)).join('')}</details>`
}

function stayRecord(state: any, stay: any) {
  const pending = ['held', 'paid'].includes(stay.phase)
  const signature = stay.signature
  return `<article class="record"><div class="record-title"><h3>${h(stay.guestName)} · ${h(propertyName(state, stay.propertyId))}</h3>${badge(stay.phase)}</div><p>${h(stay.start)} → ${h(stay.end)} (checkout) · ${h(stay.email)}</p><p class="muted">Created ${h(stay.createdAt)} · Stay ${h(stay.id)}</p>${pending || stay.error ? `<p><strong>Manager review</strong> · ${stay.phase === 'held' ? 'Nights held; payment and confirmation are pending.' : stay.phase === 'paid' ? 'Payment recorded; confirmation checks are pending.' : 'Review the recorded issue below.'}</p>` : ''}${stay.error ? `<p class="link-error" role="alert">${h(stay.error)}</p>` : ''}${quote(stay)}<p>Payment: ${stay.paymentId ? h(stay.paymentId) : 'no payment recorded'}.</p><p>Identity check: ${stay.identity ? badge(stay.identity.status) : 'no identity session recorded'}.</p>${signature ? `<p>Agreement signed by ${h(signature.name)} at ${h(signature.at)} · version ${h(signature.version)}. <a href="/api/cabin/direct/stays/${encodeURIComponent(stay.id)}/agreement">View signed agreement</a></p><details><summary>Signed agreement text</summary><pre>${h(signature.text)}</pre></details>` : '<p>Agreement: no signature recorded.</p>'}${!state.managed ? form('direct.refresh', 'direct', hidden('id', stay.id), 'Refresh payment and identity status') : ''}${stay.checkedOutAt?`<p>Checked out ${h(stay.checkedOutAt)}</p>`:stay.phase==='confirmed'&&stay.start<=new Date().toISOString().slice(0,10)?form('direct.checkout.complete','direct',hidden('id',stay.id),'Mark guest checked out'):''}${depositActions(stay, state.managed)}${taxForms(stay)}</article>`
}

export function direct(state: any) {
  if (!manager(state)) return '<h1>Page unavailable</h1><p>Your role cannot access this page.</p>'
  const stays = [...state.direct.stays].sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
  return heading('Direct bookings', 'Your homes, booked directly', 'Publish booking rules, review guest agreements and payment status, and manage damage deposits and tax filing evidence.')
    + (state.managed ? '<p>Stripe payments, ID checks and damage deposits are not available yet on RER Managed hosting.</p>' : '<p class="notice">Stripe uses the configured server secret; no keys are entered here. A test-mode secret creates test payments, ID checks and damage deposits. Test results do not establish a live payment or verified guest identity.</p>')
    + panel('Home booking settings', state.properties.map((property: any) => homeSettings(state, property)).join('') || empty('Add a property in Properties & people before setting up direct bookings.'))
    + panel('Direct stays', stays.map((stay: any) => stayRecord(state, stay)).join('') || empty('Direct booking holds and completed stays will appear here.'))
}
