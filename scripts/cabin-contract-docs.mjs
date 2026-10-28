import { readFileSync, writeFileSync } from 'node:fs'
import { parseContract } from '../src/base/seed-contract.mjs'

// Update only selected clause projections. The older journey prose and
// homepage assessments remain intact until their own judged cleanup.
const args=process.argv.slice(2),mode=args[0]
if(!['write','check'].includes(mode))throw Error('Use write or check with --clauses followed by clause IDs')
const read=path=>readFileSync(path,'utf8')
let source=read('CONTRACT.md'),acceptance=read('ACCEPTANCE.md'),claims=read('docs/CLAIMS.md')
const selected=args.includes('--clauses')?args.slice(args.indexOf('--clauses')+1).flatMap(s=>s.split(',')):[]
const managed=[...claims.matchAll(/<!-- cabin-contract-docs: ([A-Z0-9-]+) -->/g)].map(m=>m[1])
const ids=[...new Set([...managed,...selected])]
const rows=source.split('\n').filter(line=>/^\| `[A-Z0-9-]+` \|/.test(line)).map(line=>{
 const cells=line.split('|').slice(1,-1).map(s=>s.trim())
 return {id:cells[0].replaceAll('`',''),title:cells[1],kind:cells[2],status:cells[3],evidence:cells[4],gap:cells[5]}
})
const counts=list=>['done','partial','missing'].map(status=>list.filter(row=>row.status===status).length)
const all=counts(rows),target=counts(rows.filter(r=>r.kind!=='published')),published=counts(rows.filter(r=>r.kind==='published'))
for(const [label,values] of [['Published',published],['Target and push further',target],['All',all]]){
 source=source.replace(new RegExp('^\\| '+label+' \\|.*$','m'),'| '+label+' | '+values.join(' | ')+' | '+values.reduce((a,b)=>a+b,0)+' |')
}
source=source.replace(/\*\*\d+ clauses: \d+ done, \d+ partial, \d+ missing\.\*\*/,'**'+rows.length+' clauses: '+all[0]+' done, '+all[1]+' partial, '+all[2]+' missing.**')
parseContract(source)
for(const id of ids){
 const row=rows.find(r=>r.id===id)
 if(!row)throw Error('Unknown clause: '+id)
 const lines=acceptance.split('\n'),start=lines.findIndex(line=>line.startsWith('- **'+id+' — '))
 if(start<0)throw Error('Missing acceptance journey: '+id)
 lines[start]=lines[start].replace(/ · (done|partial|missing)\.\*\*/, ' · '+row.status+'.**')
 let end=start+1
 while(end<lines.length&&lines[end]&&!lines[end].startsWith('- **'))end++
 const evidence=lines.slice(start+1,end).findIndex(line=>line.trimStart().startsWith('Current evidence:'))
 if(evidence<0)throw Error('Missing evidence projection: '+id)
 lines[start+1+evidence]='  Current evidence: '+(row.evidence||'none')+'.'+(row.gap?' Remaining: '+row.gap:'')
 acceptance=lines.join('\n')
 const begin='<!-- cabin-contract-docs: '+id+' -->',finish='<!-- end cabin-contract-docs: '+id+' -->'
 const block=begin+'\n### '+id+' · '+row.title+'\n\nStatus: **'+row.status+'**.\n\nEvidence: '+(row.evidence||'none')+'.\n\n'+(row.gap?'Remaining: '+row.gap:'No remaining gap.')+'\n'+finish
 const first=claims.indexOf(begin),last=claims.indexOf(finish)
 if(first>=0){if(last<first)throw Error('Incomplete generated projection: '+id);claims=claims.slice(0,first)+block+claims.slice(last+finish.length)}
 else claims=claims.trimEnd()+'\n\n'+block+'\n'
}
let stale=false
for(const [file,value] of [['CONTRACT.md',source],['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(read(file)===value)continue
 if(mode==='write')writeFileSync(file,value)
 else {console.error('Stale contract projection: '+file);stale=true}
}
if(stale)process.exitCode=1
else console.log('Contract projections '+(mode==='write'?'generated':'current')+': '+ids.join(', '))
