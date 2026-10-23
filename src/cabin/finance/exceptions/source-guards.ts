import { type Context,need } from '../../model'
import { contextJournals } from '../../ledger/store'
/** Original provider rows remain immutable. Older amount-based writers must not
 * silently reuse them after an approved ledger correction. */
export async function requireOriginalSettlementSources(c:Context,payoutIds:readonly string[]){
 const rows=await contextJournals(c),ids=new Set(payoutIds)
 const originals=new Set(rows.filter(j=>j.sourceType==='payout'&&ids.has(j.sourceId)).map(j=>j.id))
 need(!rows.some(j=>j.sourceType==='settlement-correction'&&!!j.correctionOf&&originals.has(j.correctionOf)), 'These settlement records have correcting journals. Prepare a reconciled ledger close; allocation and imported-statement corrections need separate review.',409)
}
