import { requireProviderScope } from './policy'
export async function restorationPaused(db: D1Database) { return (await db.prepare('SELECT reviewed FROM cb_restore_review WHERE id=1').first<{reviewed:number}>())?.reviewed === 0 }
/** Read at the network boundary, never from a request's earlier state snapshot. */
export async function sharingAllowed(db: D1Database | undefined, provider: string, action?: string, propertyId?: string | null) {
 if (!db) throw Object.assign(new Error('Provider sharing needs installation storage.'), { status: 503 })
 if (await restorationPaused(db)) throw Object.assign(new Error('Review this restored installation before reconnecting providers.'), {status:409})
 const row = await db.prepare('SELECT enabled FROM cb_provider_sharing WHERE id=?').bind(provider).first<{ enabled: number }>()
 if (row && !row.enabled) throw Object.assign(new Error('Sharing with this provider is disconnected. Review it in Channel calendars before reconnecting.'), { status: 409 })
 await requireProviderScope(db, provider, action, propertyId)
}
