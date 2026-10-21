import type { Actor } from '../model'
import { redactSensitiveText } from '../connections/redaction'

type Row = Record<string, any>
type Scope = { propertyIds: string[]; actions: string[]; revision: number; pmsRole: string }
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value)
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter(object) : []
const references = ['bookingId', 'priorBookingId', 'turnoverId', 'taskId', 'statementId', 'recordId', 'reportId', 'sourceId']
const categories: Record<string, string[]> = {
  properties: ['calendar', 'reservations', 'operations', 'finance', 'inbox', 'identity', 'access', 'reports', 'owners'],
  propertyProfiles: ['calendar', 'reservations', 'operations', 'access'],
  bookings: ['calendar', 'reservations', 'operations', 'inbox', 'finance', 'reports'],
  feeds: ['calendar'], calendarDrafts: ['calendar'], requests: ['reservations'], staffQuotes: ['reservations'],
  homeSettings: ['operations', 'access'], turnovers: ['operations'], tasks: ['operations'],
  readinessPlans: ['operations'], readinessRecords: ['operations'], recoveries: ['operations'],
  recoveryPolicies: ['operations'], messages: ['inbox'], threadCases: ['inbox'], scheduled: ['inbox'],
  statements: ['finance'], statementSchedules: ['finance'], financialAllocations: ['finance'],
  sharedCosts: ['finance'], workExpenses: ['finance'], managementTerms: ['finance', 'owners'],
  payouts: ['finance'], deliveries: ['finance'], postings: ['finance'], ledgerSettings: ['finance'],
  rentalTemplates: ['reservations'], rentalAgreements: ['identity'], verifications: ['identity'],
  guests: ['reservations', 'inbox'], guestPolicies: ['reservations'], guestOffers: ['reservations'],
  guestPortalLinks:['reservations','access'], codes: ['access'], notices: ['operations'],
}

