import './photo-upload.js'
import { clearDrafts } from './cleaner-draft-store.js'
// Keep successful form responses on their workspace page, including one-time credentials.
if (location.pathname === '/app/action' && document.body.dataset.page) history.replaceState(null, '', document.body.dataset.page)
// A saved-photo confirmation (?done=, with the saved ?record=) shows once; a reload does not repeat it.
if (new URLSearchParams(location.search).has('done')) { const here = new URL(location.href); here.searchParams.delete('done'); here.searchParams.delete('record'); history.replaceState(null, '', here.pathname + here.search + here.hash) }

const signOut = document.querySelector('[data-signout]')
signOut?.addEventListener('click', async () => {
  try {
    await clearDrafts()
    sessionStorage.removeItem('cabin:submitted-form')
    const response = await fetch('/auth/signout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    if (response.ok) return location.assign('/signin')
  } catch {}
  // A sign-out that did not finish leaves this browser signed in: say so.
  let notice = signOut.parentElement.querySelector('[data-signout-failed]')
  if (!notice) { notice = document.createElement('p'); notice.className = 'notice error'; notice.setAttribute('role', 'alert'); notice.dataset.signoutFailed = ''; notice.tabIndex = -1; signOut.after(notice) }
  notice.textContent = 'Sign out did not finish, so this browser is still signed in. Try again.'
  notice.focus()
})

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

// A native POST still gets the server's complete response. Keep only the
// submitted, editable values until that response arrives, then discard them.
// Passwords, one-time codes, files and hidden authority/revision fields stay out.
const recoveryKey = 'cabin:submitted-form'
try {
  const saved = JSON.parse(sessionStorage.getItem(recoveryKey) || 'null')
  sessionStorage.removeItem(recoveryKey)
  const error = document.querySelector('main')?.firstElementChild
  if (saved?.person === document.body.dataset.person && error?.matches('.notice.error[role="alert"]')) {
    const candidates = [...document.querySelectorAll('form')].filter(form => form.action === saved.action)
    const form = saved.record ? candidates.find(form => form.querySelector('input[name="id"]')?.value === saved.record) : candidates[saved.index]
    if (form) for (const [name, values] of Object.entries(saved.values)) {
      const controls = [...form.elements].filter(input => input.name === name && !['hidden', 'password', 'file'].includes(input.type))
      controls.forEach((input, index) => { const value = values[index]; if (!value) return; if (['checkbox', 'radio'].includes(input.type)) input.checked = value.checked; else input.value = value.value })
      for (const details of form.closest('details') ? [form.closest('details')] : []) details.open = true
    }
    error.tabIndex = -1; error.focus()
  }
} catch { sessionStorage.removeItem(recoveryKey) }
// Question forms are rendered back by the server without storing the prompt in
// browser recovery storage. Move keyboard focus to that server refusal as well.
if (location.pathname === '/app/questions') {
  const error = document.querySelector('main > .notice.error[role="alert"]')
  if (error) { error.tabIndex = -1; error.focus() }
}
document.addEventListener('submit', event => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const action = new URL(form.action)
  const recoverable = /^(message\.(compose|send)|thread\.(note|handover|triage|assign)|reservation\.(request|amend|move|end|cancel)|booking\.details|task\.(raise|close)|work\.(quote|invoice|complete)|turnover\.(complete|checkout))$/
  if (action.pathname !== '/app/action' || !recoverable.test(action.searchParams.get('name') || '')) return
  if ([...form.elements].some(input => ['password', 'file', 'url'].includes(input.type) || /(?:key|token|secret|password|credential|signing|authorization)/i.test(input.name || ''))) return
  const values = {}
  for (const input of form.elements) {
    if (!input.name || !['INPUT', 'TEXTAREA', 'SELECT'].includes(input.tagName) || ['hidden', 'password', 'file', 'submit', 'button'].includes(input.type) || ['one-time-code', 'new-password', 'current-password'].includes(input.autocomplete)) continue
    ;(values[input.name] ||= []).push({ value: input.value, checked: input.checked })
  }
  const peers = [...document.querySelectorAll('form')].filter(candidate => candidate.action === form.action)
  try { sessionStorage.setItem(recoveryKey, JSON.stringify({ person: document.body.dataset.person, action: form.action, record: form.querySelector('input[name="id"]')?.value || '', index: peers.indexOf(form), values })) } catch { /* The server response remains visible if browser storage is disabled. */ }
})
