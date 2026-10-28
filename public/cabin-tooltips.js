// One tooltip layer keeps icon controls readable outside scrolling panels.
const labels = { Earlier: 'Earlier dates', Later: 'Later dates', Close: 'Close details' }
let timer, tip, control
const hide = () => {
 clearTimeout(timer)
 if (tip && control) {
  const ids = (control.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== tip.id)
  if (ids.length) control.setAttribute('aria-describedby', ids.join(' '))
  else control.removeAttribute('aria-describedby')
 }
 tip?.remove(); tip = undefined; control = undefined
}
const show = element => {
 hide(); control = element
 tip = document.createElement('div'); tip.id = 'cabin-icon-tooltip'; tip.role = 'tooltip'; tip.className = 'cabin-icon-tooltip'
 tip.textContent = labels[element.getAttribute('aria-label')] || element.getAttribute('aria-label')
 // The tooltip must also appear above an open stay popover.
 tip.setAttribute('popover', 'manual'); document.body.append(tip); tip.showPopover()
 control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '))
 place()
}
const place = () => {
 const box = control.getBoundingClientRect(), size = tip.getBoundingClientRect()
 tip.style.left = Math.max(8, Math.min(innerWidth - size.width - 8, box.left + (box.width - size.width) / 2)) + 'px'
 tip.style.top = (box.bottom + size.height + 8 < innerHeight ? box.bottom + 6 : Math.max(8, box.top - size.height - 6)) + 'px'
}
for (const element of document.querySelectorAll('a[aria-label], button[aria-label]')) {
 const content = element.cloneNode(true); content.querySelectorAll('svg, [aria-hidden="true"]').forEach(node => node.remove())
 if (content.textContent.trim()) continue
 element.addEventListener('mouseenter', () => { clearTimeout(timer); timer = setTimeout(() => show(element), 300) })
 element.addEventListener('mouseleave', () => { if (control === element && document.activeElement !== element) hide() })
 element.addEventListener('focus', () => show(element))
 element.addEventListener('blur', hide)
 element.addEventListener('click', hide)
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') hide() })
// Opening or focusing a popover can scroll its page after the focus event.
const moved = () => { if (tip && control === document.activeElement) place(); else hide() }
window.addEventListener('scroll', moved, true)
window.addEventListener('resize', moved)
