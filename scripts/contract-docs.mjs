import { readFileSync, writeFileSync } from 'node:fs'
import { parseContract } from '../src/base/seed-contract.mjs'

// Migrate touched assessments without replacing historical homepage commentary.
const [mode, ...args] = process.argv.slice(2)
if (!['write', 'check'].includes(mode) || args.length && (args.length !== 2 || args[0] !== '--clauses')) throw Error('Usage: contract-docs.mjs write|check [--clauses ID,ID]')
let source = readFileSync('CONTRACT.md', 'utf8')
const rows = new Map(source.split('\n').filter(line => /^\| `[A-Z][A-Z0-9-]+` \|/.test(line)).map(line => {
 const [id, title, kind, status, evidence, gap] = line.split('|').slice(1, -1).map(cell => cell.trim())
 return [id.replaceAll('`', ''), { title, kind, status, evidence, gap }]
}))
const tally = selected => ['done', 'partial', 'missing'].map(status => selected.filter(row => row.status === status).length).concat(selected.length)
const all = [...rows.values()]
for (const [label, selected] of [['Published', all.filter(row => row.kind === 'published')], ['Target and push further', all.filter(row => row.kind !== 'published')], ['All', all]]) {
 source = source.replace(new RegExp('^\\| ' + label + ' \\|.*$', 'm'), '| ' + label + ' | ' + tally(selected).join(' | ') + ' |')
}
const [done, partial, missing, total] = tally(all)
source = source.replace(/\*\*\d+ clauses: \d+ done, \d+ partial, \d+ missing\.\*\*/, `**${total} clauses: ${done} done, ${partial} partial, ${missing} missing.**`)
const contract = parseContract(source)
const files = new Map(['ACCEPTANCE.md', 'docs/CLAIMS.md'].map(file => [file, readFileSync(file, 'utf8')]))
const managed = [...new Set([...files.values()].flatMap(text => [...text.matchAll(/<!-- contract-docs:([A-Z0-9-]+):start -->/g)].map(match => match[1])))]
const ids = [...new Set([...managed, ...(args[1]?.split(',') ?? [])])]
if (!ids.length) throw Error('Select at least one touched clause with --clauses')
for (const id of ids) {
 const clause = contract.clauses.find(clause => clause.id === id), row = rows.get(id)
 if (!clause || !row) throw Error('Unknown clause: ' + id)
 const journey = clause.text.match(/\*\*Acceptance evidence:\*\*\s*([^\n]+)/)?.[1]
 if (!journey) throw Error('Missing acceptance journey: ' + id)
 const start = `<!-- contract-docs:${id}:start -->`, end = `<!-- contract-docs:${id}:end -->`
 const assessment = row.evidence + (row.gap ? ' Remaining: ' + row.gap : '')
 for (const [file, original] of files) {
  const content = file === 'ACCEPTANCE.md'
   ? `- **${id} — ${row.title} · ${row.status}.** ${journey}\n  Current evidence: ${assessment}`
   : `### ${id} — ${row.title}\n\nStatus: **${row.status}**.\n\n${assessment}`
  const block = start + '\n' + content + '\n' + end
  const first = original.indexOf(start), last = original.indexOf(end)
  let next
  if (first >= 0) {
   if (last < first) throw Error('Unclosed generated assessment in ' + file)
   next = original.slice(0, first) + block + original.slice(last + end.length)
  } else if (file === 'ACCEPTANCE.md') {
   const heading = original.indexOf('- **' + id + ' — ')
   if (heading < 0) throw Error('Missing acceptance entry: ' + id)
   const following = original.indexOf('\n\n', heading)
   next = original.slice(0, heading) + block + original.slice(following < 0 ? original.length : following)
  } else next = original.trimEnd() + '\n\n' + block + '\n'
  files.set(file, next)
 }
}
files.set('CONTRACT.md', source)
for (const [file, content] of files) {
 if (content === readFileSync(file, 'utf8')) continue
 if (mode === 'check') throw Error('Stale contract assessment: ' + file + '; run the documented Lander-Regenerate command')
 writeFileSync(file, content)
}
console.log('Contract assessments ' + (mode === 'write' ? 'generated' : 'current') + ': ' + ids.join(', '))
