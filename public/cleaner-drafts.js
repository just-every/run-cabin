import { draftStore } from './cleaner-draft-store.js'
import { fields, shrink } from './photo-files.js'

export async function cleanerDraft(form, notice) {
  const person = document.body.dataset.person, job = form.dataset.job
  if (!person || !job) return null
  const store = await draftStore(person), id = `${person}:${job}:${new URL(form.action).searchParams.get('name')}`
  const current = { revision: form.dataset.revision, bookingRevision: form.dataset.bookingRevision }
  let draft = await store.read(id), photos = draft?.photos ?? [], baseline = draft?.baseline ?? current
  let pending = Promise.resolve(), failed = null
  const field = form.querySelector('[name=photoFiles]'), required = field.required
  const tools = document.createElement('div'), status = document.createElement('p'), previews = document.createElement('div')
  tools.className = 'local-draft'; status.setAttribute('role', 'status'); previews.className = 'photos'
  const review = document.createElement('button'), discard = document.createElement('button'), clearPhotos = document.createElement('button')
  for (const b of [review, discard, clearPhotos]) b.type = 'button'
  review.textContent = 'Use draft for current job'; discard.textContent = 'Delete device draft'; clearPhotos.textContent = 'Remove saved photos'
  tools.append(status, previews, review, clearPhotos, discard); field.closest('label').after(tools)
  let urls = []
  const stale = () => baseline.revision !== current.revision || baseline.bookingRevision !== current.bookingRevision
  const draw = () => {
    urls.forEach(URL.revokeObjectURL); urls = []; previews.replaceChildren()
    for (const blob of photos) { const img = document.createElement('img'); img.src = URL.createObjectURL(blob); urls.push(img.src); img.alt = 'Photo saved in your device draft'; previews.append(img) }
    field.required = required && photos.length === 0
    review.hidden = !stale(); clearPhotos.hidden = !photos.length
    status.textContent = stale() ? 'Job changed. Your draft is retained. Review the current window, checklist and photos before using it.' : `Saved on this device · ${photos.length} photos. ${navigator.onLine ? 'Live assignment is checked before sending.' : 'Offline: reconnect before sending.'}`
  }
  const save = () => {
    // Serialize camera conversion and writes, so a slow earlier change cannot
    // overwrite a later edit or race a submit.
    const values = fields(form), selected = [...field.files]
    field.value = ''
    pending = pending.then(async () => {
      if (selected.length) photos = await Promise.all(selected.map(shrink))
      await store.save({ id, baseline, values, photos }); failed = null; draw()
    }).catch(error => { failed = error; notice.textContent = error.message })
    return pending
  }
  if (draft) for (const [key, value] of Object.entries(draft.values)) {
    if (['id', 'revision', 'turnoverId', 'turnoverRevision', 'bookingRevision'].includes(key)) continue
    for (const input of form.elements) if (input.name === key) {
      if (input.type === 'checkbox') input.checked = key === 'checks' ? value.includes(input.value) : value === input.value
      else input.value = value
    }
  }
  draw()
  form.addEventListener('input', save); form.addEventListener('change', event => { if (event.target === field) save() })
  review.addEventListener('click', async () => { await pending; baseline = current; await save() })
  clearPhotos.addEventListener('click', async () => { await pending; photos = []; await save() })
  discard.addEventListener('click', async () => { await pending; await store.remove(id); location.reload() })
  const reconcile = async () => {
    const response = await fetch('/api/cabin/state', { cache: 'no-store' })
    if (!response.ok) throw Error('Sign in again to check your assignment. Your device draft is retained.')
    const state = await response.json(), row = state.turnovers.find(t => t.id === job)
    if (state.actor.id !== person || !row || row.cleanerId !== state.actor.memberId || !['approved', 'completed'].includes(row.status)) {
      await store.remove(id); photos = []; draw()
      throw Error('This job is no longer assigned to you. Its device draft was deleted. Open your current jobs.')
    }
    if (row.revision !== current.revision || row.bookingRevision !== current.bookingRevision) {
      notice.replaceChildren(document.createTextNode('Job changed. Your draft is retained. '))
      const link = document.createElement('a'); link.href = `/app/turnovers?review=${encodeURIComponent(current.revision)}#turnover-${job}`; link.textContent = 'Review current job'; notice.append(link)
      throw Error('Review current job before uploading. Your draft is retained.')
    }
    if (stale()) throw Error('Review the changed job and choose “Use draft for current job” before sending.')
  }
  addEventListener('online', () => reconcile().catch(error => { if (!notice.querySelector('a')) notice.textContent = error.message }))
  addEventListener('offline', draw)
  return {
    async prepare() { await pending; if (failed) throw failed; await save(); if (failed) throw failed; await reconcile(); return photos },
    async sent() { await pending; await store.remove(id) },
  }
}
