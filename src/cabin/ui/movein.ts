import { h, heading, panel, form, field, area, hidden, empty, badge, money, select } from './shared'
import { atHome } from './ops'

const providers: [string, string][] = [['guesty', 'Guesty'], ['hostaway', 'Hostaway'], ['ownerrez', 'OwnerRez']]
const metrics = [
  ['reservations', 'Reservations'],
  ['futureNights', 'Future nights'],
  ['ownerBalanceCents', 'Opening owner balances'],
] as const

function table(caption: string, columns: string[], rows: string[][]) {
  if (!rows.length) return empty(`No ${caption.toLowerCase()} in this plan.`)
  return `<div class="movein-scroll" role="region" aria-label="${h(caption)}" tabindex="0"><table><caption>${h(caption)}</caption><thead><tr>${columns.map(c => `<th scope="col">${h(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td data-label="${h(columns[i])}"><div>${cell}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}

function records(plan: any) {
  const homes = new Map<string, any>(plan.homes.map((p: any) => [p.externalId, p]))
  const guests = new Map<string, any>(plan.guests.map((g: any) => [g.externalId, g]))
  const homeName = (id: string) => h(homes.get(id)?.name ?? id)
  return `<details class="movein-details"><summary>Homes · ${plan.homes.length}</summary>${table('Homes', ['Home / source ID', 'Owner', 'Commission', 'Calendar links'], plan.homes.map((p: any) => [
    `${h(p.name)}<small>${h(p.externalId)}</small>`, `${h(p.ownerName)}<small>${h(p.ownerEmail)}</small>`, `${(p.commissionBps / 100).toFixed(2)}%`,
    p.links.length ? p.links.map((l: any) => `${h(l.channel)}<small>${h(l.url)}</small>`).join('<br>') : 'None',
  ]))}</details>
  <details class="movein-details"><summary>Reservations · ${plan.stays.length}</summary>${table('Reservations', ['Source ID', 'Home', 'Guest', 'Arrival / checkout', 'Channel', 'Status'], plan.stays.map((b: any) => [
    h(b.externalId), homeName(b.listingId), h(guests.get(b.guestId)?.name ?? b.guestId), `${h(b.start)} → ${h(b.end)}`, h(b.channel), h(b.status),
  ]))}</details>
  <details class="movein-details"><summary>Guests · ${plan.guests.length}</summary>${table('Guests', ['Name / source ID', 'Email', 'Phone'], plan.guests.map((g: any) => [
    `${h(g.name)}<small>${h(g.externalId)}</small>`, h(g.email), h(g.phone),
  ]))}</details>
  <details class="movein-details"><summary>Opening owner balances · ${plan.balances.length}</summary>${table('Opening owner balances', ['Source ID', 'Home', 'Owner', 'As of', 'Amount'], plan.balances.map((b: any) => [
    h(b.externalId), homeName(b.listingId), h(b.ownerEmail), h(b.asOf), money(b.amountCents),
  ]))}</details>`
}

function reconciliation(job: any) {
  const r = job.reconciliation
  if (!r) return '<p class="muted">Reconciliation is not available for this job.</p>'
  return `<div class="record-title"><h4>Source → Cabin</h4>${badge(r.matched ? 'Totals match' : 'Differences to explain')}</div>
    <p class="muted">${job.status === 'review' ? 'Cabin shows the accepted plan. Import it to reconcile against saved records.' : job.status === 'undone' ? 'These are the saved totals from before undo. The imported records have been removed.' : 'Cabin shows the imported records currently saved in the database.'} Future nights are counted from ${h(job.plan.asOf)}.</p>
    <div class="movein-metrics">${metrics.map(([key, label]) => {
      const format = (n: number) => key === 'ownerBalanceCents' ? money(n) : h(n)
      const differs = r.source[key] !== r.destination[key]
      return `<div class="movein-metric"><h4>${h(label)}</h4><dl><div><dt>Source</dt><dd>${format(r.source[key])}</dd></div><div><dt>${job.status === 'undone' ? 'Before undo' : 'Cabin'}</dt><dd>${format(r.destination[key])}</dd></div></dl><p class="muted">${differs ? 'Difference requires an explanation' : 'Matches'}</p></div>`
    }).join('')}</div>`
}

function signoff(job: any) {
  const differences = new Set(job.reconciliation?.differences.map((d: any) => d.metric) ?? [])
  const explanation = (key: string, label: string, required: boolean) => `<label>${h(label)}${required ? ' (required)' : ' (optional)'}<textarea name="${h(key)}Explanation" rows="2" maxlength="${key === 'refusals' ? 4000 : 2000}" ${required ? 'required' : ''}>${h(job.explanations?.[key] ?? '')}</textarea></label>`
  return form('import.provider.signoff', 'import', hidden('id', job.id) + hidden('fingerprint', job.fingerprint) +
    '<h4>Sign off this cutover</h4><p>Review the saved records and explain every difference and refused row before signing off.</p>' +
    metrics.map(([key, label]) => explanation(key, `${label} explanation`, differences.has(key))).join('') +
    explanation('refusals', 'Refused rows explanation — account for every refused row', job.plan.refusals.length > 0) +
    '<label class="check"><input type="checkbox" name="confirm" value="yes" required> I have reviewed the imported records, reconciliation and every refused row.</label>', 'Sign off cutover')
}

function providerJob(s: any, job: any) {
  const plan = job.plan
  const name = providers.find(([id]) => id === job.provider)?.[1] ?? job.provider
  const refusals = plan.refusals.length ? `<div class="notice error"><strong>${plan.refusals.length} refused row${plan.refusals.length === 1 ? '' : 's'} — excluded from import</strong><p>Accepted rows can still be imported. Explain how every refused row is resolved before signing off.</p></div>${table('Refused rows', ['File', 'Row', 'Kind / source ID', 'Reason'], plan.refusals.map((r: any) => [h(r.file), h(r.row), `${h(r.kind)}${r.externalId ? `<small>${h(r.externalId)}</small>` : ''}`, h(r.reason)]))}` : '<p class="muted">No refused rows.</p>'
  const accepted = plan.homes.length
  return `<article class="record movein-job"><div class="record-title"><h3>${h(name)} move-in</h3>${badge(job.status)}</div><p class="muted">Cutover ${h(plan.asOf)} · Previewed ${h(atHome(s, null, job.createdAt))}</p>
    ${reconciliation(job)}${refusals}
    ${plan.warnings.length ? `<div class="notice"><strong>Review notes</strong><ul>${plan.warnings.map((w: string) => `<li>${h(w)}</li>`).join('')}</ul></div>` : ''}
    ${records(plan)}
    <details class="movein-details"><summary>Source mapping &amp; fingerprint</summary>${table('Recognized source columns', ['File', 'Record kind', 'Columns'], plan.mappings.map((m: any) => [h(m.file), h(m.kind), m.columns.map(h).join(', ')]))}<p>Job <code>${h(job.id)}</code></p><p>Fingerprint <code>${h(job.fingerprint)}</code></p></details>
    ${job.status === 'review' ? accepted ? form('import.provider.apply', 'import', hidden('id', job.id) + hidden('fingerprint', job.fingerprint) + '<p>Import the accepted homes, guests, reservations and balances in this exact preview. Refused rows stay excluded.</p>', 'Import accepted records') : '<p>No accepted records to import. Correct the source files and preview again.</p>' : ''}
    ${job.status === 'imported' ? signoff(job) : ''}
    ${job.signedOffAt ? `<p>Signed off ${h(atHome(s, null, job.signedOffAt))}.</p><details class="movein-details"><summary>Recorded explanations</summary><dl class="facts">${[...metrics, ['refusals', 'Refused rows']].filter(([key]) => job.explanations?.[key]).map(([key, label]) => `<dt>${h(label)}</dt><dd>${h(job.explanations[key])}</dd>`).join('') || '<dd>No differences or refused rows required explanations.</dd>'}</dl></details>` : ''}
    ${['imported', 'signed-off'].includes(job.status) ? form('import.provider.undo', 'import', hidden('id', job.id) + '<p class="muted">Undo removes this import only while its records are unchanged. Later edits or dependent work prevent undo.</p>', 'Undo provider import', 'class="danger"') : ''}
    ${job.undoReason ? `<p>${h(job.undoReason)}</p>` : ''}</article>`
}

function registerReview(j: any) {
  const refusals = j.diagnostics ?? [], conflicts = j.conflicts ?? []
  return `${j.properties ? table('Accepted properties', ['Home / source ID', 'Owner', 'Commission'], j.properties.map((p: any) => [`${h(p.name)}<small>${h(p.id)}</small>`, `${h(p.ownerName)}<small>${h(p.ownerEmail)}</small>`, `${(p.commissionBps / 100).toFixed(2)}%`])) : ''}${refusals.length ? `<p>${h(refusals.length)} refused rows are excluded from this plan. Correct the CSV and preview again, or approve only the accepted properties.</p>${table('Refused property rows', ['File', 'Row', 'Reason'], refusals.map((d: any) => [h(d.location?.artifact), h(d.location?.row), h(d.message)]))}` : ''}${conflicts.length ? table('Property conflicts', ['Property', 'Reason'], conflicts.map((c: any) => [h(c.propertyId), h(c.reason)])) : ''}`
}

function legacyJob(j: any) {
  const review = j.status === 'review', canApprove = review && j.properties?.length && !j.conflicts?.length
  return `<article class="record"><div class="record-title"><h3>Property register · ${h(j.id)}</h3>${badge(j.state ?? j.status)}</div><p class="muted">Fingerprint <code>${h(j.fingerprint)}</code></p>${registerReview(j)}${j.total ? `<p>${h(j.checkpoint)} of ${h(j.total)} records processed</p>` : ''}${j.error ? `<p role="alert">${h(j.error)}</p>` : ''}${j.jobId ? form('import.journal', 'import', hidden('id', j.id), 'Read import journal') : ''}${['queued', 'applying', 'undoing', 'rolling_back'].includes(j.state) ? form('import.resume', 'import', hidden('id', j.id), 'Continue approved import') : ''}${canApprove ? form('import.approve', 'import', hidden('id', j.id) + hidden('fingerprint', j.fingerprint), 'Approve this import') : review ? '<p>Correct the CSV conflicts or refused rows and preview again before importing.</p>' : ''}${j.state === 'completed' || j.status === 'completed' ? form('import.undo', 'import', hidden('id', j.id), 'Undo imported properties', 'class="danger"') : ''}</article>`
}

function legacyResult(result: any) {
  if (!result || result.provider || result.job?.provider) return ''
  const job = result.job ?? result
  const messages = [...(result.report?.conflicts ?? [])]
  const describe = (value: any): string => value === null || typeof value !== 'object' ? String(value ?? '') : Object.entries(value).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => `${k}: ${v}`).join(' · ')
  return panel('Property-register result', `${result.id ? `<p>Review <code>${h(result.id)}</code></p>` : ''}${registerReview(result)}${job.state || job.status ? `<p>${badge(job.state ?? job.status)}</p>` : ''}${job.total !== undefined ? `<p>${h(job.checkpoint ?? 0)} of ${h(job.total)} records processed.</p>` : ''}${messages.length ? `<ul>${messages.map(m => `<li>${h(describe(m))}</li>`).join('')}</ul>` : ''}${result.batches ? table('Import batches', ['Action', 'Start', 'End'], result.batches.map((b: any) => [h(b.action), h(b.position), h(b.endPosition)])) : ''}${result.originals ? table('Retained source files', ['File', 'Bytes', 'Availability'], result.originals.map((o: any) => [h(o.name), h(o.size), h(o.original.status)])) : ''}${result.report ? table('Undo report', ['Record', 'Disposition', 'Reason'], (result.report.dispositions ?? []).map((d: any) => [h(d.entity?.recordId ?? d.targetId), h(d.disposition), h(d.protectedBy?.length ? `${d.reason} · dependent property work retained` : d.reason)])) : ''}`)
}

export function movein(s: any, extras: any) {
  const jobs = s.importJobs ?? []
  const upload = form('import.provider.preview', 'import', select('provider', 'Current property manager', providers) + field('asOf', 'Cutover date', 'date', new Date().toISOString().slice(0, 10)) +
    '<label>Native export files<input type="file" name="sourceFiles" accept=".csv,text/csv" multiple required aria-describedby="movein-files"></label><p class="muted" id="movein-files">Select the original CSV exports together. Keep source IDs and column headings intact; see <a href="/docs/move-in-formats">supported provider reports</a>.</p>' +
    '<label>Supplementary cutover file (optional)<input type="file" name="sourceFiles" accept=".csv,text/csv" aria-describedby="movein-supplement"></label><p class="muted" id="movein-supplement">Add missing ownership, commission, opening balances or iCal links using the <a href="/docs/move-in-formats">documented cutover format</a>. OwnerRez reservation rows also need channel and status in this file.</p>' +
    '<p>Preview saves the source mapping and accepted records for review. It creates no homes or reservations.</p>', 'Preview exports', 'enctype="multipart/form-data"')
  const legacy = `<details class="movein-details"><summary>Property-register CSV · homes only</summary><p>Use the original five-column kit to import homes, owners and commissions.</p>${form('import.preview', 'import', area('csv', 'Property register CSV', 'external_id,name,owner_name,owner_email,commission_bps\nhome-1,Seabreeze Cottage,Morgan Lee,morgan@property.example,1500') + '<p><a href="/docs/move-in">CSV shape and example fixture</a></p>', 'Preview move-in')}</details>`
  return heading('Move in with a review', 'Move in', 'Bring your homes, reservations, guests and opening owner balances from Guesty, Hostaway or OwnerRez. Preview the exports, import the accepted records, then reconcile and sign off.') +
    panel('Preview provider exports', upload) +
    '<div class="notice"><strong>Provider API not connected · exports work</strong><p>The documented API adapters have been exercised with recorded synthetic fixtures only. Live provider access needs owner accounts.</p><p>Imported reservations block Cabin’s shared calendar. iCal links are retained for ongoing calendar sync.</p>' + (s.managed ? '<p>On RER managed hosting, outbound iCal refresh is unavailable. Self-host Cabin for live iCal refresh; file imports still work here.</p>' : '<p>Self-hosted Cabin refreshes live iCal links. Review sync status in Calendar after move-in.</p>') + '</div>' +
    panel('Provider imports', jobs.filter((j: any) => j.provider).map((job: any) => providerJob(s, job)).join('') || empty('Preview your provider exports to see accepted records, refused rows and source totals here.')) +
    panel('Property-register kit', legacy) + legacyResult(extras.result?.result ?? extras.result) +
    panel('Property-register journal', jobs.filter((j: any) => !j.provider).map(legacyJob).join('') || empty('Property-register imports will appear here.'))
}
