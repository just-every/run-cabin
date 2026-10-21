import type { Bindings } from '../../../auth.server'
import { load, mutate, SYSTEM } from '../../storage'
import { dueCases } from './cases'
/** On every Cron: a missed response deadline escalates even when nobody changed anything. */
export async function advanceCases(env: Bindings) {
 if (dueCases(await load(env.DB), Date.now())) await mutate(env.DB, SYSTEM, 'inbox.team.escalated', () => undefined, () => true)
}
