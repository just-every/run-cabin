import { sharingAllowed } from '../connections/guard'
import { record } from '../audit/write'
import type { Bindings } from '../../auth.server'
import { type Actor, exact, manager, need, newId } from '../model'
import { load, mutate } from '../storage'
import { inboxSettings } from '../inbox/settings'
import { aiKey, DraftError } from '../inbox/ai'
import { managedInstall } from '../channels'
import { baseline, note } from './cases'

/** The model supplies a courteous opening only. Approved promises are appended verbatim. */
async function opening(db: D1Database, config: { key: string; model: string; workspace: string },propertyId?:string|null) {
 await sharingAllowed(db, 'anthropic','reply:draft',propertyId)
 const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(config.workspace ? { 'anthropic-workspace-id': config.workspace } : {}) },
  body: JSON.stringify({ model: config.model, max_tokens: 500, system: 'Write one warm, brief apology for inconvenience during a vacation-rental stay. Do not promise actions, money, timing, access, readiness or safety. Return JSON with opening only.', output_config: { format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['opening'], properties: { opening: { type: 'string' } } } } }, messages: [{ role: 'user', content: 'Write the courteous opening of a stay recovery update.' }] }),
 })
 if (!response.ok) throw new DraftError(`AI wording request was refused (${response.status}). Check the key and model.`)
 const body: any = await response.json(); let value: any
 try { value = JSON.parse(body?.content?.find((v: any) => v.type === 'text')?.text ?? '') } catch { throw new DraftError('AI returned no usable wording.') }
 need(typeof value?.opening === 'string' && value.opening.trim() && value.opening.length <= 500, 'AI returned no usable wording.', 409)
 return value.opening.trim()
}
export async function recoveryWording(env: Bindings, actor: Actor, name: string, input: Record<string, unknown>) {
 manager(actor); need(!managedInstall(env), 'AI wording is not available yet on RER Managed.', 409)
 const data = await load(env.DB), config = await aiKey(env, inboxSettings(data)); need(config, 'Save this install’s own AI key first.', 409)
 const recovery=data.recoveries.find(r=>r.id===input.id),scope={kind:'recoveries',id:recovery?.id??null,propertyId:recovery?.propertyId??null,bookingId:recovery?.bookingId??null,revision:recovery?.revision??null,sourceVersion:data.version}
 await record(env.DB,actor,'recovery.ai.request',{...scope,result:'requested'})
 try {
  const words = await opening(env.DB, config,recovery?.propertyId)
  await record(env.DB,actor,'recovery.ai.result',{...scope,result:'draft'})
  if (name === 'recovery.ai.test') return { message: 'AI connection works. No stay is needed and nothing was sent to a guest.' }
  return mutate(env.DB, actor, name, c => {
   const r = c.data.recoveries.find(r => r.id === input.id); need(r?.proposal && r.status === 'proposed', 'Choose an unapplied proposal', 409); exact(r, input.revision)
   need(r.proposal.baseline === baseline(c, r, r.proposal.cleanerId), 'The proposal changed. Prepare it again.', 409)
   r.proposal.guestText = `${words}\n\n${r.proposal.guestText}`; note(c, r, 'AI wording drafted', 'The install’s own key supplied an opening; deterministic actions and amounts are unchanged. This revision needs approval.'); return r
  })
 } catch (error) { await record(env.DB,actor,'recovery.ai.result',{...scope,result:'failed-or-uncertain'});throw Object.assign(new Error(error instanceof DraftError ? error.message : (error as Error).message || 'AI provider could not be reached.'), { status: 409 }) }
}
