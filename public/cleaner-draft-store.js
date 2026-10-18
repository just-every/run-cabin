// Same-origin IndexedDB, separated by the authenticated person. No access codes,
// guest details or server pages are cached. Sign-out deletes all local work.
let opened
const database = () => opened ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('cabin-cleaner-drafts', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('work', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('This browser could not open private draft storage.'))
})
async function transaction(action, write = false) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('work', write ? 'readwrite' : 'readonly'), request = action(tx.objectStore('work'))
    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = tx.onabort = () => reject(Error('Draft could not be saved on this device. Keep this page open.'))
  })
}
export const clearDrafts = () => transaction(store => store.clear(), true)
export async function draftStore(person) {
  const rows = await transaction(store => store.getAll())
  await Promise.all(rows.filter(row => row.person !== person || Date.now() - row.savedAt > 7 * 86400_000).map(row => transaction(store => store.delete(row.id), true)))
  return {
    read: id => transaction(store => store.get(id)),
    save: row => transaction(store => store.put({ ...row, person, savedAt: Date.now() }), true),
    remove: id => transaction(store => store.delete(id), true),
  }
}
