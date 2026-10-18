import { cleanerDraft } from './cleaner-drafts.js'
import { fields, shrink, encoded } from './photo-files.js'

document.querySelectorAll('form[data-photos]').forEach(form => {
  const button = form.querySelector('button[type=submit]'), notice = document.createElement('p')
  notice.setAttribute('role', 'alert'); notice.dataset.uploadStatus = ''; form.append(notice)
  const draft = cleanerDraft(form, notice)
  draft.catch(error => { notice.textContent = error.message })
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true
    try {
      const action = new URL(form.action), name = action.searchParams.get('name'), field = form.querySelector('[name=photoFiles]')
      const local = await draft, files = local ? await local.prepare() : await Promise.all([...(field?.files ?? [])].map(shrink))
      const min = Number(field?.dataset.min ?? 0), max = Number(field?.dataset.max ?? 12)
      if (files.length < min || files.length > max) throw Error(`Add between ${min} and ${max} photos.`)
      const input = fields(form); input.photos = await Promise.all(files.map(encoded))
      notice.textContent = 'Sending…'
      const response = await fetch('/api/cabin/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, input }) })
      const result = await response.json()
      if (!response.ok) throw Error(result.error || 'This could not be saved.')
      await local?.sent()
      const next = new URL(action.searchParams.get('returnTo') || '/app', location.origin), card = form.closest('[id]')
      next.searchParams.set('done', name); if (result.result?.id) next.searchParams.set('record', result.result.id)
      location.assign(next.pathname + next.search + (card ? '#' + card.id : ''))
    } catch (error) {
      if (!notice.querySelector('a')) notice.textContent = navigator.onLine ? error.message : 'Offline. Your draft is saved on this device; reconnect and send when ready.'
      button.disabled = false
    }
  })
})
