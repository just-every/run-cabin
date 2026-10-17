import type { Bindings } from '../../auth.server'
import { type Actor, type Statement, manager, need, text, newId, sha, query } from '../model'
import { assertLive, load, mutate } from '../storage'
import { csvCell, statementCsv } from '../statements'
import { sumCents } from './csv'
import type { Payout } from './types'

type Account = { id: string; code: string; name: string; type: string; subtype: string; active: number; revision: string }
type Document = { id: string; name: string; sha256: string; text: string | null }
type JournalLine = { accountId: string; accountName: string; accountCode: string; debitCents: number; creditCents: number; memo: string }
type PantryProposal = { id: string; kind: string; summary: string; payload: Record<string, unknown>; status: string; result_id?: string | null; result_kind?: string | null }
type PantryContext = { accounts: Account[]; documents: Document[]; proposals: PantryProposal[] }
type Connection = { origin: string; token: string }
export interface BookPosting {
 id: string; revision: string; propertyId: string; statementId: string; statementRevision: string;
 origin: string; marker: string; documentId: string; sourceSha256: string; payloadSha256: string;
 date: string; memo: string; lines: JournalLine[]; rows: number;
 status: 'sending' | 'uncertain' | 'proposed' | 'posted' | 'rejected' | 'stale' | 'exported';
 proposalId: string | null; batchId: string | null; at: string; updatedAt: string; detail: string | null;
}

/** Accept a bare public HTTPS origin. Loopback HTTP is only for a local Cabin. */
function pantryOrigin(value: unknown, env: Bindings) {
 let url: URL
 try { url = new URL(text(value, 'Pantry origin', 500)) } catch { need(false, 'Enter a valid Pantry origin'); }
 const host = url!.hostname.replace(/^\[|\]$/g, '').toLowerCase()
 need(!host.endsWith('.'), 'Use a Pantry hostname without a trailing dot')
 const loopback = ['localhost', '127.0.0.1', '::1'].includes(host)
 need(!url!.username && !url!.password && url!.pathname === '/' && !url!.search && !url!.hash, 'Use the Pantry origin only, without credentials, a path or a query')
 if (loopback) need(env.AUTH_LOCAL === 'true' && ['http:', 'https:'].includes(url!.protocol), 'Loopback Pantry requires a local Cabin installation')
 else {
  need(url!.protocol === 'https:', 'Pantry requires HTTPS')
  need(host.includes('.') && !host.includes(':') && !/\.(localhost|local|internal|home|lan|test|invalid|arpa)$/.test(host), 'Use a public Pantry hostname')
  if (/^\d+(?:\.\d+){3}$/.test(host)) {
   const [a, b] = host.split('.').map(Number)
   need(!(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b)), 'Private network Pantry addresses are not allowed')
  }
 }
 return url!.origin
}

