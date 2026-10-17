export const h = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const owner = (s: any) => s.actor.role === 'owner'
export const manager = (s: any) => ['owner', 'manager'].includes(s.actor.role)
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100)
export const badge = (text: unknown) => `<span class="badge">${h(text)}</span>`
export const empty = (text: string) => `<p class="empty">${h(text)}</p>`
export const panel = (title: string, body: string) => `<section class="panel"><h2>${h(title)}</h2>${body}</section>`
export const field = (name: string, label: string, type = 'text', value = '', attrs = '') => `<label>${h(label)}<input name="${h(name)}" type="${h(type)}" value="${h(value)}" ${attrs} required></label>`
export const hidden = (name: string, value: unknown) => `<input type="hidden" name="${h(name)}" value="${h(value)}">`
export const select = (name: string, label: string, choices: [string, string][]) => `<label>${h(label)}<select name="${h(name)}" required><option value="">Choose…</option>${choices.map(([id,label]) => `<option value="${h(id)}">${h(label)}</option>`).join('')}</select></label>`
export const area = (name: string, label: string, value = '', attrs = '') => `<label>${h(label)}<textarea name="${h(name)}" rows="6" ${attrs} required>${h(value)}</textarea></label>`
export const form = (name: string, page: string, body: string, button: string, attrs = '') => `<form method="post" action="/app/action?name=${h(name)}&amp;returnTo=${encodeURIComponent('/app/' + page)}" ${attrs}>${body}<button type="submit">${h(button)}</button></form>`
export const approve = (name: string, page: string, record: any, text: string) => form(name, page, hidden('id', record.id) + hidden('revision', record.revision), text)
export const propertyName = (s: any, id: string) => s.properties.find((p: any) => p.id === id)?.name ?? id
export const memberName = (s: any, id: string) => s.members.find((p: any) => p.id === id)?.name ?? id
export const day = (value: string) => new Date(value.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const moment = (value: string | number) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
export const dateRange = (b: any) => `${h(day(b.start))} → ${h(day(b.end))} (checkout)`
export const heading = (eyebrow: string, title: string, text: string) => `<div class="page-heading"><p class="eyebrow">${h(eyebrow)}</p><h1>${h(title)}</h1><p>${h(text)}</p></div>`