/** The final read boundary for PMS grants. Unscoped native actors retain their existing representation. */
export function projectState<T>(state: T, actor: Actor): T {
  const scope = (actor as Actor & { scope?: Scope }).scope
  if (!scope || !object(state) || scope.propertyIds.includes('*') && scope.actions.includes('*')) return state
  const source = state as Row, result = structuredClone(source)
  const permitted = new Set(scope.propertyIds), actions = new Set(scope.actions)
  const has = (...names: string[]) => names.some(name => actions.has('*') || actions.has(`${name}:read`))
  const service = actor.role === 'cleaner'
  const guest = !service && has('reservations', 'inbox', 'identity')
  const identity = !service && has('identity')
  const finance = !service && has('finance')
  const owner = !service && has('owners')
  const access = has('access')
  const accepts = (ids: string[]) => ids.length > 0 && ids.every(id => permitted.has('*') || permitted.has(id))
  const index = new Map<string, Set<string>>()
  for (const p of rows(source.properties)) if (typeof p.id === 'string') index.set(p.id, new Set([p.id]))
  const objects: Row[] = []
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect)
    else if (object(value)) { objects.push(value); Object.values(value).forEach(collect) }
  }
  collect(source)
  const directScope = (row: Row): string[] => {
    const ids = typeof row.propertyId === 'string' && row.propertyId ? [row.propertyId] : []
    if (Array.isArray(row.propertyIds)) ids.push(...row.propertyIds.filter((id: unknown) => typeof id === 'string'))
    // Shared totals cannot be safely exposed by removing only the other home's share.
    for (const share of rows(row.shares)) if (typeof share.propertyId === 'string') ids.push(share.propertyId)
    return [...new Set(ids)]
  }
  const propertyIds = (row: Row): string[] => {
    const own = directScope(row)
    if (own.length) return own
    const ids = new Set<string>()
    for (const key of references) for (const id of index.get(row[key]) ?? []) ids.add(id)
    if (!ids.size) for (const id of index.get(row.id) ?? []) ids.add(id)
    return [...ids]
  }
  // Resolve indirect records regardless of collection order (delivery -> report -> home, for example).
  let changed = true
  while (changed) {
    changed = false
    for (const row of objects) {
      if (typeof row.id !== 'string') continue
      const ids = propertyIds(row), prior = index.get(row.id) ?? new Set<string>()
      for (const id of ids) if (!prior.has(id)) { prior.add(id); changed = true }
      if (prior.size) index.set(row.id, prior)
    }
  }
  const secrets = [...rows(source.codes).flatMap(row => [row.code, row.link]), ...rows(source.exports).map(row => row.token)].filter((s): s is string => typeof s === 'string' && !!s)
  const secretField = /sealed|secret|password|credential|storageState|token|bankAccount|banking|routingNumber|taxId|ssn|idImage/i
  const pii = new Set(['guestName', 'guestEmail', 'guestPhone', 'email', 'phone', 'identities', 'facts', 'consents', 'signature', 'guest', 'recipient', 'reservationTerms'])
  const money = new Set(['managementTerms', 'ownerTerms', 'ownerAllocations', 'allocation', 'reservationBalance', 'price', 'quote', 'invoice', 'deposit', 'refunds', 'taxFilings', 'close'])
  const clean = (value: any, inherited: string[] = []): any => {
    if (typeof value === 'string') return redactSensitiveText(value, access ? [] : secrets)
    if (Array.isArray(value)) return value.map(item => clean(item, inherited)).filter(item => item !== undefined)
    if (!object(value)) return value
    const explicit = directScope(value), linked = references.some(key => typeof value[key] === 'string' && value[key]) ? propertyIds(value) : []
    const own = explicit.length ? explicit : linked, ids = own.length ? own : inherited
    if (own.length && !accepts(own)) return undefined
    const out: Row = {}
    for (const [key, item] of Object.entries(value)) {
      if (secretField.test(key) && !(key==='token'&&'sessionEpoch'in value&&access&&!service) || ['customerId', 'paymentMethod', 'checkoutUrl', 'depositCheckout', 'previous', 'execution', 'authority'].includes(key)) continue
      if (!access && ['code', 'link', 'guide', 'guestText', 'content'].includes(key)) continue
      if ((!guest || service) && pii.has(key)) continue
      if (!identity && ['identity', 'verifications', 'documents', 'decision', 'provider', 'verificationPolicy'].includes(key)) continue
      if (!finance && (money.has(key) || /(?:Cents|Bps)$/.test(key))) continue
      if (!finance && !owner && /^(?:ownerName|ownerEmail|owners|commissionBps)$/.test(key)) continue
      if (!guest && key === 'summary') { out[key] = 'Reserved'; continue }
      const itemClean = clean(item, ids)
      if (itemClean !== undefined) out[key] = itemClean
    }
    return out
  }
  const select = (value: unknown, allowed: boolean) => allowed ? rows(value).filter(row => accepts(propertyIds(row))).map(row => clean(row, propertyIds(row))).filter(Boolean) : []
  for (const [key, allowed] of Object.entries(categories)) {
    if (!(key in source)) continue
    let visible = has(...allowed)
    if (['statements', 'statementSchedules', 'financialAllocations', 'sharedCosts', 'workExpenses', 'payouts', 'deliveries', 'postings', 'ledgerSettings'].includes(key)) visible &&= finance
    if (['rentalAgreements', 'verifications'].includes(key)) visible &&= identity
    if (['guests', 'guestPolicies', 'guestOffers', 'staffQuotes'].includes(key)) visible &&= guest
    result[key] = select(source[key], visible)
  }
  if ('members' in source) result.members = rows(source.members).filter(row => row.id === actor.memberId || has('operations','inbox','reports') && row.active && row.scope?.propertyIds.some((id:string)=>id==='*'||permitted.has('*')||permitted.has(id))).map(row => row.id===actor.memberId?structuredClone(row):{id:row.id,name:row.name,role:row.role,active:row.active})
  if ('cleanerProfiles' in source) result.cleanerProfiles = rows(source.cleanerProfiles).filter(row => row.id === actor.memberId).map(row => clean(row))
  for (const key of ['events', 'approvals', 'inbox', 'connections', 'exports', 'guestMerges', 'agentKeys', 'importJobs']) if (key in source) result[key] = []
  if ('channelAgent' in source) result.channelAgent = { profiles: [], actions: [] }
  for (const key of ['privacy', 'restore', 'sharing', 'books']) if (key in source) result[key] = null
  if ('lockAccount' in source) result.lockAccount = false
  if ('messaging' in source) result.messaging = { sms: false, booking: false }

  const direct = (value: Row) => ({ homes: select(value.homes, has('reservations')), stays: select(value.stays, has('reservations')) })
  const ledger = (value: Row) => ({ journals: select(value.journals, finance), periods: [] })
  const promotions = (value: Row) => ({ policies: select(value.policies, has('reservations')), offers: select(value.offers, guest) })
  const owners = (value: Row) => Object.fromEntries(['policies', 'grants', 'views', 'documents', 'expenses', 'stayRequests'].map(key => [key, select(value[key], owner)]))
  const taxes = (value: Row) => Object.fromEntries(['config', 'sources', 'lines', 'reports', 'deliveries', 'evidence', 'workItems', 'paidDirectStays'].map(key => [key, select(value[key], finance)]))
  for (const [key, project] of Object.entries({ direct, ledger, promotions, ownerOperations: owners, taxes })) if (object(source[key])) result[key] = project(source[key])

  // The same boundary also accepts the existing standalone read-builder shapes.
  if ('totals' in source && 'semantics' in source && 'reservations' in source) {
    // Removing detail rows cannot repair already computed portfolio aggregates.
    // Reports must calculate from scoped inputs before reaching this boundary.
    if (!has('reports') || rows(source.properties).some(row => !accepts([row.id]))) {
      throw Object.assign(new Error('Generate this report from the permitted properties only.'), { status: 403 })
    }
    return clean(source) as T
  }
  if ('journals' in source && 'periods' in source) return ledger(source) as T
  if ('homes' in source && 'stays' in source) return direct(source) as T
  if ('policies' in source && 'offers' in source) return promotions(source) as T
  if ('config' in source && 'sources' in source && 'reports' in source) return taxes(source) as T
  if ('grants' in source && 'stayRequests' in source) return owners(source) as T
  if ('accounts' in source && 'connected' in source) return { connected: false, status: 'disconnected', origin: null, accounts: [], documents: [], error: null } as T
  return result as T
}
