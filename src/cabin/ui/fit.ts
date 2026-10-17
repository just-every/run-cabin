import { h } from './shared'
// A calendar label and its shorter forms, longest first. The page shows the
// longest form that fits its bar or chip (public/cabin.js, fitLabels): whole
// words then an ellipsis, never a word cut mid-way; a name ends as initials.
// The full text stays in the title and in the stay's details.
const TRAILING = /^(and|&|the|of|at|from|to|on|·|→|–|-|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i
function prefixes(text: string) {
  const words = text.split(/\s+/).filter(Boolean), out: string[] = []
  for (let k = words.length - 1; k >= 1; k--) {
    const cut = words.slice(0, k)
    while (cut.length && (TRAILING.test(cut[cut.length - 1]) || /^[\d$,.:]+$/.test(cut[cut.length - 1]))) cut.pop()
    if (cut.length) out.push(cut.join(' ').replace(/[·,:;–-]+$/, '').trimEnd() + '…')
  }
  return out
}
/** "Marcus Lee" → "ML"; "The Nguyen family" → "NF"; "Mike and Tara Dunn" → "MD". */
export function initials(name: string) {
  const words = name.split(/\s+/).filter(w => /^[a-z]/i.test(w) && !/^(the|and|of)$/i.test(w))
  return words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() : name.slice(0, 2)
}
/** "Brooke Sullivan" → "Brooke S."; a family or one-word name has none. */
export function firstAndInitial(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  return words.length >= 2 && !/^the$/i.test(words[0]) && /^[a-z]/i.test(words[words.length - 1]) ? [`${words[0]} ${words[words.length - 1][0].toUpperCase()}.`] : []
}
/** A name's forms: in full, then whole first words with an ellipsis, then initials. */
export const nameForms = (name: string, last = [initials(name)]) => [...new Set([name, ...prefixes(name), ...last])]
/** A detail line's forms: whole " · " parts first, then whole words, then nothing at all. */
export function lineForms(text: string, short: string[] = []) {
  const parts = text.split(' · '), whole = parts.slice(0, -1).map((_, i) => parts.slice(0, parts.length - 1 - i).join(' · ') + '…')
  return [...new Set([text, ...whole, ...short, ...prefixes(parts[0]), ''])]
}
export const fitted = (tag: string, forms: string[], cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} data-fit="${h(JSON.stringify(forms))}">${h(forms[0])}</${tag}>`
