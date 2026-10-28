// Regenerate selected legacy views from the authoritative contract, retaining other clauses' prose.
import {readFileSync,writeFileSync} from 'node:fs'
import {parseContract} from './seed-contract.mjs'

const [mode,flag,list]=process.argv.slice(2)
if(!['write','check'].includes(mode)||flag!=='--clauses'||!list||process.argv.length!==5)throw Error('Usage: node src/base/contract-docs.mjs write|check --clauses FIN-008')
const ids=list.split(','),source=readFileSync('CONTRACT.md','utf8'),rows=source.split('\n').filter(l=>/^\| `[^`]+` \|/.test(l)).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()))
const count=selected=>{const own=rows.filter(r=>selected.includes(r[2]));return [own.filter(r=>r[3]==='done').length,own.filter(r=>r[3]==='partial').length,own.filter(r=>r[3]==='missing').length,own.length]}
const all=count(['published','target','push-further'])
const summary=text=>text.replace(/^\| (Published|Target and push further|All) \|[^\n]+$/gm,(_,label)=>`| ${label} | ${count(label==='Published'?['published']:label==='All'?['published','target','push-further']:['target','push-further']).join(' | ')} |`)
 .replace(/\*\*\d+ clauses: \d+ done, \d+ partial, \d+ missing\.\*\*/,`**${all[3]} clauses: ${all[0]} done, ${all[1]} partial, ${all[2]} missing.**`)
let contract=summary(source)
const parsed=parseContract(contract)
let acceptance=summary(readFileSync('ACCEPTANCE.md','utf8')),claims=readFileSync('docs/CLAIMS.md','utf8')
for(const id of ids){
 const clause=parsed.clauses.find(c=>c.id===id),row=rows.find(r=>r[0]==='`'+id+'`')
 if(!clause||!row)throw Error('Unknown clause: '+id)
 const evidence=clause.text.split('**Acceptance evidence:**')[1]?.trim()
 if(!evidence)throw Error('Selected clause needs its original acceptance evidence: '+id)
 const lines=acceptance.split('\n'),start=lines.findIndex(l=>l.startsWith('- **'+id+' — '))
 if(start<0)throw Error('Missing legacy acceptance entry: '+id)
 let end=start+1
 while(end<lines.length&&!/^(?:- \*\*|## )/.test(lines[end]))end++
 const suffix=clause.status==='done'?'Assessment: ':'Remaining: '
 const block=`- **${id} — ${clause.title} · ${clause.status}.** ${evidence}\n  Current evidence: ${row[4]||'none'}. ${suffix}${row[5]}\n`
 lines.splice(start,end-start,block);acceptance=lines.join('\n')
 const begin=`<!-- contract-status:${id}:start -->`,finish=`<!-- contract-status:${id}:end -->`
 const view=`${begin}\n${id} · ${clause.title} · ${clause.status}.\n\nEvidence: ${row[4]||'none'}.\n\n${suffix}${row[5]}\n${finish}`
 const at=claims.indexOf(begin),last=claims.indexOf(finish)
 if(at<0)claims=claims.trimEnd()+'\n\n'+view+'\n'
 else{if(last<at)throw Error('Unclosed generated claim: '+id);claims=claims.slice(0,at)+view+claims.slice(last+finish.length)}
}
let changed=false
for(const [file,value,old] of [['CONTRACT.md',contract,source],['ACCEPTANCE.md',acceptance,readFileSync('ACCEPTANCE.md','utf8')],['docs/CLAIMS.md',claims,readFileSync('docs/CLAIMS.md','utf8')]]){
 if(value===old)continue
 changed=true
 if(mode==='write')writeFileSync(file,value)
 else console.error('Stale generated contract view: '+file)
}
if(mode==='check'&&changed)process.exitCode=1
else console.log(`Contract views ${mode==='write'?'regenerated':'checked'} for ${ids.join(', ')}; ${all[3]} clauses`)
