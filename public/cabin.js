// Keep successful form responses on their workspace page, including one-time credentials.
if (location.pathname === '/app/action' && document.body.dataset.page) history.replaceState(null, '', document.body.dataset.page)
// A saved-photo confirmation (?done=, with the saved ?record=) shows once; a reload does not repeat it.
if (new URLSearchParams(location.search).has('done')) { const here = new URL(location.href); here.searchParams.delete('done'); here.searchParams.delete('record'); history.replaceState(null, '', here.pathname + here.search + here.hash) }

document.querySelector('[data-signout]')?.addEventListener('click', async () => {
  const response = await fetch('/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  if (response.ok) location.assign('/signin')
})

// Photos stay private: a phone's camera photos are shrunk in the browser to a
// JPEG under 256 KB, then sent with the form to the same authenticated command.
const LIMIT = 250_000
async function shrink(file) {
  if ((file.type === 'image/jpeg' || file.type === 'image/png') && file.size <= LIMIT) return file
  const image = await createImageBitmap(file), canvas = document.createElement('canvas')
  for (const [edge, quality] of [[1600, .82], [1280, .75], [1024, .7], [800, .65], [640, .6]]) {
    const scale = Math.min(1, edge / Math.max(image.width, image.height))
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', quality))
    if (blob && blob.size <= LIMIT) return blob
  }
  throw Error(`${file.name || 'A photo'} is too large to send.`)
}
const base64 = async blob => { const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary) }
document.querySelectorAll('form[data-photos]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault()
  const button = form.querySelector('button[type=submit]'), notice = form.querySelector('[data-upload-status]') ?? document.createElement('p')
  notice.setAttribute('role', 'alert'); notice.dataset.uploadStatus = ''; form.append(notice); button.disabled = true
  try {
    const action = new URL(form.action), name = action.searchParams.get('name'), field = form.querySelector('input[name=photoFiles]')
    const files = [...(field?.files ?? [])], min = Number(field?.dataset.min ?? 0), max = Number(field?.dataset.max ?? 12)
    if (files.length < min) throw Error(`Add at least ${min} photo${min === 1 ? '' : 's'}.`)
    if (files.length > max) throw Error(`Add at most ${max} photos.`)
    const input = {}
    for (const [key, value] of new FormData(form)) if (key !== 'photoFiles') input[key] = key === 'checks' ? [...(input[key] ?? []), value] : value
    input.photos = []
    for (const [i, file] of files.entries()) { notice.textContent = `Preparing photo ${i + 1} of ${files.length}…`; const blob = await shrink(file); input.photos.push({ photo: await base64(blob), mimeType: blob.type }) }
    notice.textContent = 'Sending…'
    const response = await fetch('/api/cabin/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, input }) })
    const result = await response.json()
    if (!response.ok) throw Error(result.error || 'This could not be saved.')
    // The page it returns to says what was saved (?done=), and opens at the card it came from.
    const next = new URL(action.searchParams.get('returnTo') || '/app', location.origin), card = form.closest('[id]')
    next.searchParams.set('done', name); if (result.result?.id) next.searchParams.set('record', result.result.id)
    location.assign(next.pathname + next.search + (card ? '#' + card.id : ''))
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

// A month can include several reviewed costs paid from owner funds.
document.querySelector('[data-add-expense]')?.addEventListener('click', () => {
  const list = document.querySelector('[data-expense-lines]')
  if (list.querySelectorAll('[name=expenseDescription]').length >= 100) return
  for (const label of [...list.children].slice(0, 2)) { const row = label.cloneNode(true); row.querySelector('input').value = ''; list.append(row) }
})

// Calendar labels: each bar and chip label lists its forms longest first
// (data-fit, src/cabin/ui/fit.ts); show the longest that fits without cutting
// a word. Phone layouts show every label whole, as cards.
function fitLabels() {
  const whole = matchMedia('(max-width: 700px)').matches
  const fits = (line, box) => line.scrollWidth <= line.clientWidth + 0.5 && line.scrollHeight <= line.clientHeight + 0.5 && box.scrollHeight <= box.clientHeight + 0.5
  for (const box of document.querySelectorAll('.tl-track .t')) {
    const lines = [...box.querySelectorAll('[data-fit]')].map(line => [line, JSON.parse(line.dataset.fit)]), code = box.querySelector('.code')
    if (whole) { for (const [line, forms] of lines) line.textContent = forms[0]; if (code) code.hidden = false; continue }
    // The name first, then each detail line in what room is left; the door code last.
    box.parentElement.classList.remove('no-mark'); if (code) code.hidden = true
    for (const [line] of lines) line.textContent = ''
    const used = new Set(), bar = box.parentElement
    for (const [i, [line, forms]] of lines.entries()) {
      const pick = () => forms.find(form => { line.textContent = form; return !(form && used.has(form)) && fits(line, box) }) ?? forms[forms.length - 1]
      line.textContent = pick()
      // The guest's name matters more than the channel's mark beside it; a stay
      // the channel names nobody for keeps its mark, which is then its label,
      // unless even its shortest form does not fit beside it.
      const mark = bar.querySelector(':scope > .glyph') && !bar.classList.contains('no-mark')
      if (mark && ((i === 0 && line.textContent !== forms[0] && !bar.classList.contains('keep-mark')) || !fits(line, box))) { bar.classList.add('no-mark'); line.textContent = pick() }
      used.add(line.textContent)
    }
    if (code) { code.hidden = false; if (box.scrollHeight > box.clientHeight + 0.5) code.hidden = true }
    // A declined request's reason that runs past its nights: its dashed box widens to hold it.
    if (bar.classList.contains('spill')) {
      const right = Math.max(...lines.map(([line]) => { const r = document.createRange(); r.selectNodeContents(line); return r.getBoundingClientRect().right }))
      bar.style.setProperty('--lw', `${Math.ceil(right - bar.getBoundingClientRect().left + 8)}px`)
    }
  }
}
// A home's name in a calendar row breaks only between words: a word too wide for
// the label column sets the name smaller, down to 11px, and past that ends in an
// ellipsis with the whole name on hover.
function fitHomes() {
  for (const name of document.querySelectorAll('.tl-label h3')) {
    name.style.fontSize = ''; name.classList.remove('cut'); name.removeAttribute('title')
    let size = parseFloat(getComputedStyle(name).fontSize)
    while (name.scrollWidth > name.clientWidth + 0.5 && size > 11) name.style.fontSize = `${size -= 0.5}px`
    if (name.scrollWidth > name.clientWidth + 0.5) { name.classList.add('cut'); name.title = name.textContent }
  }
}
if (document.querySelector('.tl-label h3')) {
  let pending = 0
  const again = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(fitHomes) }
  fitHomes(); document.fonts?.ready.then(again); addEventListener('resize', again)
}
if (document.querySelector('.tl-track [data-fit]')) {
  let pending = 0
  const again = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(fitLabels) }
  fitLabels(); document.fonts?.ready.then(again); addEventListener('resize', again)
}
