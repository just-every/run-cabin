import type { Bindings } from '../../auth.server'
import { type Actor, type Statement, manager, need, text, newId, sha, query } from '../model'
import { assertLive, load, mutate } from '../storage'
import { managedInstall } from '../channels'
import { csvCell, statementCsv } from '../statements'
import { sumCents } from './csv'
import type { Payout } from './types'
import { type Account, connection, context, pantryOrigin, seal, pantryAvailable, pantryMessage, PANTRY_MANAGED } from './pantry-client'
import { sendPosting } from './pantry-posting'

type JournalLine = { accountId: string; accountName: string; accountCode: string; debitCents: number; creditCents: number; memo: string }
export interface BookPosting {
 id: string; revision: string; propertyId: string; statementId: string; statementRevision: string;
 origin: string; marker: string; documentId: string; sourceSha256: string; payloadSha256: string;
 date: string; memo: string; lines: JournalLine[]; rows: number;
 status: 'sending' | 'uncertain' | 'proposed' | 'posted' | 'rejected' | 'stale' | 'exported';
 proposalId: string | null; batchId: string | null; at: string; updatedAt: string; detail: string | null;
 integrationVersion?: 1; credentialSha256?: string; evidenceCredentialSha256?: string;
 evidence?: string; evidenceName?: string; evidenceStatus?: 'pending' | 'attached' | 'uncertain';
}

export async function booksState(env: Bindings, actor: Actor) {
 if (!['owner', 'manager'].includes(actor.role) || actor.isAgent) return null
 await assertLive(env.DB, actor)
 const saved = await env.DB.prepare("SELECT origin FROM cb_finance_connections WHERE id='pantry'").first<{ origin: string }>()
 if (managedInstall(env)) return { connected: false, status: 'unavailable', origin: saved?.origin ?? null, accounts: [], documents: [], error: PANTRY_MANAGED }
 if (!saved) return { connected: false, status: 'disconnected', origin: null, accounts: [], documents: [], error: null }
 try {
  const conn = await connection(env), remote = await context(env, conn!)
  await assertLive(env.DB, actor)
  return { connected: true, status: 'connected', origin: conn!.origin, accounts: remote.accounts, documents: [], error: null }
 } catch (error) {
  await assertLive(env.DB, actor)
  return { connected: false, status: 'broken', origin: saved.origin, accounts: [], documents: [], error: pantryMessage(error) }
 }
}