const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
const unbase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
async function tokenKey(env: Bindings) {
 need(typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 16, 'Configure SESSION_SECRET before connecting Pantry', 503)
 const key = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cabin:pantry-token:${env.SESSION_SECRET}`))
 return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function seal(env: Bindings, token: string, origin: string) {
 const iv = crypto.getRandomValues(new Uint8Array(12)), key = await tokenKey(env)
 const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(origin) }, key, new TextEncoder().encode(token))
 return `v1.${base64(iv)}.${base64(new Uint8Array(bytes))}`
}
async function connection(env: Bindings): Promise<Connection | null> {
 const row = await env.DB.prepare("SELECT origin,token FROM cb_finance_connections WHERE id='pantry'").first<Connection>()
 if (!row) return null
 const origin = pantryOrigin(row.origin, env)
 try {
  const [version, iv, encrypted] = row.token.split('.')
  need(version === 'v1' && iv && encrypted, 'Stored credential format is invalid')
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: new TextEncoder().encode(origin) }, await tokenKey(env), unbase64(encrypted))
  return { origin, token: new TextDecoder().decode(bytes) }
 } catch { need(false, 'Reconnect Pantry: its encrypted credential cannot be opened', 503) }
}

/** Never include upstream response bodies, URLs with credentials, or tokens in errors. */
async function pantry<T>(conn: Connection, path: string, body?: unknown): Promise<T> {
 let response: Response
 try {
  response = await fetch(conn.origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { authorization: `Bearer ${conn.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
 } catch { need(false, 'Pantry could not be reached. Refresh the submission status before taking further action.', 502) }
 need(response!.ok, `Pantry refused the request (HTTP ${response!.status}). Check its agent token, accounts and open accounting period.`, 502)
 try { return await response!.json() as T } catch { need(false, 'Pantry returned an unreadable response. Refresh the submission status.', 502) }
}
async function context(conn: Connection) {
 const result = await pantry<PantryContext>(conn, '/api/pantry/agent/context')
 need(Array.isArray(result.accounts) && Array.isArray(result.documents) && Array.isArray(result.proposals), 'Pantry returned incomplete agent context', 502)
 return result
}

export async function booksState(env: Bindings, actor: Actor) {
 if (!['owner', 'manager'].includes(actor.role) || actor.isAgent) return null
 await assertLive(env.DB, actor)
 const saved = await env.DB.prepare("SELECT origin FROM cb_finance_connections WHERE id='pantry'").first<{ origin: string }>()
 if (!saved) return { connected: false, origin: null, accounts: [], documents: [], error: null }
 try {
  const conn = await connection(env), remote = await context(conn!)
  await assertLive(env.DB, actor)
  return { connected: true, origin: conn!.origin, accounts: remote.accounts.map(({ id, code, name, type, subtype, active, revision }) => ({ id, code, name, type, subtype, active, revision })), documents: remote.documents.map(({ id, name, sha256 }) => ({ id, name, sha256 })), error: null }
 } catch {
  await assertLive(env.DB, actor)
  return { connected: true, origin: saved.origin, accounts: [], documents: [], error: 'Pantry is unavailable or its credential needs reconnecting. Existing submissions remain saved; refresh them after restoring access.' }
 }
}

