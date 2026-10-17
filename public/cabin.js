document.querySelector('[data-signout]')?.addEventListener('click', async () => {
  const response = await fetch('/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  if (response.ok) location.assign('/signin')
})

// Files stay private: bytes go to the same authenticated completion handler.
document.querySelectorAll('form[data-photo]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault()
  const button = form.querySelector('button'), notice = document.createElement('p')
  notice.setAttribute('role', 'alert'); form.append(notice); button.disabled = true
  try {
    const data = new FormData(form), file = data.get('photoFile')
    if (!(file instanceof File) || !file.size || file.size > 256000) throw Error('Choose a JPEG or PNG photo up to 256 KB.')
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const body = { id: data.get('id'), revision: data.get('revision'), checks: data.getAll('checks'), photo: btoa(binary), mimeType: file.type, caption: data.get('caption') }
    const response = await fetch('/api/cabin/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'turnover.complete', input: body }) })
    const result = await response.json()
    if (!response.ok) throw Error(result.error || 'The checklist could not be saved.')
    location.assign('/app/turnovers')
  } catch (error) { notice.textContent = error.message; button.disabled = false }
}))

// Add real statement lines; the server converts decimal USD exactly to cents.
document.querySelector('[data-add-line]')?.addEventListener('click', () => {
  const list = document.querySelector('[data-statement-lines]')
  if (list.children.length >= 100) return
  const row = list.firstElementChild.cloneNode(true)
  row.querySelectorAll('input').forEach(input => input.value = '')
  list.append(row); row.querySelector('input').focus()
})
