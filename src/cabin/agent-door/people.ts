import { operatorAuthPeople, ToolRefusal, type PeopleAdapter, type Person } from '../../modules/agent-door/index.ts'
import type { TeamAdapter } from '../../modules/business-settings/index.ts'
import { authConfig, operatorAuth, type Bindings } from '../../auth.server'
import { memberActor } from '../permissions/authority'
import { assertLive } from '../storage'
import type { Actor } from '../model'

/** Operator IDs are durable. Cabin's current member grant remains the admission authority. */
export function cabinPeople(env: Bindings): PeopleAdapter {
  const operators = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList,
    session: request => operatorAuth(env).getSession(request) })
  async function admitted(person: Person | null): Promise<Person | null> {
    if (!person?.active) return null
    const actor = await memberActor(env.DB, person.id)
    if (!actor) return null
    try { await assertLive(env.DB, actor) } catch { return null }
    return { ...person, role: actor.role }
  }
  return {
    person: async id => admitted(await operators.person(id)),
    async sponsor(claims) {
      const settings = await env.DB.prepare('SELECT owner_id,stopped FROM bs_settings WHERE singleton=1').first<{ owner_id: string | null; stopped: number }>()
      if (!settings || settings.stopped) return null
      if (settings.owner_id === claims.sub) return admitted(await operators.sponsor(claims))
      const binding = await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state='active'").bind(claims.sub).first<{ operator_id: string | null }>()
      return binding?.operator_id ? admitted(await operators.person(binding.operator_id)) : null
    },
    session: async request => admitted(await operators.session(request)),
    async businessMember(person) {
      if (!await admitted(await operators.person(person.id))) return null
      const settings = await env.DB.prepare('SELECT stopped FROM bs_settings WHERE singleton=1').first<{ stopped: number }>()
      if (!settings || settings.stopped) return null
      const member = await operators.businessMember!(person)
      if (member?.role === 'owner') return member
      const binding = await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state='active'").bind(person.id).first<{ business_id: string | null; business_role: string | null }>()
      return binding?.business_id ? { id: binding.business_id, role: binding.business_role === 'admin' ? 'editor' : null } : null
    },
  }
}

export async function nativeActor(env: Bindings, person: Person): Promise<Actor> {
  const current = await cabinPeople(env).person(person.id)
  const actor = current?.active ? await memberActor(env.DB, person.id) : null
  if (!actor) throw new ToolRefusal('native_access_revoked')
  await assertLive(env.DB, actor)
  return actor
}

/** Pair only existing, natively admitted people. Business never creates a shadow grant. */
export function cabinTeam(env: Bindings): TeamAdapter {
  return {
    async ownerEmail() {
      return (await env.DB.prepare("SELECT email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at,id LIMIT 1").first<{ email: string }>())?.email ?? null
    },
    async prepare({ members, managed }) {
      const people = cabinPeople(env), rows = []
      for (const email of new Set([...members.map(member => member.email), ...managed.map(member => member.email)])) {
        const member = members.find(member => member.email === email), previous = managed.find(row => row.email === email)
        // An established Business ID retains its native ID even after either address changes.
        const id = previous?.operatorId ?? (await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? COLLATE NOCASE AND role='member'").bind(email).first<{ id: string }>())?.id ?? null
        const person = id ? await people.person(id) : null
        rows.push({ email, operatorId: id, invite: member?.invite ?? previous?.invite ?? 0,
          state: !member ? 'inactive' as const : person?.active ? 'active' as const : 'conflict' as const })
      }
      return { statements: [], rows, async afterCommit() {} }
    },
  }
}