function mappedAccount(remote: PantryContext, value: unknown, type: string, label: string) {
 const account = remote.accounts.find(a => a.id === text(value, label))
 need(account && account.active && account.type === type && !['receivable', 'payable'].includes(account.subtype), `Choose an active ${type} account for ${label}, outside Pantry's receivable/payable control accounts`)
 return account
}
function frozenStatement(statement: Statement | undefined, revision: unknown): asserts statement is Statement {
 need(statement?.status === 'approved' && statement.approval?.revision === statement.revision, 'An approved, frozen statement is required', 409)
 need(statement.revision === revision, 'The statement revision changed. Review it again.', 409)
 need(statement.source === 'imported', 'Books proposals require a statement prepared from matched imported payouts', 409)
}
export function journal(s: Statement, payouts: Payout[], clearing: Account, owner: Account, income: Account) {
 need(s.payoutIds?.length && new Set(s.payoutIds).size === s.payoutIds.length && payouts.length === s.payoutIds.length, 'The statement payout evidence is incomplete', 409)
 need(payouts.every(p => p.statementId === s.id && p.propertyId === s.propertyId && p.match === 'matched' && p.bookingId && p.grossCents - p.feeCents === p.netCents), 'Statement payouts changed or do not reconcile', 409)
 need(sumCents(payouts.map(p => p.grossCents)) === s.grossCents && sumCents(payouts.map(p => p.feeCents)) === s.channelFeeCents && sumCents(payouts.map(p => p.netCents)) === s.settlementCents && sumCents([s.grossCents, -s.channelFeeCents!, -s.managementFeeCents]) === s.netCents, 'The approved statement totals do not match its payout evidence', 409)
 const lines: JournalLine[] = []
 const add = (a: Account, signedDebit: number, memo: string) => {
  need(Number.isSafeInteger(signedDebit), 'Journal amount must be an integer number of cents')
  if (signedDebit) lines.push({ accountId: a.id, accountName: a.name, accountCode: a.code, debitCents: Math.max(0, signedDebit), creditCents: Math.max(0, -signedDebit), memo: memo.slice(0, 500) })
 }
 for (const p of payouts) {
  const ref = `${p.source}; imported line ${p.id}; booking ${p.bookingId}; payout ${p.payoutId || '(not supplied)'}; reference ${p.reference}`
  add(clearing, p.netCents, `Imported settlement · ${ref}`)
  add(owner, -p.grossCents, `Owner gross · ${ref}`)
  add(owner, p.feeCents, `Imported channel fees borne by owner · ${ref}`)
 }
 add(owner, s.managementFeeCents, `Management fee deducted from owner payable · ${s.id}`)
 add(income, -s.managementFeeCents, `Management fee earned · ${s.id}`)
 need(lines.length >= 2 && lines.length <= 200, 'This statement requires 2–200 journal lines. Its payout detail exceeds Pantry’s single-entry limit; prepare a reviewed accounting breakdown in Pantry instead.')
 need(sumCents(lines.map(l => l.debitCents)) === sumCents(lines.map(l => l.creditCents)) && lines.some(l => l.debitCents > 0), 'The journal does not balance')
 return lines
}
const dollars = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`
const proposalHash = (p: PantryProposal) => sha(JSON.stringify(p.payload))
function outcome(p: PantryProposal): Pick<BookPosting, 'status' | 'proposalId' | 'batchId' | 'detail'> {
 need(typeof p.id === 'string' && p.kind === 'journal', 'Pantry returned an invalid journal proposal', 502)
 if (p.status === 'approved') {
  need(p.result_kind === 'journal' && typeof p.result_id === 'string' && p.result_id, 'Pantry approval has no posted journal ID; review it in Pantry', 502)
  return { status: 'posted', proposalId: p.id, batchId: p.result_id, detail: 'A person approved and posted this journal in Pantry.' }
 }
 need(['proposed', 'rejected', 'stale'].includes(p.status), 'Pantry returned an unknown proposal status', 502)
 return { status: p.status as 'proposed' | 'rejected' | 'stale', proposalId: p.id, batchId: null, detail: p.status === 'proposed' ? 'Awaiting human approval and posting in Pantry.' : 'Review this decision in Pantry. Cabin will not submit it again automatically.' }
}
async function saveOutcome(env: Bindings, actor: Actor, id: string, values: Partial<BookPosting>) {
 return mutate(env.DB, actor, 'books.result', c => {
  const row = (c.data.postings as BookPosting[]).find(p => p.id === id)
  need(row, 'Books submission not found', 404)
  // Concurrent refreshes cannot regress a confirmed posting or replace its journal.
  if (row.status === 'posted') return row
  Object.assign(row, values, { revision: newId(), updatedAt: c.now }); c.entityId = row.id; return row
 })
}

export async function booksCommand(env: Bindings, actor: Actor, name: string, input: Record<string, unknown>) {
 manager(actor); need(!actor.isAgent, 'A human manager must connect and submit statements', 403); await assertLive(env.DB, actor)
 if (name === 'books.connect') {
  const origin = pantryOrigin(input.origin, env), token = text(input.token, 'Pantry scoped agent token', 500)
  need(!/[\s\u0000-\u001f]/.test(token), 'Enter a valid scoped Pantry agent token')
  await context({ origin, token })
  const encrypted = await seal(env, token, origin)
  return mutate(env.DB, actor, name, c => {
   need(!(c.data.postings as BookPosting[]).some(p => p.origin !== origin && ['sending', 'uncertain', 'proposed'].includes(p.status)), 'Finish or reconcile existing proposals before changing Pantry installations', 409)
   c.queries.push(query("INSERT INTO cb_finance_connections(id,origin,token) VALUES('pantry',?,?) ON CONFLICT(id) DO UPDATE SET origin=excluded.origin,token=excluded.token", origin, encrypted)); c.entityId = 'pantry'
   return { connected: true, origin }
  })
 }
 need(name === 'books.sync' || name === 'books.refresh', 'Unknown books command', 404)
 const conn = await connection(env); need(conn, 'Connect a Pantry scoped agent token first', 409)
 if (name === 'books.refresh') {
  const data = await load(env.DB), id = text(input.id, 'submission ID'), row = (data.postings as BookPosting[]).find(p => p.id === id)
  need(row, 'Books submission not found', 404); need(row.origin === conn.origin, 'Reconnect the Pantry installation that received this submission', 409)
  if (row.status === 'posted') return row
  const remote = row.proposalId ? await pantry<PantryProposal>(conn, `/api/pantry/agent/proposals/${encodeURIComponent(row.proposalId)}`) : null
  const matches = remote ? [remote] : (await context(conn)).proposals.filter(p => p.summary === row.marker)
  need(matches.length <= 1, 'Multiple Pantry proposals share this statement marker. Reconcile them in Pantry; Cabin will not resubmit.', 409)
  if (!matches.length) return saveOutcome(env, actor, id, { status: 'uncertain', detail: 'No matching proposal is visible to this agent. Check Pantry activity and the original agent token. Do not create a duplicate entry.' })
  const p = matches[0]
  need(p.summary === row.marker && await proposalHash(p) === row.payloadSha256, 'The Pantry proposal differs from this exact submission. Review it in Pantry.', 409)
  return saveOutcome(env, actor, id, outcome(p))
 }
 const data = await load(env.DB), statementId = text(input.id ?? input.statementId, 'statement ID'), s = data.statements.find(r => r.id === statementId)
 frozenStatement(s, input.revision)
 const existing = (data.postings as BookPosting[]).find(p => p.statementId === s.id && p.statementRevision === s.revision && p.origin !== '')
 if (existing) return existing // Sending and uncertain submissions are never retried.
 const [remote, csv] = await Promise.all([context(conn), statementCsv(env.DB, actor, s.id)])
 const documentId = text(input.documentId, 'uploaded Pantry document ID'), doc = remote.documents.find(d => d.id === documentId), sourceSha256 = await sha(csv)
 need(doc && (doc.sha256?.toLowerCase() === sourceSha256 || doc.text === csv), 'The Pantry document must be the exact downloaded CSV of this approved statement revision. Upload that file in Pantry Documents and paste its ID.', 409)
 const clearing = mappedAccount(remote, input.clearingAccountId, 'asset', 'payout clearing'), owner = mappedAccount(remote, input.ownerAccountId, 'liability', 'owner funds liability'), income = mappedAccount(remote, input.managementAccountId, 'income', 'management income')
 const lines = journal(s, data.payouts.filter(p => s.payoutIds?.includes(p.id)), clearing, owner, income)
 const date = new Date(Date.UTC(Number(s.month.slice(0, 4)), Number(s.month.slice(5, 7)), 0)).toISOString().slice(0, 10)
 const marker = `cabin:${s.id}:${s.revision}`, memo = `Cabin ${s.propertyName} ${s.month} · owner funds; channel fees borne by owner · ${marker}`.slice(0, 500)
 const payload = { date, memo, documentId, passages: csv.split('\r\n').filter(Boolean).flatMap(line => line.match(/[\s\S]{1,2000}/g) || []), lines: lines.map(l => ({ accountId: l.accountId, debit: dollars(l.debitCents), credit: dollars(l.creditCents), memo: l.memo })) }
 const body = { kind: 'journal', summary: marker, payload, refs: [clearing, owner, income].map(a => ({ kind: 'account', id: a.id, revision: a.revision })) }
 need(JSON.stringify(body).length <= 99_000, 'This detailed statement exceeds Pantry’s proposal size limit. Prepare a reviewed accounting breakdown in Pantry instead.')
 const payloadSha256 = await sha(JSON.stringify(payload)), known = remote.proposals.filter(p => p.summary === marker)
 need(known.length <= 1 && (!known.length || await proposalHash(known[0]) === payloadSha256), 'Pantry already contains a different proposal for this statement revision. Reconcile it before proceeding.', 409)
 const claimed = await mutate(env.DB, actor, name, async c => {
  const current = c.data.statements.find(r => r.id === s.id); frozenStatement(current, s.revision)
  need(!(c.data.postings as BookPosting[]).some(p => p.statementId === s.id && p.statementRevision === s.revision && p.origin !== ''), 'A submission already exists. Refresh its status instead of sending again.', 409)
  need(await statementCsv(env.DB, actor, s.id) === csv, 'The statement evidence changed. Review it again.', 409)
  const row: BookPosting = { id: newId(), revision: newId(), propertyId: s.propertyId, statementId: s.id, statementRevision: s.revision, origin: conn.origin, marker, documentId, sourceSha256, payloadSha256, date, memo, lines, rows: lines.length, status: 'sending', proposalId: null, batchId: null, at: c.now, updatedAt: c.now, detail: 'Submission claimed. Refresh in Pantry if its response is interrupted.' }
  ;(c.data.postings as BookPosting[]).push(row); c.entityId = row.id; return row
 })
 try {
  const p = known[0] || await pantry<PantryProposal>(conn, '/api/pantry/agent/proposals', body)
  need(p.summary === marker && await proposalHash(p) === payloadSha256, 'Pantry returned a different proposal', 502)
  return await saveOutcome(env, actor, claimed.id, outcome(p))
 } catch {
  return saveOutcome(env, actor, claimed.id, { status: 'uncertain', detail: 'Pantry acceptance is uncertain. Refresh to look up the saved statement marker; Cabin will not send it again.' })
 }
}

/** Exports contain the same saved mapping and cent amounts as the proposal. */
export async function exportBooks(db: D1Database, actor: Actor, id: string, format: 'csv' | 'iif') {
 manager(actor); need(!actor.isAgent, 'Human manager access required', 403); await assertLive(db, actor)
 const data = await load(db), posting = (data.postings as BookPosting[]).find(p => p.id === id)
 need(posting, 'Saved books submission not found', 404)
 frozenStatement(data.statements.find(s => s.id === posting.statementId), posting.statementRevision)
 need(format === 'csv' || format === 'iif', 'Choose CSV or IIF')
 const [year, month, day] = posting.date.split('-'), date = `${month}/${day}/${year}`, number = `CB-${posting.id.replaceAll('-', '').slice(0, 16)}`
 let result: string
 if (format === 'csv') {
  const rows: unknown[][] = [['Journal No.', 'Journal Date', 'Account Name', 'Description', 'Debits', 'Credits'], ...posting.lines.map(l => [number, date, l.accountName, l.memo, l.debitCents ? dollars(l.debitCents) : '', l.creditCents ? dollars(l.creditCents) : ''])]
  result = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
 } else {
  const cell = (value: string) => { const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' '); return /^[\s]*[=+@-]/.test(clean) ? "'" + clean : clean }
  const rows = ['!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO', '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO', '!ENDTRNS']
  posting.lines.forEach((l, i) => rows.push([i ? 'SPL' : 'TRNS', String(i + 1), 'GENERAL JOURNAL', date, cell(l.accountName), '', dollars(l.debitCents - l.creditCents), number, cell(l.memo)].join('\t')))
  rows.push('ENDTRNS'); result = rows.join('\r\n') + '\r\n'
 }
 await assertLive(db, actor); return result
}
