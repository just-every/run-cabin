import type { Bindings } from '../../auth.server'
import { type Actor, need, sha } from '../model'
import { assertLive, mutate } from '../storage'
import { type BookPosting, saveOutcome } from './books'
import { type Connection, pantry, pantryMessage, PantryError } from './pantry-client'

type Entry = { id: string; entry_date: string; memo: string; status: string; reversed_by_id?: string | null; lines: { account_id: string; debit_cents: number; credit_cents: number; memo: string }[] }
type Document = { id: string; name: string; sha256: string; linked_kind: string; linked_id: string }
const dollars = (n: number) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`
const base64 = (value: string) => {
 const bytes = new TextEncoder().encode(value)
 let binary = ''
 for (const byte of bytes) binary += String.fromCharCode(byte)
 return btoa(binary)
}

/** Exact filtered lookups remain valid after rotating a credential. Never use a capped context view. */
async function lookup<T>(env: Bindings, conn: Connection, path: string, field: string): Promise<T[]> {
 let cursor: string | null = null
 const seen = new Set<string>(), found: T[] = []
 do {
  const page: Record<string, unknown> = await pantry(env, conn, path + '&limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))
  need(Array.isArray(page[field]) && (page.nextCursor === null || typeof page.nextCursor === 'string'), 'Pantry returned an invalid lookup page', 502)
  found.push(...page[field] as T[])
  // More than one exact match is already an unresolved conflict.
  if (found.length > 1) break
  cursor = page.nextCursor as string | null
  need(!cursor || !seen.has(cursor), 'Pantry repeated a lookup page', 502)
  if (cursor) seen.add(cursor)
 } while (cursor)
 return found
}

function verifyEntry(entry: Entry, row: BookPosting) {
 need(entry && typeof entry.id === 'string' && entry.id && entry.entry_date === row.date && entry.memo === row.memo && Array.isArray(entry.lines), 'The Pantry journal differs from this saved statement', 409)
 need(entry.lines.length === row.lines.length && entry.lines.every((line, i) => {
  const expected = row.lines[i]
  return line.account_id === expected.accountId && line.debit_cents === expected.debitCents && line.credit_cents === expected.creditCents && line.memo === expected.memo
 }), 'The Pantry journal amounts, accounts or evidence differ from this saved statement', 409)
 need(entry.status === 'posted', 'This statement marker belongs to an unposted Pantry journal. Reconcile it in Pantry before proceeding.', 409)
 if (row.batchId) need(entry.id === row.batchId, 'The saved Pantry journal identity differs', 409)
}

async function attachEvidence(env: Bindings, actor: Actor, conn: Connection, row: BookPosting) {
 need(row.batchId && row.evidence && row.evidenceName && await sha(row.evidence) === row.sourceSha256, 'Saved source evidence is missing or changed', 409)
 const documents = await lookup<Document>(env, conn, '/documents?name=' + encodeURIComponent(row.evidenceName), 'documents')
 need(documents.length <= 1, 'Multiple Pantry documents share this evidence marker. Reconcile them in Pantry.', 409)
 let document = documents[0]
 if (!document) {
  const fingerprint = await sha(conn.token)
  // Claim the credential before its first write. Pantry keys belong to credentials,
  // so an absent read after rotation cannot justify replaying an uncertain write.
  row = await mutate(env.DB, actor, 'books.evidence', c => {
   const current = (c.data.postings as BookPosting[]).find(p => p.id === row.id)
   need(current && current.batchId === row.batchId, 'Saved journal changed. Refresh its status.', 409)
   if (current.documentId) return current
   if (current.evidenceCredentialSha256 && current.evidenceCredentialSha256 !== fingerprint) throw new PantryError('Evidence upload is uncertain under the previous credential. Restore that credential or reconcile the document in Pantry; Cabin will not create another copy.', 409)
   current.evidenceCredentialSha256 = fingerprint; c.entityId = current.id
   return current
  })
  if (row.documentId) return row
  await assertLive(env.DB, actor)
  document = await pantry<Document>(env, conn, '/documents', { name: row.evidenceName, mediaType: 'text/plain', base64: base64(row.evidence!), linkedKind: 'journal', linkedId: row.batchId, note: `Approved Cabin statement, matched booking/payout amounts, actual channel fees, owner expenses and management fee. ${row.marker}` }, `${row.marker}:evidence:v1`)
 }
 need(document && typeof document.id === 'string' && document.id && document.name === row.evidenceName && document.sha256 === row.sourceSha256 && document.linked_kind === 'journal' && document.linked_id === row.batchId, 'The Pantry source document differs from this exact statement evidence', 409)
 return saveOutcome(env, actor, row.id, { documentId: document.id, evidenceStatus: 'attached', detail: 'Posted in Pantry with the approved statement and matched booking, payout, channel fee, expense and management fee evidence.' })
}

/** The saved intent is immutable. Replays use its original body and deterministic key. */
export async function sendPosting(env: Bindings, actor: Actor, conn: Connection, initial: BookPosting) {
 let row = initial
 try {
  need(await sha(JSON.stringify({ date: row.date, memo: row.memo, lines: row.lines })) === row.payloadSha256, 'The saved journal payload changed. Reconcile this statement before proceeding.', 409)
  const entries = await lookup<Entry>(env, conn, '/journals?' + (row.batchId ? 'id=' + encodeURIComponent(row.batchId) : 'memo=' + encodeURIComponent(row.memo)), 'entries')
  need(entries.length <= 1, 'Multiple Pantry journals share this statement marker. Reconcile them in Pantry; Cabin will not post another.', 409)
  let entry = entries[0]
  if (!entry) {
   need(!row.batchId, 'The saved posted journal is no longer visible in Pantry. Check its installation and credential.', 409)
   if (row.credentialSha256 !== await sha(conn.token)) throw new PantryError('Posting is uncertain under the previous credential. Restore that credential or reconcile this statement in Pantry; Cabin will not risk a duplicate journal with a replacement credential.', 409)
   await assertLive(env.DB, actor)
   entry = await pantry<Entry>(env, conn, '/journals', { date: row.date, memo: row.memo, post: true, lines: row.lines.map(l => ({ accountId: l.accountId, debit: dollars(l.debitCents), credit: dollars(l.creditCents), memo: l.memo })) }, `${row.marker}:journal:v1`)
  }
  verifyEntry(entry, row)
  row = await saveOutcome(env, actor, row.id, { status: 'posted', batchId: entry.id, detail: entry.reversed_by_id ? 'The Pantry journal was posted and subsequently reversed. Cabin will not post it again.' : 'Posted in Pantry. Attaching the approved statement and matched payout evidence.' })
  if (entry.reversed_by_id || row.documentId) return row
  return await attachEvidence(env, actor, conn, row)
 } catch (error) {
  return saveOutcome(env, actor, row.id, row.status === 'posted'
   ? { evidenceStatus: 'uncertain', detail: `Journal posted in Pantry; source attachment needs attention. ${pantryMessage(error)}` }
   : { status: 'uncertain', detail: pantryMessage(error) })
 }
}
