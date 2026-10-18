/** Read at the network boundary, never from a request's earlier state snapshot. */
export async function sharingAllowed(db: D1Database | undefined, provider: string) {
 if (!db) throw Object.assign(new Error('Provider sharing needs installation storage.'), { status: 503 })
 const row = await db.prepare('SELECT enabled FROM cb_provider_sharing WHERE id=?').bind(provider).first<{ enabled: number }>()
 if (row && !row.enabled) throw Object.assign(new Error('Sharing with this provider is disconnected. Review it in Channel calendars before reconnecting.'), { status: 409 })
}
