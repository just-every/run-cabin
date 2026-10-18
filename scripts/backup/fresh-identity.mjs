import { literal, objects, readRows } from './sql.mjs'
import policy from '../../src/cabin/archive-policy.mjs'

const images = rows => rows.map(row => Object.values(row).map(literal).join(',')).sort()
const same = (a, b) => JSON.stringify(images(a)) === JSON.stringify(images(b))

// A normal rer deployment has claimed its owner but has done no product work.
// Admit only that exact native bootstrap shape, never a later sign-in or grant.
export function freshIdentity(archive, target, seeded) {
  const credentialTables = new Set([...policy.excludeTables, 'rer_dependency_keys', 'rer_dependency_pending', 'rer_dependency_codes'])
  const names = objects(target).filter(o => o.type === 'table' && (/^(?:oa_|oc_)/.test(o.name) || credentialTables.has(o.name))).map(o => o.name)
  const seedNames = new Set(objects(seeded).filter(o => o.type === 'table').map(o => o.name))
  const rows = name => names.includes(name) ? readRows(target, name) : []
  const owners = rows('oa_operators'), claims = rows('oa_bootstrap')
  const replaced = new Set(), retired = new Set()
  if (owners.length) {
    const owner = owners[0], claim = claims[0]
    if (owners.length !== 1 || owner.role !== 'owner' || owner.status !== 'active' || owner.version !== 1 || claims.length !== 1 || claim.singleton !== 1 || claim.claim_id !== owner.id || claim.claimed_at !== owner.created_at) throw Error('Fresh destination requires only its original bootstrap owner; additional operators or identity use refuse restore.')
    const email = owner.email.toLowerCase()
    if (!readRows(archive, 'oa_operators').some(row => row.role === 'owner' && row.status === 'active' && row.email.toLowerCase() === email)) throw Error('Fresh destination owner email must match an archived active owner.')
    const sessions = rows('oa_sessions')
    if (sessions.length > 1 || sessions.some(row => row.kind !== 'native' || row.operator_id !== owner.id || row.operator_version !== owner.version || row.source_token_id !== null || row.created_at !== claim.claimed_at || row.revoked_at !== null)) throw Error('Destination has identity use beyond the original bootstrap session.')
    const settings = rows('oa_auth_settings')
    if (settings.length !== 1 || settings[0].singleton !== 1 || settings[0].idp_sign_in !== 0 || settings[0].generation !== 0 || ![0, 1].includes(settings[0].first_setup)) throw Error('Destination has identity configuration beyond native bootstrap.')
    // Bootstrap may consume one IP rate bucket. It has no reusable authority.
    const limits = rows('oa_limits')
    if (limits.length > 1 || limits.some(row => row.count !== 1)) throw Error('Destination has authentication activity beyond native bootstrap.')
    replaced.add('oa_operators'); replaced.add('oa_bootstrap')
    retired.add('oa_sessions')
  }
  const permitted = new Set([...replaced, ...retired, ...(owners.length ? ['oa_auth_settings', 'oa_limits'] : [])])
  for (const name of names) {
    if (permitted.has(name)) continue
    const wanted = seedNames.has(name) ? readRows(seeded, name) : []
    if (!same(rows(name), wanted)) throw Error('Fresh destination contains identity activity or provider credentials: ' + name + '.')
  }
  // Snapshot every identity table, including empty grant tables, so no concurrent
  // sign-in or provider authorization can slip between validation and commit.
  return { replaced, retired, guarded: names }
}