function mappedAccount(remote: { accounts: Account[] }, value: unknown, type: string, label: string) {
 const account = remote.accounts.find(a => a.id === text(value, label))
 need(account && account.active && account.type === type && !['receivable', 'payable'].includes(account.subtype), `Choose an active ${type} account for ${label}, outside Pantry's receivable/payable control accounts`)
 return account
}
function frozenStatement(statement: Statement | undefined, revision: unknown): asserts statement is Statement {
 need(statement?.status === 'approved' && statement.approval?.revision === statement.revision, 'An approved, frozen statement is required', 409)
 need(statement.revision === revision, 'The statement revision changed. Review it again.', 409)
 need(statement.source === 'imported', 'Books posting requires a statement prepared from matched imported payouts', 409)
}
export function journal(s: Statement, payouts: Payout[], clearing: Account, owner: Account, income: Account) {
 need(s.payoutIds?.length && new Set(s.payoutIds).size === s.payoutIds.length && payouts.length === s.payoutIds.length, 'The statement payout evidence is incomplete', 409)
 need(payouts.every(p => p.statementId === s.id && p.propertyId === s.propertyId && p.match === 'matched' && p.bookingId && p.grossCents - p.feeCents === p.netCents), 'Statement payouts changed or do not reconcile', 409)
 need(sumCents(payouts.map(p => p.grossCents)) === s.grossCents && sumCents(payouts.map(p => p.feeCents)) === s.channelFeeCents && sumCents(payouts.map(p => p.netCents)) === s.settlementCents && sumCents([s.grossCents, -s.channelFeeCents!, -s.managementFeeCents, -(s.expenseCents ?? 0)]) === s.netCents, 'The approved statement totals do not match its payout evidence', 409)
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
 for (const expense of s.lines.filter(l => l.category === 'expense')) {
  add(owner, -expense.amountCents, `Owner expense · ${expense.description}`)
  add(clearing, expense.amountCents, `Expense paid from owner funds · ${expense.description}`)
 }
 need(sumCents(s.lines.filter(l => l.category === 'expense').map(l => -l.amountCents)) === (s.expenseCents ?? 0), 'The approved expense evidence does not match its total', 409)
 add(owner, s.managementFeeCents, `Management fee deducted from owner payable · ${s.id}`)
 add(income, -s.managementFeeCents, `Management fee earned · ${s.id}`)
 need(lines.length >= 2 && lines.length <= 200, 'This statement requires 2–200 journal lines. Its payout detail exceeds Pantry’s single-entry limit; prepare a reviewed accounting breakdown in Pantry instead.')
 need(sumCents(lines.map(l => l.debitCents)) === sumCents(lines.map(l => l.creditCents)) && lines.some(l => l.debitCents > 0), 'The journal does not balance')
 return lines
}
const dollars = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`
export async function saveOutcome(env: Bindings, actor: Actor, id: string, values: Partial<BookPosting>) {
 return mutate(env.DB, actor, 'books.result', c => {
  const row = (c.data.postings as BookPosting[]).find(p => p.id === id)
  need(row, 'Books entry not found', 404)
  // A slow readback must never regress a posted journal or replace its identity.
  if (row.status === 'posted') {
   if (values.batchId) need(values.batchId === row.batchId, 'Pantry journal identity changed', 409)
   delete values.status
   if (row.documentId && values.documentId !== row.documentId) return row
   if (row.evidenceStatus === 'attached' && values.evidenceStatus !== 'attached') return row
  }
  Object.assign(row, values, { revision: newId(), updatedAt: c.now }); c.entityId = row.id; return row
 })
}

export async function booksCommand(env: Bindings, actor: Actor, name: string, input: Record<string, unknown>) {
 manager(actor); need(!actor.isAgent, 'A human manager must connect and post statements', 403); await assertLive(env.DB, actor)
 if (name === 'books.connect') {
  pantryAvailable(env)
  const origin = pantryOrigin(input.origin, env), token = text(input.token, 'Pantry integration credential', 500)
  need(/^pantry_integration_[a-f0-9]{64}$/.test(token), 'Use an integration credential from Pantry People & settings → Integration credentials')
  await context(env, { origin, token })
  const encrypted = await seal(env, token, origin)
  return mutate(env.DB, actor, name, c => {
   need(!(c.data.postings as BookPosting[]).some(p => p.origin !== origin && p.origin && (p.status !== 'posted' || p.integrationVersion === 1 && p.evidenceStatus !== 'attached')), 'Finish or reconcile saved entries before changing Pantry installations', 409)
   c.queries.push(query("INSERT INTO cb_finance_connections(id,origin,token) VALUES('pantry',?,?) ON CONFLICT(id) DO UPDATE SET origin=excluded.origin,token=excluded.token", origin, encrypted)); c.entityId = 'pantry'
   return { connected: true, status: 'connected', origin }
  })
 }
 need(name === 'books.sync' || name === 'books.refresh', 'Unknown books command', 404)
 const data = await load(env.DB)
 let existing: BookPosting | undefined
 let s: Statement | undefined
 if (name === 'books.refresh') {
  existing = (data.postings as BookPosting[]).find(p => p.id === text(input.id, 'entry ID'))
  need(existing, 'Books entry not found', 404)
 } else {
  s = data.statements.find(r => r.id === text(input.id ?? input.statementId, 'statement ID'))
  frozenStatement(s, input.revision)
  existing = (data.postings as BookPosting[]).find(p => p.statementId === s!.id && p.statementRevision === s!.revision && p.origin)
 }
 if (existing?.status === 'exported') return existing
 if (existing?.status === 'posted' && (existing.integrationVersion !== 1 || existing.evidenceStatus === 'attached')) return existing
 if (existing && existing.integrationVersion !== 1) return saveOutcome(env, actor, existing.id, { status: 'uncertain', detail: 'Legacy Pantry proposal. Reconcile its original outcome in Pantry; Cabin will not send another journal for this statement.' })
 pantryAvailable(env)
 const conn = await connection(env); need(conn, 'Connect a Pantry integration credential first', 409)
 if (existing) {
  need(existing.origin === conn.origin, 'Reconnect the Pantry installation that received this entry', 409)
  return sendPosting(env, actor, conn, existing)
 }
 frozenStatement(s, input.revision)
 const [remote, csv] = await Promise.all([context(env, conn), statementCsv(env.DB, actor, s.id)])
 const clearing = mappedAccount(remote, input.clearingAccountId, 'asset', 'payout clearing'), owner = mappedAccount(remote, input.ownerAccountId, 'liability', 'owner funds liability'), income = mappedAccount(remote, input.managementAccountId, 'income', 'management income')
 const payouts = data.payouts.filter(p => s!.payoutIds?.includes(p.id)).sort((a, b) => a.id.localeCompare(b.id))
 const matchedBookings = payouts.map(p => {
  const booking = data.bookings.find(b => b.id === p.bookingId && b.propertyId === s!.propertyId)
  need(booking && booking.kind !== 'block', 'A matched booking is missing from this statement evidence', 409)
  return { id: booking.id, revision: booking.revision, channel: booking.channel, reference: booking.channelRef ?? booking.uid, start: booking.start, end: booking.end }
 })
 const lines = journal(s, payouts, clearing, owner, income)
 const date = new Date(Date.UTC(Number(s.month.slice(0, 4)), Number(s.month.slice(5, 7)), 0)).toISOString().slice(0, 10)
 const marker = `cabin:${s.id}:${s.revision}`
 // Put the stable marker first so long property names cannot truncate it.
 const memo = `${marker} · ${s.propertyName} ${s.month} · owner funds; channel fees borne by owner`.slice(0, 500)
 const evidence = JSON.stringify({ format: 'cabin-approved-statement-v1', marker, statement: s, approvedStatementCsv: csv, matchedPayouts: payouts, matchedBookings, journal: { date, memo, lines }, accounting: 'Payout proceeds belong to owner; channel fees and approved expenses reduce owner funds; management fee is management income.' })
 need(new TextEncoder().encode(evidence).length <= 1_500_000, 'This statement evidence exceeds Pantry’s document limit', 409)
 const sourceSha256 = await sha(evidence), payloadSha256 = await sha(JSON.stringify({ date, memo, lines })), credentialSha256 = await sha(conn.token)
 const claimed = await mutate(env.DB, actor, name, async c => {
  const current = c.data.statements.find(r => r.id === s!.id); frozenStatement(current, s!.revision)
  need(!(c.data.postings as BookPosting[]).some(p => p.statementId === s!.id && p.statementRevision === s!.revision && p.origin), 'An entry already exists. Refresh its saved status.', 409)
  need(await statementCsv(env.DB, actor, s!.id) === csv && JSON.stringify(c.data.payouts.filter(p => s!.payoutIds?.includes(p.id)).sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify(payouts), 'The statement evidence changed. Review it again.', 409)
  need(matchedBookings.every(b => c.data.bookings.some(current => current.id === b.id && current.revision === b.revision && current.propertyId === s!.propertyId)), 'Matched booking evidence changed. Review the statement again.', 409)
  const row: BookPosting = { id: newId(), revision: newId(), propertyId: s!.propertyId, statementId: s!.id, statementRevision: s!.revision, origin: conn.origin, marker, documentId: '', sourceSha256, payloadSha256, date, memo, lines, rows: lines.length, status: 'sending', proposalId: null, batchId: null, at: c.now, updatedAt: c.now, detail: 'Posting the approved journal and its source evidence in Pantry.', integrationVersion: 1, credentialSha256, evidence, evidenceName: `${marker}.json`, evidenceStatus: 'pending' }
  ;(c.data.postings as BookPosting[]).push(row); c.entityId = row.id; return row
 })
 return sendPosting(env, actor, conn, claimed)
}

/** Exports contain the same saved mapping and cent amounts as the journal. */
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
